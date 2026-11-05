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

export const DashboardScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentTab, setCurrentTab] = useState(0);

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
        {currentTab === 0 && (
          <OverviewTab
            topInset={topInset}
            navigation={navigation}
            onNavigateToMembers={() => setCurrentTab(1)}
            onNavigateToBookings={() => setCurrentTab(2)}
            onNavigateToEmployees={() => setCurrentTab(3)}
            onNavigateToSections={() => setCurrentTab(4)}
          />
        )}
        {currentTab === 1 && <MembersTab topInset={topInset} />}
        {currentTab === 2 && (
          <BookingsTab
            topInset={topInset}
            navigation={navigation}
          />
        )}
        {currentTab === 3 && (
          <EmployeesTab
            topInset={topInset}
            navigation={navigation}
          />
        )}
        {currentTab === 4 && (
          <SectionsTab
            topInset={topInset}
            navigation={navigation}
          />
        )}
      </View>

      {/* Floating Bottom Navigation Bar with Smooth Physics Animations */}
      <CustomFloatingNavBar
        currentIndex={currentTab}
        onTap={(index) => setCurrentTab(index)}
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
});
