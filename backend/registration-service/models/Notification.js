const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
    },
    type: {
      type: String,
      enum: [
        'registration_confirmed',
        'registration_cancelled',
        'waitlist_added',
        'waitlist_promoted',
        'event_reminder',
        'event_update',
        'event_cancelled',
        'general',
      ],
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    relatedEventId: {
      type: String,
      default: null,
    },
    relatedEventTitle: {
      type: String,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailSentAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
