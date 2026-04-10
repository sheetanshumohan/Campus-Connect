const { validationResult } = require('express-validator');
const Category = require('../models/Category');

// ─── @route  GET /api/categories ─────────────────────────────────────────────
const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });
    res.json({ success: true, data: { categories } });
  } catch (error) {
    next(error);
  }
};

// ─── @route  POST /api/categories  (admin) ───────────────────────────────────
const createCategory = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }
    const category = await Category.create(req.body);
    res.status(201).json({ success: true, message: 'Category created.', data: { category } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Category already exists.' });
    }
    next(error);
  }
};

// ─── @route  PUT /api/categories/:id  (admin) ────────────────────────────────
const updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });
    res.json({ success: true, message: 'Category updated.', data: { category } });
  } catch (error) {
    next(error);
  }
};

// ─── @route  DELETE /api/categories/:id  (admin) ─────────────────────────────
const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });
    res.json({ success: true, message: 'Category deactivated.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
