import Header from './components/Header.js';
import Footer from './components/Footer.js';
import auth from './auth.js';
import router from './router.js';
import i18n from './i18n.js';

import LandingPage from './pages/landing.js';
import LoginPage from './pages/login.js';
import RegisterPage from './pages/register.js';
import SearchPage from './pages/search.js';
import PropertyDetailPage from './pages/propertyDetail.js';
import BookingFormPage from './pages/bookingForm.js';
import BookingConfirmationPage from './pages/bookingConfirmation.js';
import BookingSummaryPage from './pages/bookingSummary.js';
import PaymentCheckoutPage from './pages/paymentCheckout.js';
import DashboardTouristPage from './pages/dashboardTourist.js';
import ReviewFormPage from './pages/reviewForm.js';
import FeedbackFormPage from './pages/feedbackForm.js';
import ProfilePage from './pages/profile.js';
import HostDashboardPage from './pages/hostDashboard.js';
import PublishPropertyPage from './pages/publishProperty.js';
import ManagePropertiesPage from './pages/manageProperties.js';
import CalendarAvailabilityPage from './pages/calendarAvailability.js';
import HostReservationsPage from './pages/hostReservations.js';
import HostEarningsPage from './pages/hostEarnings.js';
import HostProfilePage from './pages/hostProfile.js';
import AdminDashboardPage from './pages/adminDashboard.js';
import AdminBookingsPage from './pages/adminBookings.js';
import AdminPropertiesPage from './pages/adminProperties.js';
import AdminFeedbackPage from './pages/adminFeedback.js';
import AdminUsersPage from './pages/adminUsers.js';
import AdminSettingsPage from './pages/adminSettings.js';
import AdminReportsPage from './pages/adminReports.js';
import AdminAvailabilityPage from './pages/adminAvailability.js';
import AdminOrphanedPaymentsPage from './pages/adminOrphanedPayments.js';
import AdminHostCommissionsPage from './pages/adminHostCommissions.js';
import EditPropertyPage from './pages/editProperty.js';
import HowItWorksPage from './pages/howItWorks.js';
import TermsPage from './pages/terms.js';
import PrivacyPage from './pages/privacy.js';
import FAQPage from './pages/faq.js';

async function renderPage(page) {
  const app = document.getElementById('app');
  if (!app) return;

  window.scrollTo(0, 0);

  const html = typeof page.render === 'function'
    ? await page.render()
    : '';

  app.innerHTML = html;
  Header.init();
  Footer.init();

  if (typeof page.init === 'function') {
    page.init();
  }
}

function guard(allowedRoles) {
  if (!auth.isLoggedIn()) {
    router.navigate('/login?redirect=' + encodeURIComponent(window.location.pathname));
    return false;
  }
  if (allowedRoles && !allowedRoles.includes(auth.getRole())) {
    router.navigate('/');
    return false;
  }
  return true;
}

function routeHandler(page) {
  return async (params) => {
    page._params = params;
    await renderPage(page);
  };
}

i18n.init().then(() => {

router
  .addRoute('/', routeHandler(LandingPage))
  .addRoute('/login', routeHandler(LoginPage))
  .addRoute('/register', routeHandler(RegisterPage))
  .addRoute('/search', routeHandler(SearchPage))
  .addRoute('/property/:id', routeHandler(PropertyDetailPage))
  .addRoute('/booking/:propertyId', async (params) => {
    if (!guard(['tourist'])) return;
    BookingFormPage._params = params;
    await renderPage(BookingFormPage);
  })
  .addRoute('/booking/confirmation/:bookingId', async (params) => {
    if (!guard(['tourist'])) return;
    BookingConfirmationPage._params = params;
    await renderPage(BookingConfirmationPage);
  })
  .addRoute('/booking/summary/:id', async (params) => {
    if (!guard(['tourist'])) return;
    BookingSummaryPage._params = params;
    await renderPage(BookingSummaryPage);
  })
  .addRoute('/payment/checkout', async (params) => {
    if (!guard(['tourist'])) return;
    PaymentCheckoutPage._params = params;
    await renderPage(PaymentCheckoutPage);
  })
  .addRoute('/dashboard', async (params) => {
    if (!guard(['tourist'])) return;
    DashboardTouristPage._params = params;
    await renderPage(DashboardTouristPage);
  })
  .addRoute('/review/new', async (params) => {
    if (!guard(['tourist'])) return;
    ReviewFormPage._params = params;
    await renderPage(ReviewFormPage);
  })
  .addRoute('/feedback', routeHandler(FeedbackFormPage))
  .addRoute('/profile', async (params) => {
    if (!guard()) return;
    ProfilePage._params = params;
    await renderPage(ProfilePage);
  })
  .addRoute('/host/dashboard', async (params) => {
    if (!guard(['host'])) return;
    HostDashboardPage._params = params;
    await renderPage(HostDashboardPage);
  })
  .addRoute('/host/properties/new', async (params) => {
    if (!guard(['host'])) return;
    PublishPropertyPage._params = params;
    await renderPage(PublishPropertyPage);
  })
  .addRoute('/host/properties', async (params) => {
    if (!guard(['host'])) return;
    ManagePropertiesPage._params = params;
    await renderPage(ManagePropertiesPage);
  })
  .addRoute('/host/properties/:id/edit', async (params) => {
    if (!guard(['host'])) return;
    EditPropertyPage._params = params;
    await renderPage(EditPropertyPage);
  })
  .addRoute('/host/properties/:id/calendar', async (params) => {
    if (!guard(['host'])) return;
    CalendarAvailabilityPage._params = params;
    await renderPage(CalendarAvailabilityPage);
  })
  .addRoute('/host/bookings', async (params) => {
    if (!guard(['host'])) return;
    HostReservationsPage._params = params;
    await renderPage(HostReservationsPage);
  })
  .addRoute('/host/earnings', async (params) => {
    if (!guard(['host'])) return;
    HostEarningsPage._params = params;
    await renderPage(HostEarningsPage);
  })
  .addRoute('/host/profile', async (params) => {
    if (!guard(['host'])) return;
    HostProfilePage._params = params;
    await renderPage(HostProfilePage);
  })
  .addRoute('/admin/dashboard', async (params) => {
    if (!guard(['admin'])) return;
    AdminDashboardPage._params = params;
    await renderPage(AdminDashboardPage);
  })
  .addRoute('/admin/bookings', async (params) => {
    if (!guard(['admin'])) return;
    AdminBookingsPage._params = params;
    await renderPage(AdminBookingsPage);
  })
  .addRoute('/admin/properties', async (params) => {
    if (!guard(['admin'])) return;
    AdminPropertiesPage._params = params;
    await renderPage(AdminPropertiesPage);
  })
  .addRoute('/admin/feedback', async (params) => {
    if (!guard(['admin'])) return;
    AdminFeedbackPage._params = params;
    await renderPage(AdminFeedbackPage);
  })
  .addRoute('/admin/users', async (params) => {
    if (!guard(['admin'])) return;
    AdminUsersPage._params = params;
    await renderPage(AdminUsersPage);
  })
  .addRoute('/admin/settings', async (params) => {
    if (!guard(['admin'])) return;
    AdminSettingsPage._params = params;
    await renderPage(AdminSettingsPage);
  })
  .addRoute('/admin/reports', async (params) => {
    if (!guard(['admin'])) return;
    AdminReportsPage._params = params;
    await renderPage(AdminReportsPage);
  })
  .addRoute('/admin/availability', async (params) => {
    if (!guard(['admin'])) return;
    AdminAvailabilityPage._params = params;
    await renderPage(AdminAvailabilityPage);
  })
  .addRoute('/admin/orphaned-payments', async (params) => {
    if (!guard(['admin'])) return;
    AdminOrphanedPaymentsPage._params = params;
    await renderPage(AdminOrphanedPaymentsPage);
  })
  .addRoute('/admin/host-commissions', async (params) => {
    if (!guard(['admin'])) return;
    AdminHostCommissionsPage._params = params;
    await renderPage(AdminHostCommissionsPage);
  })
  .addRoute('/how-it-works', routeHandler(HowItWorksPage))
  .addRoute('/terms', routeHandler(TermsPage))
  .addRoute('/privacy', routeHandler(PrivacyPage))
  .addRoute('/faq', routeHandler(FAQPage))
  .addRoute('*', async () => {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div class="error" style="padding:80px 20px;text-align:center;">
          <h1 style="font-size:3rem;color:var(--primary);">404</h1>
          <p style="margin:20px 0;color:var(--text-light);">Page not found</p>
          <a href="/" data-link class="btn btn-primary">Go Home</a>
        </div>
      `;
    }
    Header.init();
    Footer.init();
  })
  .init();

});

window.toggleMobileMenu = function () {
  const nav = document.querySelector('.nav');
  if (nav) nav.classList.toggle('active');
};

window.rerenderCurrentPage = function () {
  router.resolve();
};

window.logout = function () {
  auth.logout();
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
