import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { AppColors, AppTheme } from '../theme/appTheme';
import { useBookingRepository, mapBackendBookingToClient } from '../data/BookingContext';
import { apiService } from '../services/apiService';
import { walletService } from '../services/walletService';

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
  const [useWalletBalance, setUseWalletBalance] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [createdBooking, setCreatedBooking] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [gymWallet, setGymWallet] = useState(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);

  const totalAmount = Math.max(0, subtotal - discount);
  const gymWalletBalance = gymWallet?.balanceINR ?? 0;
  const applicableWalletDiscount = useWalletBalance && gymWalletBalance > 0
    ? Math.min(gymWalletBalance, totalAmount)
    : 0;
  const netPayableAmount = Math.max(0, totalAmount - applicableWalletDiscount);
  const isFullWalletPayment = applicableWalletDiscount >= totalAmount && totalAmount > 0;

  const targetGymId = gym?._id || gym?.id || gym?.partnerId;

  useEffect(() => {
    let isMounted = true;
    if (targetGymId) {
      setIsLoadingWallet(true);
      walletService
        .fetchGymWallet(targetGymId)
        .then((data) => {
          if (isMounted && data) {
            setGymWallet(data);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setIsLoadingWallet(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [targetGymId]);

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
          method: isFullWalletPayment ? 'Wallet' : selectedPaymentMethod,
          status: 'Completed',
          walletAmountApplied: applicableWalletDiscount,
          transactionId: `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          paidAt: new Date().toISOString(),
        },
        useWallet: useWalletBalance && applicableWalletDiscount > 0,
        appliedWalletAmount: applicableWalletDiscount,
      };

      const serverBooking = await apiService.createBooking(payload);
      const mapped = mapBackendBookingToClient(serverBooking);
      addBooking(mapped);
      setCreatedBooking(mapped);
      setShowConfirmModal(true);
    } catch (err) {
      console.warn('[PAYMENT SUMMARY] Booking creation failed:', err?.message);
      Alert.alert(
        'Booking Notice',
        err.message || 'Unable to complete your booking right now. Please try again.',
        [{ text: 'OK' }]
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

          {applicableWalletDiscount > 0 && (
            <>
              <View style={[styles.divider, { backgroundColor: borderColor }]} />
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: '#059669', fontWeight: '600' }]}>
                  Wallet Applied ({gym?.name || 'Gym'})
                </Text>
                <Text style={[styles.priceValue, { color: '#059669', fontWeight: 'bold' }]}>
                  -₹{Math.round(applicableWalletDiscount)}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: borderColor }]} />
              <View style={styles.priceRow}>
                <Text style={[styles.totalLabel, { color: textColor, fontWeight: '700' }]}>Net Payable</Text>
                <Text style={[styles.totalValue, { color: '#00BF62', fontWeight: 'bold', fontSize: 18 }]}>
                  ₹{Math.round(netPayableAmount)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* 3. Payment Method Section */}
        <View style={[styles.card, { backgroundColor: cardColor, borderColor: borderColor, marginTop: 18 }]}>
          <Text style={[styles.cardSectionTitle, { color: textColor, marginBottom: 12 }]}>
            Select Payment Method
          </Text>

          {/* Wallet Offset Toggle Card */}
          {gymWalletBalance > 0 && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setUseWalletBalance(!useWalletBalance)}
              style={[
                styles.walletOffsetCard,
                {
                  backgroundColor: useWalletBalance
                    ? (isDark ? '#064E3B' : '#E6F7EF')
                    : (isDark ? '#1E293B' : '#F8FAFC'),
                  borderColor: useWalletBalance
                    ? (isDark ? '#34D399' : '#059669')
                    : (isDark ? '#334155' : '#E2E8F0'),
                },
              ]}
            >
              <View
                style={[
                  styles.walletOffsetIconBox,
                  { backgroundColor: useWalletBalance ? (isDark ? '#059669' : '#FFFFFF') : (isDark ? '#0F172A' : '#F1F5F9') },
                ]}
              >
                <MaterialIcons
                  name="account-balance-wallet"
                  size={22}
                  color={useWalletBalance ? (isDark ? '#FFFFFF' : '#059669') : (isDark ? '#94A3B8' : '#64748B')}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.walletOffsetTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Use {gym?.name || 'Gym'} Wallet Balance
                </Text>
                <Text style={[styles.walletOffsetSubtitle, { color: isDark ? '#A7F3D0' : '#047857' }]}>
                  Available: ₹{gymWalletBalance.toLocaleString('en-IN')}
                  {useWalletBalance && ` • Applying: -₹${Math.round(applicableWalletDiscount).toLocaleString('en-IN')}`}
                </Text>
              </View>

              <View
                style={[
                  styles.checkboxCircle,
                  {
                    backgroundColor: useWalletBalance ? (isDark ? '#34D399' : '#059669') : 'transparent',
                    borderColor: useWalletBalance ? (isDark ? '#34D399' : '#059669') : (isDark ? '#475569' : '#CBD5E1'),
                  },
                ]}
              >
                {useWalletBalance && <MaterialIcons name="check" size={14} color="#FFFFFF" />}
              </View>
            </TouchableOpacity>
          )}

          {isFullWalletPayment ? (
            <View
              style={[
                styles.fullWalletCoveredBanner,
                {
                  backgroundColor: isDark ? '#064E3B' : '#E6F7EF',
                  borderColor: isDark ? '#34D399' : '#059669',
                },
              ]}
            >
              <MaterialIcons name="check-circle" size={24} color={isDark ? '#34D399' : '#059669'} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.fullWalletTitle, { color: isDark ? '#FFFFFF' : '#064E3B' }]}>
                  100% Covered by Wallet Balance
                </Text>
                <Text style={[styles.fullWalletSub, { color: isDark ? '#A7F3D0' : '#047857' }]}>
                  Your {gym?.name || 'gym'} wallet covers the entire purchase. No external gateway payment needed!
                </Text>
              </View>
            </View>
          ) : (
            <>
              {useWalletBalance && applicableWalletDiscount > 0 && (
                <Text style={[styles.remainingSubheading, { color: subtitleColor, marginBottom: 10 }]}>
                  Select payment method for remaining balance (₹{Math.round(netPayableAmount).toLocaleString('en-IN')})
                </Text>
              )}
              {[
                { id: 'UPI', title: 'UPI', subtitle: 'Google Pay, PhonePe, Paytm', icon: 'account-balance-wallet' },
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
            </>
          )}
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
                {netPayableAmount === 0
                  ? 'Pay ₹0 with Wallet'
                  : `Pay ₹${Math.round(netPayableAmount)}${applicableWalletDiscount > 0 ? ` (₹${Math.round(applicableWalletDiscount)} from Wallet)` : ''}`}
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
  walletOffsetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  walletOffsetIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletOffsetTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  walletOffsetSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWalletCoveredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  fullWalletTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  fullWalletSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  remainingSubheading: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});
