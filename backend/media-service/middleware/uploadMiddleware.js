const multer = require('multer');

// ── Parse allowed types from .env ─────────────────────────────────────────────
const getAllowedTypes = () => {
  const images = (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/webp,image/gif').split(',');
  const videos = (process.env.ALLOWED_VIDEO_TYPES || 'video/mp4,video/webm,video/ogg').split(',');
  return [...images, ...videos, 'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
};

const MAX_IMAGE_MB = parseInt(process.env.MAX_IMAGE_SIZE_MB || '10');
const MAX_VIDEO_MB = parseInt(process.env.MAX_VIDEO_SIZE_MB || '100');
const MAX_FILES    = parseInt(process.env.MAX_FILES_PER_REQUEST || '10');

// ── Storage: memory (buffer sent to Cloudinary stream) ────────────────────────
const storage = multer.memoryStorage();

// ── File filter ────────────────────────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const allowed = getAllowedTypes();
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type '${file.mimetype}' is not allowed.`), false);
  }
};

// ── Dynamic size limit based on mime type ─────────────────────────────────────
const limits = {
  fileSize: MAX_VIDEO_MB * 1024 * 1024, // use the larger of the two limits
  files: MAX_FILES,
};

// ── Multer instances ──────────────────────────────────────────────────────────

/** Upload a single file under field name 'file' */
const uploadSingle = multer({ storage, fileFilter, limits }).single('file');

/** Upload multiple files under field name 'files' */
const uploadMultiple = multer({ storage, fileFilter, limits }).array('files', MAX_FILES);

/** Upload fields: 'banner' (1) and 'gallery' (multiple) */
const uploadEventMedia = multer({ storage, fileFilter, limits }).fields([
  { name: 'banner', maxCount: 1 },
  { name: 'gallery', maxCount: 10 },
]);

// ── Multer error handler wrapper ──────────────────────────────────────────────
const handleUpload = (multerFn) => (req, res, next) => {
  multerFn(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE: `File too large. Max image size: ${MAX_IMAGE_MB}MB, max video: ${MAX_VIDEO_MB}MB.`,
        LIMIT_FILE_COUNT: `Too many files. Max ${MAX_FILES} files per request.`,
        LIMIT_UNEXPECTED_FILE: 'Unexpected field name in upload.',
      };
      return res.status(400).json({ success: false, message: messages[err.code] || err.message });
    }

    return res.status(400).json({ success: false, message: err.message });
  });
};

module.exports = { uploadSingle, uploadMultiple, uploadEventMedia, handleUpload };
