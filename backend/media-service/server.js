require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/db');
const { configureCloudinary } = require('./config/cloudinary');
const mediaRoutes = require('./routes/mediaRoutes');

const app = express();

// ─── Connect Services ─────────────────────────────────────────────────────────
connectDB();
configureCloudinary();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// NOTE: Do NOT use express.json() body size limit — multer handles multipart independently.
// express.json is only for non-file JSON requests.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/media', mediaRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Media Service',
    port: process.env.PORT,
    cloudinary: process.env.CLOUDINARY_CLOUD_NAME || 'not configured',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log(`🚀 Media Service running on http://localhost:${PORT}`);
  console.log(`📋 Routes: /api/media`);
  console.log(`📦 Limits: Images ${process.env.MAX_IMAGE_SIZE_MB || 10}MB | Videos ${process.env.MAX_VIDEO_SIZE_MB || 100}MB | Max ${process.env.MAX_FILES_PER_REQUEST || 10} files`);
});
