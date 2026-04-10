const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const {
  getEvents, getMyEvents, getEventById,
  createEvent, updateEvent, updateEventStatus,
  deleteEvent, updateCapacity,
} = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/authMiddleware');

// ─── Validation ────────────────────────────────────────────────────────────────
const eventValidation = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 150 }),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('venue.name').trim().notEmpty().withMessage('Venue name is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('capacity.total').isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
];

// ─── Public routes ────────────────────────────────────────────────────────────
router.get('/', getEvents);
router.get('/:id', getEventById);

// ─── Protected routes ─────────────────────────────────────────────────────────
router.get('/my/events', protect, authorize('organizer', 'admin'), getMyEvents);
router.post('/', protect, authorize('organizer', 'admin'), eventValidation, createEvent);
router.put('/:id', protect, authorize('organizer', 'admin'), updateEvent);
router.patch('/:id/status', protect, authorize('organizer', 'admin'), updateEventStatus);

// Admin only
router.delete('/:id', protect, authorize('admin'), deleteEvent);

// Internal route for Registration Service (capacity management)
router.patch('/:id/capacity', protect, updateCapacity);

module.exports = router;
