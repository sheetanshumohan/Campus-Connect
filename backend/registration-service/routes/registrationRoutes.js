const express = require('express');
const router = express.Router();
const {
  registerForEvent,
  getMyRegistrations,
  getMyPastEvents,
  getMyUpcomingEvents,
  getMyEventHistory,
  getEventRegistrations,
  getRegistrationById,
  cancelRegistration,
  checkInAttendee,
} = require('../controllers/registrationController');
const { getEventWaitlist, getMyWaitlistPosition } = require('../controllers/waitlistController');
const { protect, authorize } = require('../middleware/authMiddleware');

// ─── All routes require authentication ───────────────────────────────────────

// Register for an event
router.post('/', protect, registerForEvent);

// ── My event history routes (must come BEFORE /my/:id to avoid conflicts) ────
router.get('/my/past',     protect, getMyPastEvents);      // past events only
router.get('/my/upcoming', protect, getMyUpcomingEvents);  // future events only
router.get('/my/history',  protect, getMyEventHistory);    // full stats + recent

// My registrations (all, with optional ?status= filter)
router.get('/my', protect, getMyRegistrations);

// Single registration
router.get('/:id', protect, getRegistrationById);

// Cancel registration
router.delete('/:id', protect, cancelRegistration);

// Check-in attendee (organizer/admin)
router.patch('/:id/checkin', protect, authorize('organizer', 'admin'), checkInAttendee);

// All registrations for an event (organizer/admin)
router.get('/event/:eventId', protect, authorize('organizer', 'admin'), getEventRegistrations);

// Waitlist for an event (organizer/admin)
router.get('/waitlist/:eventId', protect, authorize('organizer', 'admin'), getEventWaitlist);

// My waitlist position for an event
router.get('/waitlist/my/:eventId', protect, getMyWaitlistPosition);

module.exports = router;
