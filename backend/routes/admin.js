const express = require('express');
const {
  getDashboard, getPendingProperties, approveProperty,
  rejectProperty, getAllBookings, updateSettings,
  getHosts, approveHost, rejectHost, suspendHost, deleteHost,
  getAllProperties, adminEditProperty, adminDeleteProperty,
  adminBlockDates, adminUnblockDates, adminGetAvailabilityCalendar,
  getBookingWhatsAppLink, getHostPayouts, getBookingTouristContactLinks,
  getOrphanedPayments, reviewOrphanedPayment,
  getHostCommissions, markHostCommissionPaid, markHostCommissionWaived, getHostCommissionWhatsAppLink,
  getAuditLog,
  getPasswordResetRequests, getPasswordResetDeliveryLinks,
  getOrganizers, approveOrganizer, rejectOrganizer, suspendOrganizer, deleteOrganizer,
  getPendingExperiences, approveExperience, rejectExperience,
  getAllExperienceBookings, approveExperienceBooking, rejectExperienceBooking,
  getExperienceBookingOrganizerWhatsAppLink, getExperienceBookingTouristContactLinks,
  getOrganizerCommissions, markOrganizerCommissionPaid, markOrganizerCommissionWaived, getOrganizerCommissionWhatsAppLink,
  getPendingCounts,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const { setTenant } = require('../middleware/tenant');

const router = express.Router();

router.use(setTenant);
router.use(protect);
router.use(authorize('admin'));

router.get('/dashboard', getDashboard);
router.get('/properties/pending', getPendingProperties);
router.get('/properties', getAllProperties);
router.post('/properties/:id/approve', approveProperty);
router.post('/properties/:id/reject', rejectProperty);
router.put('/properties/:id', adminEditProperty);
router.delete('/properties/:id', adminDeleteProperty);
router.post('/properties/:id/availability/block', adminBlockDates);
router.delete('/properties/:id/availability/block/:blockId', adminUnblockDates);
router.get('/properties/:id/availability/calendar', adminGetAvailabilityCalendar);
router.get('/hosts', getHosts);
router.post('/hosts/:id/approve', approveHost);
router.post('/hosts/:id/reject', rejectHost);
router.post('/hosts/:id/suspend', suspendHost);
router.delete('/hosts/:id', deleteHost);
router.get('/bookings', getAllBookings);
router.get('/host-payouts', getHostPayouts);
router.get('/bookings/:id/whatsapp-link', getBookingWhatsAppLink);
router.get('/bookings/:id/tourist-contact-links', getBookingTouristContactLinks);
router.get('/orphaned-payments', getOrphanedPayments);
router.post('/orphaned-payments/:id/review', reviewOrphanedPayment);
router.get('/host-commissions', getHostCommissions);
router.post('/host-commissions/:id/paid', markHostCommissionPaid);
router.post('/host-commissions/:id/waive', markHostCommissionWaived);
router.get('/host-commissions/:id/whatsapp-link', getHostCommissionWhatsAppLink);
router.get('/audit-log', getAuditLog);
router.get('/password-resets', getPasswordResetRequests);
router.get('/password-resets/:id/delivery-links', getPasswordResetDeliveryLinks);

// Organizadores (excursiones y viajes locales)
router.get('/organizers', getOrganizers);
router.post('/organizers/:id/approve', approveOrganizer);
router.post('/organizers/:id/reject', rejectOrganizer);
router.post('/organizers/:id/suspend', suspendOrganizer);
router.delete('/organizers/:id', deleteOrganizer);

// Excursiones (incluye ocurrencias generadas por recurrencia)
router.get('/experiences/pending', getPendingExperiences);
router.post('/experiences/:id/approve', approveExperience);
router.post('/experiences/:id/reject', rejectExperience);

// Reservas de excursiones
router.get('/experience-bookings', getAllExperienceBookings);
router.post('/experience-bookings/:id/approve', approveExperienceBooking);
router.post('/experience-bookings/:id/reject', rejectExperienceBooking);
router.get('/experience-bookings/:id/organizer-whatsapp-link', getExperienceBookingOrganizerWhatsAppLink);
router.get('/experience-bookings/:id/tourist-contact-links', getExperienceBookingTouristContactLinks);

// Comisiones mensuales de organizadores
router.get('/organizer-commissions', getOrganizerCommissions);
router.post('/organizer-commissions/:id/paid', markOrganizerCommissionPaid);
router.post('/organizer-commissions/:id/waive', markOrganizerCommissionWaived);
router.get('/organizer-commissions/:id/whatsapp-link', getOrganizerCommissionWhatsAppLink);

router.get('/pending-counts', getPendingCounts);
router.put('/settings', updateSettings);

module.exports = router;
