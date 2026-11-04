import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './general/Login';
import Register from './general/Register';
import ApplicationStatus from './general/ApplicationStatus';
import OwnerLayout from './owner/OwnerLayout';
import Dashboard from './owner/Dashboard';
import QrCheckIn from './owner/QrCheckIn';
import MembersManagement from './owner/components/MembersManagement';
import BookingsManagement from './owner/components/BookingsManagement';
import EmployeeManagement from './owner/components/EmployeeManagement';
import GymProfileManagement from './owner/components/GymProfileManagement';
import SectionsManagement from './owner/components/SectionsManagement';
import TransactionsManagement from './owner/components/TransactionsManagement';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main Entry Points */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/application-status" element={<ApplicationStatus />} />
        <Route path="/pending-approval" element={<Navigate to="/application-status" replace />} />
        <Route path="/status" element={<Navigate to="/application-status" replace />} />

        {/* Gym Owner Portal Nested Routes */}
        <Route path="/owner" element={<OwnerLayout />}>
          <Route index element={<Navigate to="/owner/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="checkin" element={<QrCheckIn />} />
          <Route path="sections" element={<SectionsManagement />} />
          <Route path="members" element={<MembersManagement />} />
          <Route path="membership" element={<MembersManagement />} />
          <Route path="bookings" element={<BookingsManagement />} />
          <Route path="transactions" element={<TransactionsManagement />} />
          <Route path="payments" element={<Navigate to="/owner/transactions" replace />} />
          <Route path="trainers" element={<EmployeeManagement />} />
          <Route path="employees" element={<EmployeeManagement />} />
          <Route path="staff" element={<EmployeeManagement />} />
          <Route path="settings" element={<GymProfileManagement />} />
          <Route path="profile" element={<GymProfileManagement />} />
        </Route>

        {/* Direct Route Aliases for quick top-level URLs */}
        <Route path="/dashboard" element={<Navigate to="/owner/dashboard" replace />} />
        <Route path="/checkin" element={<Navigate to="/owner/checkin" replace />} />
        <Route path="/sections" element={<Navigate to="/owner/sections" replace />} />
        <Route path="/members" element={<Navigate to="/owner/members" replace />} />
        <Route path="/membership" element={<Navigate to="/owner/members" replace />} />
        <Route path="/bookings" element={<Navigate to="/owner/bookings" replace />} />
        <Route path="/transactions" element={<Navigate to="/owner/transactions" replace />} />
        <Route path="/payments" element={<Navigate to="/owner/transactions" replace />} />
        <Route path="/trainers" element={<Navigate to="/owner/employees" replace />} />
        <Route path="/employees" element={<Navigate to="/owner/employees" replace />} />
        <Route path="/staff" element={<Navigate to="/owner/employees" replace />} />
        <Route path="/settings" element={<Navigate to="/owner/settings" replace />} />
        <Route path="/plans" element={<Navigate to="/owner/dashboard" replace />} />
        <Route path="/analytics" element={<Navigate to="/owner/dashboard" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
