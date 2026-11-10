import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { membershipService } from '../services/membershipService';
import { getSafeImageUri, getGymLogoUri, getGymCoverImage } from '../utils/mediaUtils';

const BookingContext = createContext();

export const mapBackendBookingToClient = (b) => {
  if (!b) return null;
  const startStr = b.startDate
    ? new Date(b.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const endStr = b.endDate
    ? new Date(b.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const dateSummary = startStr && endStr && startStr !== endStr ? `${startStr} - ${endStr}` : (startStr || b.date || 'Scheduled Batch');

  const durDays = b.durationDays || b.sessionsCount || 1;

  const now = new Date();
  let resolvedStatus = b.status || 'Upcoming';
  if (resolvedStatus !== 'Cancelled' && resolvedStatus !== 'Cancellation_Requested' && resolvedStatus !== 'Completed') {
    if (b.isCustomDates && Array.isArray(b.customDates) && b.customDates.length > 0) {
      const allCustomDatesPassed = b.customDates.every((cd) => {
        if (!cd || !cd.date) return true;
        const endOfDay = new Date(cd.date);
        endOfDay.setHours(23, 59, 59, 999);
        return now > endOfDay || cd.status === 'Attended' || cd.status === 'Missed';
      });
      if (allCustomDatesPassed) {
        resolvedStatus = 'Completed';
      }
    } else {
      const sDate = b.startDate ? new Date(b.startDate) : null;
      if (sDate) sDate.setHours(0, 0, 0, 0);
      const eDate = b.endDate ? new Date(b.endDate) : null;
      if (eDate) eDate.setHours(23, 59, 59, 999);

      if (sDate && sDate <= now && (!eDate || eDate >= now)) {
        resolvedStatus = 'Active';
      } else if (eDate && eDate < now) {
        resolvedStatus = 'Completed';
      }
    }
  }

  const resolvedGymLogo =
    getSafeImageUri(b.gymLogo) ||
    getGymLogoUri(b.gymId) ||
    getGymLogoUri(b.gym) ||
    getSafeImageUri(b.gymImageUrl) ||
    null;

  return {
    ...b,
    id: b.bookingId || b.id || b._id,
    _id: b._id,
    bookingId: b.bookingId || b.id,
    customerId: b.userId?.customerId || b.customerId || 'GYZ0001',
    gymName: b.gymId?.name || b.gymName || 'GYMEZY Partner Gym',
    gymLocation: b.gymId?.location || b.gymId?.address?.city || b.gymLocation || '',
    gymLogo: resolvedGymLogo,
    gymImageUrl: resolvedGymLogo || getGymCoverImage(b.gymId || b.gym),
    type: b.bookingType === 'GROUP_CLASS'
      ? 'Group Class'
      : (b.bookingType === 'SECTION' ? 'Section Batch' : (b.type || 'Gym Access')),
    sessionSubtitle: b.title || b.sessionSubtitle || 'Workout Session',
    date: dateSummary,
    startDateStr: startStr,
    endDateStr: endStr,
    time: b.timeSlot || b.time || 'Scheduled Time',
    daysBooked: `${durDays} ${durDays > 1 ? 'Days' : 'Day'} Batch`,
    amountPaid: b.pricing?.totalAmount ?? b.amountPaid ?? 0,
    paymentMode: b.payment?.method || b.paymentMode || 'UPI',
    otp: b.entryOtp || b.otp || '',
    isCustomDates: Boolean(b.isCustomDates || (Array.isArray(b.customDates) && b.customDates.length > 0)),
    isTodayValid: b.isTodayValid !== undefined ? b.isTodayValid : true,
    customDates: b.customDates || [],
    nextSessionDateFormatted: b.nextSessionDateFormatted || null,
    status: resolvedStatus,
    iconName: b.category === 'yoga' ? 'self-improvement' : (b.category === 'zumba' ? 'music-note' : 'fitness-center'),
    accentColor: '#003882',
    sectionId: b.sectionId?._id || b.sectionId,
    trainerId: b.trainerId,
    rawBackendBooking: b,
  };
};

export const BookingProvider = ({ children }) => {
  const [bookings, setBookings] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);

  const refreshBookings = useCallback(async () => {
    try {
      setIsLoadingBookings(true);
      const serverBookings = await apiService.getMyBookings();
      if (Array.isArray(serverBookings) && serverBookings.length > 0) {
        const mapped = serverBookings.map(mapBackendBookingToClient);
        setBookings(mapped);
      }
    } catch (err) {
      console.warn('[BOOKING CONTEXT] Failed to sync bookings from server:', err?.message);
    } finally {
      setIsLoadingBookings(false);
    }
  }, []);

  useEffect(() => {
    refreshBookings();
  }, [refreshBookings]);

  const addBooking = (item) => {
    const normalized = mapBackendBookingToClient(item);
    setBookings((prev) => [normalized, ...prev.filter((b) => b.id !== normalized.id)]);
  };

  const updateBooking = (updated) => {
    const normalized = mapBackendBookingToClient(updated);
    setBookings((prev) => prev.map((b) => (b.id === normalized.id ? normalized : b)));
  };

  const cancelBooking = async (bookingId, reason = 'Cancelled by member') => {
    try {
      const updated = await apiService.cancelBooking(bookingId, reason);
      if (updated) {
        const mapped = mapBackendBookingToClient(updated);
        updateBooking(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('[BOOKING CONTEXT] Server cancel booking failed:', err?.message);
      throw err;
    }
  };

  const addMembership = (item) => {
    setMemberships((prev) => [item, ...prev]);
  };

  const updateMembership = (updated) => {
    setMemberships((prev) =>
      prev.map((m) =>
        (updated._id && m._id && String(m._id) === String(updated._id)) ||
        (m.id && updated.id && String(m.id) === String(updated.id))
          ? updated
          : m
      )
    );
  };

  const cancelMembership = async (membershipId, reason) => {
    const negotiation = await membershipService.requestCancellationNegotiation(membershipId, reason);
    setMemberships((prev) =>
      prev.map((m) =>
        m.id === membershipId ||
        (m._id && String(m._id) === String(membershipId)) ||
        m.membershipId === membershipId
          ? {
              ...m,
              status: negotiation?.status === 'COMPLETED' ? 'Cancelled' : m.status,
              cancellationNegotiation: negotiation,
              cancellationStatus: negotiation?.status || 'PENDING_GYM_APPROVAL',
            }
          : m
      )
    );
    return negotiation;
  };

  const setAllMemberships = (items) => {
    setMemberships(Array.isArray(items) ? items : []);
  };

  const setAllBookings = (items) => {
    if (Array.isArray(items)) {
      setBookings(items.map(mapBackendBookingToClient));
    }
  };

  const contextValue = useMemo(
    () => ({
      bookings,
      memberships,
      isLoadingBookings,
      refreshBookings,
      addBooking,
      updateBooking,
      cancelBooking,
      setAllBookings,
      addMembership,
      setAllMemberships,
      updateMembership,
      cancelMembership,
    }),
    [bookings, memberships, isLoadingBookings, refreshBookings]
  );

  return (
    <BookingContext.Provider value={contextValue}>
      {children}
    </BookingContext.Provider>
  );
};

export const useBookingRepository = () => {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBookingRepository must be used within a BookingProvider');
  }
  return context;
};
