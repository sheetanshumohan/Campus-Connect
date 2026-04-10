const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
    },
    userEmail: {
      type: String,
      required: [true, 'User email is required'],
    },
    userName: {
      type: String,
      required: [true, 'User name is required'],
    },
    eventId: {
      type: String,
      required: [true, 'Event ID is required'],
    },
    eventTitle: {
      type: String,
      required: [true, 'Event title is required'],
    },
    position: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['waiting', 'promoted', 'expired', 'removed'],
      default: 'waiting',
    },
    promotedAt: {
      type: Date,
    },
    // When a spot opens, user has this long to confirm
    offerExpiresAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

waitlistSchema.index({ eventId: 1, position: 1 });
waitlistSchema.index({ userId: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model('Waitlist', waitlistSchema);
