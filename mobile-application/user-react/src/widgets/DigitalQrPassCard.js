import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import LottieView from 'lottie-react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { useToast } from './CustomScaffoldMessage';

const getStatusTheme = (normStatus) => {
  if (normStatus === 'ACTIVE') {
    return {
      bg: '#E6F7EF',
      border: '#B7EAD0',
      text: '#047857',
    };
  }
  if (
    normStatus === 'GAP DAY' ||
    normStatus === 'REST DAY' ||
    normStatus === 'IN REVIEW' ||
    normStatus === 'PENDING_REVIEW' ||
    normStatus === 'UNDER REVIEW' ||
    normStatus === 'PENDING_GYM_APPROVAL' ||
    normStatus === 'PENDING_SUPER_ADMIN_APPROVAL'
  ) {
    return {
      bg: 'transparent',
      border: 'transparent',
      text: '#D97706',
    };
  }
  if (normStatus === 'UPCOMING') {
    return {
      bg: 'transparent',
      border: 'transparent',
      text: '#D97706',
    };
  }
  return {
    bg: 'transparent',
    border: 'transparent',
    text: '#DC2626',
  };
};

const getStatusAnimationConfig = (
  normStatus,
  primaryDateValue,
  secondaryDateValue,
  effectiveAccent,
  isInReview = false,
  isCustomGapDay = false,
  nextSessionDateFormatted = null
) => {
  if (isCustomGapDay) {
    return {
      isCustomGapDay: true,
      icon: 'event-busy',
      text: 'NO SESSION SCHEDULED TODAY',
      textColor: '#D97706',
      helpText: nextSessionDateFormatted
        ? `Next session: ${nextSessionDateFormatted}. Entry QR & OTP will unlock on that date.`
        : 'No session booked for today. Please review your custom schedule dates.',
    };
  }
  if (
    isInReview ||
    normStatus === 'IN REVIEW' ||
    normStatus === 'PENDING_REVIEW' ||
    normStatus === 'UNDER REVIEW' ||
    normStatus === 'PENDING_GYM_APPROVAL' ||
    normStatus === 'PENDING_SUPER_ADMIN_APPROVAL'
  ) {
    return {
      isReview: true,
      icon: 'pending-actions',
      text: 'PLAN SWITCH IN REVIEW',
      textColor: '#D97706',
      helpText: 'QR code & entry OTP are paused while your plan change request is under review.',
    };
  }
  const cleanStartDate = primaryDateValue?.includes('-')
    ? primaryDateValue.split('-')[0].trim()
    : (primaryDateValue || 'START DATE');

  if (normStatus === 'UPCOMING') {
    return {
      source: require('../../assets/animations/upcoming-calendar.json'),
      icon: 'event-available',
      text: `PASS ACTIVATES ON ${cleanStartDate.toUpperCase()}`,
      textColor: effectiveAccent,
      helpText: 'QR pass & 6-digit entry OTP will automatically unlock on your start date',
      loop: true,
    };
  }
  if (
    normStatus === 'SWITCHED' ||
    normStatus === 'DOWNGRADED' ||
    normStatus === 'UPGRADED' ||
    normStatus === 'TRANSFERRED'
  ) {
    return {
      source: require('../../assets/animations/expired-calender.json'),
      icon: 'sync-disabled',
      text: 'MEMBERSHIP SWITCHED',
      textColor: '#DC2626',
      helpText: 'This pass was switched to a new plan and is no longer valid for entry',
      loop: false,
    };
  }
  if (normStatus === 'EXPIRED') {
    return {
      source: require('../../assets/animations/expired-calender.json'),
      icon: 'event-busy',
      text: `MEMBERSHIP EXPIRED ON ${secondaryDateValue?.toUpperCase() || 'EXPIRY DATE'}`,
      textColor: '#DC2626',
      helpText: 'Membership has expired — please renew to gain entry',
      loop: false,
    };
  }
  if (normStatus === 'CANCELLED') {
    return {
      source: require('../../assets/animations/cancel-calender.json'),
      icon: 'cancel',
      text: 'MEMBERSHIP CANCELLED',
      textColor: '#DC2626',
      helpText: 'This pass has been cancelled and is no longer valid for entry',
      loop: false,
    };
  }
  if (normStatus === 'INACTIVE') {
    return {
      source: require('../../assets/animations/expired-calender.json'),
      icon: 'event-busy',
      text: 'MEMBERSHIP INACTIVE',
      textColor: '#DC2626',
      helpText: 'This membership is currently inactive',
      loop: false,
    };
  }
  return null;
};

export const DigitalQrPassCard = ({
  passId,
  customerId,
  otp,
  gymName,
  subtitle,
  primaryDateLabel,
  primaryDateValue,
  secondaryDateLabel,
  secondaryDateValue,
  status = 'ACTIVE',
  iconName = 'workspace-premium',
  gymImageUrl,
  accentColor,
  isInReview = false,
  qrValue,
  passType = 'BOOKING',
  isCustomDates = false,
  isTodayValid = true,
  nextSessionDateFormatted = null,
}) => {
  const { isDark, colors } = useTheme();
  const { showToast } = useToast();
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = gymImageUrl && !logoFailed;

  const effectiveAccent = isDark
    ? AppColors.darkAccentColor
    : accentColor || AppColors.primaryNavy;

  const qrData =
    qrValue ||
    JSON.stringify({
      type: passType,
      id: passId,
      bookingId: passId,
      customerId: customerId,
      entryOtp: otp || null,
    });
  const otpDigits = typeof otp === 'string' && otp.trim().length > 0 ? otp.trim().split('') : [];

  const copyToClipboard = async (text, label) => {
    await Clipboard.setStringAsync(text);
    showToast({
      message: `${label} copied to clipboard`,
      isSuccess: true,
    });
  };

  const isCustomGapDay = isCustomDates && !isTodayValid;
  const normStatus = isCustomGapDay
    ? 'GAP DAY'
    : (isInReview ? 'IN REVIEW' : status || 'ACTIVE').toUpperCase();
  const statusTheme = getStatusTheme(normStatus);
  const animConfig = getStatusAnimationConfig(
    normStatus,
    primaryDateValue,
    secondaryDateValue,
    effectiveAccent,
    isInReview,
    isCustomGapDay,
    nextSessionDateFormatted
  );

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      {/* 1. Pass Header */}
      <View style={styles.headerSection}>
        <View style={styles.titleRow}>
          <View
            style={[
              styles.iconBadge,
              {
                backgroundColor: showLogo
                  ? (isDark ? '#1E293B' : '#F1F5F9')
                  : (isDark ? 'rgba(147, 197, 253, 0.12)' : 'rgba(0, 56, 130, 0.12)'),
                borderColor: showLogo
                  ? colors.border
                  : (isDark ? 'rgba(147, 197, 253, 0.2)' : 'rgba(0, 56, 130, 0.2)'),
                padding: showLogo ? 0 : 10,
                overflow: 'hidden',
                width: 46,
                height: 46,
              },
            ]}
          >
            {showLogo ? (
              <Image
                source={{ uri: gymImageUrl }}
                style={styles.gymLogoImg}
                resizeMode="cover"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <MaterialIcons name={iconName} size={24} color={effectiveAccent} />
            )}
          </View>

          <View style={styles.titleTextContainer}>
            <Text style={[styles.gymNameText, { color: colors.text }]} numberOfLines={1}>
              {gymName}
            </Text>
            <Text style={[styles.subtitleText, { color: effectiveAccent }]}>
              {subtitle}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: statusTheme.bg,
                borderColor: statusTheme.border,
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: statusTheme.text,
                },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                {
                  color: statusTheme.text,
                },
              ]}
            >
              {normStatus}
            </Text>
          </View>
        </View>

        {/* Date Strip */}
        <View
          style={[
            styles.dateStrip,
            {
              backgroundColor: isDark ? '#262626' : '#F8FAFC',
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.dateCol}>
            <Text style={[styles.dateLabel, { color: colors.subtitle }]}>
              {primaryDateLabel}
            </Text>
            <Text style={[styles.dateValue, { color: colors.text }]} numberOfLines={2}>
              {primaryDateValue}
            </Text>
          </View>

          <View style={[styles.dateDivider, { backgroundColor: colors.border }]} />

          <View style={styles.dateCol}>
            <Text style={[styles.dateLabel, { color: colors.subtitle }]}>
              {secondaryDateLabel}
            </Text>
            <Text style={[styles.dateValue, { color: colors.text }]} numberOfLines={1}>
              {secondaryDateValue}
            </Text>
          </View>
        </View>
      </View>

      {/* Perforated Tear Line with Scalloped Cutouts */}
      <View style={styles.tearLineContainer}>
        <View
          style={[
            styles.scallopCutoutLeft,
            { backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground },
          ]}
        />
        <View style={styles.dashedLineWrapper}>
          {Array.from({ length: 24 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dashSegment,
                {
                  backgroundColor: i % 2 === 0 ? colors.border : 'transparent',
                },
              ]}
            />
          ))}
        </View>
        <View
          style={[
            styles.scallopCutoutRight,
            { backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground },
          ]}
        />
      </View>

      {/* 2. QR Code Canvas or Status Review/Lottie Animation */}
      <View style={styles.bodySection}>
        {animConfig ? (
          animConfig.isCustomGapDay ? (
            <View style={styles.reviewCanvasWrapper}>
              <View
                style={[
                  styles.reviewIconCircle,
                  {
                    width: 76,
                    height: 76,
                    borderRadius: 38,
                    backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#FEF3C7',
                    borderWidth: 1.5,
                    borderColor: isDark ? 'rgba(217, 119, 6, 0.3)' : '#FDE68A',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  },
                ]}
              >
                <MaterialIcons name="event-busy" size={42} color="#D97706" />
              </View>
              <View
                style={[
                  styles.reviewBadge,
                  {
                    paddingHorizontal: 14,
                    paddingVertical: 5,
                    borderRadius: 20,
                    backgroundColor: isDark ? 'rgba(217, 119, 6, 0.2)' : '#FEF3C7',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(217, 119, 6, 0.35)' : '#FDE68A',
                  },
                ]}
              >
                <MaterialIcons
                  name="calendar-today"
                  size={15}
                  color="#D97706"
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.reviewBadgeText, { color: '#D97706' }]}>
                  {animConfig.text}
                </Text>
              </View>
              {nextSessionDateFormatted ? (
                <View
                  style={{
                    marginTop: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 12,
                    backgroundColor: isDark ? '#262626' : '#F1F5F9',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                    Next Session: {nextSessionDateFormatted}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : animConfig.isReview ? (
            <View style={styles.reviewCanvasWrapper}>
              <View style={styles.reviewIconCircle}>
                <MaterialIcons name="pending-actions" size={52} color="#D97706" />
              </View>
              <View style={styles.reviewBadge}>
                <MaterialIcons
                  name="sync"
                  size={16}
                  color="#D97706"
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.reviewBadgeText, { color: '#D97706' }]}>
                  {animConfig.text}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.upcomingCanvasWrapper}>
              <LottieView
                source={animConfig.source}
                autoPlay
                loop={animConfig.loop === true}
                style={styles.upcomingLottie}
              />
              <View style={styles.upcomingBadge}>
                <MaterialIcons
                  name={animConfig.icon}
                  size={16}
                  color={animConfig.textColor}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.upcomingBadgeText, { color: animConfig.textColor }]}>
                  {animConfig.text}
                </Text>
              </View>
            </View>
          )
        ) : (
          <View style={styles.qrCanvasWrapper}>
            <View style={styles.qrCanvas}>
              <QRCode
                value={qrData}
                size={180}
                color="#0F172A"
                backgroundColor="#FFFFFF"
              />
              {/* Center Logo Overlay */}
              <View style={styles.qrCenterLogoContainer}>
                <Image
                  source={require('../../assets/logo/gymezy.png')}
                  style={styles.qrCenterLogo}
                  resizeMode="contain"
                />
              </View>
            </View>
          </View>
        )}

        <Text style={[styles.qrHelpText, { color: colors.subtitle }]}>
          {animConfig
            ? animConfig.helpText
            : 'Show this QR code or 6-digit OTP to gym reception'}
        </Text>

        {/* 3. 6-Digit Check-in OTP (only when strictly Active) */}
        {!animConfig && otpDigits.length > 0 && (
          otpDigits.length > 0 ? (
            <View
              style={[
                styles.otpContainer,
                {
                  backgroundColor: isDark ? '#262626' : '#F1F5F9',
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.otpHeader}>
                <View style={styles.otpHeaderLeft}>
                  <MaterialIcons name="pin" size={16} color={effectiveAccent} />
                  <Text style={[styles.otpHeaderLabel, { color: colors.subtitle }]}>
                    ENTRY OTP
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => copyToClipboard(otp, 'OTP')}
                  style={styles.copyBtn}
                >
                  <MaterialIcons name="content-copy" size={14} color={effectiveAccent} />
                  <Text style={[styles.copyBtnText, { color: effectiveAccent }]}>Copy</Text>
                </TouchableOpacity>
              </View>

              {/* 6 Digit Boxes */}
              <View style={styles.digitRow}>
                {otpDigits.map((digit, idx) => (
                  <View
                    key={`otp-box-${idx}-${digit}`}
                    style={[
                      styles.digitBox,
                      {
                        backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                        borderColor: isDark ? 'rgba(147, 197, 253, 0.3)' : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.digitText,
                        { color: isDark ? '#FFFFFF' : effectiveAccent },
                      ]}
                    >
                      {digit}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View
              style={[
                styles.otpContainer,
                {
                  backgroundColor: otpFallback.bg,
                  borderColor: otpFallback.border,
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                  alignItems: 'center',
                },
              ]}
            >
              <MaterialIcons
                name={otpFallback.icon}
                size={20}
                color={otpFallback.iconColor}
                style={{ marginBottom: 4 }}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: otpFallback.titleColor,
                  textAlign: 'center',
                }}
              >
                {otpFallback.title}
              </Text>
              <Text
                style={{
                  fontSize: 11.5,
                  color: otpFallback.subColor,
                  textAlign: 'center',
                  marginTop: 3,
                  lineHeight: 16,
                }}
              >
                {otpFallback.description}
              </Text>
            </View>
          )
        )}

        {/* 4. Pass Meta Info (Pass ID & Customer ID) */}
        <View
          style={[
            styles.metaInfoRow,
            {
              backgroundColor: isDark ? '#262626' : '#F8FAFC',
              borderColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => copyToClipboard(passId, 'Pass ID')}
            style={styles.metaCol}
            activeOpacity={0.7}
          >
            <Text style={[styles.metaLabel, { color: colors.subtitle }]}>PASS ID</Text>
            <View style={styles.metaValueRow}>
              <Text style={[styles.metaValue, { color: colors.text }]}>{passId}</Text>
              <MaterialIcons
                name="content-copy"
                size={12}
                color={colors.subtitle}
                style={{ marginLeft: 4 }}
              />
            </View>
          </TouchableOpacity>

          <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />

          <View style={styles.metaCol}>
            <Text style={[styles.metaLabel, { color: colors.subtitle }]}>CUSTOMER ID</Text>
            <Text style={[styles.metaValue, { color: colors.text }]}>{customerId}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  headerSection: {
    padding: 20,
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gymLogoImg: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  titleTextContainer: {
    flex: 1,
    marginLeft: 14,
  },
  gymNameText: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  subtitleText: {
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 0.8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  dateStrip: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateCol: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  dateValue: {
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 2,
  },
  dateDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 10,
  },
  tearLineContainer: {
    height: 24,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  scallopCutoutLeft: {
    position: 'absolute',
    left: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    zIndex: 10,
  },
  scallopCutoutRight: {
    position: 'absolute',
    right: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    zIndex: 10,
  },
  dashedLineWrapper: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dashSegment: {
    flex: 1,
    height: 1.5,
    marginHorizontal: 2,
  },
  bodySection: {
    padding: 20,
    paddingTop: 14,
    alignItems: 'center',
  },
  upcomingCanvasWrapper: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewCanvasWrapper: {
    width: '100%',
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewIconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  reviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  reviewBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  upcomingLottie: {
    width: 240,
    height: 160,
  },
  upcomingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  upcomingBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  qrCanvasWrapper: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCanvas: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCenterLogoContainer: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: AppColors.primaryNavy,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  qrCenterLogo: {
    width: 26,
    height: 26,
    tintColor: AppColors.primaryNavy,
  },
  qrHelpText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  otpContainer: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
  },
  otpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  otpHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  otpHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginLeft: 6,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  digitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  digitBox: {
    width: 42,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  digitText: {
    fontSize: 20,
    fontWeight: '900',
  },
  metaInfoRow: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  metaValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaValue: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  metaDivider: {
    width: 1,
    height: 22,
    marginHorizontal: 10,
  },
});
