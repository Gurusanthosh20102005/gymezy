import React from 'react';
import { Layout, Avatar, Dropdown, Badge, Switch, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  SunOutlined,
  MoonOutlined,
  LogoutOutlined,
  SettingOutlined,
  DownOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../theme/ThemeContext';
import { logout } from '../../redux/slices/authSlice';

const hasValidProfilePic = (avatar) => {
  if (!avatar || typeof avatar !== 'string') return false;
  const trimmed = avatar.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
  if (trimmed.includes('dicebear.com')) return false;
  return true;
};

const { Header } = Layout;

/**
 * Custom Gym Storefront SVG Logo
 */
export const GymStoreLogo = ({ isDarkMode }) => (
  <div
    style={{
      width: 48,
      height: 48,
      borderRadius: 'var(--radius-base)',
      backgroundColor: isDarkMode ? 'rgba(0, 56, 130, 0.25)' : '#edf4fe',
      border: `1.5px solid ${isDarkMode ? 'rgba(0, 56, 130, 0.5)' : '#d6e4ff'}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Roof Bar */}
      <path
        d="M3.5 4H20.5V7H3.5V4Z"
        stroke={isDarkMode ? '#597ef7' : '#003882'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Awning with 3 Scallops */}
      <path
        d="M3.5 7V10.5C3.5 11.3 4.2 12 5 12C5.8 12 6.5 11.3 6.5 10.5C6.5 11.3 7.2 12 8 12C8.8 12 9.5 11.3 9.5 10.5C9.5 11.3 10.2 12 11 12C11.8 12 12.5 11.3 12.5 10.5C12.5 11.3 13.2 12 14 12C14.8 12 15.5 11.3 15.5 10.5C15.5 11.3 16.2 12 17 12C17.8 12 18.5 11.3 18.5 10.5C18.5 11.3 19.2 12 20 12C20.8 12 20.5 11.3 20.5 10.5V7"
        stroke={isDarkMode ? '#597ef7' : '#003882'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Store Base Walls */}
      <path
        d="M4.5 12V20H19.5V12"
        stroke={isDarkMode ? '#597ef7' : '#003882'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Center Door */}
      <path
        d="M9.5 20V15H14.5V20"
        stroke={isDarkMode ? '#597ef7' : '#003882'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

/**
 * AppBar - Reusable, Role-Aware Application Header Component
 * 
 * @param {Object} props
 * @param {Object} props.gym - Gym details { name, branch, logo }
 * @param {Object} props.user - User details { name, email, role, avatar }
 * @param {boolean} props.showSubscription - Whether to show the subscription status badge
 * @param {string} props.subscriptionPlan - Subscription plan title (default: 'Hybrid Plan')
 * @param {string} props.subscriptionExpiry - Renewal date (default: '20 Aug 2026')
 * @param {Function} props.onSettings - Custom settings click handler
 * @param {Function} props.onLogout - Custom logout handler
 * @param {React.ReactNode} props.extra - Extra header actions slot
 */
export const AppBar = ({
  gym,
  user: userProp,
  showSubscription = true,
  subscriptionPlan = 'Hybrid Plan',
  subscriptionStatus = 'Active',
  subscriptionExpiry = '20 Aug 2026',
  onSettings,
  onLogout,
  extra,
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isDarkMode, toggleTheme } = useTheme();

  const authUser = useSelector((state) => state.auth?.user);
  const gymFromState = useSelector((state) => state.gym?.gymProfile);

  const [avatarLoadFailed, setAvatarLoadFailed] = React.useState(false);

  const currentUser = userProp || authUser;
  const currentGym = gym || gymFromState;

  const userAvatar = currentUser?.profilePicture || currentUser?.avatar;
  const hasPic = hasValidProfilePic(userAvatar);
  const showImage = hasPic && !avatarLoadFailed;

  const handleSettingsClick = () => {
    if (onSettings) {
      onSettings();
    } else {
      navigate('/owner/settings');
    }
  };

  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    } else {
      dispatch(logout());
      navigate('/login');
    }
  };

  const profileMenu = {
    items: [
      {
        key: 'profile-info',
        label: (
          <div style={{ padding: '6px 0' }}>
            <div style={{ fontWeight: 600 }}>{currentUser?.fullName || currentUser?.name || 'Gym Owner'}</div>
            {currentUser?.email && (
              <div style={{ fontSize: 12, color: '#888888' }}>{currentUser.email}</div>
            )}
            <Tag color="blue" style={{ marginTop: 4, fontSize: 11 }}>
              {currentUser?.role ? currentUser.role.replace('_', ' ') : 'FITNESS CENTER OWNER'}
            </Tag>
          </div>
        ),
      },
      { type: 'divider' },
      {
        key: 'staff-profile',
        icon: <UserOutlined />,
        label: 'My Staff Profile',
        onClick: () => navigate('/owner/employees'),
      },
      {
        key: 'settings',
        icon: <SettingOutlined />,
        label: 'Gym Settings',
        onClick: handleSettingsClick,
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
        onClick: handleLogoutClick,
      },
    ],
  };

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
      {/* Left: Gym Logo, Gym Name & Branch */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {currentGym?.logo ? (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 'var(--radius-base)',
              overflow: 'hidden',
              border: `1.5px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.15)' : '#d6e4ff'}`,
              flexShrink: 0,
              backgroundColor: isDarkMode ? '#1e1e1e' : '#edf4fe',
            }}
          >
            <img
              src={currentGym.logo}
              alt={currentGym?.name || 'Gym Logo'}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        ) : (
          <GymStoreLogo isDarkMode={isDarkMode} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="app-bar-label" style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#627289', lineHeight: 1.15 }}>
            Gym Name
          </div>
          <div className="app-bar-gym-name" style={{ fontSize: 16, color: isDarkMode ? '#ffffff' : '#0a1629', lineHeight: 1.25 }}>
            {currentGym?.name || currentUser?.gymName || 'Gym Facility'}
          </div>
          <div className="app-bar-subtext" style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#5e718d', lineHeight: 1.15 }}>
            {currentGym?.branch || currentGym?.city || currentGym?.fullAddress || 'Partner Location'}
          </div>
        </div>
      </div>

      {/* Center: Subscription Status */}
      {showSubscription && (
        <div
          className="hide-mobile"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            gap: 3,
          }}
        >
          <div className="app-bar-label" style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#627289', lineHeight: 1.2 }}>
            Subscription Status
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="app-bar-status" style={{ color: '#00bf62', fontSize: 12, lineHeight: 1.2 }}>
              {currentGym?.subscriptionType || subscriptionPlan || 'Hybrid Plan'} • {currentGym?.subscriptionStatus || currentGym?.status || subscriptionStatus || 'Active'}
            </span>
            <span style={{ color: isDarkMode ? '#444444' : '#cbd5e1', fontSize: 12 }}>|</span>
            <span className="app-bar-subtext" style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', lineHeight: 1.2 }}>
              Partner ID: {(currentGym?.partnerId && !/^[0-9a-fA-F]{24}$/.test(currentGym.partnerId) && currentGym.partnerId !== '-') ? currentGym.partnerId : '-'}
            </span>
          </div>
        </div>
      )}

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
                  backgroundColor: showImage ? 'transparent' : (isDarkMode ? 'rgba(0, 56, 130, 0.25)' : '#edf4fe'),
                  color: showImage ? 'inherit' : (isDarkMode ? '#597ef7' : '#003882'),
                  border: `2px solid ${isDarkMode ? 'rgba(89, 126, 247, 0.3)' : 'rgba(0, 56, 130, 0.2)'}`,
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
                {currentUser?.fullName || currentUser?.name || 'Gym Owner'}
              </div>
              <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', lineHeight: 1.2 }}>
                {currentUser?.role === 'MANAGER' ? 'Manager' : (currentUser?.role === 'GYM_OWNER' || currentUser?.role === 'owner' ? 'Owner' : 'Partner')}
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
