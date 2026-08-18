const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

let mongoServer;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

describe('Auth Controller', () => {
  test('should export register function', () => {
    const { register } = require('../controllers/authController');
    expect(typeof register).toBe('function');
  });

  test('should export login function', () => {
    const { login } = require('../controllers/authController');
    expect(typeof login).toBe('function');
  });

  test('should export refreshToken function', () => {
    const { refreshToken } = require('../controllers/authController');
    expect(typeof refreshToken).toBe('function');
  });

  test('should export logout function', () => {
    const { logout } = require('../controllers/authController');
    expect(typeof logout).toBe('function');
  });

  test('should generate valid JWT token', () => {
    const token = jwt.sign({ id: 'test123' }, 'test-secret', { expiresIn: '1h' });
    const decoded = jwt.verify(token, 'test-secret');
    expect(decoded.id).toBe('test123');
  });
});

describe('Models', () => {
  test('should have Booking model with fee_amount default 7', () => {
    const Booking = require('../models/Booking');
    const schema = Booking.schema;
    const feeAmountField = schema.path('fee_amount');
    expect(feeAmountField.options.default).toBe(7);
  });

  test('should have User model with refresh_token field', () => {
    const User = require('../models/User');
    const schema = User.schema;
    expect(schema.path('refresh_token')).toBeDefined();
  });
});

describe('Middleware', () => {
  test('should export rate limiters', () => {
    const { loginLimiter, apiLimiter } = require('../middleware/rateLimiter');
    expect(typeof loginLimiter).toBe('function');
    expect(typeof apiLimiter).toBe('function');
  });

  test('should export auth middleware', () => {
    const auth = require('../middleware/auth');
    expect(typeof auth.protect).toBe('function');
    expect(typeof auth.authorize).toBe('function');
  });

  test('should export tenant middleware', () => {
    const { setTenant } = require('../middleware/tenant');
    expect(typeof setTenant).toBe('function');
  });
});

describe('Utils', () => {
  test('should export email functions', () => {
    const email = require('../utils/email');
    expect(typeof email.sendEmail).toBe('function');
    expect(typeof email.sendBookingConfirmation).toBe('function');
    expect(typeof email.sendBookingApproved).toBe('function');
    expect(typeof email.sendBookingRejected).toBe('function');
  });

  test('should export helper functions', () => {
    const helpers = require('../utils/helpers');
    expect(typeof helpers.calculateNights).toBe('function');
    expect(typeof helpers.calculateTotal).toBe('function');
    expect(typeof helpers.formatDate).toBe('function');
    expect(typeof helpers.formatCurrency).toBe('function');
  });

  test('calculateNights should return correct number of nights', () => {
    const { calculateNights } = require('../utils/helpers');
    const nights = calculateNights('2026-07-10', '2026-07-15');
    expect(nights).toBe(5);
  });
});

describe('Cron Jobs', () => {
  test('should export startHoldExpiryCron function', () => {
    const { startHoldExpiryCron } = require('../jobs/holdExpiry');
    expect(typeof startHoldExpiryCron).toBe('function');
  });
});

describe('Routes', () => {
  test('should export auth routes', () => {
    const authRoutes = require('../routes/auth');
    expect(typeof authRoutes).toBe('function');
  });

  test('should export properties routes', () => {
    const propertiesRoutes = require('../routes/properties');
    expect(typeof propertiesRoutes).toBe('function');
  });

  test('should export bookings routes', () => {
    const bookingsRoutes = require('../routes/bookings');
    expect(typeof bookingsRoutes).toBe('function');
  });

  test('should export search routes', () => {
    const searchRoutes = require('../routes/search');
    expect(typeof searchRoutes).toBe('function');
  });

  test('should export contact routes', () => {
    const contactRoutes = require('../routes/contact');
    expect(typeof contactRoutes).toBe('function');
  });
});

describe('Controllers', () => {
  test('should export search controller', () => {
    const { search } = require('../controllers/searchController');
    expect(typeof search).toBe('function');
  });

  test('should export contact controller', () => {
    const { contact } = require('../controllers/contactController');
    expect(typeof contact).toBe('function');
  });

  test('should export booking controller functions', () => {
    const bookingController = require('../controllers/bookingController');
    expect(typeof bookingController.createBooking).toBe('function');
    expect(typeof bookingController.approveBooking).toBe('function');
    expect(typeof bookingController.rejectBooking).toBe('function');
    expect(typeof bookingController.cancelBooking).toBe('function');
  });

  test('should export admin controller functions', () => {
    const adminController = require('../controllers/adminController');
    expect(typeof adminController.getDashboard).toBe('function');
    expect(typeof adminController.approveProperty).toBe('function');
    expect(typeof adminController.rejectProperty).toBe('function');
  });
});

describe('Experiences module', () => {
  test('should have Experience model with allows_mixed_audience default false', () => {
    const Experience = require('../models/Experience');
    const field = Experience.schema.path('allows_mixed_audience');
    expect(field.options.default).toBe(false);
  });

  test('should have ExperienceRecurrence model with generate_horizon_days default 30', () => {
    const ExperienceRecurrence = require('../models/ExperienceRecurrence');
    const field = ExperienceRecurrence.schema.path('generate_horizon_days');
    expect(field.options.default).toBe(30);
  });

  test('should have ExperienceBooking model without a fee-based pending_payment status', () => {
    const ExperienceBooking = require('../models/ExperienceBooking');
    const statusField = ExperienceBooking.schema.path('status');
    expect(statusField.enumValues).toEqual(
      expect.arrayContaining(['pending_approval', 'approved', 'rejected', 'expired', 'completed', 'cancelled'])
    );
    expect(statusField.enumValues).not.toContain('pending_payment');
  });

  test('should have ExperienceWaitlist model', () => {
    const ExperienceWaitlist = require('../models/ExperienceWaitlist');
    expect(ExperienceWaitlist.schema.path('position')).toBeDefined();
  });

  test('should have OrganizerMonthlyCommission model with per-currency totals', () => {
    const OrganizerMonthlyCommission = require('../models/OrganizerMonthlyCommission');
    expect(OrganizerMonthlyCommission.schema.path('totals')).toBeDefined();
  });

  test('should have User model with organizer role and conditional phone requirement', () => {
    const User = require('../models/User');
    const roleField = User.schema.path('role');
    expect(roleField.enumValues).toContain('organizer');
    expect(typeof User.schema.path('phone').options.required).toBe('function');
  });

  test('should export experienceController functions', () => {
    const experienceController = require('../controllers/experienceController');
    expect(typeof experienceController.getExperiences).toBe('function');
    expect(typeof experienceController.createExperienceBooking).toBe('function');
    expect(typeof experienceController.joinWaitlist).toBe('function');
    expect(typeof experienceController.claimWaitlistSpot).toBe('function');
    expect(typeof experienceController.cancelExperienceBooking).toBe('function');
  });

  test('should export organizerController functions', () => {
    const organizerController = require('../controllers/organizerController');
    expect(typeof organizerController.createExperience).toBe('function');
    expect(typeof organizerController.createRecurrence).toBe('function');
    expect(typeof organizerController.completeExperienceBooking).toBe('function');
  });

  test('should export new adminController functions for organizers/experiences/commissions', () => {
    const adminController = require('../controllers/adminController');
    expect(typeof adminController.approveOrganizer).toBe('function');
    expect(typeof adminController.approveExperience).toBe('function');
    expect(typeof adminController.approveExperienceBooking).toBe('function');
    expect(typeof adminController.getOrganizerCommissions).toBe('function');
  });

  test('should export experiences, experienceBookings and organizer routes', () => {
    expect(typeof require('../routes/experiences')).toBe('function');
    expect(typeof require('../routes/experienceBookings')).toBe('function');
    expect(typeof require('../routes/organizer')).toBe('function');
  });

  test('should export experience recurrence util (idempotent generation)', () => {
    const { generateOccurrences } = require('../utils/experienceRecurrence');
    expect(typeof generateOccurrences).toBe('function');
  });

  test('should export waitlist promotion util with dynamic claim window', () => {
    const { computeClaimWindowMs, promoteNextWaitlistEntry } = require('../utils/experienceWaitlist');
    expect(typeof promoteNextWaitlistEntry).toBe('function');
    // Menos de 1h para la excursión -> no se promueve automático
    const soon = new Date(Date.now() + 30 * 60 * 1000);
    expect(computeClaimWindowMs(soon)).toBeNull();
    // Sobra tiempo -> nunca más de 2h
    const farAway = new Date(Date.now() + 10 * 60 * 60 * 1000);
    expect(computeClaimWindowMs(farAway)).toBeLessThanOrEqual(2 * 60 * 60 * 1000);
  });

  test('should export organizer and recurrence cron jobs', () => {
    const { startOrganizerCommissionCron } = require('../jobs/organizerCommissionCron');
    const { startExperienceRecurrenceCron } = require('../jobs/experienceRecurrenceCron');
    expect(typeof startOrganizerCommissionCron).toBe('function');
    expect(typeof startExperienceRecurrenceCron).toBe('function');
  });
});
