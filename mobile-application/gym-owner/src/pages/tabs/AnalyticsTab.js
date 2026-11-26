import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeContext';
import { AppColors } from '../../theme/appTheme';
import { useAuth } from '../../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const WEEKLY_CHECKINS = [
  { day: 'Mon', count: 74, heightPct: 74 },
  { day: 'Tue', count: 88, heightPct: 88 },
  { day: 'Wed', count: 68, heightPct: 68 },
  { day: 'Thu', count: 82, heightPct: 82 },
  { day: 'Fri', count: 95, heightPct: 95 },
  { day: 'Sat', count: 100, heightPct: 100 },
  { day: 'Sun', count: 54, heightPct: 54 },
];

export const AnalyticsTab = ({ topInset }) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, gym } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');

  const isManager = Boolean(
    user?.isManager ||
    user?.role === 'Manager' ||
    user?.role === 'MANAGER' ||
    String(user?.role || '').toLowerCase() === 'manager'
  );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: topInset + 12,
          paddingBottom: 170 + Math.max(insets.bottom, 24),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header with Title & Period Selector */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.pageTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Performance & Insights
          </Text>
          <Text style={[styles.pageSubtitle, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
            Real-time analytics for {gym?.name || 'your gym'}
          </Text>
        </View>
      </View>

      {/* Period Filter Buttons */}
      <View style={styles.periodRow}>
        {['This Week', 'This Month', 'This Year'].map((p) => {
          const isSelected = selectedPeriod === p;
          return (
            <TouchableOpacity
              key={p}
              onPress={() => setSelectedPeriod(p)}
              style={[
                styles.periodBtn,
                {
                  backgroundColor: isSelected
                    ? AppColors.primaryColor
                    : isDark
                    ? AppColors.darkCard
                    : '#FFFFFF',
                  borderColor: isSelected
                    ? AppColors.primaryColor
                    : isDark
                    ? AppColors.darkBorder
                    : '#E2E8F0',
                },
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.periodBtnText,
                  {
                    color: isSelected
                      ? '#FFFFFF'
                      : isDark
                      ? 'rgba(255,255,255,0.7)'
                      : '#475569',
                    fontWeight: isSelected ? '700' : '500',
                  },
                ]}
              >
                {p}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Revenue Highlight Card */}
      {!isManager && (
        <View
          style={[
            styles.revenueCard,
            {
              backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
              borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.revenueTopRow}>
            <View>
              <Text
                style={[
                  styles.revenueLabel,
                  { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' },
                ]}
              >
                TOTAL REVENUE ({selectedPeriod.toUpperCase()})
              </Text>
              <Text
                style={[
                  styles.revenueAmount,
                  { color: isDark ? '#FFFFFF' : '#0F172A' },
                ]}
              >
                ₹1,85,400
              </Text>
            </View>
            <View style={styles.growthBadge}>
              <MaterialIcons name="trending-up" size={16} color={AppColors.secondaryColor} />
              <Text style={styles.growthText}>+14.2%</Text>
            </View>
          </View>

          <View
            style={[
              styles.statDivider,
              { backgroundColor: isDark ? AppColors.darkBorder : '#F1F5F9' },
            ]}
          />

          <View style={styles.miniStatsRow}>
            <View style={styles.miniStatItem}>
              <Text
                style={[
                  styles.miniStatLabel,
                  { color: isDark ? 'rgba(255,255,255,0.5)' : '#94A3B8' },
                ]}
              >
                Daily Average
              </Text>
              <Text
                style={[
                  styles.miniStatVal,
                  { color: isDark ? '#FFFFFF' : '#0F172A' },
                ]}
              >
                ₹6,180
              </Text>
            </View>

            <View style={styles.miniStatItem}>
              <Text
                style={[
                  styles.miniStatLabel,
                  { color: isDark ? 'rgba(255,255,255,0.5)' : '#94A3B8' },
                ]}
              >
                Renewal Rate
              </Text>
              <Text
                style={[
                  styles.miniStatVal,
                  { color: isDark ? '#FFFFFF' : '#0F172A' },
                ]}
              >
                92.4%
              </Text>
            </View>

            <View style={styles.miniStatItem}>
              <Text
                style={[
                  styles.miniStatLabel,
                  { color: isDark ? 'rgba(255,255,255,0.5)' : '#94A3B8' },
                ]}
              >
                New Signups
              </Text>
              <Text
                style={[
                  styles.miniStatVal,
                  { color: isDark ? '#FFFFFF' : '#0F172A' },
                ]}
              >
                +28
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Weekly Check-In Activity Graph */}
      <View
        style={[
          styles.chartCard,
          {
            backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.chartHeader}>
          <View>
            <Text
              style={[
                styles.chartTitle,
                { color: isDark ? '#FFFFFF' : '#0F172A' },
              ]}
            >
              Weekly Footfall Trends
            </Text>
            <Text
              style={[
                styles.chartSub,
                { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' },
              ]}
            >
              Average 82 members / day
            </Text>
          </View>
          <View style={styles.peakBadge}>
            <Text style={styles.peakBadgeText}>Saturday Peak</Text>
          </View>
        </View>

        {/* Bar Chart Container */}
        <View style={styles.barChartContainer}>
          {WEEKLY_CHECKINS.map((item) => (
            <View key={item.day} style={styles.barColumn}>
              <Text
                style={[
                  styles.barValueText,
                  { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' },
                ]}
              >
                {item.count}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${item.heightPct}%`,
                      backgroundColor:
                        item.day === 'Sat'
                          ? AppColors.secondaryColor
                          : isDark
                          ? '#3B82F6'
                          : AppColors.primaryColor,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.barDayText,
                  {
                    color:
                      item.day === 'Sat'
                        ? AppColors.secondaryColor
                        : isDark
                        ? 'rgba(255,255,255,0.7)'
                        : '#475569',
                    fontWeight: item.day === 'Sat' ? '800' : '600',
                  },
                ]}
              >
                {item.day}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Settlement Alert Card */}
      <View
        style={[
          styles.settlementCard,
          {
            backgroundColor: isDark ? 'rgba(0, 56, 130, 0.15)' : '#EFF6FF',
            borderColor: isDark ? 'rgba(0, 56, 130, 0.4)' : '#BFDBFE',
          },
        ]}
      >
        <Ionicons name="card-outline" size={24} color={AppColors.primaryColor} />
        <View style={styles.settlementContent}>
          <Text
            style={[
              styles.settlementTitle,
              { color: isDark ? '#93C5FD' : AppColors.primaryColor },
            ]}
          >
            Next Settlement: 01 Oct 2026
          </Text>
          <Text
            style={[
              styles.settlementSub,
              { color: isDark ? 'rgba(255,255,255,0.7)' : '#475569' },
            ]}
          >
            ₹48,200 pending payout will be credited to HDFC Bank (A/C **** 4891)
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 18,
  },
  headerRow: {
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodBtnText: {
    fontSize: 12,
  },
  revenueCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  revenueTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  revenueLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  revenueAmount: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 191, 98, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  growthText: {
    color: AppColors.secondaryColor,
    fontSize: 12,
    fontWeight: '700',
  },
  statDivider: {
    height: 1,
    marginVertical: 14,
  },
  miniStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  miniStatItem: {
    alignItems: 'center',
  },
  miniStatLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  miniStatVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  chartCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  chartSub: {
    fontSize: 12,
    marginTop: 2,
  },
  peakBadge: {
    backgroundColor: 'rgba(0, 191, 98, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  peakBadgeText: {
    color: AppColors.secondaryColor,
    fontSize: 11,
    fontWeight: '700',
  },
  barChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 10,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValueText: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  barTrack: {
    width: 22,
    height: 90,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    borderRadius: 6,
  },
  barDayText: {
    fontSize: 11,
    marginTop: 6,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  settlementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    marginBottom: 10,
  },
  settlementContent: {
    flex: 1,
  },
  settlementTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  settlementSub: {
    fontSize: 12,
    lineHeight: 16,
  },
});
