import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { AppColors, AppTheme } from '../theme/appTheme';
import { useBookingRepository, mapBackendBookingToClient } from '../data/BookingContext';
import { apiService } from '../services/apiService';
import { paymentService } from '../services/paymentService';

export const PaymentSummaryScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const {
    gym,
    bookingTitle,
    datesSummary,
    timeSlot,
    sessionsCount = 1,
    subtotal,
    discount = 0.0,
  } = route.params;

  const { isDark, colors } = useTheme();
  const { addBooking } = useBookingRepository();

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('UPI');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [createdBooking, setCreatedBooking] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingErrorMessage, setBookingErrorMessage] = useState('');

  const totalAmount = Math.max(0, subtotal - discount);

  const primaryNavy = isDark ? '#93C5FD' : '#003882';
  const cardColor = isDark ? '#1E1E1E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#0F172A';
  const subtitleColor = isDark ? 'rgba(255, 255, 255, 0.7)' : '#64748B';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';

  const handleProcessPayment = async () => {
    if (isProcessing) return;

    setIsProcessing(true);

    try {
      const payload = {
        gymId: gym?._id || gym?.id || gym?.partnerId,
        sectionId: route.params?.sectionId || null,
        trainerId: route.params?.trainerId || null,
        bookingType: route.params?.bookingType || (route.params?.sectionId ? 'GROUP_CLASS' : 'GYM_SESSION'),
        title: bookingTitle,
        category: route.params?.category || 'general',
        startDate: route.params?.startDate || null,
        endDate: route.params?.endDate || null,
        timeSlot: timeSlot || null,
        durationDays: route.params?.durationDays || sessionsCount || 1,
        sessionsCount: sessionsCount || 1,
        customDates: route.params?.customDates || null,
        pricing: {
          subtotal,
          discount,
          totalAmount,
          currency: 'INR',
        },
        payment: {
          method: selectedPaymentMethod,
          status: 'Completed',
          transactionId: `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          paidAt: new Date().toISOString(),
        },
      };

      const serverBooking = await paymentService.payWithRazorpay({
        flowType: 'BOOKING_PASS',
        payload,
        description: bookingTitle || 'Gym Session Pass',
      });
      const mapped = mapBackendBookingToClient(serverBooking);
      addBooking(mapped);
      setCreatedBooking(mapped);
      setShowConfirmModal(true);
    } catch (err) {
      console.warn('[PAYMENT SUMMARY] Booking creation failed:', err?.message);
      setBookingErrorMessage(
        err?.message || 'Unable to complete your booking right now. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewPass = () => {
    setShowConfirmModal(false);
    if (createdBooking) {
      navigation.replace('BookingDetails', { booking: createdBooking });
    }
  };

  const handleBackToHome = () => {
    setShowConfirmModal(false);
    navigation.navigate('HomeTabs');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* App Bar */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}>
        <View style={styles.appBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.appBarTitle, { color: textColor }]}>Payment Summary</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 80 + (insets.bottom > 0 ? insets.bottom + 8 : 16) },
        ]}
      >
        {/* 1. Booking Details Card */}
        <View style={[styles.card, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardSectionTitle, { color: textColor }]}>Booking Details</Text>
            <View style={styles.sessionCountBadge}>
              <Text style={styles.sessionCountText}>
                {sessionsCount} {sessionsCount > 1 ? 'Sessions' : 'Session'}
              </Text>
            </View>
          </View>

          <Text style={[styles.gymNameText, { color: textColor }]}>{gym.name}</Text>
          <Text style={[styles.bookingTitleText, { color: subtitleColor }]}>{bookingTitle}</Text>

          <View style={styles.metaRow}>
            <MaterialIcons name="calendar-today" size={14} color="#00BF62" style={{ marginRight: 6 }} />
            <Text style={[styles.metaText, { color: textColor }]}>{datesSummary}</Text>
          </View>

          {timeSlot && (
            <View style={[styles.metaRow, { marginTop: 6 }]}>
              <MaterialIcons name="access-time" size={14} color="#00BF62" style={{ marginRight: 6 }} />
              <Text style={[styles.metaText, { color: textColor, fontWeight: '600' }]}>{timeSlot}</Text>
            </View>
          )}
        </View>

        {/* 2. Price Details Card */}
        <View style={[styles.card, { backgroundColor: cardColor, borderColor: borderColor, marginTop: 18 }]}>
          <Text style={[styles.cardSectionTitle, { color: textColor, marginBottom: 12 }]}>
            Price Details
          </Text>

          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: subtitleColor }]}>Subtotal</Text>
            <Text style={[styles.priceValue, { color: textColor }]}>₹{Math.round(subtotal)}</Text>
          </View>

          {discount > 0 && (
            <View style={[styles.priceRow, { marginTop: 8 }]}>
              <Text style={[styles.priceLabel, { color: '#00BF62' }]}>GYMEZY Discount</Text>
              <Text style={[styles.priceValue, { color: '#00BF62', fontWeight: 'bold' }]}>
                -₹{Math.round(discount)}
              </Text>
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: borderColor }]} />

          <View style={styles.priceRow}>
            <Text style={[styles.totalLabel, { color: textColor }]}>Total Amount</Text>
            <Text style={[styles.totalValue, { color: textColor }]}>₹{Math.round(totalAmount)}</Text>
          </View>
        </View>

        {/* 3. Payment Method Section */}
        <View style={[styles.card, { backgroundColor: cardColor, borderColor: borderColor, marginTop: 18 }]}>
          <Text style={[styles.cardSectionTitle, { color: textColor, marginBottom: 12 }]}>
            Select Payment Method
          </Text>

          {[
            { id: 'UPI', title: 'UPI', subtitle: 'Google Pay, PhonePe, Paytm', icon: 'qr-code-2' },
            { id: 'Card', title: 'Card', subtitle: 'Debit / Credit Card', icon: 'credit-card' },
            { id: 'NetBanking', title: 'Net Banking', subtitle: 'All major banks', icon: 'account-balance' },
          ].map((m) => {
            const isSel = selectedPaymentMethod === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                activeOpacity={0.85}
                onPress={() => setSelectedPaymentMethod(m.id)}
                style={[
                  styles.paymentOptionRow,
                  {
                    backgroundColor: isSel ? (isDark ? '#1E293B' : '#F0F4FF') : isDark ? '#262626' : '#F8FAFC',
                    borderColor: isSel ? '#003882' : borderColor,
                    borderWidth: isSel ? 1.5 : 1,
                  },
                ]}
              >
                <MaterialIcons
                  name={m.icon}
                  size={22}
                  color={isSel ? (isDark ? '#93C5FD' : '#003882') : subtitleColor}
                />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.paymentOptionTitle, { color: textColor }]}>{m.title}</Text>
                  <Text style={[styles.paymentOptionSub, { color: subtitleColor }]}>{m.subtitle}</Text>
                </View>
                <MaterialIcons
                  name={isSel ? 'radio-button-checked' : 'radio-button-unchecked'}
                  size={20}
                  color={isSel ? '#003882' : subtitleColor}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Persistent Bottom Bar */}
      <View style={[styles.bottomBar, { backgroundColor: cardColor, borderTopColor: borderColor, paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 16 }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={isProcessing}
          onPress={handleProcessPayment}
          style={[styles.payBtn, isProcessing && { opacity: 0.75 }]}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="lock-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.payBtnText}>
                {`Pay ₹${Math.round(totalAmount)}`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={handleBackToHome}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.dialogCard, { backgroundColor: cardColor }]}>
            <View style={styles.dialogSuccessBadge}>
              <MaterialIcons name="check-circle" size={48} color="#00BF62" />
            </View>

            <Text style={[styles.dialogTitle, { color: textColor }]}>Booking Confirmed!</Text>
            <Text style={[styles.dialogDesc, { color: subtitleColor }]}>
              Your pass for {gym.name} has been booked successfully.
            </Text>

            <View style={[styles.dialogBookingIdCard, { backgroundColor: isDark ? '#262626' : '#F8FAFC', borderColor: borderColor }]}>
              <Text style={[styles.dialogBookingIdLabel, { color: subtitleColor }]}>Booking ID:</Text>
              <Text style={[styles.dialogBookingIdValue, { color: textColor }]}>
                {createdBooking?.id || ''}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleViewPass}
              style={styles.viewPassBtn}
            >
              <Text style={styles.viewPassBtnText}>View Pass & OTP</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleBackToHome}
              style={{ marginTop: 12 }}
            >
              <Text style={[styles.dialogBackHomeText, { color: subtitleColor }]}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Booking Notice / Error Modal */}
      <Modal
        visible={Boolean(bookingErrorMessage)}
        transparent
        animationType="fade"
        onRequestClose={() => setBookingErrorMessage('')}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.dialogCard, { backgroundColor: cardColor }]}>
            <View style={styles.dialogErrorBadge}>
              <MaterialIcons name="error-outline" size={38} color="#EF4444" />
            </View>

            <Text style={[styles.dialogTitle, { color: textColor }]}>Booking Notice</Text>
            <Text style={[styles.dialogDesc, { color: subtitleColor, marginTop: 10, marginBottom: 22 }]}>
              {bookingErrorMessage}
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setBookingErrorMessage('')}
              style={styles.errorDismissBtn}
            >
              <Text style={styles.errorDismissBtnText}>Got It</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                setBookingErrorMessage('');
                navigation.goBack();
              }}
              style={{ marginTop: 12 }}
            >
              <Text style={[styles.dialogBackHomeText, { color: subtitleColor }]}>
                Change Selection
              </Text>
            </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 4,
    marginRight: 12,
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  sessionCountBadge: {
    backgroundColor: 'rgba(0,191,98,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sessionCountText: {
    color: '#00BF62',
    fontSize: 11,
    fontWeight: 'bold',
  },
  gymNameText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  bookingTitleText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  metaText: {
    fontSize: 12,
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 13,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  paymentOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  paymentOptionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  paymentOptionSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    borderTopWidth: 1,
  },
  payBtn: {
    height: 52,
    backgroundColor: '#003882',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialogCard: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  dialogSuccessBadge: {
    backgroundColor: 'rgba(0,191,98,0.12)',
    padding: 16,
    borderRadius: 40,
    marginBottom: 18,
  },
  dialogErrorBadge: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    padding: 16,
    borderRadius: 40,
    marginBottom: 18,
  },
  errorDismissBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#003882',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorDismissBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  dialogDesc: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  dialogBookingIdCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 16,
  },
  dialogBookingIdLabel: {
    fontSize: 12,
  },
  dialogBookingIdValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  viewPassBtn: {
    backgroundColor: '#00BF62',
    width: '100%',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewPassBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dialogBackHomeText: {
    fontSize: 13,
  },
});
