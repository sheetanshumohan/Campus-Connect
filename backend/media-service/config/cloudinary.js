const cloudinary = require('cloudinary').v2;

/**
 * Configure Cloudinary with env credentials.
 * Called once at server startup.
 */
const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  console.log(`☁️  Cloudinary configured — cloud: ${process.env.CLOUDINARY_CLOUD_NAME}`);
};

/**
 * Upload a buffer to Cloudinary using upload_stream.
 *
 * @param {Buffer} buffer       - File buffer from multer memoryStorage
 * @param {Object} options      - Cloudinary upload options
 * @returns {Promise<Object>}   - Cloudinary upload result
 */
const uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    uploadStream.end(buffer);
  });
};

/**
 * Delete a media asset from Cloudinary by its public_id.
 *
 * @param {string} publicId
 * @param {string} resourceType - 'image' | 'video' | 'raw'
 */
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return result;
  } catch (error) {
    console.error(`❌ Cloudinary delete failed for ${publicId}:`, error.message);
    throw error;
  }
};

/**
 * Generate a Cloudinary transformation URL.
 * Useful for on-the-fly resizing.
 *
 * @param {string} publicId
 * @param {Object} transformations  - e.g. { width: 400, height: 400, crop: 'fill' }
 */
const getTransformedUrl = (publicId, transformations = {}) => {
  return cloudinary.url(publicId, { ...transformations, secure: true });
};

module.exports = {
  cloudinary,
  configureCloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
  getTransformedUrl,
};
