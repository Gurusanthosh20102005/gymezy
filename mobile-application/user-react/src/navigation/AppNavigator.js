import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SplashScreen } from '../pages/SplashScreen';
import { OnboardingScreen } from '../pages/OnboardingScreen';
import { LoginScreen } from '../pages/LoginScreen';
import { HomeScreen } from '../pages/HomeScreen';
import { GymDetailsScreen } from '../pages/GymDetailsScreen';
import { BookingSessionScreen } from '../pages/BookingSessionScreen';
import { BuyMembershipScreen } from '../pages/BuyMembershipScreen';
import { PaymentSummaryScreen } from '../pages/PaymentSummaryScreen';
import { BookingDetailsScreen } from '../pages/BookingDetailsScreen';
import { MembershipDetailsScreen } from '../pages/MembershipDetailsScreen';
import { WalletScreen } from '../pages/WalletScreen';
import { AttendanceHistoryScreen } from '../pages/AttendanceHistoryScreen';

const Stack = createNativeStackNavigator();

export const AppNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="HomeTabs" component={HomeScreen} />
      <Stack.Screen name="HomeTab" component={HomeScreen} />
      <Stack.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="AttendanceHistory"
        component={AttendanceHistoryScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="GymDetails"
        component={GymDetailsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="BookingSession"
        component={BookingSessionScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="BuyMembership"
        component={BuyMembershipScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="PaymentSummary"
        component={PaymentSummaryScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="BookingDetails"
        component={BookingDetailsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="MembershipDetails"
        component={MembershipDetailsScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
};
