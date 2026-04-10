const { validationResult } = require('express-validator');
const crypto = require('crypto');
const User = require('../models/User');
const { generateTokens, verifyRefreshToken } = require('../utils/generateToken');
const { sendOTPEmail, sendPasswordResetEmail } = require('../utils/sendEmail');

// ─── Helper ───────────────────────────────────────────────────────────────────
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendTokenResponse = (res, user, statusCode = 200) => {
  const payload = { id: user._id, name: user.name, email: user.email, role: user.role };
  const { accessToken, refreshToken } = generateTokens(payload);
  res.status(statusCode).json({
    success: true,
    message: statusCode === 201 ? 'Registration successful' : 'Login successful',
    data: {
      user: user.toPublicJSON(),
      accessToken,
      refreshToken,
    },
  });
};

// ─── @route  POST /api/auth/register ─────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { name, email, password, role, department, year } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const otp = generateOTP();
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: role || 'student',
      department: department || '',
      year: year || '',
      otp: {
        code: otp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
      },
    });

    // Send OTP email (non-blocking)
    sendOTPEmail(user.email, user.name, otp);

    sendTokenResponse(res, user, 201);
  } catch (error) {
    next(error);
  }
};

// ─── @route  POST /api/auth/verify-otp ───────────────────────────────────────
const verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() }).select('+otp');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.isVerified) return res.status(400).json({ success: false, message: 'Email already verified.' });
    if (!user.otp?.code || user.otp.code !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }
    if (user.otp.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    user.isVerified = true;
    user.otp = undefined;
    await user.save();

    res.json({ success: true, message: 'Email verified successfully.' });
  } catch (error) {
    next(error);
  }
};

// ─── @route  POST /api/auth/login ────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Your account has been deactivated.' });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(res, user, 200);
  } catch (error) {
    next(error);
  }
};

// ─── @route  POST /api/auth/refresh ──────────────────────────────────────────
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Refresh token required.' });

    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found.' });

    const payload = { id: user._id, name: user.name, email: user.email, role: user.role };
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(payload);

    res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
  }
};

// ─── @route  POST /api/auth/forgot-password ──────────────────────────────────
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ success: true, message: 'If this email exists, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    await user.save({ validateBeforeSave: false });

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;
    sendPasswordResetEmail(user.email, user.name, resetLink);

    res.json({ success: true, message: 'If this email exists, a reset link has been sent.' });
  } catch (error) {
    next(error);
  }
};

// ─── @route  POST /api/auth/reset-password/:token ────────────────────────────
const resetPassword = async (req, res, next) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) return res.status(400).json({ success: false, message: 'Token is invalid or has expired.' });

    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successful. Please login.' });
  } catch (error) {
    next(error);
  }
};

// ─── @route  POST /api/auth/logout ───────────────────────────────────────────
const logout = async (req, res) => {
  // Stateless logout — client discards token
  // Optionally: add token to a blacklist (Redis) in production
  res.json({ success: true, message: 'Logged out successfully.' });
};

module.exports = { register, login, verifyOTP, refreshToken, forgotPassword, resetPassword, logout };
