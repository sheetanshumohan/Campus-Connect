const express = require('express');
const router = express.Router();
const {
  uploadSingle,
  uploadMultiple,
  uploadEventMedia,
  getMedia,
  getMediaByEntity,
  getMediaById,
  getTransformed,
  updateMedia,
  deleteMedia,
  deleteEntityMedia,
  getStats,
} = require('../controllers/mediaController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadSingle: multerSingle, uploadMultiple: multerMultiple, uploadEventMedia: multerEvent, handleUpload } = require('../middleware/uploadMiddleware');

// ─── Upload routes ────────────────────────────────────────────────────────────

// Single file upload  → field name: "file"
router.post('/upload', protect, handleUpload(multerSingle), uploadSingle);

// Multiple files      → field name: "files" (up to 10)
router.post('/upload/multiple', protect, handleUpload(multerMultiple), uploadMultiple);

// Event banner + gallery → field names: "banner", "gallery"
router.post('/upload/event', protect, authorize('organizer', 'admin'), handleUpload(multerEvent), uploadEventMedia);

// ─── Query routes ─────────────────────────────────────────────────────────────

// Admin stats
router.get('/stats', protect, authorize('admin'), getStats);

// List media (admin sees all, others see own)
router.get('/', protect, getMedia);

// Public: get all media for a specific entity (e.g. event gallery)
router.get('/entity/:entityType/:entityId', getMediaByEntity);

// On-the-fly Cloudinary transformation URL
router.get('/:id/transform', getTransformed);

// Single media detail
router.get('/:id', getMediaById);

// ─── Mutation routes ──────────────────────────────────────────────────────────

// Update metadata (altText, caption, entity link)
router.patch('/:id', protect, updateMedia);

// Delete single media (uploader or admin)
router.delete('/:id', protect, deleteMedia);

// Bulk delete all media for an entity (organizer/admin)
router.delete('/entity/:entityType/:entityId', protect, authorize('organizer', 'admin'), deleteEntityMedia);

module.exports = router;
