const { validationResult } = require('express-validator');
const Event = require('../models/Event');

// ─── @route  GET /api/events ──────────────────────────────────────────────────
const getEvents = async (req, res, next) => {
  try {
    const { category, status = 'published', search, startDate, endDate, page = 1, limit = 12, sort = '-startDate' } = req.query;

    const query = { status };
    if (category) query.category = { $regex: category, $options: 'i' };
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [events, total] = await Promise.all([
      Event.find(query).skip(skip).limit(parseInt(limit)).sort(sort),
      Event.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        events,
        pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route  GET /api/events/my ──────────────────────────────────────────────
const getMyEvents = async (req, res, next) => {
  try {
    const events = await Event.find({ 'organizer.userId': req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: { events } });
  } catch (error) {
    next(error);
  }
};

// ─── @route  GET /api/events/:id ─────────────────────────────────────────────
const getEventById = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, data: { event } });
  } catch (error) {
    next(error);
  }
};

// ─── @route  POST /api/events ─────────────────────────────────────────────────
const createEvent = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const eventData = {
      ...req.body,
      organizer: {
        userId: req.user.id,
        name: req.user.name,
        email: req.user.email,
      },
    };

    const event = await Event.create(eventData);
    res.status(201).json({ success: true, message: 'Event created successfully.', data: { event } });
  } catch (error) {
    next(error);
  }
};

// ─── @route  PUT /api/events/:id ─────────────────────────────────────────────
const updateEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    // Only organizer who created it OR admin can update
    if (event.organizer.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this event.' });
    }

    // Prevent shrinking capacity below currently registered count
    if (req.body.capacity?.total && req.body.capacity.total < event.capacity.registered) {
      return res.status(400).json({
        success: false,
        message: `Cannot reduce capacity below current registrations (${event.capacity.registered}).`,
      });
    }

    const updatedEvent = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, message: 'Event updated successfully.', data: { event: updatedEvent } });
  } catch (error) {
    next(error);
  }
};

// ─── @route  PATCH /api/events/:id/status ────────────────────────────────────
const updateEventStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'published', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    if (event.organizer.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    event.status = status;
    await event.save();
    res.json({ success: true, message: `Event status updated to '${status}'.`, data: { event } });
  } catch (error) {
    next(error);
  }
};

// ─── @route  DELETE /api/events/:id  (admin only) ────────────────────────────
const deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, message: 'Event deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

// ─── Internal: increment/decrement registration count ─────────────────────────
// Called internally by Registration Service via HTTP
const updateCapacity = async (req, res, next) => {
  try {
    const { action } = req.body; // 'increment' | 'decrement' | 'waitlist-increment' | 'waitlist-decrement'
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    if (action === 'increment') {
      if (event.capacity.registered >= event.capacity.total) {
        return res.status(409).json({ success: false, message: 'Event is full.', isFull: true });
      }
      event.capacity.registered += 1;
    } else if (action === 'decrement') {
      event.capacity.registered = Math.max(0, event.capacity.registered - 1);
    } else if (action === 'waitlist-increment') {
      event.capacity.waitlisted += 1;
    } else if (action === 'waitlist-decrement') {
      event.capacity.waitlisted = Math.max(0, event.capacity.waitlisted - 1);
    }

    await event.save();
    res.json({ success: true, data: { capacity: event.capacity, isFull: event.isFull } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getEvents, getMyEvents, getEventById, createEvent, updateEvent, updateEventStatus, deleteEvent, updateCapacity };
