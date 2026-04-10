const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const registrationSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      unique: true,
      default: () => `TKT-${uuidv4().slice(0, 8).toUpperCase()}`,
    },
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
    eventDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['confirmed', 'waitlisted', 'cancelled', 'attended'],
      default: 'confirmed',
    },
    cancelledAt: {
      type: Date,
    },
    cancelReason: {
      type: String,
      default: '',
    },
    checkedIn: {
      type: Boolean,
      default: false,
    },
    checkedInAt: {
      type: Date,
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: '',
    },
  },
  { timestamps: true }
);

// Indexes
registrationSchema.index({ userId: 1 });
registrationSchema.index({ eventId: 1 });
registrationSchema.index({ userId: 1, eventId: 1 }, { unique: true });
registrationSchema.index({ status: 1 });

module.exports = mongoose.model('Registration', registrationSchema);
