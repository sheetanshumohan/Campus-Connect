const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { getCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public
router.get('/', getCategories);

// Admin only
router.post('/', protect, authorize('admin'), [
  body('name').trim().notEmpty().withMessage('Category name is required').isLength({ max: 50 }),
  body('color').optional().isHexColor().withMessage('Invalid hex color'),
], createCategory);

router.put('/:id', protect, authorize('admin'), updateCategory);
router.delete('/:id', protect, authorize('admin'), deleteCategory);

module.exports = router;
