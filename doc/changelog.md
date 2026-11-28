# Changelog

All notable changes to this project are recorded here, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added
- **Razorpay Payment, Refund & Route Settlement Integration** ([`doc/RAZORPAY_PAYMENT_ARCHITECTURE.md`](./RAZORPAY_PAYMENT_ARCHITECTURE.md)):
  - Added [`middleware/src/services/razorpay.service.js`](../middleware/src/services/razorpay.service.js), [`middleware/src/models/paymentTransaction.model.js`](../middleware/src/models/paymentTransaction.model.js), [`middleware/src/controllers/payment.controller.js`](../middleware/src/controllers/payment.controller.js), and [`middleware/src/routes/payment.routes.js`](../middleware/src/routes/payment.routes.js) (`/api/v1/payments/create-order`, `/verify`, `/webhook`).
  - Integrated `react-native-razorpay` native checkout in `mobile-application/user-react` via [`paymentService.js`](../mobile-application/user-react/src/services/paymentService.js) across membership purchases, session/class bookings, and plan switch upgrades, removing `mock_mem_*` fallbacks.
  - Wired automated Razorpay refunds on approved membership and booking cancellations and added Super Admin Route linked-account & settlement payout endpoints (`/api/v1/admin/gyms/:id/razorpay-account`, `/api/v1/admin/settlements/:transactionId/transfer`).
- **Shared Form Input Validation** ([`web-application/gym-owner/src/utils/formValidation.js`](../web-application/gym-owner/src/utils/formValidation.js), [`mobile-application/gym-owner/src/utils/formValidation.js`](../mobile-application/gym-owner/src/utils/formValidation.js)): standardized name, mobile, email, Manager password complexity, date range, and working-time validation across Gym Owner Web and Mobile employee modals.
- **Gym Application Rejection, Hold, and Resubmission Tracking Subsystem**:
  - **Schema Enhancements** ([`middleware/src/models/gym.model.js`](../middleware/src/models/gym.model.js)): added `rejectionReason` (categorical reason), `rejectionNote` (detailed administrator remarks), `resubmissionNote` (partner explanation of fixes), and `resubmittedAt` timestamp to `gymSchema`.
  - **Decision Engine Updates** ([`middleware/src/controllers/gym.controller.js`](../middleware/src/controllers/gym.controller.js)):
    - `updateGymStatus`: stores `rejectionReason` and `rejectionNote` separately upon rejection or on-hold actions.
    - `resubmitGymApplication`: sets `approvalStatus` to `'Pending Approval'`, preserves historical rejection feedback for administrative reference, and saves `resubmissionNote` with `resubmittedAt`.
    - `updateGym`: properly transitions rejected or on-hold partner edits into `'Pending Approval'` and records `resubmissionNote` when resubmitted.
  - **Super Admin Review Banners & Modals** ([`web-application/super-admin/src/admin/GymsManagement.jsx`](../web-application/super-admin/src/admin/GymsManagement.jsx), [`web-application/super-admin/src/admin/components/GymDetailsView.jsx`](../web-application/super-admin/src/admin/components/GymDetailsView.jsx)):
    - Review view displays prominent **Rejection / Hold Feedback Banner** (reason tag + admin rejection note) and **Owner Resubmission Notes Banner** (changes submitted by partner + timestamp).
    - Rejection modal and Hold modal enhanced with structured reason dropdowns and dedicated instruction textareas.
  - **Gym Owner Web & Mobile Experience** ([`web-application/gym-owner/src/general/ApplicationStatus.jsx`](../web-application/gym-owner/src/general/ApplicationStatus.jsx), [`mobile-application/gym-owner/src/pages/ApplicationStatusScreen.js`](../mobile-application/gym-owner/src/pages/ApplicationStatusScreen.js)):
    - Displays structured rejection reason tags alongside administrator instructions.
    - Captures `resubmissionNote` across both standalone resubmission modals and inline profile edit modals.
    - Renders "Your Resubmission Explanation" card while the application is in review.
- **Gym & Trainer Ratings and Reviews Subsystem Specification** ([`doc/RATINGS_AND_REVIEWS_SPECIFICATION.md`](./RATINGS_AND_REVIEWS_SPECIFICATION.md)): comprehensive documentation of the dual-entity reputation engine, embedded `reviewSchema` architecture, arithmetic rating averages, star distribution histograms (5★ down to 1★), dynamic `computeTimeAgo` engine, public and authenticated REST endpoints, and cross-platform UI implementations.
- **Ratings & Reviews Automated Unit Tests** ([`middleware/test/gym_reviews_ratings.test.js`](../middleware/test/gym_reviews_ratings.test.js)): test suite covering endpoint routes, `computeTimeAgo` human-readable strings, star histogram percentages, and 1 to 5 star boundary constraints.

### Changed
- Synchronized `README.md` and `doc/README.md` to index the new ratings & reviews specification and documented the reputation engine under core platform technologies.

