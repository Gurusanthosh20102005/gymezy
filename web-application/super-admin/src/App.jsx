import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './general/Login';
import AdminLayout from './admin/AdminLayout';
import Dashboard from './admin/Dashboard';
import GymsManagement from './admin/GymsManagement';
import CustomersManagement from './admin/CustomersManagement';
import MembershipsManagement from './admin/MembershipsManagement';
import BookingsManagement from './admin/BookingsManagement';
import TransactionsManagement from './admin/TransactionsManagement';
import SubscriptionsManagement from './admin/SubscriptionsManagement';
import GymOnboarding from './admin/GymOnboarding';
import ReportsManagement from './admin/ReportsManagement';
import BannerManagement from './admin/BannerManagement';
import SettingsManagement from './admin/SettingsManagement';

export function App() {
  return (
    <Routes>
      {/* Main Entry Points */}
      <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/login" element={<Login />} />

      {/* Super Admin Portal Nested Routes */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="banners" element={<BannerManagement />} />
        <Route path="ads" element={<BannerManagement />} />
        <Route path="gyms" element={<GymsManagement />} />
        <Route path="onboarding" element={<GymOnboarding />} />
        <Route path="customers" element={<CustomersManagement />} />
        <Route path="users" element={<CustomersManagement />} />
        <Route path="memberships" element={<MembershipsManagement />} />
        <Route path="membership" element={<MembershipsManagement />} />
        <Route path="bookings" element={<BookingsManagement />} />
        <Route path="payments" element={<TransactionsManagement />} />
        <Route path="transactions" element={<TransactionsManagement />} />
        <Route path="subscriptions" element={<SubscriptionsManagement />} />
        <Route path="reports" element={<ReportsManagement />} />
        <Route path="audit" element={<Dashboard />} />
        <Route path="settings" element={<SettingsManagement />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>

      {/* Direct Route Aliases */}
      <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/banners" element={<Navigate to="/admin/banners" replace />} />
      <Route path="/ads" element={<Navigate to="/admin/banners" replace />} />
      <Route path="/gyms" element={<Navigate to="/admin/gyms" replace />} />
      <Route path="/onboarding" element={<Navigate to="/admin/onboarding" replace />} />
      <Route path="/customers" element={<Navigate to="/admin/customers" replace />} />
      <Route path="/users" element={<Navigate to="/admin/customers" replace />} />
      <Route path="/memberships" element={<Navigate to="/admin/memberships" replace />} />
      <Route path="/bookings" element={<Navigate to="/admin/bookings" replace />} />
      <Route path="/payments" element={<Navigate to="/admin/payments" replace />} />
      <Route path="/transactions" element={<Navigate to="/admin/payments" replace />} />
      <Route path="/subscriptions" element={<Navigate to="/admin/subscriptions" replace />} />
      <Route path="/reports" element={<Navigate to="/admin/reports" replace />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
}

export default App;

