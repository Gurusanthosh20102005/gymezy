import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { CustomFloatingNavBar } from '../widgets/CustomFloatingNavBar';
import { OverviewTab } from './tabs/OverviewTab';
import { MembersTab } from './tabs/MembersTab';
import { BookingsTab } from './tabs/BookingsTab';
import { EmployeesTab } from './tabs/EmployeesTab';
import { SectionsTab } from './tabs/SectionsTab';
import { notificationService } from '../services/notificationService';

export const DashboardScreen = ({ navigation, route }) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const initialTab = typeof route?.params?.initialTab === 'number' ? route.params.initialTab : 0;
  const [currentTab, setCurrentTab] = useState(initialTab);
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([initialTab]));
  const [membersMode, setMembersMode] = useState('MEMBERS');

  const switchTab = (tabIndex) => {
    setVisitedTabs((prev) => {
      if (prev.has(tabIndex)) return prev;
      const next = new Set(prev);
      next.add(tabIndex);
      return next;
    });
    setCurrentTab(tabIndex);
  };

  useEffect(() => {
    if (typeof route?.params?.initialTab === 'number') {
      switchTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);

  // Request native notification permission on initial dashboard entry
  useEffect(() => {
    notificationService.requestNotificationPermission();
  }, []);

  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 36) : 44
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground },
      ]}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />

      <View style={styles.tabContentContainer}>
        {visitedTabs.has(0) && (
          <View style={[styles.tabPane, { display: currentTab === 0 ? 'flex' : 'none' }]}>
            <OverviewTab
              topInset={topInset}
              navigation={navigation}
              onNavigateToMembers={() => switchTab(1)}
              onNavigateToBookings={() => switchTab(2)}
              onNavigateToEmployees={() => switchTab(3)}
              onNavigateToSections={() => switchTab(4)}
            />
          </View>
        )}
        {visitedTabs.has(1) && (
          <View style={[styles.tabPane, { display: currentTab === 1 ? 'flex' : 'none' }]}>
            <MembersTab
              topInset={topInset}
              activeMode={membersMode}
              onChangeMode={setMembersMode}
            />
          </View>
        )}
        {visitedTabs.has(2) && (
          <View style={[styles.tabPane, { display: currentTab === 2 ? 'flex' : 'none' }]}>
            <BookingsTab
              topInset={topInset}
              navigation={navigation}
            />
          </View>
        )}
        {visitedTabs.has(3) && (
          <View style={[styles.tabPane, { display: currentTab === 3 ? 'flex' : 'none' }]}>
            <EmployeesTab
              topInset={topInset}
              navigation={navigation}
            />
          </View>
        )}
        {visitedTabs.has(4) && (
          <View style={[styles.tabPane, { display: currentTab === 4 ? 'flex' : 'none' }]}>
            <SectionsTab
              topInset={topInset}
              navigation={navigation}
            />
          </View>
        )}
      </View>

      {/* Floating Bottom Navigation Bar with Smooth Physics Animations */}
      <CustomFloatingNavBar
        currentIndex={currentTab}
        onTap={(index) => switchTab(index)}
        membersMode={membersMode}
        onSelectMembersMode={(mode) => {
          setMembersMode(mode);
          switchTab(1);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContentContainer: {
    flex: 1,
  },
  tabPane: {
    flex: 1,
  },
});
