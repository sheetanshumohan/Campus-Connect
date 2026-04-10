const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const {
  getProfile, updateProfile, changePassword,
  getAllUsers, getUserById, changeUserRole, toggleUserStatus,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

// ─── Current user routes (protected) ─────────────────────────────────────────
router.get('/profile', protect, getProfile);
router.put('/profile', protect, [
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('bio').optional().isLength({ max: 500 }),
], updateProfile);
router.put('/change-password', protect, changePassword);

// ─── Admin routes ─────────────────────────────────────────────────────────────
router.get('/', protect, authorize('admin'), getAllUsers);
router.get('/:id', protect, authorize('admin'), getUserById);
router.patch('/:id/role', protect, authorize('admin'), changeUserRole);
router.patch('/:id/status', protect, authorize('admin'), toggleUserStatus);

module.exports = router;
