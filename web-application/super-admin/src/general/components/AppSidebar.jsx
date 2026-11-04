import React, { useEffect } from 'react';
import { Layout, Menu, Button } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

const { Sider } = Layout;
import {
  DashboardOutlined,
  ShopOutlined,
  TeamOutlined,
  DollarOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CreditCardOutlined,
  IdcardOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../theme/ThemeContext';
import gymezyLogo from '../../assets/logo/gymezy.png';

// Helper to render neatly proportioned sidebar count badges
const renderMenuBadge = (count, isHighlight = false) => {
  if (count === undefined || count === null || count === 0) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 20,
        height: 20,
        padding: '0 6px',
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        backgroundColor: isHighlight ? '#6366f1' : 'rgba(255, 255, 255, 0.14)',
        color: '#ffffff',
        flexShrink: 0,
      }}
    >
      {count}
    </span>
  );
};

export const AppSidebar = ({
  collapsed = false,
  onCollapse,
  brandRedirect = '/admin/dashboard',
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode } = useTheme();

  const gyms = useSelector((state) => state.gyms?.gyms || []);
  const stats = useSelector((state) => state.dashboard?.stats || {});

  // Compute live dynamic counts directly from fleet data if loaded, or fallback to dashboard stats
  const totalGyms = gyms.length > 0 ? gyms.length : (stats.registeredGyms?.total || stats.totalGyms || 0);
  const pendingCount = gyms.length > 0
    ? gyms.filter(
        (g) => g.approvalStatus === 'Pending Approval' || g.status === 'Pending' || g.approvalStatus === 'Pending'
      ).length
    : (stats.pendingApprovalsCount || (Array.isArray(stats.pendingApprovals) ? stats.pendingApprovals.length : 0));
  const approvedCount = gyms.length > 0
    ? gyms.filter((g) => g.approvalStatus === 'Approved' || g.status === 'Active').length
    : (stats.registeredGyms?.active || stats.activeGyms || 0);
  const onHoldCount = gyms.length > 0
    ? gyms.filter((g) => g.approvalStatus === 'On Hold' || g.status === 'On Hold' || g.status === 'Inactive').length
    : (stats.registeredGyms?.inactive || 0);
  const rejectedCount = gyms.length > 0
    ? gyms.filter((g) => g.approvalStatus === 'Rejected' || g.status === 'Rejected').length
    : 0;

  const totalActionRequired = pendingCount;

  const menuItems = [
    {
      key: '/admin/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: 'gyms-sub',
      icon: <ShopOutlined />,
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: 4 }}>
          <span>Gyms</span>
          {totalActionRequired > 0 && renderMenuBadge(totalActionRequired, true)}
        </div>
      ),
      children: [
        {
          key: '/admin/gyms?tab=all',
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: 2 }}>
              <span>All Gyms</span>
              {renderMenuBadge(totalGyms, false)}
            </div>
          ),
        },
        {
          key: '/admin/gyms?tab=pending',
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: 2 }}>
              <span>Gym Approvals</span>
              {pendingCount > 0 && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 18,
                    height: 18,
                    padding: '0 5px',
                    borderRadius: 9,
                    fontSize: 10,
                    fontWeight: 800,
                    backgroundColor: '#d97706',
                    color: '#ffffff',
                    flexShrink: 0,
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </div>
          ),
        },
        {
          key: '/admin/gyms?tab=approved',
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: 2 }}>
              <span>Approved / Active</span>
              {renderMenuBadge(approvedCount, false)}
            </div>
          ),
        },
        {
          key: '/admin/gyms?tab=on_hold',
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: 2 }}>
              <span>On Hold</span>
              {renderMenuBadge(onHoldCount, false)}
            </div>
          ),
        },
        {
          key: '/admin/gyms?tab=rejected',
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: 2 }}>
              <span>Rejected</span>
              {rejectedCount > 0 && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 18,
                    height: 18,
                    padding: '0 5px',
                    borderRadius: 9,
                    fontSize: 10,
                    fontWeight: 800,
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    flexShrink: 0,
                  }}
                >
                  {rejectedCount}
                </span>
              )}
            </div>
          ),
        },
      ],
    },
    {
      key: '/admin/banners',
      icon: <PictureOutlined />,
      label: 'Banners & Ads',
    },
    {
      key: '/admin/customers',
      icon: <TeamOutlined />,
      label: 'Customers',
    },
    {
      key: '/admin/subscriptions',
      icon: <DollarOutlined />,
      label: 'Subscriptions',
    },
    {
      key: 'memberships-sub',
      icon: <IdcardOutlined />,
      label: 'Memberships',
      children: [
        {
          key: '/admin/memberships?tab=all',
          label: 'All Memberships',
        },
        {
          key: '/admin/memberships?tab=active',
          label: 'Active Members',
        },
        {
          key: '/admin/memberships?tab=expiring',
          label: 'Expiring Soon',
        },
        {
          key: '/admin/memberships?tab=switched_cancelled',
          label: 'Switched / Cancelled',
        },
      ],
    },
    {
      key: 'bookings-sub',
      icon: <CalendarOutlined />,
      label: 'Bookings',
      children: [
        {
          key: '/admin/bookings?type=session',
          label: 'Session Bookings',
        },
        {
          key: '/admin/bookings?type=group_class',
          label: 'Group Classes',
        },
      ],
    },
    {
      key: '/admin/payments',
      icon: <CreditCardOutlined />,
      label: 'Payments',
    },
    {
      key: '/admin/reports',
      icon: <BarChartOutlined />,
      label: 'Reports',
    },
  ];

  // Compute active key matching exact route and query parameter tab
  const getActiveKey = () => {
    if (location.pathname === '/admin/gyms') {
      const search = location.search || '?tab=all';
      return `/admin/gyms${search}`;
    }
    if (
      location.pathname === '/admin/memberships' ||
      location.pathname === '/admin/membership'
    ) {
      const search = location.search || '?tab=all';
      return `/admin/memberships${search}`;
    }
    if (location.pathname === '/admin/bookings') {
      const search = location.search || '?type=session';
      return `/admin/bookings${search}`;
    }
    return location.pathname;
  };

  const activeKey = getActiveKey();

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      trigger={null}
      width={260}
      collapsedWidth={80}
      style={{
        backgroundColor: isDarkMode ? '#0d0d0d' : '#0e131f',
        borderRight: `1px solid ${isDarkMode ? '#222222' : '#1e293b'}`,
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 60,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Brand Header */}
        <div
          onClick={() => navigate(brandRedirect)}
          style={{
            height: 72,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 20px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <img
            src={gymezyLogo}
            alt="GYMEZY"
            style={{
              height: 38,
              width: 38,
              objectFit: 'contain',
              flexShrink: 0,
            }}
          />
          {!collapsed && (
            <div style={{ lineHeight: 1.2, overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  letterSpacing: '1.5px',
                  color: '#ffffff',
                }}
              >
                GYMEZY
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.8px',
                  color: '#818cf8',
                  textTransform: 'uppercase',
                }}
              >
                ADMIN PANEL
              </div>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <div style={{ flex: 1, padding: '16px 8px', overflowY: 'auto' }}>
          <Menu
            mode="inline"
            theme="dark"
            selectedKeys={[activeKey]}
            defaultOpenKeys={['gyms-sub']}
            onClick={({ key }) => navigate(key)}
            items={menuItems}
            style={{
              backgroundColor: 'transparent',
              borderRight: 'none',
            }}
          />
        </div>

        {/* Collapse Toggle Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
          }}
        >
          {!collapsed && (
            <span style={{ fontSize: 11, color: '#64748b' }}>
              v1.0.0 Enterprise
            </span>
          )}
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => onCollapse(!collapsed)}
            style={{ color: '#94a3b8' }}
          />
        </div>
      </div>
    </Sider>
  );
};

export default AppSidebar;
