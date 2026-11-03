import cron from 'node-cron';
import crypto from 'node:crypto';
import Attendance from '../models/attendance.model.js';
import Membership from '../models/membership.model.js';
import MembershipSwitchRequest from '../models/membershipSwitchRequest.model.js';
import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import { sendPushNotification } from './firebase.service.js';

/**
 * Auto-transition memberships based on date window:
 * - 'Upcoming' -> 'Active' (and generate entry OTP) once startDate <= now <= endDate (provided not under review)
 * - 'Active' -> 'Expired' (and clear entry OTP) once endDate < now
 * - Suppress/Clear OTP while plan switch is under review ('PENDING_GYM_APPROVAL', 'PENDING_SUPER_ADMIN_APPROVAL')
 */
export const syncMembershipStatuses = async () => {
  try {
    const now = new Date();

    // 0. Find all memberships currently under switch review
    const pendingReviews = await MembershipSwitchRequest.find({
      status: { $in: ['PENDING_GYM_APPROVAL', 'PENDING_SUPER_ADMIN_APPROVAL'] },
    })
      .select('membershipId')
      .lean();

    const pendingMembershipIds = new Set(
      pendingReviews
        .filter((r) => r.membershipId)
        .map((r) => r.membershipId.toString())
    );

    // Ensure all memberships currently under review do NOT have an active entry OTP
    if (pendingMembershipIds.size > 0) {
      await Membership.updateMany(
        {
          _id: { $in: Array.from(pendingMembershipIds) },
          entryOtp: { $ne: null },
        },
        { $set: { entryOtp: null } }
      );
    }

    // 1. Activate all memberships whose start date has arrived
    const toActivate = await Membership.find({
      status: { $in: ['Upcoming', 'Pending'] },
      startDate: { $lte: now },
      endDate: { $gte: now },
    });

    const activatePromises = toActivate.map((mem) => {
      mem.status = 'Active';
      const isUnderReview = pendingMembershipIds.has(mem._id.toString());
      if (isUnderReview) {
        // While under review, do NOT generate QR/OTP
        mem.entryOtp = null;
      } else if (!mem.entryOtp) {
        mem.entryOtp = crypto.randomInt(100000, 1000000).toString();
      }
      return mem.save();
    });
    await Promise.all(activatePromises);
    const activatedCount = toActivate.length;

    // 2. Ensure active memberships not under review have a valid entry OTP
    const activeWithoutOtp = await Membership.find({
      status: 'Active',
      startDate: { $lte: now },
      endDate: { $gte: now },
      _id: { $nin: Array.from(pendingMembershipIds) },
      $or: [{ entryOtp: null }, { entryOtp: { $exists: false } }],
    });

    const otpPromises = activeWithoutOtp.map((mem) => {
      mem.entryOtp = crypto.randomInt(100000, 1000000).toString();
      return mem.save();
    });
    await Promise.all(otpPromises);

    // 3. Expire all past memberships
    const toExpire = await Membership.find({
      status: { $in: ['Active', 'Expiring Soon'] },
      endDate: { $lt: now },
    });

    const expirePromises = toExpire.map((mem) => {
      mem.status = 'Expired';
      mem.entryOtp = null;
      return mem.save();
    });
    await Promise.all(expirePromises);
    const expiredCount = toExpire.length;

    if (activatedCount > 0 || expiredCount > 0) {
      console.log(`[MEMBERSHIP CRON] Activated: ${activatedCount}, Expired: ${expiredCount}`);
    }
    return { activated: activatedCount, expired: expiredCount };
  } catch (error) {
    console.error('[MEMBERSHIP SYNC ERROR]:', error.message);
    return { activated: 0, expired: 0 };
  }
};

/**
 * Auto-checkout stale attendance sessions.
 * Finds all 'Checked-In' sessions older than 4 hours or from prior days,
 * and sets checkOutTime to checkInTime + 2 hours with status 'Completed'.
 */
export const autoCheckoutStaleRecords = async () => {
  try {
    const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000); // 4 hours ago
    const staleRecords = await Attendance.find({
      status: 'Checked-In',
      checkInTime: { $lt: cutoff },
    });

    let updatedCount = 0;
    if (staleRecords.length > 0) {
      for (const record of staleRecords) {
        const estimatedCheckout = new Date(record.checkInTime.getTime() + 2 * 60 * 60 * 1000);
        record.status = 'Completed';
        record.checkOutTime = estimatedCheckout;
        record.notes = (record.notes ? record.notes + '; ' : '') + 'Auto checked-out by system';
        await record.save();
        updatedCount += 1;
      }
      console.log(`[ATTENDANCE CRON] Auto-checked out ${updatedCount} stale check-in records.`);
    }

    // Sync membership statuses
    await syncMembershipStatuses();

    // Auto-deactivate expired temporary staff contracts
    await autoDeactivateExpiredTemporaryStaff();

    return updatedCount;
  } catch (error) {
    console.error('[ATTENDANCE CRON ERROR]:', error.message);
    return 0;
  }
};

/**
 * Auto-deactivate temporary contract staff whose contract endDate has passed
 */
export const autoDeactivateExpiredTemporaryStaff = async () => {
  try {
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

    const expiredStaff = await Employee.find({
      type: 'Temporary',
      status: 'Active',
      'schedule.endDate': { $exists: true, $ne: '' },
    });

    let deactivatedCount = 0;
    for (const emp of expiredStaff) {
      const endStr = emp.schedule?.endDate
        ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(emp.schedule.endDate))
        : null;

      if (endStr && endStr < todayStr) {
        emp.status = 'Inactive';
        emp.adminRemarks = (emp.adminRemarks ? emp.adminRemarks + '; ' : '') + 'Contract Expired - Auto-deactivated by Nightly Cron';
        if (!Array.isArray(emp.auditHistory)) emp.auditHistory = [];
        emp.auditHistory.push({
          changeType: 'STATUS_CHANGE',
          changedBy: 'Nightly System Cron',
          changedByRole: 'SYSTEM',
          changedAt: new Date(),
          gymId: emp.gymId,
          gymPartnerId: emp.gymPartnerId,
          fieldDiffs: [
            { field: 'status', previousValue: 'Active', updatedValue: 'Inactive' },
          ],
        });
        await emp.save();
        deactivatedCount += 1;
      }
    }

    if (deactivatedCount > 0) {
      console.log(`[ATTENDANCE CRON] Auto-deactivated ${deactivatedCount} expired temporary staff contracts.`);
    }
    return deactivatedCount;
  } catch (error) {
    console.error('[ATTENDANCE CRON ERROR] Error deactivating expired staff:', error?.message);
    return 0;
  }
};

/**
 * Send push notification alerts to members whose pass is expiring within 3 days.
 * Strictly respects user.preferences.passExpiryAlerts.
 */
export const sendPassExpiryAlerts = async () => {
  try {
    const now = new Date();
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    const expiringMemberships = await Membership.find({
      status: 'Active',
      endDate: { $gte: now, $lte: threeDaysFromNow },
    }).populate('userId', 'fcmTokens preferences fullName');

    let sentCount = 0;
    for (const mem of expiringMemberships) {
      const user = mem.userId;
      if (!user) continue;

      const isAlertEnabled = Boolean(user.preferences?.passExpiryAlerts);
      if (!isAlertEnabled || !user.fcmTokens || user.fcmTokens.length === 0) continue;

      const daysLeft = Math.max(1, Math.ceil((new Date(mem.endDate) - now) / (1000 * 60 * 60 * 24)));
      const gymName = mem.gymName || 'your gym';

      await sendPushNotification(user.fcmTokens, {
        title: 'Pass Expiry Alert ⚠️',
        body: `Your pass at ${gymName} expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}. Renew now to stay active!`,
        data: {
          type: 'PASS_EXPIRY',
          membershipId: String(mem._id),
        },
      });
      sentCount++;
    }

    if (sentCount > 0) {
      console.log(`[PASS EXPIRY ALERTS] Dispatched ${sentCount} pass expiration push notifications.`);
    }
    return sentCount;
  } catch (error) {
    console.error('[PASS EXPIRY ALERTS ERROR]:', error.message);
    return 0;
  }
};

/**
 * Send daily workout reminder push notifications before workouts.
 * Strictly respects user.preferences.workoutReminders.
 */
export const sendWorkoutReminders = async () => {
  try {
    const activeUsers = await User.find({
      isActive: true,
      role: 'CUSTOMER',
      'preferences.workoutReminders': true,
      'fcmTokens.0': { $exists: true },
    }).select('fcmTokens fullName preferences');

    let sentCount = 0;
    for (const user of activeUsers) {
      await sendPushNotification(user.fcmTokens, {
        title: 'Daily Workout Reminder 🏋️‍♂️',
        body: `Ready for your session, ${user.fullName || 'Champion'}? Consistency is key to reaching your fitness goals!`,
        data: {
          type: 'WORKOUT_REMINDER',
        },
      });
      sentCount++;
    }

    if (sentCount > 0) {
      console.log(`[WORKOUT REMINDERS] Dispatched ${sentCount} daily workout push reminders.`);
    }
    return sentCount;
  } catch (error) {
    console.error('[WORKOUT REMINDERS ERROR]:', error.message);
    return 0;
  }
};

/**
 * Initialize scheduled cron jobs
 */
export const initAttendanceCron = () => {
  // Run daily at 02:00 AM: nightly stale check-out and staff deactivation
  cron.schedule('0 2 * * *', async () => {
    console.log('[ATTENDANCE CRON] Running 02:00 AM nightly tasks...');
    await autoCheckoutStaleRecords();
    await autoDeactivateExpiredTemporaryStaff();
  });

  // Daily morning workout reminder at 07:00 AM
  cron.schedule('0 7 * * *', async () => {
    console.log('[ATTENDANCE CRON] Running 07:00 AM daily workout reminders...');
    await sendWorkoutReminders();
  });

  // Daily pass expiration alerts at 10:00 AM
  cron.schedule('0 10 * * *', async () => {
    console.log('[ATTENDANCE CRON] Running 10:00 AM pass expiry alerts...');
    await sendPassExpiryAlerts();
  });

  // Also run every hour to activate memberships as soon as their start date arrives
  cron.schedule('0 * * * *', async () => {
    await syncMembershipStatuses();
  });

  console.log('[ATTENDANCE CRON] Attendance cron jobs initialized (membership sync, pass expiry alerts, workout reminders).');
};

// If run directly via CLI (e.g. node src/services/attendanceCron.service.js)
if (process.argv[1] && (process.argv[1].endsWith('attendanceCron.service.js') || process.argv[1].includes('attendanceCron'))) {
  try {
    await import('dotenv/config');
    const { default: mongoose } = await import('mongoose');
    if (!process.env.MONGODB_URI) {
      console.error('[ATTENDANCE CRON ERROR] MONGODB_URI environment variable is missing.');
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[ATTENDANCE CRON] Connected to MongoDB. Running autoCheckoutStaleRecords & syncMembershipStatuses...');
    const count = await autoCheckoutStaleRecords();
    console.log(`[ATTENDANCE CRON] Successfully processed ${count} stale records.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[ATTENDANCE CRON ERROR]:', err);
    process.exit(1);
  }
}

export default {
  initAttendanceCron,
  autoCheckoutStaleRecords,
  syncMembershipStatuses,
  sendPassExpiryAlerts,
  sendWorkoutReminders,
};
