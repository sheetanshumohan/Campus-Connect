const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [3000, 'Description cannot exceed 3000 characters'],
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: [300, 'Short description cannot exceed 300 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    banner: {
      type: String,
      default: '',
    },
    venue: {
      name: { type: String, required: true, trim: true },
      address: { type: String, trim: true, default: '' },
      isOnline: { type: Boolean, default: false },
      meetingLink: { type: String, default: '' },
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    registrationDeadline: {
      type: Date,
    },
    capacity: {
      total: { type: Number, required: true, min: [1, 'Capacity must be at least 1'] },
      registered: { type: Number, default: 0 },
      waitlisted: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'cancelled', 'completed'],
      default: 'draft',
    },
    organizer: {
      userId: { type: String, required: true },
      name: { type: String, required: true },
      email: { type: String, required: true },
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    price: {
      type: Number,
      default: 0, // 0 = free
      min: 0,
    },
  },
  { timestamps: true }
);

// Virtual: available spots
eventSchema.virtual('availableSpots').get(function () {
  return this.capacity.total - this.capacity.registered;
});

// Virtual: isFull
eventSchema.virtual('isFull').get(function () {
  return this.capacity.registered >= this.capacity.total;
});

eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

// Index for common queries
eventSchema.index({ status: 1, startDate: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ 'organizer.userId': 1 });

module.exports = mongoose.model('Event', eventSchema);
