import React from 'react';
import { Layout, Menu, Button } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  QrcodeOutlined,
  TeamOutlined,
  ScheduleOutlined,
  DollarOutlined,
  UserSwitchOutlined,
  LineChartOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  AppstoreOutlined,
  IdcardOutlined,
  SyncOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../theme/ThemeContext';
import gymezyLogo from '../../assets/logo/gymezy.png';

const { Sider } = Layout;

// Role-based Navigation Configuration
export const DEFAULT_NAV_ITEMS = [
  {
    key: '/owner/dashboard',
    icon: <DashboardOutlined />,
    label: 'Live Dashboard',
    roles: ['owner', 'admin', 'manager'],
  },
  {
    key: '/owner/checkin',
    icon: <QrcodeOutlined />,
    label: 'QR Turnstile Check-In',
    roles: ['owner', 'admin', 'manager', 'staff', 'frontdesk'],
  },
  {
    key: '/owner/sections',
    icon: <AppstoreOutlined />,
    label: 'Sections & Batches',
    roles: ['owner', 'admin', 'manager'],
  },
  {
    key: 'membership-sub',
    icon: <IdcardOutlined />,
    label: 'Membership',
    roles: ['owner', 'admin', 'manager', 'staff'],
    children: [
      {
        key: '/owner/members?tab=members',
        icon: <TeamOutlined />,
        label: 'All Members',
        roles: ['owner', 'admin', 'manager', 'staff'],
      },
      {
        key: '/owner/members?tab=switches',
        icon: <SyncOutlined />,
        label: 'Plan Switch Requests',
        roles: ['owner', 'admin', 'manager', 'staff'],
      },
      {
        key: '/owner/members?tab=cancellations',
        icon: <StopOutlined />,
        label: 'Cancellation Requests',
        roles: ['owner', 'admin', 'manager', 'staff'],
      },
    ],
  },
  {
    key: '/owner/bookings',
    icon: <ScheduleOutlined />,
    label: 'Bookings & Passes',
    roles: ['owner', 'admin', 'manager', 'trainer', 'staff'],
  },
  {
    key: '/owner/transactions',
    icon: <DollarOutlined />,
    label: 'Transactions & Payments',
    roles: ['owner', 'admin'],
  },
  {
    key: '/owner/employees',
    icon: <UserSwitchOutlined />,
    label: 'Employees',
    roles: ['owner', 'admin', 'manager'],
  },
  {
    key: '/owner/settings',
    icon: <SettingOutlined />,
    label: 'Gym Profile',
    roles: ['owner', 'admin', 'manager'],
  },
];

// Helper to normalize role strings (handles 'GYM_OWNER', 'owner', 'ADMIN', 'MANAGER', etc.)
export const normalizeRole = (role) => {
  if (!role) return 'owner';
  const r = String(role).toLowerCase().trim();
  if (r.includes('owner')) return 'owner';
  if (r.includes('admin')) return 'admin';
  if (r.includes('manager')) return 'manager';
  if (r.includes('trainer')) return 'trainer';
  if (r.includes('staff') || r.includes('frontdesk')) return 'staff';
  return r;
};

/**
 * AppSidebar - Reusable, Role-Based Navigation Sider
 * 
 * @param {Object} props
 * @param {boolean} props.collapsed - Controlled collapsed state
 * @param {Function} props.onCollapse - Collapsed state toggle handler
 * @param {string} props.role - User role for permission filtering ('GYM_OWNER' | 'owner' | 'admin' | 'trainer' | 'staff')
 * @param {string} props.roleTitle - Subtitle below GYMEZY (e.g., 'Owner Console', 'Trainer Console')
 * @param {Array} props.menuItems - Optional custom menu item list
 * @param {string} props.brandRedirect - Route to navigate on clicking the brand header
 */
export const AppSidebar = ({
  collapsed = false,
  onCollapse,
  role = 'owner',
  roleTitle = 'Owner Console',
  menuItems = DEFAULT_NAV_ITEMS,
  brandRedirect = '/owner/dashboard',
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode } = useTheme();

  const userRoleNormalized = normalizeRole(role);

  // Filter menu items by user role (recursively for sub-menus)
  const filterByRole = (items) => {
    return items
      .filter((item) => {
        if (!item.roles || item.roles.length === 0) return true;
        return item.roles.some((r) => {
          const itemRoleNorm = normalizeRole(r);
          return itemRoleNorm === userRoleNormalized || r === role || r === '*';
        });
      })
      .map(({ roles, children, ...rest }) => ({
        ...rest,
        ...(children ? { children: filterByRole(children) } : {}),
      }));
  };

  const filteredItems = filterByRole(menuItems);

  // Compute selected key matching query parameter
  const getSelectedKey = () => {
    if (location.pathname === '/owner/members' || location.pathname === '/owner/membership') {
      const tab = new URLSearchParams(location.search).get('tab') || 'members';
      return `/owner/members?tab=${tab}`;
    }
    return location.pathname;
  };

  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={collapsed}
      width={260}
      style={{
        backgroundColor: isDarkMode ? '#0a0a0a' : '#ffffff',
        borderRight: `1px solid ${isDarkMode ? '#1e1e1e' : '#e2e8f0'}`,
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 100,
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          height: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '0' : '0 24px',
          borderBottom: `1px solid ${isDarkMode ? '#1a1a1a' : '#e2e8f0'}`,
          gap: 12,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          flexShrink: 0,
        }}
        onClick={() => navigate(brandRedirect)}
      >
        <img
          src={gymezyLogo}
          alt="GYMEZY Logo"
          style={{
            width: 38,
            height: 38,
            borderRadius: 'var(--radius-base)',
            objectFit: 'contain',
            flexShrink: 0,
          }}
        />
        {!collapsed && (
          <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: isDarkMode ? '#ffffff' : '#0f172a',
                letterSpacing: '-0.5px',
              }}
            >
              GYMEZY
            </div>
            <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b' }}>
              {roleTitle}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Menu
          theme={isDarkMode ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          defaultOpenKeys={['membership-sub']}
          onClick={({ key }) => navigate(key)}
          items={filteredItems}
          style={{
            backgroundColor: 'transparent',
            borderRight: 'none',
            padding: '8px 8px',
            fontSize: 14,
            fontWeight: 500,
          }}
        />
      </div>

      {/* Sider Collapse Trigger Footer (Pinned to Bottom) */}
      <div
        style={{
          marginTop: 'auto',
          padding: collapsed ? '12px 0' : '12px 16px',
          borderTop: `1px solid ${isDarkMode ? '#1a1a1a' : '#e2e8f0'}`,
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'flex-start',
          flexShrink: 0,
        }}
      >
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => onCollapse && onCollapse(!collapsed)}
          style={{
            color: isDarkMode ? '#888888' : '#64748b',
            fontSize: 14,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            width: collapsed ? 44 : '100%',
            padding: collapsed ? 0 : '0 12px',
          }}
        >
          {!collapsed && <span style={{ marginLeft: 8 }}>Collapse Sidebar</span>}
        </Button>
      </div>
    </Sider>
  );
};

export default AppSidebar;
