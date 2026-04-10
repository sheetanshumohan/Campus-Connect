const Media = require('../models/Media');
const { uploadToCloudinary, deleteFromCloudinary, getTransformedUrl } = require('../config/cloudinary');

const BASE_FOLDER = process.env.CLOUDINARY_BASE_FOLDER || 'campus-connect';

// ── Determine resource type and Cloudinary folder from MIME ───────────────────
const resolveUploadOptions = (mimetype, category, entityId) => {
  const isVideo = mimetype.startsWith('video/');
  const isImage = mimetype.startsWith('image/');
  const isRaw   = !isVideo && !isImage;

  const resourceType = isVideo ? 'video' : isImage ? 'image' : 'raw';
  const folder = `${BASE_FOLDER}/${category}${entityId ? `/${entityId}` : ''}`;

  const options = {
    resource_type: resourceType,
    folder,
    use_filename: false,
    unique_filename: true,
    overwrite: false,
  };

  // Apply image transformations for avatars (auto-crop to square)
  if (category === 'avatar' && isImage) {
    options.transformation = [{ width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' }];
  }

  // Apply compression for event banners
  if (category === 'event_banner' && isImage) {
    options.transformation = [{ width: 1200, height: 630, crop: 'fill', quality: 'auto:good', fetch_format: 'auto' }];
  }

  // Auto-generate thumbnail for videos
  if (isVideo) {
    options.eager = [{ resource_type: 'image', format: 'jpg', transformation: [{ width: 640, height: 360, crop: 'fill' }] }];
    options.eager_async = true;
  }

  return { resourceType, options };
};

// ─── @route  POST /api/media/upload  (single file) ───────────────────────────
const uploadSingle = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded. Use field name "file".' });
    }

    const { category = 'general', entityType = null, entityId = null, altText = '', caption = '' } = req.body;
    const { resourceType, options } = resolveUploadOptions(req.file.mimetype, category, entityId);

    // Upload buffer → Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, options);

    const media = await Media.create({
      uploadedBy: { userId: req.user.id, name: req.user.name, email: req.user.email },
      category,
      entityType: entityType || null,
      entityId: entityId || null,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      resourceType,
      format: result.format,
      sizeBytes: req.file.size,
      cloudinaryPublicId: result.public_id,
      url: result.url,
      secureUrl: result.secure_url,
      width: result.width || null,
      height: result.height || null,
      duration: result.duration || null,
      thumbnailUrl: result.eager?.[0]?.secure_url || '',
      altText,
      caption,
    });

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully.',
      data: { media },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route  POST /api/media/upload/multiple  (array of files) ───────────────
const uploadMultiple = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded. Use field name "files".' });
    }

    const { category = 'general', entityType = null, entityId = null } = req.body;

    const uploadPromises = req.files.map(async (file) => {
      const { resourceType, options } = resolveUploadOptions(file.mimetype, category, entityId);
      const result = await uploadToCloudinary(file.buffer, options);

      return Media.create({
        uploadedBy: { userId: req.user.id, name: req.user.name, email: req.user.email },
        category,
        entityType: entityType || null,
        entityId: entityId || null,
        originalName: file.originalname,
        mimeType: file.mimetype,
        resourceType,
        format: result.format,
        sizeBytes: file.size,
        cloudinaryPublicId: result.public_id,
        url: result.url,
        secureUrl: result.secure_url,
        width: result.width || null,
        height: result.height || null,
        duration: result.duration || null,
        thumbnailUrl: result.eager?.[0]?.secure_url || '',
      });
    });

    const mediaList = await Promise.all(uploadPromises);

    res.status(201).json({
      success: true,
      message: `${mediaList.length} file(s) uploaded successfully.`,
      data: { media: mediaList, count: mediaList.length },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route  POST /api/media/upload/event  (banner + gallery) ────────────────
const uploadEventMedia = async (req, res, next) => {
  try {
    const { entityId } = req.body;
    if (!entityId) {
      return res.status(400).json({ success: false, message: 'entityId (event ID) is required.' });
    }

    const uploaded = { banner: null, gallery: [] };

    // ── Banner ────────────────────────────────────────────────────────────────
    if (req.files?.banner?.[0]) {
      const file = req.files.banner[0];
      const { resourceType, options } = resolveUploadOptions(file.mimetype, 'event_banner', entityId);
      const result = await uploadToCloudinary(file.buffer, options);

      uploaded.banner = await Media.create({
        uploadedBy: { userId: req.user.id, name: req.user.name, email: req.user.email },
        category: 'event_banner',
        entityType: 'event',
        entityId,
        originalName: file.originalname,
        mimeType: file.mimetype,
        resourceType,
        format: result.format,
        sizeBytes: file.size,
        cloudinaryPublicId: result.public_id,
        url: result.url,
        secureUrl: result.secure_url,
        width: result.width,
        height: result.height,
      });
    }

    // ── Gallery ───────────────────────────────────────────────────────────────
    if (req.files?.gallery?.length > 0) {
      const galleryPromises = req.files.gallery.map(async (file) => {
        const { resourceType, options } = resolveUploadOptions(file.mimetype, 'event_gallery', entityId);
        const result = await uploadToCloudinary(file.buffer, options);

        return Media.create({
          uploadedBy: { userId: req.user.id, name: req.user.name, email: req.user.email },
          category: 'event_gallery',
          entityType: 'event',
          entityId,
          originalName: file.originalname,
          mimeType: file.mimetype,
          resourceType,
          format: result.format,
          sizeBytes: file.size,
          cloudinaryPublicId: result.public_id,
          url: result.url,
          secureUrl: result.secure_url,
          width: result.width,
          height: result.height,
        });
      });

      uploaded.gallery = await Promise.all(galleryPromises);
    }

    if (!uploaded.banner && uploaded.gallery.length === 0) {
      return res.status(400).json({ success: false, message: 'No files found. Use "banner" or "gallery" field names.' });
    }

    res.status(201).json({
      success: true,
      message: 'Event media uploaded successfully.',
      data: uploaded,
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route  GET /api/media  (list with filters) ─────────────────────────────
const getMedia = async (req, res, next) => {
  try {
    const { category, entityType, entityId, resourceType, page = 1, limit = 20 } = req.query;
    const query = { isActive: true };

    if (category) query.category = category;
    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;
    if (resourceType) query.resourceType = resourceType;

    // Non-admins can only see their own media
    if (req.user.role !== 'admin') {
      query['uploadedBy.userId'] = req.user.id;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [media, total] = await Promise.all([
      Media.find(query).skip(skip).limit(parseInt(limit)).sort({ createdAt: -1 }),
      Media.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        media,
        pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route  GET /api/media/entity/:entityType/:entityId ─────────────────────
// Public: get all active media for a specific event or user
const getMediaByEntity = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const { category } = req.query;
    const query = { entityType, entityId, isActive: true };
    if (category) query.category = category;

    const media = await Media.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: { media, count: media.length } });
  } catch (error) {
    next(error);
  }
};

// ─── @route  GET /api/media/:id ───────────────────────────────────────────────
const getMediaById = async (req, res, next) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media || !media.isActive) {
      return res.status(404).json({ success: false, message: 'Media not found.' });
    }
    res.json({ success: true, data: { media } });
  } catch (error) {
    next(error);
  }
};

// ─── @route  GET /api/media/:id/transform  (on-the-fly resizing) ─────────────
const getTransformed = async (req, res, next) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ success: false, message: 'Media not found.' });

    const { width, height, crop = 'fill', quality = 'auto', format = 'auto' } = req.query;
    const transformations = {};
    if (width) transformations.width = parseInt(width);
    if (height) transformations.height = parseInt(height);
    if (crop) transformations.crop = crop;
    transformations.quality = quality;
    transformations.fetch_format = format;

    const transformedUrl = getTransformedUrl(media.cloudinaryPublicId, transformations);
    res.json({ success: true, data: { transformedUrl, originalUrl: media.secureUrl } });
  } catch (error) {
    next(error);
  }
};

// ─── @route  PATCH /api/media/:id ─────────────────────────────────────────────
const updateMedia = async (req, res, next) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ success: false, message: 'Media not found.' });

    // Only uploader or admin can update
    if (media.uploadedBy.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const allowed = ['altText', 'caption', 'entityType', 'entityId'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) media[field] = req.body[field];
    });

    await media.save();
    res.json({ success: true, message: 'Media updated.', data: { media } });
  } catch (error) {
    next(error);
  }
};

// ─── @route  DELETE /api/media/:id ───────────────────────────────────────────
const deleteMedia = async (req, res, next) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ success: false, message: 'Media not found.' });

    // Only uploader or admin can delete
    if (media.uploadedBy.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    // Delete from Cloudinary first
    await deleteFromCloudinary(media.cloudinaryPublicId, media.resourceType);

    // Remove from DB
    await Media.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Media deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

// ─── @route  DELETE /api/media/entity/:entityType/:entityId (admin/organizer) ─
const deleteEntityMedia = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const mediaList = await Media.find({ entityType, entityId });

    if (mediaList.length === 0) {
      return res.json({ success: true, message: 'No media found for this entity.' });
    }

    // Delete each from Cloudinary
    await Promise.allSettled(
      mediaList.map((m) => deleteFromCloudinary(m.cloudinaryPublicId, m.resourceType))
    );

    // Delete all from DB
    await Media.deleteMany({ entityType, entityId });

    res.json({ success: true, message: `${mediaList.length} media file(s) deleted.` });
  } catch (error) {
    next(error);
  }
};

// ─── @route  GET /api/media/stats (admin) ────────────────────────────────────
const getStats = async (req, res, next) => {
  try {
    const [total, byCategory, byResourceType, totalSize] = await Promise.all([
      Media.countDocuments({ isActive: true }),
      Media.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
      Media.aggregate([{ $group: { _id: '$resourceType', count: { $sum: 1 } } }]),
      Media.aggregate([{ $group: { _id: null, totalBytes: { $sum: '$sizeBytes' } } }]),
    ]);

    res.json({
      success: true,
      data: {
        total,
        byCategory: byCategory.reduce((acc, { _id, count }) => ({ ...acc, [_id]: count }), {}),
        byResourceType: byResourceType.reduce((acc, { _id, count }) => ({ ...acc, [_id]: count }), {}),
        totalSizeMB: ((totalSize[0]?.totalBytes || 0) / (1024 * 1024)).toFixed(2),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
