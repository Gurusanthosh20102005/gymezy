import React, { useState } from 'react';
import { Layout } from 'antd';
import { Outlet, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTheme } from '../theme/ThemeContext';
import AppSidebar from '../general/components/AppSidebar';
import AppBar from '../general/components/AppBar';

const { Content } = Layout;

export const OwnerLayout = () => {
  const { isDarkMode } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useSelector((state) => state.auth || {});

  const approvalStatus = user?.gym?.approvalStatus || 'Approved';
  const isPendingOrRejected =
    approvalStatus === 'Pending Approval' ||
    approvalStatus === 'Pending' ||
    approvalStatus === 'Rejected';

  if (user?.role !== 'SUPER_ADMIN' && isPendingOrRejected) {
    return <Navigate to="/application-status" replace />;
  }

  return (
    <Layout style={{ minHeight: '100vh', backgroundColor: isDarkMode ? '#000000' : '#f8fafc' }}>
      {/* REUSABLE ROLE-BASED SIDEBAR COMPONENT */}
      <AppSidebar
        collapsed={collapsed}
        onCollapse={setCollapsed}
        role={user?.role || 'owner'}
        roleTitle={user?.role === 'MANAGER' ? 'Manager Console' : 'Owner Console'}
        brandRedirect="/owner/dashboard"
      />

      {/* MAIN CONTENT WRAPPER */}
      <Layout style={{ backgroundColor: isDarkMode ? '#000000' : '#f8fafc' }}>
        {/* REUSABLE APPLICATION TOP BAR */}
        <AppBar />

        {/* OUTLET CONTENT */}
        <Content
          style={{
            padding: '28px 32px',
            minHeight: 'calc(100vh - 72px)',
            backgroundColor: isDarkMode ? '#000000' : '#f8fafc',
            transition: 'all 0.3s ease',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default OwnerLayout;
