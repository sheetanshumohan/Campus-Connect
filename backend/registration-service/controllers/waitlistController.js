const Waitlist = require('../models/Waitlist');

// ─── @route  GET /api/registrations/waitlist/:eventId  (organizer/admin) ─────
const getEventWaitlist = async (req, res, next) => {
  try {
    const waitlist = await Waitlist.find({
      eventId: req.params.eventId,
      status: 'waiting',
    }).sort({ position: 1 });

    res.json({
      success: true,
      data: { waitlist, count: waitlist.length },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route  GET /api/registrations/waitlist/my/:eventId ─────────────────────
const getMyWaitlistPosition = async (req, res, next) => {
  try {
    const entry = await Waitlist.findOne({
      userId: req.user.id,
      eventId: req.params.eventId,
    });

    if (!entry) {
      return res.status(404).json({ success: false, message: 'You are not on the waitlist for this event.' });
    }

    res.json({ success: true, data: { waitlistEntry: entry } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getEventWaitlist, getMyWaitlistPosition };
