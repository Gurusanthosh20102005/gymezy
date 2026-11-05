import { ApiError } from '../utils/apiError.js';
import { USER_ROLES } from '../models/user.model.js';

/**
 * Role-based authorization middleware
 * @param  {...string} allowedRoles - List of permitted roles (e.g. 'SUPER_ADMIN', 'GYM_OWNER', 'CUSTOMER')
 */
export const authorizeRoles = (...allowedRoles) => {
  const allowedSet = new Set(allowedRoles);

  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('User not authenticated.'));
    }

    // A MANAGER has operational admin access for gym resources whenever GYM_OWNER is permitted
    const isManagerAuthorized =
      allowedSet.has(USER_ROLES.GYM_OWNER) &&
      (req.user.role === USER_ROLES.MANAGER || req.user.role === 'MANAGER');

    if (!allowedSet.has(req.user.role) && !isManagerAuthorized) {
      return next(
        ApiError.forbidden(`Access denied. Role '${req.user.role}' is not authorized for this resource.`)
      );
    }

    next();
  };
};
