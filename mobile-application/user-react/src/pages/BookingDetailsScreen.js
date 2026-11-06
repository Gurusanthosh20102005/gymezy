import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  Dimensions,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { AppColors, AppTheme } from '../theme/appTheme';
import { MonthlyGridCalendar } from '../widgets/CustomCalendar';
import { DigitalQrPassCard } from '../widgets/DigitalQrPassCard';
import { useBookingRepository } from '../data/BookingContext';
import { useToast } from '../widgets/CustomScaffoldMessage';
import { apiService } from '../services/apiService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TIME_SLOTS = [
  '6:00 AM - 7:00 AM',
  '7:00 AM - 8:00 AM',
  '8:00 AM - 9:00 AM',
  '9:00 AM - 10:00 AM',
  '5:00 PM - 6:00 PM',
  '6:00 PM - 7:00 PM',
  '7:00 PM - 8:00 PM',
  '8:00 PM - 9:00 PM',
];

const CANCEL_REASONS = [
  'Change of plans / Schedule conflict',
  'Feeling unwell / Medical reasons',
  'Booked the wrong date or time',
  'Booked wrong gym location',
  'Personal emergency',
  'Other',
];

export const BookingDetailsScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { booking: initialBooking } = route.params;
  const { isDark, colors } = useTheme();
  const { bookings, updateBooking, cancelBooking } = useBookingRepository();
  const { showToast } = useToast();

  const booking = bookings.find((b) => b.id === initialBooking.id) || initialBooking;
  const isCompleted = booking.status === 'Completed';
  const isPendingCancellation = booking.status === 'Cancellation_Requested';
  const isPassVisible =
    (booking.status === 'Active' ||
    booking.status === 'Upcoming' ||
    booking.status === 'Confirmed') && !isPendingCancellation;
  const isActionable = isPassVisible && !isCompleted;

  // Cancellation quote preview & submission state
  const [cancellationQuote, setCancellationQuote] = useState(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Modals state
  const [showFullscreenQr, setShowFullscreenQr] = useState(false);
  const [showModifySheet, setShowModifySheet] = useState(false);
  const [showCancelSheet, setShowCancelSheet] = useState(false);

  // Modify Booking Sheet State
  const [modifyDate, setModifyDate] = useState(new Date(Date.now() + 86400000));
  const [modifyTime, setModifyTime] = useState(booking.time);

  // Cancel Booking Sheet State
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0]);

  // Custom Dates Reschedule State
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null); // { index, date }
  const [selectedRescheduleDate, setSelectedRescheduleDate] = useState(null);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);
  const [isRespondingProposal, setIsRespondingProposal] = useState(false);

  const getEligibleDatesForSession = (sessionIndex, customDates) => {
    if (!Array.isArray(customDates)) return { dates: [], nextSessionDate: null };
    const nextSession = customDates.slice(sessionIndex + 1).find(
      (s) => s.status === 'Scheduled' || s.status === 'Rescheduled'
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let maxLimit;
    let nextDateObj = null;
    if (nextSession) {
      nextDateObj = new Date(nextSession.date);
      nextDateObj.setHours(0, 0, 0, 0);
      maxLimit = new Date(nextDateObj.getTime() - 86400000);
    } else {
      maxLimit = new Date(today.getTime() + 7 * 86400000);
    }

    const dates = [];
    let cur = new Date(today);
    while (cur <= maxLimit) {
      dates.push(new Date(cur));
      cur = new Date(cur.getTime() + 86400000);
    }
    return { dates, nextSessionDate: nextDateObj };
  };

  const formatSessionDate = (d) => {
    if (!d) return '';
    const dateObj = new Date(d);
    if (Number.isNaN(dateObj.getTime())) return String(d);
    return dateObj.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleOpenReschedule = (sessionIndex, sessionDate) => {
    const { dates } = getEligibleDatesForSession(sessionIndex, booking.customDates);
    setRescheduleTarget({ index: sessionIndex, date: sessionDate });
    setSelectedRescheduleDate(dates.length > 0 ? dates[0] : null);
    setRescheduleReason('');
    setShowRescheduleModal(true);
  };

  const handleSubmitReschedule = async () => {
    if (!rescheduleTarget || !selectedRescheduleDate) {
      showToast({ message: 'Please select a valid reschedule date.', isSuccess: false });
      return;
    }
    try {
      setIsSubmittingReschedule(true);
      const reqDateStr = selectedRescheduleDate.toISOString().split('T')[0];
      const updated = await apiService.requestBookingReschedule(booking._id || booking.id, {
        sessionIndex: rescheduleTarget.index,
        sessionDate: rescheduleTarget.date,
        requestedDate: reqDateStr,
        reason: rescheduleReason,
      });
      if (updated) {
        updateBooking(updated);
      }
      setShowRescheduleModal(false);
      showToast({
        message: 'Reschedule request submitted to gym owner for approval.',
        isSuccess: true,
      });
    } catch (err) {
      showToast({
        message: err.message || 'Failed to submit reschedule request.',
        isSuccess: false,
      });
    } finally {
      setIsSubmittingReschedule(false);
    }
  };

  const handleRespondProposal = async (sessionIndex, sessionDate, decision) => {
    try {
      setIsRespondingProposal(true);
      const updated = await apiService.respondRescheduleProposal(booking._id || booking.id, {
        sessionIndex,
        sessionDate,
        decision,
      });
      if (updated) {
        updateBooking(updated);
      }
      showToast({
        message: decision === 'ACCEPT' ? 'Proposed date accepted!' : 'Proposed date declined.',
        isSuccess: true,
      });
    } catch (err) {
      showToast({
        message: err.message || 'Failed to update proposal response.',
        isSuccess: false,
      });
    } finally {
      setIsRespondingProposal(false);
    }
  };

  const copyToClipboard = async (text, label) => {
    await Clipboard.setStringAsync(text);
    showToast({
      message: `${label} copied to clipboard`,
      isSuccess: true,
    });
  };

  const handleUpdateBooking = () => {
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = weekdays[modifyDate.getDay() === 0 ? 6 : modifyDate.getDay() - 1];
    const monthName = months[modifyDate.getMonth()];
    const formattedDate = `${dayName}, ${modifyDate.getDate()} ${monthName} ${modifyDate.getFullYear()}`;

    const updated = {
      ...booking,
      date: formattedDate,
      time: modifyTime,
    };
    updateBooking(updated);
    setShowModifySheet(false);
    showToast({
      message: `Booking rescheduled to ${formattedDate} at ${modifyTime}`,
      isSuccess: true,
    });
  };

  const handleOpenCancelSheet = async () => {
    setShowCancelSheet(true);
    setIsLoadingQuote(true);
    try {
      const quote = await apiService.getBookingCancellationQuote(booking.id || booking._id || booking.bookingId);
      setCancellationQuote(quote);
    } catch (err) {
      console.warn('Failed to load cancellation quote:', err?.message);
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const handleConfirmCancel = async () => {
    setIsSubmittingCancel(true);
    try {
      const updated = await cancelBooking(booking.id || booking._id || booking.bookingId, cancelReason);
      setShowCancelSheet(false);
      if (updated?.status === 'Cancellation_Requested') {
        showToast({
          message: 'Cancellation request submitted to Gym Owner for review.',
          isSuccess: true,
        });
      } else {
        const refundAmount = cancellationQuote?.refundAmount ?? Math.round(booking.amountPaid || 0);
        showToast({
          message: refundAmount > 0
            ? `Booking cancelled. Refund of ₹${refundAmount} initiated to your original payment method.`
            : 'Booking cancelled successfully.',
          isSuccess: true,
        });
      }
    } catch (err) {
      showToast({
        message: err?.message || 'Failed to cancel booking.',
        isSuccess: false,
      });
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const getStatusColors = (status) => {
    if (status === 'Active') {
      return { text: '#00BF62', bg: 'rgba(0, 191, 98, 0.12)' };
    } else if (status === 'Confirmed' || status === 'Upcoming') {
      return { text: '#D97706', bg: 'rgba(217, 119, 6, 0.12)' };
    } else if (status === 'Completed') {
      return { text: '#6B7280', bg: 'rgba(107, 114, 128, 0.12)' };
    } else if (status === 'Cancellation_Requested') {
      return { text: '#D97706', bg: 'rgba(217, 119, 6, 0.12)' };
    } else {
      return { text: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' };
    }
  };
  const statusColors = getStatusColors(booking.status);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top App Bar */}
      <SafeAreaView style={{ backgroundColor: colors.background }}>
        <View style={styles.appBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back-ios" size={18} color={colors.text} />
          </TouchableOpacity>

          <Text style={[styles.appBarTitle, { color: colors.text }]}>Digital Entry Pass</Text>

          <View style={styles.fullscreenBtn} />
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 40 + (insets.bottom > 0 ? insets.bottom + 12 : 16) },
        ]}
      >
        {/* Session Completed Notice */}
        {isCompleted && (
          <View style={[styles.statusNoticeCard, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6', borderColor: isDark ? '#374151' : '#E5E7EB', marginBottom: 18, padding: 16, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center' }]}>
            <MaterialIcons name="check-circle" size={26} color="#10B981" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Session Completed</Text>
              <Text style={{ fontSize: 13, color: colors.subtitle, marginTop: 3, lineHeight: 18 }}>
                This workout session has concluded. Completed sessions cannot be cancelled or refunded.
              </Text>
            </View>
          </View>
        )}

        {/* Cancellation Under Review Notice */}
        {isPendingCancellation && (
          <View style={[styles.statusNoticeCard, { backgroundColor: isDark ? '#2D2013' : '#FFFBEB', borderColor: '#F59E0B', marginBottom: 18, padding: 16, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'flex-start' }]}>
            <MaterialIcons name="hourglass-empty" size={24} color="#D97706" style={{ marginTop: 2 }} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#D97706' }}>Cancellation Under Review</Text>
              <Text style={{ fontSize: 13, color: colors.text, marginTop: 4, lineHeight: 18 }}>
                Your cancellation request has been forwarded to the Gym Owner for approval.
              </Text>
              <View style={{ marginTop: 8, padding: 10, backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(217, 119, 6, 0.08)', borderRadius: 8 }}>
                <Text style={{ fontSize: 12, color: colors.text }}>
                  • Consumed: {booking.cancellation?.consumedDays || 1} day(s) (-₹{booking.cancellation?.deductedAmount || 0})
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 3 }}>
                  • Expected Refund: ₹{booking.cancellation?.refundAmount || 0} to Original Payment Method
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.subtitle, marginTop: 6 }}>
                Entry QR & OTP are temporarily suspended while this request is being reviewed.
              </Text>
            </View>
          </View>
        )}

        {/* Cancellation Rejected Alert */}
        {booking.cancellation?.cancellationStatus === 'REJECTED' && (
          <View style={[styles.statusNoticeCard, { backgroundColor: isDark ? '#2B1718' : '#FEF2F2', borderColor: '#EF4444', marginBottom: 18, padding: 16, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'flex-start' }]}>
            <MaterialIcons name="info" size={24} color="#EF4444" style={{ marginTop: 2 }} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#EF4444' }}>Cancellation Rejected by Gym</Text>
              <Text style={{ fontSize: 13, color: colors.text, marginTop: 3 }}>
                Reason: {booking.cancellation?.rejectionReason || 'Gym owner rejected the cancellation request.'}
              </Text>
              <Text style={{ fontSize: 11, color: colors.subtitle, marginTop: 4 }}>
                Your entry pass has been restored so you can complete your remaining workouts.
              </Text>
            </View>
          </View>
        )}

        {/* 1. Digital Entry Pass Card */}
        {isPassVisible && (
          <View style={{ marginBottom: 18 }}>
            <DigitalQrPassCard
              passId={booking.id}
              customerId={booking.customerId}
              otp={booking.otp}
              gymName={booking.gymName}
              subtitle={booking.sessionSubtitle}
              primaryDateLabel={booking.isCustomDates ? 'CUSTOM DATES' : 'BATCH DATES'}
              primaryDateValue={booking.date}
              secondaryDateLabel="TIME SLOT"
              secondaryDateValue={booking.time}
              status={booking.status}
              iconName="fitness-center"
              gymImageUrl={booking.gymLogo || booking.gymImageUrl}
              accentColor={isDark ? '#93C5FD' : AppColors.primaryColor}
              qrValue={booking.qrCodeData || booking.rawBackendBooking?.qrCodeData}
              passType="BOOKING"
              isCustomDates={booking.isCustomDates}
              isTodayValid={booking.isTodayValid}
              nextSessionDateFormatted={booking.nextSessionDateFormatted}
            />
          </View>
        )}

        {/* Check-in & Attendance History Action Card */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate('AttendanceHistory', {
              bookingId: booking.id || booking._id,
              title: `${booking.sessionSubtitle || booking.title || 'Session'} Attendance`,
              contextName: `${booking.gymName || 'Gym'} • ${booking.id || booking.bookingId}`,
            })
          }
          style={[
            styles.attendanceActionTile,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              marginBottom: 18,
            },
          ]}
        >
          <View style={[styles.attendanceIconBox, { backgroundColor: isDark ? '#1E293B' : 'rgba(0, 56, 130, 0.08)' }]}>
            <MaterialIcons name="history" size={22} color={isDark ? '#93C5FD' : '#003882'} />
          </View>
          <View style={styles.attendanceTileContent}>
            <Text style={[styles.attendanceTileTitle, { color: colors.text }]}>Check-in & Attendance History</Text>
            <Text style={[styles.attendanceTileSubtitle, { color: colors.subtitle }]}>
              {booking.attendedSessionsCount
                ? `${booking.attendedSessionsCount} session(s) attended • View check-in logs`
                : 'View all turnstile check-ins for this pass'}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={colors.subtitle} />
        </TouchableOpacity>

        {/* Custom Sessions Schedule Breakdown */}
        {booking.isCustomDates && Array.isArray(booking.customDates) && booking.customDates.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={[styles.summaryHeader, { color: colors.text, marginBottom: 0 }]}>
                Custom Sessions Schedule
              </Text>
              <View style={[styles.statusPill, { backgroundColor: 'rgba(0, 56, 130, 0.1)' }]}>
                <Text style={[styles.statusPillText, { color: AppColors.primaryColor, fontWeight: '700' }]}>
                  {booking.customDates.length} Days Plan
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  padding: 12,
                },
              ]}
            >
              {booking.customDates.map((item, idx) => {
                const sessionDateStr = formatSessionDate(item.date);
                const isMissed = item.status === 'Missed';
                const isAttended = item.status === 'Attended';
                const isProposed = item.status === 'Reschedule_Proposed';
                const isRequested = item.status === 'Reschedule_Requested';
                const isRescheduled = item.status === 'Rescheduled';

                let tagBg = 'rgba(2, 132, 199, 0.12)';
                let tagColor = '#0284C7';
                let tagLabel = 'Scheduled';

                if (isAttended) {
                  tagBg = 'rgba(5, 150, 105, 0.12)';
                  tagColor = '#059669';
                  tagLabel = 'Attended';
                } else if (isMissed) {
                  tagBg = 'rgba(220, 38, 38, 0.12)';
                  tagColor = '#DC2626';
                  tagLabel = 'Missed';
                } else if (isRequested) {
                  tagBg = 'rgba(217, 119, 6, 0.12)';
                  tagColor = '#D97706';
                  tagLabel = 'Reschedule Requested';
                } else if (isProposed) {
                  tagBg = 'rgba(124, 58, 237, 0.12)';
                  tagColor = '#7C3AED';
                  tagLabel = 'Gym Proposed New Date';
                } else if (isRescheduled) {
                  tagBg = 'rgba(13, 148, 136, 0.12)';
                  tagColor = '#0D9488';
                  tagLabel = 'Rescheduled';
                }

                return (
                  <View
                    key={idx}
                    style={[
                      styles.customSessionItem,
                      {
                        backgroundColor: isDark ? '#262626' : '#F8FAFC',
                        borderColor: colors.border,
                        marginBottom: idx === booking.customDates.length - 1 ? 0 : 12,
                      },
                    ]}
                  >
                    <View style={styles.customSessionHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[styles.sessionNumberBadge, { backgroundColor: isDark ? 'rgba(147, 197, 253, 0.15)' : 'rgba(0, 56, 130, 0.1)' }]}>
                          <Text style={[styles.sessionNumberText, { color: isDark ? '#93C5FD' : AppColors.primaryNavy }]}>
                            {idx + 1}
                          </Text>
                        </View>
                        <View style={{ marginLeft: 10 }}>
                          <Text style={[styles.customSessionDate, { color: colors.text }]}>
                            {sessionDateStr}
                          </Text>
                          {item.dailyOtp ? (
                            <Text style={[styles.customSessionOtp, { color: colors.subtitle }]}>
                              Daily Pass OTP: <Text style={{ fontWeight: '700', color: colors.text }}>{item.dailyOtp}</Text>
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <View style={[styles.statusPill, { backgroundColor: tagBg }]}>
                        <Text style={[styles.statusPillText, { color: tagColor }]}>{tagLabel}</Text>
                      </View>
                    </View>

                    {/* Missed session prompt to reschedule */}
                    {isMissed && (
                      <View style={[styles.sessionActionRow, { borderTopColor: colors.border }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.missedNoticeText, { color: '#DC2626' }]}>
                            You missed this session. Reschedule before your next scheduled date.
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.rescheduleBtn}
                          onPress={() => handleOpenReschedule(idx, item.date)}
                        >
                          <MaterialIcons name="edit-calendar" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.rescheduleBtnText}>Reschedule</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Reschedule Requested Info */}
                    {isRequested && item.requestedDate && (
                      <View style={[styles.pendingNoticeBox, { backgroundColor: 'rgba(217, 119, 6, 0.08)', borderColor: 'rgba(217, 119, 6, 0.25)' }]}>
                        <MaterialIcons name="schedule" size={16} color="#D97706" />
                        <Text style={[styles.pendingNoticeText, { color: '#B45309' }]}>
                          Requested Date: {formatSessionDate(item.requestedDate)} (Awaiting Gym Approval)
                        </Text>
                      </View>
                    )}

                    {/* Reschedule Proposed with Accept / Decline */}
                    {isProposed && item.proposedDate && (
                      <View style={[styles.proposedBox, { backgroundColor: 'rgba(124, 58, 237, 0.08)', borderColor: 'rgba(124, 58, 237, 0.25)' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                          <MaterialIcons name="notifications-active" size={16} color="#7C3AED" />
                          <Text style={[styles.proposedTitle, { color: '#7C3AED' }]}>
                            Gym proposed a new date: {formatSessionDate(item.proposedDate)}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <TouchableOpacity
                            style={[styles.acceptProposalBtn, { opacity: isRespondingProposal ? 0.6 : 1 }]}
                            disabled={isRespondingProposal}
                            onPress={() => handleRespondProposal(idx, item.date, 'ACCEPT')}
                          >
                            <MaterialIcons name="check" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={styles.acceptProposalText}>Accept Date</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.declineProposalBtn, { opacity: isRespondingProposal ? 0.6 : 1 }]}
                            disabled={isRespondingProposal}
                            onPress={() => handleRespondProposal(idx, item.date, 'DECLINE')}
                          >
                            <MaterialIcons name="close" size={15} color="#EF4444" style={{ marginRight: 4 }} />
                            <Text style={styles.declineProposalText}>Decline</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* Rescheduled info */}
                    {isRescheduled && item.rescheduledTo && (
                      <View style={[styles.rescheduledNoticeBox, { backgroundColor: 'rgba(13, 148, 136, 0.08)', borderColor: 'rgba(13, 148, 136, 0.25)' }]}>
                        <MaterialIcons name="event-repeat" size={16} color="#0D9488" />
                        <Text style={[styles.rescheduledNoticeText, { color: '#0F766E' }]}>
                          Successfully rescheduled to {formatSessionDate(item.rescheduledTo)}
                        </Text>
                      </View>
                    )}

                    {/* Attended info */}
                    {isAttended && item.attendedAt && (
                      <View style={[styles.attendedNoticeBox, { backgroundColor: 'rgba(5, 150, 105, 0.08)', borderColor: 'rgba(5, 150, 105, 0.25)' }]}>
                        <MaterialIcons name="check-circle" size={16} color="#059669" />
                        <Text style={[styles.attendedNoticeText, { color: '#047857' }]}>
                          Attended at {new Date(item.attendedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Cancelled Banner */}
        {booking.status === 'Cancelled' && (
          <View
            style={[
              styles.cancelledBanner,
              {
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
              },
            ]}
          >
            <MaterialIcons name="cancel" size={28} color="#EF4444" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cancelledBannerTitle}>This Booking Has Been Cancelled</Text>
              <Text style={[styles.cancelledBannerSub, { color: colors.subtitle }]}>
                Reason: {booking.cancellationReason || 'User Requested'}
              </Text>
            </View>
          </View>
        )}

        {/* 2. Detailed Receipt Information Table */}
        <Text style={[styles.summaryHeader, { color: colors.text }]}>Booking Summary</Text>

        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Booking ID */}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.subtitle }]}>Booking ID</Text>
            <TouchableOpacity
              onPress={() => copyToClipboard(booking.id, 'Booking ID')}
              style={styles.copyValueRow}
              activeOpacity={0.7}
            >
              <Text style={[styles.detailValue, { color: colors.text }]}>{booking.id}</Text>
              <MaterialIcons
                name="content-copy"
                size={14}
                color={AppColors.secondaryColor}
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Customer ID */}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.subtitle }]}>Customer ID</Text>
            <TouchableOpacity
              onPress={() => copyToClipboard(booking.customerId, 'Customer ID')}
              style={styles.copyValueRow}
              activeOpacity={0.7}
            >
              <Text style={[styles.detailValue, { color: colors.text }]}>{booking.customerId}</Text>
              <MaterialIcons
                name="content-copy"
                size={14}
                color={AppColors.secondaryColor}
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Gym / Class */}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.subtitle }]}>Gym / Class</Text>
            <Text style={[styles.detailValue, { color: colors.text, fontWeight: '700' }]}>
              {booking.gymName}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Session Type */}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.subtitle }]}>Session Type</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {booking.sessionSubtitle || booking.type}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Date */}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.subtitle }]}>Date</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{booking.date}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Time */}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.subtitle }]}>Time</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{booking.time}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Days Booked */}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.subtitle }]}>Days Booked</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{booking.daysBooked}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Amount Paid */}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.subtitle }]}>Amount Paid</Text>
            <Text
              style={[
                styles.detailValue,
                {
                  color: AppColors.secondaryColor,
                  fontWeight: '800',
                  fontSize: 15,
                },
              ]}
            >
              ₹{Math.round(booking.amountPaid)}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Payment Mode */}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.subtitle }]}>Payment Mode</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {booking.paymentMode}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Booking Status */}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.subtitle }]}>Booking Status</Text>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: statusColors.bg },
              ]}
            >
              <Text style={[styles.statusPillText, { color: statusColors.text }]}>
                {booking.status === 'Upcoming' ? 'Confirmed' : booking.status}
              </Text>
            </View>
          </View>
        </View>

        {/* 3. Action Buttons (Modify & Cancel) */}
        {isActionable && (
          <View style={styles.actionsRow}>
            {/* Modify Booking Button */}
            <TouchableOpacity
              onPress={() => setShowModifySheet(true)}
              style={[
                styles.actionBtn,
                {
                  borderColor: isDark ? '#93C5FD' : AppColors.primaryColor,
                },
              ]}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="edit-calendar"
                size={16}
                color={isDark ? '#93C5FD' : AppColors.primaryColor}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.actionBtnText,
                  { color: isDark ? '#93C5FD' : AppColors.primaryColor },
                ]}
              >
                Modify Booking
              </Text>
            </TouchableOpacity>

            {/* Cancel Booking Button */}
            <TouchableOpacity
              onPress={handleOpenCancelSheet}
              style={[
                styles.actionBtn,
                {
                  borderColor: 'rgba(239, 68, 68, 0.6)',
                  marginLeft: 12,
                },
              ]}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="delete-outline"
                size={16}
                color="#EF4444"
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Cancel Booking</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ========================================== */}
      {/* FULLSCREEN QR PASS MODAL                   */}
      {/* ========================================== */}
      <Modal
        visible={showFullscreenQr}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFullscreenQr(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.fullscreenQrCard}>
            {/* Header */}
            <View style={styles.fullscreenHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fullscreenGymName}>{booking.gymName}</Text>
                <Text style={styles.fullscreenPassId}>Pass ID: {booking.id}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowFullscreenQr(false)}
                style={styles.fullscreenCloseBtn}
              >
                <MaterialIcons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Dot-matrix style large QR Canvas */}
            <View style={styles.largeQrWrapper}>
              <QRCode
                value={
                  booking.qrCodeData ||
                  booking.rawBackendBooking?.qrCodeData ||
                  JSON.stringify({
                    type: 'BOOKING',
                    id: booking.id,
                    bookingId: booking.id,
                    customerId: booking.customerId,
                    entryOtp: booking.otp,
                  })
                }
                size={230}
                color="#0F172A"
                backgroundColor="#FFFFFF"
              />
              {/* Centered GymEzy Logo Overlay */}
              <View style={styles.qrLogoOverlay}>
                <Image
                  source={require('../../assets/logo/gymezy.png')}
                  style={styles.qrLogoImage}
                  resizeMode="contain"
                />
              </View>
            </View>

            <Text style={styles.fullscreenHint}>Present this screen to the gym scanner</Text>
          </View>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* MODIFY BOOKING MODAL SHEET                 */}
      {/* ========================================== */}
      <Modal
        visible={showModifySheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModifySheet(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 20,
              },
            ]}
          >
            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Modify Booking</Text>
              <TouchableOpacity onPress={() => setShowModifySheet(false)}>
                <MaterialIcons name="close" size={24} color={colors.subtitle} />
              </TouchableOpacity>
            </View>

            {/* Current Booking Info Card */}
            <View
              style={[
                styles.currentBookingCard,
                {
                  backgroundColor: isDark ? '#262626' : '#F8FAFC',
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.bookingIconBox}>
                <MaterialIcons name="fitness-center" size={20} color={AppColors.secondaryColor} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.bookingGymTitle, { color: colors.text }]}>
                  {booking.gymName}
                </Text>
                <Text style={[styles.bookingSubtitle, { color: colors.subtitle }]}>
                  {booking.sessionSubtitle}
                </Text>
                <Text style={styles.bookingDateTime}>
                  {booking.date} • {booking.time}
                </Text>
              </View>
            </View>

            {/* Month Grid Calendar Selector */}
            <View style={{ marginTop: 14 }}>
              <MonthlyGridCalendar
                selectedDate={modifyDate}
                minDate={new Date(Date.now() + 86400000)}
                maxMonthsAhead={3}
                wrapInCard={true}
                showMonthHeader={true}
                onDateSelected={(date) => setModifyDate(date)}
              />
            </View>

            {/* Time Slot Picker */}
            <Text style={[styles.slotSectionTitle, { color: colors.text }]}>
              Select Time Slot
            </Text>
            <View style={styles.timeSlotsWrap}>
              {TIME_SLOTS.map((slot) => {
                const isSelected = modifyTime === slot;
                return (
                  <TouchableOpacity
                    key={slot}
                    onPress={() => setModifyTime(slot)}
                    style={[
                      styles.slotChip,
                      {
                        backgroundColor: isSelected
                          ? AppColors.primaryColor
                          : isDark
                          ? '#262626'
                          : '#F1F5F9',
                        borderColor: isSelected ? AppColors.primaryColor : colors.border,
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.slotChipText,
                        {
                          color: isSelected ? '#FFFFFF' : colors.text,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {slot}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Update Booking CTA */}
            <TouchableOpacity
              onPress={handleUpdateBooking}
              style={[
                styles.sheetPrimaryBtn,
                { backgroundColor: AppColors.secondaryColor },
              ]}
              activeOpacity={0.85}
            >
              <Text style={styles.sheetPrimaryBtnText}>Update Booking</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* ========================================== */}
      {/* CANCEL BOOKING MODAL SHEET                 */}
      {/* ========================================== */}
      <Modal
        visible={showCancelSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCancelSheet(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                maxHeight: '85%',
                paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 20,
              },
            ]}
          >
            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Cancel Booking</Text>
              <TouchableOpacity onPress={() => setShowCancelSheet(false)}>
                <MaterialIcons name="close" size={24} color={colors.subtitle} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Loading State */}
              {isLoadingQuote ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={isDark ? '#93C5FD' : AppColors.primaryColor} />
                  <Text style={{ marginTop: 10, fontSize: 13, color: colors.subtitle }}>Calculating cancellation refund quote...</Text>
                </View>
              ) : (
                <>
                  {/* Dynamic Refund Quote Summary */}
                  {cancellationQuote && (
                    <View
                      style={[
                        styles.currentBookingCard,
                        {
                          backgroundColor: isDark ? '#262626' : '#F8FAFC',
                          borderColor: cancellationQuote.requiresGymApproval ? '#F59E0B' : colors.border,
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          marginBottom: 14,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.subtitle, textTransform: 'uppercase' }}>
                          {cancellationQuote.requiresGymApproval ? 'Partial Cancellation (Prorated)' : 'Pre-Start Full Refund'}
                        </Text>
                        <View style={[styles.statusPill, { backgroundColor: cancellationQuote.requiresGymApproval ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)' }]}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: cancellationQuote.requiresGymApproval ? '#D97706' : '#10B981' }}>
                            {cancellationQuote.requiresGymApproval ? 'Gym Review Required' : 'Instant Approval'}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                        <Text style={{ fontSize: 13, color: colors.subtitle }}>Total Paid</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>₹{cancellationQuote.totalAmount}</Text>
                      </View>

                      {cancellationQuote.consumedDays > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                          <Text style={{ fontSize: 13, color: colors.subtitle }}>Consumed ({cancellationQuote.consumedDays} of {cancellationQuote.totalDays} sessions)</Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: '#EF4444' }}>-₹{cancellationQuote.deductedAmount}</Text>
                        </View>
                      )}

                      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Net Refundable Amount</Text>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#10B981' }}>₹{cancellationQuote.refundAmount}</Text>
                      </View>
                    </View>
                  )}

                  {/* Reason Selector */}
                  <Text style={[styles.reasonTitle, { color: colors.text, marginBottom: 8 }]}>
                    Reason for Cancellation
                  </Text>
                  <View style={styles.reasonsList}>
                    {CANCEL_REASONS.map((r) => {
                      const isSelected = cancelReason === r;
                      return (
                        <TouchableOpacity
                          key={r}
                          onPress={() => setCancelReason(r)}
                          style={styles.reasonRadioRow}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons
                            name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                            size={20}
                            color={isSelected ? '#EF4444' : colors.subtitle}
                          />
                          <Text
                            style={[
                              styles.reasonRadioText,
                              {
                                color: colors.text,
                                fontWeight: isSelected ? '700' : '500',
                              },
                            ]}
                          >
                            {r}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Policy Notice Box */}
                  <View style={[styles.policyNoticeBox, { marginTop: 10, marginBottom: 16 }]}>
                    <MaterialIcons name="info-outline" size={18} color="#D97706" />
                    <Text style={styles.policyNoticeText}>
                      {cancellationQuote?.policyNotice || 'Refunds are reversed to your original payment method in 5-7 business days.'}
                    </Text>
                  </View>

                  {/* Confirm Cancel Button */}
                  <TouchableOpacity
                    onPress={handleConfirmCancel}
                    disabled={isSubmittingCancel || (cancellationQuote && !cancellationQuote.canCancel)}
                    style={[
                      styles.sheetPrimaryBtn,
                      {
                        backgroundColor: cancellationQuote?.requiresGymApproval ? '#D97706' : '#EF4444',
                        opacity: isSubmittingCancel || (cancellationQuote && !cancellationQuote.canCancel) ? 0.6 : 1,
                        marginBottom: 16,
                      },
                    ]}
                    activeOpacity={0.85}
                  >
                    {isSubmittingCancel ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.sheetPrimaryBtnText}>
                        {cancellationQuote?.requiresGymApproval
                          ? 'Submit Cancellation Request'
                          : 'Confirm Cancellation & Refund'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* RESCHEDULE SESSION MODAL                   */}
      {/* ========================================== */}
      <Modal
        visible={showRescheduleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRescheduleModal(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                maxHeight: '85%',
                paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 20,
              },
            ]}
          >
            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Reschedule Missed Session</Text>
                <Text style={{ fontSize: 12, color: colors.subtitle, marginTop: 2 }}>
                  Pick a new date before your next scheduled workout
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowRescheduleModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.subtitle} />
              </TouchableOpacity>
            </View>

            {rescheduleTarget && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
                {/* Missed Session Info */}
                <View
                  style={[
                    styles.currentBookingCard,
                    {
                      backgroundColor: isDark ? '#262626' : '#F8FAFC',
                      borderColor: colors.border,
                      marginBottom: 16,
                    },
                  ]}
                >
                  <View style={[styles.bookingIconBox, { backgroundColor: 'rgba(220, 38, 38, 0.12)' }]}>
                    <MaterialIcons name="event-busy" size={20} color="#DC2626" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.bookingGymTitle, { color: colors.text }]}>
                      Missed Session #{rescheduleTarget.index + 1}
                    </Text>
                    <Text style={[styles.bookingSubtitle, { color: colors.subtitle }]}>
                      Originally booked for: {formatSessionDate(rescheduleTarget.date)}
                    </Text>
                  </View>
                </View>

                {/* Available Date Chips */}
                {(() => {
                  const { dates, nextSessionDate } = getEligibleDatesForSession(
                    rescheduleTarget.index,
                    booking.customDates
                  );

                  return (
                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
                        Select New Date
                      </Text>
                      {nextSessionDate && (
                        <Text style={{ fontSize: 12, color: '#D97706', marginBottom: 10 }}>
                          Strict constraint: Must be scheduled before {formatSessionDate(nextSessionDate)}
                        </Text>
                      )}

                      {dates.length === 0 ? (
                        <View style={{ padding: 14, borderRadius: 12, backgroundColor: 'rgba(220, 38, 38, 0.08)', borderWidth: 1, borderColor: 'rgba(220, 38, 38, 0.2)' }}>
                          <Text style={{ fontSize: 12.5, color: '#DC2626', lineHeight: 18 }}>
                            No available gap days between today and your next scheduled session. Please contact gym reception.
                          </Text>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                          {dates.map((d, i) => {
                            const isSelected =
                              selectedRescheduleDate &&
                              selectedRescheduleDate.toDateString() === d.toDateString();
                            return (
                              <TouchableOpacity
                                key={i}
                                onPress={() => setSelectedRescheduleDate(d)}
                                style={[
                                  styles.dateChip,
                                  {
                                    backgroundColor: isSelected
                                      ? (isDark ? '#93C5FD' : AppColors.primaryNavy)
                                      : (isDark ? '#262626' : '#F1F5F9'),
                                    borderColor: isSelected
                                      ? (isDark ? '#93C5FD' : AppColors.primaryNavy)
                                      : colors.border,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.dateChipDay,
                                    {
                                      color: isSelected
                                        ? '#FFFFFF'
                                        : (isDark ? '#93C5FD' : AppColors.primaryNavy),
                                    },
                                  ]}
                                >
                                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                                </Text>
                                <Text
                                  style={[
                                    styles.dateChipNum,
                                    { color: isSelected ? '#FFFFFF' : colors.text },
                                  ]}
                                >
                                  {d.getDate()} {d.toLocaleDateString('en-US', { month: 'short' })}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })()}

                {/* Reason Input */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
                    Reason for Reschedule (Optional)
                  </Text>
                  <TextInput
                    value={rescheduleReason}
                    onChangeText={setRescheduleReason}
                    placeholder="e.g. Health emergency, schedule conflict..."
                    placeholderTextColor={colors.subtitle}
                    style={[
                      styles.reasonInput,
                      {
                        backgroundColor: isDark ? '#262626' : '#F8FAFC',
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  onPress={handleSubmitReschedule}
                  disabled={isSubmittingReschedule || !selectedRescheduleDate}
                  style={[
                    styles.submitRescheduleBtn,
                    {
                      backgroundColor: isSubmittingReschedule || !selectedRescheduleDate
                        ? '#94A3B8'
                        : AppColors.primaryColor,
                    },
                  ]}
                >
                  {isSubmittingReschedule ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.submitRescheduleBtnText}>Submit to Gym Owner</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  fullscreenBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 40,
  },
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 18,
  },
  cancelledBannerTitle: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800',
  },
  cancelledBannerSub: {
    fontSize: 12,
    marginTop: 4,
  },
  summaryHeader: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  summaryCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 13,
    flexShrink: 0,
    marginRight: 16,
    lineHeight: 18,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    lineHeight: 18,
  },
  copyValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  divider: {
    height: 0.8,
    marginVertical: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 24,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.2,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },

  /* Fullscreen QR Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  fullscreenQrCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 18,
  },
  fullscreenGymName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  fullscreenPassId: {
    fontSize: 12,
    fontWeight: '800',
    color: AppColors.secondaryColor,
    marginTop: 2,
  },
  fullscreenCloseBtn: {
    padding: 4,
  },
  largeQrWrapper: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  qrLogoOverlay: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#01327E',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  qrLogoImage: {
    width: '100%',
    height: '100%',
    tintColor: '#01327E',
  },
  fullscreenHint: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginTop: 18,
  },

  /* Sheets */
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  currentBookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  bookingIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 56, 130, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingGymTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  bookingSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  bookingDateTime: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.secondaryColor,
    marginTop: 2,
  },
  slotSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 10,
  },
  timeSlotsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  slotChipText: {
    fontSize: 12,
  },
  sheetPrimaryBtn: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  sheetPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  /* Cancel Sheet Specifics */
  previewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  previewLabel: {
    fontSize: 11,
  },
  previewId: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.secondaryColor,
  },
  previewGymName: {
    fontSize: 13,
    fontWeight: '800',
  },
  previewSub: {
    fontSize: 11,
    marginTop: 2,
  },
  previewAmount: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  reasonTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 8,
  },
  reasonsList: {
    marginVertical: 4,
  },
  reasonRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  reasonRadioText: {
    fontSize: 13,
    marginLeft: 10,
  },
  policyNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  policyNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#B45309',
    lineHeight: 15,
    marginLeft: 8,
  },

  /* Custom Sessions & Reschedule Styles */
  customSessionItem: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  customSessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionNumberText: {
    fontSize: 13,
    fontWeight: '800',
  },
  customSessionDate: {
    fontSize: 14,
    fontWeight: '700',
  },
  customSessionOtp: {
    fontSize: 11.5,
    marginTop: 2,
  },
  sessionActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  missedNoticeText: {
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 16,
    marginRight: 8,
  },
  rescheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#003882',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rescheduleBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pendingNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    gap: 6,
  },
  pendingNoticeText: {
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
  },
  proposedBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  proposedTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
    flex: 1,
  },
  acceptProposalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 8,
    borderRadius: 8,
  },
  acceptProposalText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  declineProposalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: 8,
    borderRadius: 8,
  },
  declineProposalText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  rescheduledNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    gap: 6,
  },
  rescheduledNoticeText: {
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
  },
  attendedNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    gap: 6,
  },
  attendedNoticeText: {
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
  },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 72,
  },
  dateChipDay: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dateChipNum: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  reasonInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 13,
    textAlignVertical: 'top',
    minHeight: 70,
  },
  submitRescheduleBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  submitRescheduleBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  /* Attendance Action Tile */
  attendanceActionTile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  attendanceIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  attendanceTileContent: {
    flex: 1,
  },
  attendanceTileTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  attendanceTileSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
