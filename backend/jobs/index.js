const { startHoldExpiryCron } = require('./holdExpiry');
const { startHostCommissionCron } = require('./hostCommissionCron');
const { startOrganizerCommissionCron } = require('./organizerCommissionCron');
const { startExperienceRecurrenceCron } = require('./experienceRecurrenceCron');
const { startBookingLifecycleCron } = require('./bookingLifecycle');
const { startApprovalReminderCron } = require('./approvalReminder');
const { startPlaceImportCron } = require('./placeImport');

// Arranca todos los crons. Debe correr en UN solo proceso: con varias
// instancias web se duplicarian. Ver worker.js y RUN_JOBS en server.js.
const startAllJobs = () => {
  startHoldExpiryCron();
  startHostCommissionCron();
  startOrganizerCommissionCron();
  startExperienceRecurrenceCron();
  startBookingLifecycleCron();
  startApprovalReminderCron();
  startPlaceImportCron();
};

module.exports = { startAllJobs };
