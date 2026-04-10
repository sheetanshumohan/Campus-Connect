const Notification = require('../models/Notification');

// ─── @route  GET /api/notifications ──────────────────────────────────────────
const getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const query = { userId: req.user.id };
    if (unreadOnly === 'true') query.isRead = false;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).skip(skip).limit(parseInt(limit)).sort({ createdAt: -1 }),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId: req.user.id, isRead: false }),
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route  PATCH /api/notifications/:id/read ────────────────────────────────
const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found.' });

    res.json({ success: true, message: 'Notification marked as read.', data: { notification } });
  } catch (error) {
    next(error);
  }
};

// ─── @route  PATCH /api/notifications/read-all ───────────────────────────────
const markAllAsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({ success: true, message: `${result.modifiedCount} notifications marked as read.` });
  } catch (error) {
    next(error);
  }
};

// ─── @route  DELETE /api/notifications/:id ───────────────────────────────────
const deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found.' });

    res.json({ success: true, message: 'Notification deleted.' });
  } catch (error) {
    next(error);
  }
};

// ─── @route  DELETE /api/notifications ───────────────────────────────────────
const clearAllNotifications = async (req, res, next) => {
  try {
    const result = await Notification.deleteMany({ userId: req.user.id });
    res.json({ success: true, message: `${result.deletedCount} notifications cleared.` });
  } catch (error) {
    next(error);
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications };
