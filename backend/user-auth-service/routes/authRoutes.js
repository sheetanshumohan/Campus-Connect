const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const {
  register, login, verifyOTP, refreshToken,
  forgotPassword, resetPassword, logout,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// ─── Validation Rules ──────────────────────────────────────────────────────────
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['student', 'organizer', 'admin']).withMessage('Invalid role'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/verify-otp', verifyOTP);
router.post('/refresh', refreshToken);
router.post('/forgot-password', body('email').isEmail(), forgotPassword);
router.post('/reset-password/:token', body('password').isLength({ min: 6 }), resetPassword);
router.post('/logout', protect, logout);

module.exports = router;
