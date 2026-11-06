import React from 'react';
import { Layout, Avatar, Dropdown, Switch, Badge, Breadcrumb, Button, Tooltip } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  SunOutlined,
  MoonOutlined,
  LogoutOutlined,
  SettingOutlined,
  DownOutlined,
  HomeOutlined,
  ReloadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../hooks';
import { useRefresh } from '../../context/RefreshContext';

const hasValidProfilePic = (avatar) => {
  if (!avatar || typeof avatar !== 'string') return false;
  const trimmed = avatar.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
  if (trimmed.includes('dicebear.com')) return false;
  return true;
};

const { Header } = Layout;

const ROUTE_NAMES = {
  '/admin/dashboard': 'Dashboard',
  '/admin/banners': 'Promotional Banners & Ads',
  '/admin/gyms': 'Gyms & Tenants',
  '/admin/onboarding': 'Gym Onboarding Wizard',
  '/admin/customers': 'Customers & Users',
  '/admin/bookings': 'Bookings Management',
  '/admin/payments': 'Transactions & Payments',
  '/admin/transactions': 'Transactions & Payments',
  '/admin/subscriptions': 'Billing & Plans',
  '/admin/reports': 'Reports & Analytics',
  '/admin/users': 'Platform Users',
  '/admin/audit': 'Security & Audit Logs',
  '/admin/settings': 'Global Settings',
};

export const AppBar = ({
  user: userProp,
  onLogout,
  extra,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const { user: authUser, logout } = useAuth();
  const { isRefreshing, triggerRefresh } = useRefresh();

  const currentUser = userProp || authUser || null;
  const [avatarLoadFailed, setAvatarLoadFailed] = React.useState(false);

  const userAvatar = currentUser?.profilePicture || currentUser?.avatar;
  const hasPic = hasValidProfilePic(userAvatar);
  const showImage = hasPic && !avatarLoadFailed;

  const currentTitle = ROUTE_NAMES[location.pathname] || 'Dashboard';

  const handleLogoutAction = async () => {
    if (onLogout) {
      onLogout();
    } else {
      await logout();
      navigate('/login');
    }
  };

  const profileMenu = {
    items: [
      {
        key: 'profile-info',
        label: (
          <div style={{ padding: '6px 0' }}>
            <div style={{ fontWeight: 600 }}>{currentUser?.fullName || currentUser?.name || 'Administrator'}</div>
            {currentUser?.email && (
              <div style={{ fontSize: 12, color: '#888888' }}>{currentUser.email}</div>
            )}
          </div>
        ),
      },
      { type: 'divider' },
      {
        key: 'settings',
        icon: <SettingOutlined />,
        label: 'Platform Settings',
        onClick: () => navigate('/admin/settings'),
      },
      {
        key: 'theme-toggle',
        icon: isDarkMode ? (
          <MoonOutlined style={{ color: '#ffd700' }} />
        ) : (
          <SunOutlined style={{ color: '#fa8c16' }} />
        ),
        label: (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              minWidth: 155,
              gap: 12,
            }}
          >
            <span>{isDarkMode ? 'Dark Theme' : 'Light Theme'}</span>
            <div onClick={(e) => e.stopPropagation()}>
              <Switch
                size="small"
                checked={isDarkMode}
                onChange={toggleTheme}
                checkedChildren={<MoonOutlined style={{ color: '#ffd700', fontSize: 10 }} />}
                unCheckedChildren={<SunOutlined style={{ color: '#fa8c16', fontSize: 10 }} />}
                style={{
                  backgroundColor: isDarkMode ? '#1677ff' : '#cbd5e1',
                }}
              />
            </div>
          </div>
        ),
        onClick: () => toggleTheme(),
      },
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined style={{ color: '#ef4444' }} />,
        label: <span style={{ color: '#ef4444' }}>Sign Out</span>,
        onClick: handleLogoutAction,
      },
    ],
  };

  const displayName = currentUser?.fullName || currentUser?.name || 'Super Admin';
  const roleLabel = currentUser?.role ? currentUser.role.replace('_', ' ') : 'Master Admin';

  return (
    <Header
      style={{
        padding: '0 28px',
        height: 72,
        lineHeight: 'normal',
        backgroundColor: isDarkMode ? '#0a0a0a' : '#ffffff',
        borderBottom: `1px solid ${isDarkMode ? '#1e1e1e' : '#e2e8f0'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 99,
      }}
    >
      {/* Left: Dynamic Breadcrumbs & Refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Breadcrumb
          items={[
            {
              title: (
                <span
                  style={{
                    color: isDarkMode ? '#888888' : '#64748b',
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onClick={() => navigate('/admin/dashboard')}
                >
                  <HomeOutlined style={{ fontSize: 13 }} />
                  <span>Home</span>
                </span>
              ),
            },
            {
              title: (
                <span
                  style={{
                    color: isDarkMode ? '#ffffff' : '#0f172a',
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {currentTitle}
                </span>
              ),
            },
          ]}
        />

        <Tooltip title="Refresh page" placement="bottom">
          <Button
            size="small"
            icon={<ReloadOutlined spin={isRefreshing} style={{ color: isDarkMode ? '#818cf8' : '#4f46e5' }} />}
            onClick={triggerRefresh}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              height: 28,
              padding: '0 10px',
              borderRadius: 'var(--radius-base, 6px)',
              borderColor: isDarkMode ? '#27272a' : '#e2e8f0',
              backgroundColor: isDarkMode ? '#18181b' : '#ffffff',
              color: isDarkMode ? '#e2e8f0' : '#334155',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Refresh
          </Button>
        </Tooltip>
      </div>

      {/* Right: Actions & Profile Dropdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {extra}

        {/* Profile Dropdown */}
        <Dropdown menu={profileMenu} placement="bottomRight" arrow>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <Badge dot status="success" offset={[-2, 32]}>
              <Avatar
                src={showImage ? userAvatar : undefined}
                icon={!showImage ? <UserOutlined style={{ fontSize: 18 }} /> : undefined}
                onError={() => {
                  setAvatarLoadFailed(true);
                  return false;
                }}
                size={36}
                style={{
                  backgroundColor: showImage ? 'transparent' : (isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#ede9fe'),
                  color: showImage ? 'inherit' : (isDarkMode ? '#818cf8' : '#4338ca'),
                  fontWeight: 700,
                  border: isDarkMode ? '2px solid rgba(129, 140, 248, 0.3)' : '2px solid rgba(67, 56, 202, 0.2)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </Badge>
            <div
              className="hide-mobile"
              style={{
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: isDarkMode ? '#ffffff' : '#0f172a',
                  lineHeight: 1.2,
                }}
              >
                {displayName}
              </div>
              <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', lineHeight: 1.2 }}>
                {roleLabel}
              </div>
            </div>
            <DownOutlined style={{ fontSize: 10, color: isDarkMode ? '#888888' : '#64748b', marginLeft: 2 }} />
          </div>
        </Dropdown>
      </div>
    </Header>
  );
};

export default AppBar;
