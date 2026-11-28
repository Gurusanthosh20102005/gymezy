import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import adminRoutes from './admin.routes.js';
import gymRoutes from './gym.routes.js';
import employeeRoutes from './employee.routes.js';
import membershipRoutes from './membership.routes.js';
import attendanceRoutes from './attendance.routes.js';
import walletRoutes from './wallet.routes.js';
import sectionRoutes from './section.routes.js';
import bookingRoutes from './booking.routes.js';
import bannerRoutes from './banner.routes.js';
import notificationRoutes from './notification.routes.js';
import paymentRoutes from './payment.routes.js';

const apiRouter = Router();

apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/gyms', gymRoutes);
apiRouter.use('/employees', employeeRoutes);
apiRouter.use('/memberships', membershipRoutes);
apiRouter.use('/attendance', attendanceRoutes);
apiRouter.use('/wallet', walletRoutes);
apiRouter.use('/sections', sectionRoutes);
apiRouter.use('/bookings', bookingRoutes);
apiRouter.use('/banners', bannerRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/payments', paymentRoutes);

export default apiRouter;
