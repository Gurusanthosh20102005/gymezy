import { Router } from 'express';
import {
  getDashboardStats,
  getAdminCustomers,
  getAdminCustomerDetails,
  createAdminCustomer,
  updateAdminCustomer,
  toggleCustomerStatus,
  getAdminBookings,
} from '../controllers/admin.controller.js';
import { getAdminGymsFleet, getGymOptions } from '../controllers/gym.controller.js';
import {
  getAdminSwitchRequests,
  superAdminActionReviewSwitchRequest,
  getAdminAllGymMemberships,
} from '../controllers/membership.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/role.middleware.js';
import { USER_ROLES } from '../models/user.model.js';

const router = Router();

// Protect all admin routes: Require authenticated SUPER_ADMIN
router.use(authenticate, authorizeRoles(USER_ROLES.SUPER_ADMIN));

// Executive Command Center Dashboard Stats
router.get('/dashboard-stats', getDashboardStats);

// Customers & Users Fleet with Server-Side Pagination
router.get('/customers', getAdminCustomers);
router.get('/customers/:id', getAdminCustomerDetails);
router.post('/customers', createAdminCustomer);
router.put('/customers/:id', updateAdminCustomer);
router.patch('/customers/:id/status', toggleCustomerStatus);

// Lightweight Gym Options / Dropdown with Infinite Scroll & Search (must be before /gyms or distinct)
router.get('/gyms/options', getGymOptions);

// Super Admin Gyms Fleet
router.get('/gyms', getAdminGymsFleet);

// All Gym Bookings & Group Classes Fleet (Super Admin)
router.get('/bookings', getAdminBookings);

// All Gym Memberships Fleet (Super Admin)
router.get('/memberships', getAdminAllGymMemberships);

// Membership Plan Switch Governance Inbox
router.get('/membership-switch-requests', getAdminSwitchRequests);

// Super Admin Final Approval / Rejection & Execution
router.patch('/membership-switch-requests/:requestId/admin-action', superAdminActionReviewSwitchRequest);

export default router;

