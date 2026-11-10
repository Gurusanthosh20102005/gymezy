import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Single Source of Truth (SSOT) Skeleton Shimmer Primitives & Domain Composites
 * Engineered for 60FPS Native Driver execution, zero cumulative layout shift (CLS = 0),
 * and dynamic light/dark theme adaptation.
 */

export const SkeletonBox = ({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
  shimmer = false,
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
export const SkeletonShimmer = ({ width = SCREEN_WIDTH, height = 200, borderRadius = 16, style, children }) => {
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
 * Domain Composite: Spotlight Banner Skeleton
 */
export const SkeletonSpotlightCard = () => {
  const { colors, isDark } = useTheme();
  const cardW = SCREEN_WIDTH - 32;

  return (
    <View style={[styles.spotlightWrapper, { width: cardW }]}>
      <SkeletonShimmer width={cardW} height={170} borderRadius={18}>
        <View style={styles.spotlightContent}>
          <SkeletonBox width={85} height={20} borderRadius={10} style={{ marginBottom: 12 }} />
          <SkeletonBox width="70%" height={22} borderRadius={6} style={{ marginBottom: 8 }} />
          <SkeletonBox width="45%" height={14} borderRadius={6} />
        </View>
      </SkeletonShimmer>
    </View>
  );
};

/**
 * Domain Composite: Category Chips Row Skeleton
 */
export const SkeletonCategoryChips = () => {
  const chipWidths = [80, 95, 75, 110, 85];
  return (
    <View style={styles.categoryRow}>
      {chipWidths.map((w, idx) => (
        <SkeletonBox
          key={idx}
          width={w}
          height={38}
          borderRadius={20}
          style={{ marginRight: 10 }}
        />
      ))}
    </View>
  );
};

/**
 * Domain Composite: Home Nearby Gym Card Skeleton (CLS = 0)
 */
export const SkeletonGymCard = () => {
  const { colors, isDark } = useTheme();
  const cardWidth = SCREEN_WIDTH - 32;

  return (
    <View
      style={[
        styles.gymCardWrapper,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      {/* Hero Image Skeleton with Shimmer */}
      <SkeletonShimmer width="100%" height={170} borderRadius={16} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
        {/* Rating Badge Placeholder */}
        <View style={styles.badgeTopLeft}>
          <SkeletonBox width={54} height={24} borderRadius={8} />
        </View>
        {/* Bookmark Circle Placeholder */}
        <View style={styles.badgeTopRight}>
          <SkeletonCircle size={32} />
        </View>
      </SkeletonShimmer>

      {/* Card Info Section */}
      <View style={styles.gymCardBody}>
        <View style={styles.gymCardHeaderRow}>
          <SkeletonBox width="65%" height={18} borderRadius={6} />
          <SkeletonBox width="20%" height={18} borderRadius={6} />
        </View>

        <SkeletonBox width="45%" height={13} borderRadius={5} style={{ marginTop: 8 }} />

        <View style={styles.gymCardDivider} />

        <View style={styles.gymCardFooter}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <SkeletonBox width={65} height={22} borderRadius={6} />
            <SkeletonBox width={75} height={22} borderRadius={6} />
          </View>
          <SkeletonBox width={85} height={28} borderRadius={8} />
        </View>
      </View>
    </View>
  );
};

/**
 * Domain Composite: Gym Details Screen Skeleton
 */
export const SkeletonGymDetails = () => {
  const { colors } = useTheme();

  return (
    <View style={[styles.detailsContainer, { backgroundColor: colors.background }]}>
      {/* Hero Carousel Skeleton */}
      <SkeletonShimmer width={SCREEN_WIDTH} height={270} borderRadius={0} style={{ marginBottom: 16 }}>
        <View style={styles.detailsHeroTopRow}>
          <SkeletonCircle size={40} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <SkeletonCircle size={40} />
            <SkeletonCircle size={40} />
          </View>
        </View>
      </SkeletonShimmer>

      {/* Main Body */}
      <View style={{ paddingHorizontal: 16 }}>
        {/* Title & Rating */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <SkeletonBox width="60%" height={24} borderRadius={6} />
          <SkeletonBox width={60} height={26} borderRadius={8} />
        </View>

        {/* Location line */}
        <SkeletonBox width="40%" height={14} borderRadius={5} style={{ marginBottom: 18 }} />

        {/* Pricing / Pass Row */}
        <View
          style={[
            styles.detailsPriceBox,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View>
            <SkeletonBox width={100} height={13} borderRadius={4} style={{ marginBottom: 6 }} />
            <SkeletonBox width={80} height={22} borderRadius={6} />
          </View>
          <SkeletonBox width={120} height={40} borderRadius={10} />
        </View>

        {/* Amenities Row */}
        <SkeletonBox width={110} height={18} borderRadius={5} style={{ marginTop: 22, marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonBox key={i} width={75} height={34} borderRadius={8} />
          ))}
        </View>

        {/* Trainers Row */}
        <SkeletonBox width={130} height={18} borderRadius={5} style={{ marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.trainerCardSkeleton,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <SkeletonCircle size={52} style={{ marginBottom: 8 }} />
              <SkeletonBox width={60} height={12} borderRadius={4} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

/**
 * Domain Composite: My Bookings / Membership Pass Skeleton
 */
export const SkeletonBookingCard = () => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.passCardWrapper,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <SkeletonCircle size={46} style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <SkeletonBox width="60%" height={16} borderRadius={5} style={{ marginBottom: 6 }} />
          <SkeletonBox width="40%" height={12} borderRadius={4} />
        </View>
        <SkeletonBox width={70} height={24} borderRadius={12} />
      </View>

      <View style={styles.gymCardDivider} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <SkeletonBox width={90} height={14} borderRadius={4} />
        <SkeletonBox width={100} height={32} borderRadius={8} />
      </View>
    </View>
  );
};

/**
 * Domain Composite: Bookmarked Gym Item Skeleton
 */
export const SkeletonBookmarkRow = () => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.bookmarkRow,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <SkeletonBox width={84} height={84} borderRadius={12} style={{ marginRight: 12 }} />
      <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: 4 }}>
        <View>
          <SkeletonBox width="75%" height={16} borderRadius={5} style={{ marginBottom: 6 }} />
          <SkeletonBox width="45%" height={12} borderRadius={4} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <SkeletonBox width={50} height={18} borderRadius={6} />
          <SkeletonBox width={60} height={18} borderRadius={6} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  shimmerContainer: {
    overflow: 'hidden',
    position: 'relative',
  },
  spotlightWrapper: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  spotlightContent: {
    padding: 16,
    justifyContent: 'flex-end',
    height: '100%',
  },
  categoryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  gymCardWrapper: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  badgeTopLeft: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  badgeTopRight: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  gymCardBody: {
    padding: 14,
  },
  gymCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gymCardDivider: {
    height: 1,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    marginVertical: 12,
  },
  gymCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailsContainer: {
    flex: 1,
  },
  detailsHeroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
  },
  detailsPriceBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  trainerCardSkeleton: {
    width: 90,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  passCardWrapper: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  bookmarkRow: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
});
