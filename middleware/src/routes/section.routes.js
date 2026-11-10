import { Router } from 'express';
import {
  createSection,
  getSections,
  getAvailableTrainersForSection,
  getSectionById,
  updateSection,
  toggleSectionStatus,
  deleteSection,
} from '../controllers/section.controller.js';
import { authenticate, optionalAuthenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/role.middleware.js';
import { USER_ROLES } from '../models/user.model.js';

const router = Router();

// Get all sections for gym (Public discovery or Authenticated Member/Owner)
router.get('/', optionalAuthenticate, getSections);

// Get available trainers for a proposed section schedule (Must be before /:id)
router.get('/available-trainers', optionalAuthenticate, getAvailableTrainersForSection);

// Get single section details
router.get('/:id', optionalAuthenticate, getSectionById);

// Create new section (Gym Owner or Super Admin)
router.post(
  '/',
  authenticate,
  authorizeRoles(USER_ROLES.GYM_OWNER, USER_ROLES.SUPER_ADMIN),
  createSection
);

// Update section (Gym Owner or Super Admin)
router.put(
  '/:id',
  authenticate,
  authorizeRoles(USER_ROLES.GYM_OWNER, USER_ROLES.SUPER_ADMIN),
  updateSection
);

// Toggle section active/inactive status
router.patch(
  '/:id/status',
  authenticate,
  authorizeRoles(USER_ROLES.GYM_OWNER, USER_ROLES.SUPER_ADMIN),
  toggleSectionStatus
);

// Delete section
router.delete(
  '/:id',
  authenticate,
  authorizeRoles(USER_ROLES.GYM_OWNER, USER_ROLES.SUPER_ADMIN),
  deleteSection
);

export default router;
