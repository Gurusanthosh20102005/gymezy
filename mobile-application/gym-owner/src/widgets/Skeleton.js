import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../theme/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Single Source of Truth (SSOT) Skeleton Shimmer Primitives & Domain Composites for Gym Owner App
 * Engineered for 60FPS Native Driver execution, zero cumulative layout shift (CLS = 0),
 * and dynamic light/dark theme adaptation.
 */

export const SkeletonBox = ({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}) => {
  const { isDark } = useTheme();
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.9,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const baseColor = isDark ? '#262626' : '#E2E8F0';

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
};

export const SkeletonCircle = ({ size = 44, style }) => (
  <SkeletonBox
    width={size}
    height={size}
    borderRadius={size / 2}
    style={style}
  />
);

export const SkeletonText = ({
  lines = 1,
  height = 14,
  lineHeight = 20,
  width = '100%',
  borderRadius = 6,
  style,
}) => {
  if (lines <= 1) {
    return <SkeletonBox width={width} height={height} borderRadius={borderRadius} style={style} />;
  }

  return (
    <View style={[{ gap: Math.max(4, lineHeight - height) }, style]}>
      {Array.from({ length: lines }).map((_, idx) => {
        const lineW = idx === lines - 1 && typeof width === 'string' && width.endsWith('%')
          ? `${Math.max(40, parseInt(width, 10) - 25)}%`
          : width;
        return (
          <SkeletonBox
            key={idx}
            width={lineW}
            height={height}
            borderRadius={borderRadius}
          />
        );
      })}
    </View>
  );
};

/**
 * Horizontal Shimmer Overlay for Cards and Banners
 */
export const SkeletonShimmer = ({ width = SCREEN_WIDTH, height = 120, borderRadius = 14, style, children }) => {
  const { isDark } = useTheme();
  const translateX = useRef(new Animated.Value(-width)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: width * 1.5,
        duration: 1300,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [translateX, width]);

  const baseColor = isDark ? '#1E1E1E' : '#F1F5F9';
  const shimmerColors = isDark
    ? ['transparent', 'rgba(255, 255, 255, 0.06)', 'transparent']
    : ['transparent', 'rgba(255, 255, 255, 0.65)', 'transparent'];

  return (
    <View
      style={[
        styles.shimmerContainer,
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
        },
        style,
      ]}
    >
      {children}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ translateX }],
          },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={shimmerColors}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

/**
 * Domain Composite: KPI Metric Card Skeleton for OverviewTab
 */
export const SkeletonMetricCard = () => {
  const { isDark } = useTheme();
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0';

  return (
    <View style={[styles.metricCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonBox width="55%" height={14} borderRadius={5} />
        <SkeletonCircle size={32} />
      </View>
      <SkeletonBox width="70%" height={24} borderRadius={6} style={{ marginTop: 12 }} />
      <SkeletonBox width="40%" height={11} borderRadius={4} style={{ marginTop: 8 }} />
    </View>
  );
};

/**
 * Domain Composite: Member Row Skeleton for MembersTab
 */
export const SkeletonMemberRow = () => {
  const { isDark } = useTheme();
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0';

  return (
    <View style={[styles.memberRow, { backgroundColor: cardBg, borderColor: borderCol }]}>
      <SkeletonCircle size={46} style={{ marginRight: 12 }} />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <SkeletonBox width="60%" height={16} borderRadius={5} style={{ marginBottom: 6 }} />
        <SkeletonBox width="40%" height={12} borderRadius={4} />
      </View>
      <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
        <SkeletonBox width={65} height={20} borderRadius={10} style={{ marginBottom: 6 }} />
        <SkeletonBox width={50} height={11} borderRadius={4} />
      </View>
    </View>
  );
};

/**
 * Domain Composite: Booking Row Skeleton for BookingsTab
 */
export const SkeletonBookingRow = () => {
  const { isDark } = useTheme();
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0';

  return (
    <View style={[styles.bookingRow, { backgroundColor: cardBg, borderColor: borderCol }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SkeletonCircle size={38} style={{ marginRight: 10 }} />
          <View>
            <SkeletonBox width={120} height={15} borderRadius={5} style={{ marginBottom: 4 }} />
            <SkeletonBox width={80} height={11} borderRadius={4} />
          </View>
        </View>
        <SkeletonBox width={60} height={22} borderRadius={11} />
      </View>
      <View style={styles.divider} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <SkeletonBox width={100} height={13} borderRadius={4} />
        <SkeletonBox width={85} height={30} borderRadius={8} />
      </View>
    </View>
  );
};

/**
 * Domain Composite: Employee Card Skeleton for EmployeesTab
 */
export const SkeletonEmployeeCard = () => {
  const { isDark } = useTheme();
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0';

  return (
    <View style={[styles.employeeCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <SkeletonCircle size={50} style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <SkeletonBox width="65%" height={16} borderRadius={5} style={{ marginBottom: 6 }} />
          <SkeletonBox width="45%" height={12} borderRadius={4} />
        </View>
        <SkeletonBox width={60} height={22} borderRadius={11} />
      </View>
      <View style={styles.divider} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
        <SkeletonBox width={90} height={12} borderRadius={4} />
        <SkeletonBox width={90} height={12} borderRadius={4} />
      </View>
    </View>
  );
};

/**
 * Domain Composite: Section Card Skeleton for SectionsTab
 */
export const SkeletonSectionCard = () => {
  const { isDark } = useTheme();
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0';

  return (
    <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <SkeletonBox width="50%" height={18} borderRadius={5} />
        <SkeletonBox width={50} height={24} borderRadius={12} />
      </View>
      <SkeletonBox width="80%" height={13} borderRadius={4} style={{ marginBottom: 14 }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <SkeletonBox width={80} height={26} borderRadius={6} />
        <SkeletonBox width={95} height={26} borderRadius={6} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  shimmerContainer: {
    overflow: 'hidden',
    position: 'relative',
  },
  metricCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  bookingRow: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  employeeCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
});

