import { Router } from 'express';
import {
  createEmployee,
  getEmployees,
  getPendingApprovals,
  updateEmployee,
  reviewEmployeeApproval,
  deleteEmployee,
} from '../controllers/employee.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/role.middleware.js';
import { USER_ROLES } from '../models/user.model.js';

const router = Router();

// All employee routes require active JWT authentication
router.use(authenticate);

// Gym Owner & Super Admin pending employee approvals
router.get(
  '/approvals',
  authorizeRoles(USER_ROLES.GYM_OWNER, USER_ROLES.SUPER_ADMIN),
  getPendingApprovals
);

// Gym Owner & Super Admin decision (Approve / Reject) on manager submitted employee addition or edit
router.patch(
  '/:id/approval',
  authorizeRoles(USER_ROLES.GYM_OWNER, USER_ROLES.SUPER_ADMIN),
  reviewEmployeeApproval
);

// List employees (with gymId / partnerId filtering)
router.get('/', getEmployees);

// Add new employee
router.post(
  '/',
  authorizeRoles(USER_ROLES.GYM_OWNER, USER_ROLES.SUPER_ADMIN),
  createEmployee
);

// Edit employee details
router.put(
  '/:id',
  authorizeRoles(USER_ROLES.GYM_OWNER, USER_ROLES.SUPER_ADMIN),
  updateEmployee
);
router.patch(
  '/:id',
  authorizeRoles(USER_ROLES.GYM_OWNER, USER_ROLES.SUPER_ADMIN),
  updateEmployee
);

// Deactivate / Delete employee
router.delete(
  '/:id',
  authorizeRoles(USER_ROLES.GYM_OWNER, USER_ROLES.SUPER_ADMIN),
  deleteEmployee
);

export default router;
