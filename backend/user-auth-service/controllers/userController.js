const { validationResult } = require('express-validator');
const User = require('../models/User');

// ─── @route  GET /api/users/profile ──────────────────────────────────────────
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: { user: user.toPublicJSON() } });
  } catch (error) {
    next(error);
  }
};

// ─── @route  PUT /api/users/profile ──────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const allowedFields = ['name', 'department', 'year', 'bio', 'avatar'];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, message: 'Profile updated successfully.', data: { user: user.toPublicJSON() } });
  } catch (error) {
    next(error);
  }
};

// ─── @route  PUT /api/users/change-password ──────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully. Please login again.' });
  } catch (error) {
    next(error);
  }
};

// ─── @route  GET /api/users  (admin) ─────────────────────────────────────────
const getAllUsers = async (req, res, next) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(query).skip(skip).limit(parseInt(limit)).sort({ createdAt: -1 }),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        users: users.map((u) => u.toPublicJSON()),
        pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route  GET /api/users/:id  (admin) ─────────────────────────────────────
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: { user: user.toPublicJSON() } });
  } catch (error) {
    next(error);
  }
};

// ─── @route  PATCH /api/users/:id/role  (admin) ──────────────────────────────
const changeUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const validRoles = ['student', 'organizer', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `Role must be one of: ${validRoles.join(', ')}` });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    res.json({ success: true, message: `User role updated to '${role}'.`, data: { user: user.toPublicJSON() } });
  } catch (error) {
    next(error);
  }
};

// ─── @route  PATCH /api/users/:id/status  (admin) ────────────────────────────
const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully.`,
      data: { user: user.toPublicJSON() },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile, changePassword, getAllUsers, getUserById, changeUserRole, toggleUserStatus };
