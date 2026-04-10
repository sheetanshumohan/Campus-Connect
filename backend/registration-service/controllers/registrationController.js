const axios = require('axios');
const Registration = require('../models/Registration');
const Waitlist = require('../models/Waitlist');
const Notification = require('../models/Notification');
const {
  sendRegistrationConfirmation,
  sendWaitlistEmail,
  sendWaitlistPromotionEmail,
  sendCancellationEmail,
} = require('../utils/sendEmail');

const EVENT_SERVICE_URL = process.env.EVENT_SERVICE_URL || 'http://localhost:3002';

// ─── Helper: create in-app notification ───────────────────────────────────────
const createNotification = async (userId, type, title, message, eventId = null, eventTitle = null) => {
  try {
    await Notification.create({ userId, type, title, message, relatedEventId: eventId, relatedEventTitle: eventTitle });
  } catch (err) {
    console.error('Notification creation failed:', err.message);
  }
};

// ─── @route  POST /api/registrations ─────────────────────────────────────────
// Register the current user for an event
const registerForEvent = async (req, res, next) => {
  try {
    const { eventId, eventTitle, eventDate, notes } = req.body;
    const { id: userId, name: userName, email: userEmail } = req.user;

    if (!eventId || !eventTitle) {
      return res.status(400).json({ success: false, message: 'eventId and eventTitle are required.' });
    }

    // Check duplicate registration (including waitlist)
    const existing = await Registration.findOne({ userId, eventId });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: existing.status === 'waitlisted'
          ? 'You are already on the waitlist for this event.'
          : 'You are already registered for this event.',
      });
    }

    // ── Ask Event Service to increment capacity ────────────────────────────────
    let isFull = false;
    try {
      const { data } = await axios.patch(
        `${EVENT_SERVICE_URL}/api/events/${eventId}/capacity`,
        { action: 'increment' },
        { headers: { Authorization: req.headers.authorization } }
      );
      isFull = data.data?.isFull || false;
    } catch (err) {
      if (err.response?.status === 409) {
        // Event is full — add to waitlist
        isFull = true;
      } else {
        return res.status(502).json({ success: false, message: 'Event service unavailable. Please try again.' });
      }
    }

    if (isFull) {
      // ── Add to waitlist ────────────────────────────────────────────────────
      const waitlistCount = await Waitlist.countDocuments({ eventId, status: 'waiting' });

      // Also check waitlist duplicate
      const onWaitlist = await Waitlist.findOne({ userId, eventId });
      if (onWaitlist) {
        return res.status(409).json({ success: false, message: 'You are already on the waitlist.' });
      }

      const waitlistEntry = await Waitlist.create({
        userId, userEmail, userName, eventId, eventTitle,
        position: waitlistCount + 1,
      });

      // Update event waitlist count
      await axios.patch(
        `${EVENT_SERVICE_URL}/api/events/${eventId}/capacity`,
        { action: 'waitlist-increment' },
        { headers: { Authorization: req.headers.authorization } }
      ).catch(() => {});

      // Save as waitlisted registration for history
      const registration = await Registration.create({
        userId, userEmail, userName, eventId, eventTitle, eventDate,
        status: 'waitlisted', notes,
      });

      // Notify
      sendWaitlistEmail(userEmail, userName, eventTitle, waitlistEntry.position);
      createNotification(userId, 'waitlist_added', 'Added to Waitlist',
        `You've been added to the waitlist for "${eventTitle}" at position #${waitlistEntry.position}.`, eventId, eventTitle);

      return res.status(201).json({
        success: true,
        message: `Event is full. You've been added to the waitlist at position #${waitlistEntry.position}.`,
        data: { registration, waitlistPosition: waitlistEntry.position },
      });
    }

    // ── Confirmed registration ─────────────────────────────────────────────────
    const registration = await Registration.create({
      userId, userEmail, userName, eventId, eventTitle, eventDate, notes, status: 'confirmed',
    });

    sendRegistrationConfirmation(userEmail, userName, eventTitle, eventDate, registration.ticketNumber);
    createNotification(userId, 'registration_confirmed', 'Registration Confirmed! 🎉',
      `Your spot for "${eventTitle}" is confirmed. Ticket: ${registration.ticketNumber}`, eventId, eventTitle);

    res.status(201).json({
      success: true,
      message: 'Registration successful!',
      data: { registration },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route  GET /api/registrations/my ───────────────────────────────────────
const getMyRegistrations = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = { userId: req.user.id };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [registrations, total] = await Promise.all([
      Registration.find(query).skip(skip).limit(parseInt(limit)).sort({ createdAt: -1 }),
      Registration.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        registrations,
        pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route  GET /api/registrations/event/:eventId  (organizer/admin) ────────
const getEventRegistrations = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const query = { eventId: req.params.eventId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [registrations, total] = await Promise.all([
      Registration.find(query).skip(skip).limit(parseInt(limit)).sort({ createdAt: 1 }),
      Registration.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        registrations,
        pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route  GET /api/registrations/:id ──────────────────────────────────────
const getRegistrationById = async (req, res, next) => {
  try {
    const registration = await Registration.findById(req.params.id);
    if (!registration) return res.status(404).json({ success: false, message: 'Registration not found.' });

    // Only the registrant or admin/organizer can view
    if (registration.userId !== req.user.id && !['admin', 'organizer'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    res.json({ success: true, data: { registration } });
  } catch (error) {
    next(error);
  }
};

// ─── @route  DELETE /api/registrations/:id ───────────────────────────────────
const cancelRegistration = async (req, res, next) => {
  try {
    const registration = await Registration.findById(req.params.id);
    if (!registration) return res.status(404).json({ success: false, message: 'Registration not found.' });

    // Only the registrant or admin can cancel
    if (registration.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this registration.' });
    }

    if (registration.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Registration is already cancelled.' });
    }

    const wasConfirmed = registration.status === 'confirmed';

    registration.status = 'cancelled';
    registration.cancelledAt = new Date();
    registration.cancelReason = req.body.reason || '';
    await registration.save();

    // Notify user of cancellation
    sendCancellationEmail(registration.userEmail, registration.userName, registration.eventTitle);
    createNotification(registration.userId, 'registration_cancelled', 'Registration Cancelled',
      `Your registration for "${registration.eventTitle}" has been cancelled.`,
      registration.eventId, registration.eventTitle);

    if (wasConfirmed) {
      // Decrement event capacity
      await axios.patch(
        `${EVENT_SERVICE_URL}/api/events/${registration.eventId}/capacity`,
        { action: 'decrement' },
        { headers: { Authorization: req.headers.authorization } }
      ).catch(() => {});

      // ── Promote next waitlisted user ─────────────────────────────────────
      const nextInLine = await Waitlist.findOne({
        eventId: registration.eventId,
        status: 'waiting',
      }).sort({ position: 1 });

      if (nextInLine) {
        nextInLine.status = 'promoted';
        nextInLine.promotedAt = new Date();
        await nextInLine.save();

        // Update their registration record
        await Registration.findOneAndUpdate(
          { userId: nextInLine.userId, eventId: registration.eventId },
          { status: 'confirmed' }
        );

        // Decrement waitlist count on event service
        await axios.patch(
          `${EVENT_SERVICE_URL}/api/events/${registration.eventId}/capacity`,
          { action: 'waitlist-decrement' },
          { headers: { Authorization: req.headers.authorization } }
        ).catch(() => {});

        // Increment confirmed count
        await axios.patch(
          `${EVENT_SERVICE_URL}/api/events/${registration.eventId}/capacity`,
          { action: 'increment' },
          { headers: { Authorization: req.headers.authorization } }
        ).catch(() => {});

        // Get their registration for ticket number
        const promotedReg = await Registration.findOne({
          userId: nextInLine.userId, eventId: registration.eventId,
        });

        sendWaitlistPromotionEmail(nextInLine.userEmail, nextInLine.userName, nextInLine.eventTitle, promotedReg?.ticketNumber || 'N/A');
        createNotification(nextInLine.userId, 'waitlist_promoted', '🎉 You Got a Spot!',
          `A spot opened up for "${nextInLine.eventTitle}" and you've been confirmed!`,
          registration.eventId, registration.eventTitle);
      }
    } else if (registration.status === 'waitlisted') {
      // Remove from waitlist and decrement waitlist counter
      await Waitlist.findOneAndUpdate(
        { userId: registration.userId, eventId: registration.eventId },
        { status: 'removed' }
      );
      await axios.patch(
        `${EVENT_SERVICE_URL}/api/events/${registration.eventId}/capacity`,
        { action: 'waitlist-decrement' },
        { headers: { Authorization: req.headers.authorization } }
      ).catch(() => {});
    }

    res.json({ success: true, message: 'Registration cancelled successfully.' });
  } catch (error) {
    next(error);
  }
};

// ─── @route  PATCH /api/registrations/:id/checkin  (organizer/admin) ─────────
const checkInAttendee = async (req, res, next) => {
  try {
    const registration = await Registration.findById(req.params.id);
    if (!registration) return res.status(404).json({ success: false, message: 'Registration not found.' });
    if (registration.status !== 'confirmed') {
      return res.status(400).json({ success: false, message: 'Only confirmed registrations can be checked in.' });
    }

    registration.checkedIn = true;
    registration.checkedInAt = new Date();
    registration.status = 'attended';
    await registration.save();

    res.json({ success: true, message: `${registration.userName} checked in successfully.`, data: { registration } });
  } catch (error) {
    next(error);
  }
};

// ─── @route  GET /api/registrations/my/past ──────────────────────────────────
// Returns events whose eventDate has already passed
const getMyPastEvents = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const now = new Date();

    const query = {
      userId: req.user.id,
      eventDate: { $lt: now },           // event date is in the past
      status: { $in: ['confirmed', 'attended', 'cancelled'] },
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [registrations, total] = await Promise.all([
      Registration.find(query).skip(skip).limit(parseInt(limit)).sort({ eventDate: -1 }),
      Registration.countDocuments(query),
    ]);

    // Quick summary counts
    const [attendedCount, confirmedCount, cancelledCount] = await Promise.all([
      Registration.countDocuments({ userId: req.user.id, eventDate: { $lt: now }, status: 'attended' }),
      Registration.countDocuments({ userId: req.user.id, eventDate: { $lt: now }, status: 'confirmed' }),
      Registration.countDocuments({ userId: req.user.id, eventDate: { $lt: now }, status: 'cancelled' }),
    ]);

    res.json({
      success: true,
      data: {
        registrations,
        summary: { total, attended: attendedCount, missed: confirmedCount, cancelled: cancelledCount },
        pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route  GET /api/registrations/my/upcoming ───────────────────────────────
// Returns events the user is registered for that haven't happened yet
const getMyUpcomingEvents = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const now = new Date();

    const query = {
      userId: req.user.id,
      eventDate: { $gte: now },          // event date is in the future
      status: { $in: ['confirmed', 'waitlisted'] },
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [registrations, total] = await Promise.all([
      Registration.find(query).skip(skip).limit(parseInt(limit)).sort({ eventDate: 1 }), // nearest first
      Registration.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        registrations,
        pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route  GET /api/registrations/my/history ───────────────────────────────
// Full event history — all registrations grouped by status with overall stats
const getMyEventHistory = async (req, res, next) => {
  try {
    const now = new Date();
    const userId = req.user.id;

    const [all, past, upcoming, attended, waitlisted, cancelled] = await Promise.all([
      Registration.countDocuments({ userId }),
      Registration.countDocuments({ userId, eventDate: { $lt: now }, status: { $ne: 'cancelled' } }),
      Registration.countDocuments({ userId, eventDate: { $gte: now }, status: { $in: ['confirmed', 'waitlisted'] } }),
      Registration.countDocuments({ userId, status: 'attended' }),
      Registration.countDocuments({ userId, status: 'waitlisted' }),
      Registration.countDocuments({ userId, status: 'cancelled' }),
    ]);

    // Last 5 most recent registrations
    const recent = await Registration.find({ userId }).sort({ createdAt: -1 }).limit(5);

    res.json({
      success: true,
      data: {
        stats: { total: all, past, upcoming, attended, waitlisted, cancelled },
        recentRegistrations: recent,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerForEvent,
  getMyRegistrations,
  getMyPastEvents,
  getMyUpcomingEvents,
  getMyEventHistory,
  getEventRegistrations,
  getRegistrationById,
  cancelRegistration,
  checkInAttendee,
};
