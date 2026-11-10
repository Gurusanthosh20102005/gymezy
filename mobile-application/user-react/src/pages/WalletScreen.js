import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { useToast } from '../widgets/CustomScaffoldMessage';
import { useAuth } from '../context/AuthContext';
import { walletService } from '../services/walletService';
import { getSafeImageUri } from '../utils/mediaUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const QUICK_TOP_UP_AMOUNTS = [500, 1000, 2000, 5000];
const FILTER_TABS = ['All', 'Credits', 'Debits'];

const safeText = (val, fallback = '') => {
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  return fallback;
};

export const WalletScreen = ({ navigation }) => {
  const { isDark, colors } = useTheme();
  const { showToast } = useToast();
  const authContext = useAuth();
  const user = authContext?.user || null;

  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'android'
    ? Math.max(StatusBar.currentHeight || 0, insets.top, 38)
    : insets.top;
  const [failedLogos, setFailedLogos] = useState({});
  const [walletData, setWalletData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [selectedGymIndex, setSelectedGymIndex] = useState(0);

  // Modals
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('1000');
  const [selectedTopUpMethod, setSelectedTopUpMethod] = useState('UPI');
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawUpiId, setWithdrawUpiId] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('Downgrade refund withdrawal');
  const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);

  const [selectedTxn, setSelectedTxn] = useState(null);

  const loadWallet = useCallback(async (isPullRefresh = false) => {
    try {
      if (isPullRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      const userId = user?.id || user?._id || user?.userId;
      const data = await walletService.fetchMyWallet(userId);
      if (data) {
        setWalletData(data);
      }
    } catch (err) {
      console.warn('[WALLET SCREEN] Load error:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id, user?._id, user?.userId]);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  // Derived Calculations
  const totalBalanceINR = walletData?.totalBalanceINR ?? 0;
  const transactions = walletData?.transactions || [];
  const individualWallets = walletData?.wallets || [];
  const activeGymWallet = individualWallets[selectedGymIndex] || individualWallets[0] || null;
  const activeGymBalanceINR = activeGymWallet?.balanceINR ?? 0;
  const activeGymKey = activeGymWallet?.gymId ? String(activeGymWallet.gymId) : 'active';
  const activeGymLogoUri =
    !failedLogos[activeGymKey] && getSafeImageUri(activeGymWallet?.gymLogo)
      ? getSafeImageUri(activeGymWallet.gymLogo)
      : null;

  const filteredTransactions = useMemo(() => {
    let list = transactions;
    if (activeGymWallet?.gymId) {
      list = list.filter((t) => String(t.gymId) === String(activeGymWallet.gymId));
    }
    if (selectedFilter === 'Credits') {
      return list.filter((t) => t.type === 'CREDIT');
    }
    if (selectedFilter === 'Debits') {
      return list.filter((t) => t.type === 'DEBIT');
    }
    return list;
  }, [transactions, activeGymWallet?.gymId, selectedFilter]);

  const copyToClipboard = async (text, label) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    showToast({
      message: `${label} copied to clipboard`,
      isSuccess: true,
    });
  };

  const handleTopUpSubmit = async () => {
    const num = Number(topUpAmount);
    if (!num || num <= 0) {
      showToast({ message: 'Please enter a valid amount', isError: true });
      return;
    }
    if (!activeGymWallet?.gymId) {
      showToast({ message: 'Please select a gym wallet to top up', isError: true });
      return;
    }

    try {
      setIsProcessingTopUp(true);
      await walletService.topUpWallet({
        gymId: activeGymWallet.gymId,
        amount: num,
        paymentMethod: selectedTopUpMethod,
        userId: user?.id || user?._id,
      });

      showToast({
        message: `₹${num.toLocaleString('en-IN')} added to ${activeGymWallet.gymName} wallet!`,
        isSuccess: true,
      });
      setShowTopUpModal(false);
      await loadWallet();
    } catch (error) {
      showToast({
        message: error.message || 'Top up failed. Please try again.',
        isError: true,
      });
    } finally {
      setIsProcessingTopUp(false);
    }
  };

  const handleWithdrawSubmit = async () => {
    const num = Number(withdrawAmount);
    if (!num || num <= 0) {
      showToast({ message: 'Please enter a valid withdrawal amount', isError: true });
      return;
    }
    if (!activeGymWallet?.gymId) {
      showToast({ message: 'Please select a gym wallet to withdraw from', isError: true });
      return;
    }
    if (num > activeGymBalanceINR) {
      showToast({
        message: `Withdrawal amount exceeds balance at ${activeGymWallet.gymName}`,
        isError: true,
      });
      return;
    }
    if (!withdrawUpiId.trim()) {
      showToast({ message: 'Please enter your UPI ID or Bank account details', isError: true });
      return;
    }

    try {
      setIsProcessingWithdraw(true);
      await walletService.withdrawWallet({
        gymId: activeGymWallet.gymId,
        amount: num,
        upiId: withdrawUpiId.trim(),
        reason: withdrawReason,
        userId: user?.id || user?._id,
      });

      showToast({
        message: `₹${num.toLocaleString('en-IN')} withdrawal request submitted for ${activeGymWallet.gymName}!`,
        isSuccess: true,
      });
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      await loadWallet();
    } catch (error) {
      showToast({
        message: error.message || 'Withdrawal request failed. Please try again.',
        isError: true,
      });
    } finally {
      setIsProcessingWithdraw(false);
    }
  };

  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatTxnDate = (dt) => {
    if (!dt) return '';
    const date = new Date(dt);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // User Card Masked Number
  const memberIdSuffix = useMemo(() => {
    const raw = String(user?.id || user?._id || '9934');
    return raw.slice(-4).toUpperCase();
  }, [user?.id, user?._id]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: isDark ? '#0B0F17' : '#F9FBFA' }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={{ height: topInset }} />

      {/* 1. Minimal Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E5E7EB' }]}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={20} color={isDark ? '#FFFFFF' : '#111827'} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>Wallet</Text>

        <TouchableOpacity
          onPress={() => void loadWallet(true)}
          style={[styles.syncBtn, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E5E7EB' }]}
          activeOpacity={0.7}
        >
          <Feather name="rotate-cw" size={16} color={isDark ? '#FFFFFF' : '#111827'} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 40 + (insets.bottom > 0 ? insets.bottom + 10 : 20) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadWallet(true)}
            colors={[isDark ? '#34D399' : '#059669']}
            tintColor={isDark ? '#34D399' : '#059669'}
          />
        }
      >
        {/* 2. Gym-Specific Wallet Hero Card */}
        {individualWallets.length === 0 && !isLoading ? (
          <View
            style={[
              styles.emptyWalletCard,
              {
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderColor: isDark ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.15)' : '#E6F7EF' },
              ]}
            >
              <MaterialIcons
                name="account-balance-wallet"
                size={34}
                color={isDark ? '#34D399' : '#059669'}
              />
            </View>
            <Text style={[styles.emptyWalletTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              No Active Gym Wallets
            </Text>
            <Text style={[styles.emptyWalletSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              GYMEZY wallets are maintained per gym. When you book sessions, enroll in memberships, or receive refunds at a partner gym, your gym-specific wallet will appear here.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('HomeTabs')}
              style={[styles.exploreGymsBtn, { backgroundColor: isDark ? '#34D399' : '#003882' }]}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.exploreGymsBtnText,
                  { color: isDark ? '#064E3B' : '#FFFFFF' },
                ]}
              >
                Explore Partner Gyms
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Stacked Minimal Card Container */}
            <View style={styles.cardStackWrapper}>
              {/* Subtle Background Stack Layer */}
              <View
                style={[
                  styles.stackedBackLayer,
                  {
                    backgroundColor: isDark ? '#1E293B' : '#E7F5ED',
                    borderColor: isDark ? '#334155' : '#D1EAD9',
                  },
                ]}
              >
                <View style={styles.backLayerHeader}>
                  <View
                    style={[
                      styles.currencyPillMini,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#FFFFFF' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.currencyPillTextMini,
                        { color: isDark ? '#E2E8F0' : '#374151' },
                      ]}
                    >
                      INR • GYMEZY PASS CARD
                    </Text>
                  </View>
                </View>
              </View>

              {/* Main Hero Card for Active Gym */}
              <LinearGradient
                colors={isDark ? ['#132E27', '#0F2520'] : ['#D4ECD5', '#C2E5CA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.heroCard,
                  {
                    borderColor: isDark
                      ? 'rgba(52, 211, 153, 0.2)'
                      : 'rgba(255, 255, 255, 0.8)',
                  },
                ]}
              >
                {/* Gym Header Row */}
                <View style={styles.cardGymHeader}>
                  <View
                    style={[
                      styles.cardGymIconBox,
                      activeGymLogoUri && {
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(52, 211, 153, 0.3)' : 'rgba(255, 255, 255, 0.9)',
                      },
                    ]}
                  >
                    {activeGymLogoUri ? (
                      <Image
                        source={{ uri: activeGymLogoUri }}
                        style={styles.cardGymLogoImg}
                        resizeMode="cover"
                        onError={() =>
                          setFailedLogos((prev) => ({
                            ...prev,
                            [activeGymKey]: true,
                          }))
                        }
                      />
                    ) : (
                      <MaterialIcons
                        name="fitness-center"
                        size={18}
                        color={isDark ? '#34D399' : '#047857'}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text
                      style={[styles.cardGymName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                      numberOfLines={1}
                    >
                      {activeGymWallet?.gymName || 'GYMEZY Partner Gym'}
                    </Text>
                    <Text
                      style={[styles.cardGymLocation, { color: isDark ? '#9CA3AF' : '#4B5563' }]}
                      numberOfLines={1}
                    >
                      {activeGymWallet?.gymLocation || 'Partner Gym Account'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.currencyPill,
                      { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#FFFFFF' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.currencyPillText,
                        { color: isDark ? '#E2E8F0' : '#1F2937' },
                      ]}
                    >
                      INR
                    </Text>
                  </View>
                </View>

                {/* Balance Details */}
                <View style={styles.balanceContainer}>
                  <Text style={[styles.yourBalanceLabel, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>
                    Available Gym Balance
                  </Text>

                  <View style={styles.balanceRow}>
                    <Text
                      style={[
                        styles.balanceAmountText,
                        { color: isDark ? '#FFFFFF' : '#0F172A' },
                      ]}
                    >
                      {isLoading && !walletData
                        ? '₹ ••••••'
                        : isBalanceHidden
                        ? '₹ ••••••'
                        : formatCurrency(activeGymBalanceINR)}
                    </Text>

                    <TouchableOpacity
                      onPress={() => setIsBalanceHidden(!isBalanceHidden)}
                      style={styles.eyeToggleBtn}
                      activeOpacity={0.7}
                    >
                      <Feather
                        name={isBalanceHidden ? 'eye-off' : 'eye'}
                        size={20}
                        color={isDark ? '#A7F3D0' : '#475569'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Gym Isolation Subtext */}
                <Text
                  style={[styles.gymIsolationNotice, { color: isDark ? '#A7F3D0' : '#065F46' }]}
                  numberOfLines={1}
                >
                  • Usable exclusively at {activeGymWallet?.gymName || 'this gym'}
                </Text>

                {/* Bottom Card Row */}
                <View style={styles.cardBottomInfoRow}>
                  <View>
                    <Text style={[styles.accountLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                      Account number
                    </Text>
                    <Text
                      style={[
                        styles.accountNumberVal,
                        { color: isDark ? '#F1F5F9' : '#1E293B' },
                      ]}
                    >
                      •••• {memberIdSuffix}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.accountLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                      Status
                    </Text>
                    <Text
                      style={[
                        styles.accountNumberVal,
                        { color: isDark ? '#34D399' : '#059669', fontWeight: '700' },
                      ]}
                    >
                      Active
                    </Text>
                  </View>
                </View>
              </LinearGradient>

              {/* Floating Action Buttons Scoped to Active Gym */}
              <View style={styles.floatingActionsRow}>
                {/* Request / Withdraw Pill */}
                <TouchableOpacity
                  onPress={() => {
                    if (activeGymBalanceINR <= 0) {
                      showToast({
                        message: `No funds available to withdraw from ${activeGymWallet?.gymName || 'this gym'}`,
                        isError: true,
                      });
                      return;
                    }
                    setWithdrawAmount(String(activeGymBalanceINR));
                    setShowWithdrawModal(true);
                  }}
                  style={[
                    styles.floatingPillBtn,
                    {
                      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                      borderColor: isDark ? '#334155' : '#E2E8F0',
                    },
                  ]}
                  activeOpacity={0.85}
                >
                  <Feather
                    name="arrow-down-left"
                    size={18}
                    color={isDark ? '#FFFFFF' : '#0F172A'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.floatingPillText,
                      { color: isDark ? '#FFFFFF' : '#0F172A' },
                    ]}
                  >
                    Request Payout
                  </Text>
                </TouchableOpacity>

                {/* Add Money Pill */}
                <TouchableOpacity
                  onPress={() => setShowTopUpModal(true)}
                  style={[
                    styles.floatingPillBtn,
                    {
                      backgroundColor: isDark ? '#34D399' : '#0F172A',
                      borderColor: 'transparent',
                    },
                  ]}
                  activeOpacity={0.85}
                >
                  <Feather
                    name="arrow-up-right"
                    size={18}
                    color={isDark ? '#064E3B' : '#FFFFFF'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.floatingPillText,
                      { color: isDark ? '#064E3B' : '#FFFFFF' },
                    ]}
                  >
                    Add Money
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. Option B: Gym Wallets Account Breakdown List */}
            {individualWallets.length > 0 && (
              <View style={styles.gymAccountsSection}>
                <View style={styles.gymAccountsHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.sectionHeading, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      Gym Accounts
                    </Text>
                    <View
                      style={[
                        styles.countBadge,
                        { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.15)' : '#E6F7EF' },
                      ]}
                    >
                      <Text style={[styles.countBadgeText, { color: isDark ? '#34D399' : '#059669' }]}>
                        {individualWallets.length}
                      </Text>
                    </View>
                  </View>

                  {individualWallets.length > 1 && (
                    <Text style={[styles.totalAcrossLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Total:{' '}
                      <Text style={{ fontWeight: '700', color: isDark ? '#34D399' : '#059669' }}>
                        {formatCurrency(totalBalanceINR)}
                      </Text>
                    </Text>
                  )}
                </View>

                {individualWallets.map((gymW, idx) => {
                  const isSelected = selectedGymIndex === idx;
                  const gymKey = gymW.gymId ? String(gymW.gymId) : String(idx);
                  const gymLogoUri =
                    !failedLogos[gymKey] && getSafeImageUri(gymW.gymLogo)
                      ? getSafeImageUri(gymW.gymLogo)
                      : null;
                  return (
                    <TouchableOpacity
                      key={gymW.gymId || idx}
                      onPress={() => setSelectedGymIndex(idx)}
                      style={[
                        styles.gymAccountCard,
                        {
                          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                          borderColor: isSelected
                            ? (isDark ? '#34D399' : '#059669')
                            : (isDark ? '#334155' : '#E2E8F0'),
                          borderWidth: isSelected ? 1.5 : 1,
                        },
                      ]}
                      activeOpacity={0.75}
                    >
                      <View
                        style={[
                          styles.gymAccountIconCircle,
                          {
                            backgroundColor: gymLogoUri
                              ? '#FFFFFF'
                              : isSelected
                              ? (isDark ? 'rgba(52, 211, 153, 0.2)' : '#E6F7EF')
                              : (isDark ? '#0F172A' : '#F1F5F9'),
                            borderColor: isDark ? '#334155' : '#E2E8F0',
                            borderWidth: gymLogoUri ? 1 : 0,
                          },
                        ]}
                      >
                        {gymLogoUri ? (
                          <Image
                            source={{ uri: gymLogoUri }}
                            style={styles.gymAccountLogoImg}
                            resizeMode="cover"
                            onError={() =>
                              setFailedLogos((prev) => ({ ...prev, [gymKey]: true }))
                            }
                          />
                        ) : (
                          <MaterialIcons
                            name="fitness-center"
                            size={18}
                            color={
                              isSelected
                                ? (isDark ? '#34D399' : '#059669')
                                : (isDark ? '#94A3B8' : '#64748B')
                            }
                          />
                        )}
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text
                          style={[
                            styles.gymAccountName,
                            {
                              color: isDark ? '#FFFFFF' : '#0F172A',
                              fontWeight: isSelected ? '700' : '600',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {gymW.gymName}
                        </Text>
                        <Text
                          style={[
                            styles.gymAccountLocation,
                            { color: isDark ? '#94A3B8' : '#64748B' },
                          ]}
                          numberOfLines={1}
                        >
                          {isSelected ? 'Active Card • ' : ''}
                          {gymW.gymLocation || 'Partner Gym Account'}
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                        <Text
                          style={[
                            styles.gymAccountBalance,
                            {
                              color: isSelected
                                ? (isDark ? '#34D399' : '#059669')
                                : (isDark ? '#F1F5F9' : '#1E293B'),
                            },
                          ]}
                        >
                          {formatCurrency(gymW.balanceINR)}
                        </Text>
                        {isSelected ? (
                          <View
                            style={[
                              styles.activeIndicatorBadge,
                              { backgroundColor: isDark ? '#064E3B' : '#E6F7EF' },
                            ]}
                          >
                            <Feather
                              name="check"
                              size={11}
                              color={isDark ? '#34D399' : '#047857'}
                            />
                            <Text
                              style={[
                                styles.activeIndicatorText,
                                { color: isDark ? '#34D399' : '#047857' },
                              ]}
                            >
                              Active
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.switchPromptBadge}>
                            <Text
                              style={[
                                styles.tapToViewText,
                                { color: isDark ? '#94A3B8' : '#64748B' },
                              ]}
                            >
                              Select
                            </Text>
                            <Feather
                              name="chevron-right"
                              size={12}
                              color={isDark ? '#94A3B8' : '#64748B'}
                            />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* 3. Minimal Transaction History */}
        <View style={styles.transactionsSection}>
          <View style={styles.txnSectionHeader}>
            <View>
              <Text style={[styles.txnSectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Transactions
              </Text>
              {activeGymWallet?.gymName && (
                <Text style={[styles.txnSectionSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  {activeGymWallet.gymName}
                </Text>
              )}
            </View>

            {/* Filter Pills */}
            <View
              style={[
                styles.filterPillsTrack,
                {
                  backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                },
              ]}
            >
              {FILTER_TABS.map((tab) => {
                const isSelected = selectedFilter === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setSelectedFilter(tab)}
                    style={[
                      styles.filterTabPill,
                      isSelected && {
                        backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                        shadowColor: '#000',
                        shadowOpacity: 0.06,
                        shadowRadius: 2,
                        elevation: 1,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterTabPillText,
                        {
                          color: isSelected
                            ? (isDark ? '#FFFFFF' : '#0F172A')
                            : (isDark ? '#94A3B8' : '#64748B'),
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {tab}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Transaction List */}
          {isLoading && !walletData ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={isDark ? '#34D399' : '#059669'} />
              <Text style={[styles.loadingText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                Loading transactions...
              </Text>
            </View>
          ) : filteredTransactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="inbox" size={36} color={isDark ? '#475569' : '#94A3B8'} />
              <Text style={[styles.emptyTitle, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                No transactions yet
              </Text>
              <Text style={[styles.emptySub, { color: isDark ? '#64748B' : '#94A3B8' }]}>
                Proration refunds, pass switches, and top-ups will appear here.
              </Text>
            </View>
          ) : (
            filteredTransactions.map((tx) => {
              const isCredit = tx.type === 'CREDIT';
              return (
                <TouchableOpacity
                  key={tx.id || tx.transactionId}
                  onPress={() => setSelectedTxn(tx)}
                  style={[
                    styles.txnRow,
                    {
                      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                      borderColor: isDark ? '#334155' : '#F1F5F9',
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.txnIconCircle,
                      {
                        backgroundColor: isCredit
                          ? (isDark ? 'rgba(52, 211, 153, 0.15)' : '#E6F7EF')
                          : (isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2'),
                      },
                    ]}
                  >
                    <Feather
                      name={isCredit ? 'arrow-down-left' : 'arrow-up-right'}
                      size={16}
                      color={isCredit ? '#10B981' : '#EF4444'}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text
                      style={[styles.txnTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                      numberOfLines={1}
                    >
                      {safeText(tx.description, 'Wallet Transaction')}
                    </Text>
                    <Text
                      style={[styles.txnSubText, { color: isDark ? '#94A3B8' : '#64748B' }]}
                      numberOfLines={1}
                    >
                      {formatTxnDate(tx.createdAt)} • {safeText(tx.gymName, 'GYMEZY Partner')}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                    <Text
                      style={[
                        styles.txnAmountText,
                        {
                          color: isCredit
                            ? (isDark ? '#34D399' : '#059669')
                            : (isDark ? '#F87171' : '#0F172A'),
                        },
                      ]}
                    >
                      {isCredit ? '+' : '-'} {formatCurrency(tx.amountINR)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ============================================================ */}
      {/* MODAL 1: ADD MONEY (CLEAN MINIMAL SHEET) */}
      {/* ============================================================ */}
      <Modal
        visible={showTopUpModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTopUpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropDismiss}
            activeOpacity={1}
            onPress={() => setShowTopUpModal(false)}
          />
          <View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderColor: isDark ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeaderRow}>
              <View>
                <Text style={[styles.sheetTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Add Money to {activeGymWallet?.gymName || 'Gym Wallet'}
                </Text>
                <Text style={[styles.sheetSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  Instant wallet deposit for {activeGymWallet?.gymName || 'this partner gym'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowTopUpModal(false)} style={styles.sheetCloseBtn}>
                <Feather name="x" size={20} color={isDark ? '#FFFFFF' : '#0F172A'} />
              </TouchableOpacity>
            </View>

            {/* Big Amount Input */}
            <View style={styles.amountInputBlock}>
              <Text style={[styles.currencyPrefix, { color: isDark ? '#94A3B8' : '#64748B' }]}>₹</Text>
              <TextInput
                value={topUpAmount}
                onChangeText={setTopUpAmount}
                keyboardType="numeric"
                style={[styles.bigAmountInput, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                placeholder="0"
                placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                maxLength={6}
                autoFocus
              />
            </View>

            {/* Quick Amount Pills */}
            <View style={styles.quickPillsRow}>
              {QUICK_TOP_UP_AMOUNTS.map((amt) => (
                <TouchableOpacity
                  key={amt}
                  onPress={() => setTopUpAmount(String(amt))}
                  style={[
                    styles.quickPill,
                    {
                      backgroundColor: isDark ? '#0F172A' : '#F1F5F9',
                      borderColor: topUpAmount === String(amt) ? (isDark ? '#34D399' : '#0F172A') : 'transparent',
                      borderWidth: 1.5,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.quickPillText,
                      {
                        color: topUpAmount === String(amt) ? (isDark ? '#34D399' : '#0F172A') : (isDark ? '#94A3B8' : '#475569'),
                        fontWeight: topUpAmount === String(amt) ? '700' : '600',
                      },
                    ]}
                  >
                    + ₹{amt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Payment Method Selector */}
            <Text style={[styles.methodLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>PAYMENT METHOD</Text>
            <View style={styles.methodSelectorRow}>
              {['UPI', 'Card', 'Net Banking'].map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setSelectedTopUpMethod(m)}
                  style={[
                    styles.methodOption,
                    {
                      backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                      borderColor: selectedTopUpMethod === m ? (isDark ? '#34D399' : '#0F172A') : (isDark ? '#334155' : '#E2E8F0'),
                      borderWidth: selectedTopUpMethod === m ? 1.5 : 1,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.methodOptionText,
                      {
                        color: selectedTopUpMethod === m ? (isDark ? '#34D399' : '#0F172A') : (isDark ? '#94A3B8' : '#64748B'),
                        fontWeight: selectedTopUpMethod === m ? '700' : '500',
                      },
                    ]}
                  >
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleTopUpSubmit}
              disabled={isProcessingTopUp}
              style={[styles.primaryCtaBtn, { backgroundColor: isDark ? '#34D399' : '#0F172A' }]}
              activeOpacity={0.88}
            >
              {isProcessingTopUp ? (
                <ActivityIndicator color={isDark ? '#064E3B' : '#FFFFFF'} />
              ) : (
                <Text style={[styles.primaryCtaText, { color: isDark ? '#064E3B' : '#FFFFFF' }]}>
                  Proceed to Add ₹{Number(topUpAmount || 0).toLocaleString('en-IN')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 2: REQUEST / WITHDRAW */}
      {/* ============================================================ */}
      <Modal
        visible={showWithdrawModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropDismiss}
            activeOpacity={1}
            onPress={() => setShowWithdrawModal(false)}
          />
          <View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderColor: isDark ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeaderRow}>
              <View>
                <Text style={[styles.sheetTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Request Payout from {activeGymWallet?.gymName || 'Gym Wallet'}
                </Text>
                <Text style={[styles.sheetSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  Withdraw balance from {activeGymWallet?.gymName || 'this gym'} directly to your UPI ID or Bank
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowWithdrawModal(false)} style={styles.sheetCloseBtn}>
                <Feather name="x" size={20} color={isDark ? '#FFFFFF' : '#0F172A'} />
              </TouchableOpacity>
            </View>

            {/* Amount Field */}
            <Text style={[styles.inputFieldLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>AMOUNT (INR)</Text>
            <View style={[styles.inputBox, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
              <Text style={[styles.inputBoxPrefix, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>₹</Text>
              <TextInput
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                keyboardType="numeric"
                style={[styles.inputBoxText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                placeholder={`Max ${activeGymBalanceINR}`}
                placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
              />
              <TouchableOpacity onPress={() => setWithdrawAmount(String(activeGymBalanceINR))} style={styles.maxBtn}>
                <Text style={styles.maxBtnText}>MAX</Text>
              </TouchableOpacity>
            </View>

            {/* UPI ID Field */}
            <Text style={[styles.inputFieldLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>UPI ID OR VPA</Text>
            <View style={[styles.inputBox, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
              <TextInput
                value={withdrawUpiId}
                onChangeText={setWithdrawUpiId}
                style={[styles.inputBoxText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                placeholder="yourname@okaxis or 9876543210@paytm"
                placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                autoCapitalize="none"
              />
            </View>

            {/* Reason Field */}
            <Text style={[styles.inputFieldLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>REASON</Text>
            <View style={[styles.inputBox, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
              <TextInput
                value={withdrawReason}
                onChangeText={setWithdrawReason}
                style={[styles.inputBoxText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                placeholder="Downgrade refund withdrawal"
                placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleWithdrawSubmit}
              disabled={isProcessingWithdraw}
              style={[styles.primaryCtaBtn, { backgroundColor: isDark ? '#34D399' : '#0F172A' }]}
              activeOpacity={0.88}
            >
              {isProcessingWithdraw ? (
                <ActivityIndicator color={isDark ? '#064E3B' : '#FFFFFF'} />
              ) : (
                <Text style={[styles.primaryCtaText, { color: isDark ? '#064E3B' : '#FFFFFF' }]}>
                  Submit Payout Request
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 3: MINIMAL TRANSACTION RECEIPT */}
      {/* ============================================================ */}
      <Modal
        visible={Boolean(selectedTxn)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTxn(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropDismiss}
            activeOpacity={1}
            onPress={() => setSelectedTxn(null)}
          />
          <View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderColor: isDark ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.receiptTop}>
              <Text style={[styles.receiptAmount, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {selectedTxn?.type === 'CREDIT' ? '+' : '-'} {formatCurrency(selectedTxn?.amountINR)}
              </Text>
              <Text style={[styles.receiptTypeLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                {selectedTxn?.type === 'CREDIT' ? 'Deposit / Proration Credit' : 'Withdrawal / Payment'}
              </Text>
            </View>

            <View style={[styles.receiptDetailsCard, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
              <View style={styles.receiptRow}>
                <Text style={[styles.receiptRowLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Description</Text>
                <Text style={[styles.receiptRowValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  {safeText(selectedTxn?.description, 'Wallet Transaction')}
                </Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={[styles.receiptRowLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Gym Partner</Text>
                <Text style={[styles.receiptRowValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  {safeText(selectedTxn?.gymName, 'GYMEZY Partner')}
                </Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={[styles.receiptRowLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Date & Time</Text>
                <Text style={[styles.receiptRowValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  {formatTxnDate(selectedTxn?.createdAt)}
                </Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={[styles.receiptRowLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Balance After</Text>
                <Text style={[styles.receiptRowValue, { color: isDark ? '#34D399' : '#059669', fontWeight: '700' }]}>
                  {formatCurrency(selectedTxn?.balanceAfterINR)}
                </Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={[styles.receiptRowLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Transaction ID</Text>
                <TouchableOpacity
                  onPress={() => copyToClipboard(selectedTxn?.transactionId, 'Transaction ID')}
                  style={styles.copyInlineBtn}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.receiptRowValueCode, { color: isDark ? '#93C5FD' : '#003882' }]}>
                    {selectedTxn?.transactionId}
                  </Text>
                  <Feather name="copy" size={12} color={isDark ? '#93C5FD' : '#003882'} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setSelectedTxn(null)}
              style={[styles.primaryCtaBtn, { backgroundColor: isDark ? '#34D399' : '#0F172A' }]}
              activeOpacity={0.88}
            >
              <Text style={[styles.primaryCtaText, { color: isDark ? '#064E3B' : '#FFFFFF' }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  syncBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  cardStackWrapper: {
    width: '100%',
    position: 'relative',
    marginTop: 14,
    marginBottom: 20,
  },
  stackedBackLayer: {
    position: 'absolute',
    top: -10,
    left: 14,
    right: 14,
    height: 190,
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    opacity: 0.85,
  },
  backLayerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  currencyPillMini: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
  },
  currencyPillTextMini: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  cardGymHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardGymIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardGymLogoImg: {
    width: '100%',
    height: '100%',
  },
  cardGymName: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  cardGymLocation: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  gymIsolationNotice: {
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 8,
  },
  gymAccountsSection: {
    marginTop: 6,
    marginBottom: 20,
  },
  gymAccountsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  countBadge: {
    marginLeft: 6,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  totalAcrossLabel: {
    fontSize: 12,
  },
  gymAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  gymAccountIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gymAccountLogoImg: {
    width: '100%',
    height: '100%',
  },
  gymAccountName: {
    fontSize: 14,
    letterSpacing: -0.2,
  },
  gymAccountLocation: {
    fontSize: 11,
    marginTop: 2,
  },
  gymAccountBalance: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  activeIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
    gap: 3,
  },
  activeIndicatorText: {
    fontSize: 10,
    fontWeight: '700',
  },
  switchPromptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 2,
  },
  tapToViewText: {
    fontSize: 11,
    fontWeight: '600',
  },
  txnSectionSub: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  emptyWalletCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 26,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyWalletTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyWalletSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  exploreGymsBtn: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 20,
  },
  exploreGymsBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  heroCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 22,
    minHeight: 185,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  flagEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  currencyPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  balanceContainer: {
    marginVertical: 12,
  },
  yourBalanceLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceAmountText: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  eyeToggleBtn: {
    marginLeft: 12,
    padding: 4,
  },
  cardBottomInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  accountLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  accountNumberVal: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  floatingActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  floatingPillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  floatingPillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  transactionsSection: {
    marginTop: 18,
  },
  txnSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  txnSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  filterPillsTrack: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterTabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 11,
  },
  filterTabPillText: {
    fontSize: 12,
  },
  loadingContainer: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    marginTop: 8,
  },
  emptyContainer: {
    paddingVertical: 44,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 10,
  },
  txnIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnTitleText: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  txnSubText: {
    fontSize: 12,
    fontWeight: '500',
  },
  txnAmountText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdropDismiss: {
    flex: 1,
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 38 : 24,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sheetSub: {
    fontSize: 13,
    marginTop: 2,
  },
  sheetCloseBtn: {
    padding: 4,
  },
  amountInputBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  currencyPrefix: {
    fontSize: 30,
    fontWeight: '700',
    marginRight: 6,
  },
  bigAmountInput: {
    fontSize: 40,
    fontWeight: '900',
    minWidth: 120,
    textAlign: 'center',
  },
  quickPillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 18,
  },
  quickPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
  },
  quickPillText: {
    fontSize: 13,
  },
  methodLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  methodSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  methodOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodOptionText: {
    fontSize: 13,
  },
  primaryCtaBtn: {
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryCtaText: {
    fontSize: 15,
    fontWeight: '800',
  },
  inputFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 10,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 8,
    marginBottom: 8,
  },
  inputBoxPrefix: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 6,
  },
  inputBoxText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  maxBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  maxBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  receiptTop: {
    alignItems: 'center',
    marginVertical: 14,
  },
  receiptAmount: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  receiptTypeLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 3,
  },
  receiptDetailsCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginVertical: 14,
    gap: 12,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiptRowLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  receiptRowValue: {
    fontSize: 13,
    fontWeight: '600',
    maxWidth: SCREEN_WIDTH * 0.5,
    textAlign: 'right',
  },
  copyInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptRowValueCode: {
    fontSize: 13,
    fontWeight: '700',
  },
});
