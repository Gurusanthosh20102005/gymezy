import React, { useState } from 'react';
import {
  Form,
  Input,
  Button,
  Checkbox,
  Switch,
  Alert,
  message,
  Divider,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  UserOutlined,
  LockOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons';
import { useTheme } from '../theme/ThemeContext';
import { loginUser, loginSuccess } from '../redux/slices/authSlice';
import { apiClient } from '../services/apiClient';
import { signInWithGoogle } from '../config/firebase';
import gymezyLogo from '../assets/logo/gymezy.png';
import fitnessBg from '../assets/images/onboarding_1.jpg';

export const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isDarkMode, toggleTheme } = useTheme();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setLoginError(null);
    try {
      const { idToken } = await signInWithGoogle();
      const response = await apiClient.post('/auth/google-login', {
        idToken,
        portal: 'gym-owner',
        expectedRole: 'GYM_OWNER',
      });

      const data = response.data?.data || {};

      // If user does not exist in DB: redirect to /register with pre-filled Google profile
      // CRITICAL: Database remains untouched until they complete onboarding form!
      if (data.exists === false) {
        message.info(
          `Welcome, ${data.profile?.fullName || 'Partner'}! Please complete your gym details to finish onboarding.`
        );
        navigate('/register', {
          state: {
            googleProfile: data.profile,
          },
        });
        return;
      }

      // Existing user: Log them in
      const user = data.user || {};
      const token = data.token;
      dispatch(loginSuccess({ user, token }));

      const approvalStatus = user.gym?.approvalStatus || 'Approved';
      const isPendingOrRejected =
        approvalStatus === 'Pending Approval' ||
        approvalStatus === 'Pending' ||
        approvalStatus === 'Rejected';

      if (isPendingOrRejected) {
        message.info(`Welcome back, ${user.fullName || user.name || 'Partner'}! Your application status is loaded.`);
        navigate('/application-status');
      } else {
        message.success(`Welcome back, ${user.fullName || user.name || 'Partner'}! Gym Owner Portal loaded.`);
        navigate('/owner/dashboard');
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.message || err.message || 'Google Sign-In failed. Please try again.';
      setLoginError(errorMsg);
      message.error(errorMsg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (values) => {
    setLoading(true);
    setLoginError(null);
    try {
      const resultAction = await dispatch(
        loginUser({
          identifier: values.email,
          password: values.password,
        })
      );

      if (loginUser.fulfilled.match(resultAction)) {
        const user = resultAction.payload.user;
        const approvalStatus = user.gym?.approvalStatus || 'Approved';
        const isPendingOrRejected =
          approvalStatus === 'Pending Approval' ||
          approvalStatus === 'Pending' ||
          approvalStatus === 'Rejected';

        if (isPendingOrRejected) {
          message.info(`Welcome back, ${user.fullName || user.name || 'Partner'}! Your application status is loaded.`);
          navigate('/application-status');
        } else {
          const roleLabel = user.role === 'MANAGER' ? 'Manager Portal' : 'Gym Owner Portal';
          message.success(`Welcome back, ${user.fullName || user.name || 'Partner'}! ${roleLabel} loaded.`);
          navigate('/owner/dashboard');
        }
      } else {
        const errorMsg = resultAction.payload || 'Invalid email/phone or password.';
        setLoginError(errorMsg);
        message.error(errorMsg);
      }
    } catch (err) {
      const errorMsg = err.message || 'Login failed. Please verify credentials and try again.';
      setLoginError(errorMsg);
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        backgroundColor: isDarkMode ? '#000000' : '#ffffff',
        color: isDarkMode ? '#ffffff' : '#0f172a',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Floating Day/Night Theme Switch */}
      <div
        onClick={toggleTheme}
        role="button"
        tabIndex={0}
        style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 100,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          height: 36,
          padding: '0 14px',
          borderRadius: 18,
          backgroundColor: isDarkMode ? 'rgba(20, 20, 20, 0.85)' : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${isDarkMode ? '#333333' : '#e2e8f0'}`,
          boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <Switch
          size="small"
          checked={isDarkMode}
          checkedChildren={<MoonOutlined style={{ color: '#ffd700', fontSize: 10 }} />}
          unCheckedChildren={<SunOutlined style={{ color: '#fa8c16', fontSize: 10 }} />}
          style={{
            margin: 0,
            backgroundColor: isDarkMode ? '#1677ff' : '#cbd5e1',
            pointerEvents: 'none',
          }}
        />
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: isDarkMode ? '#e2e8f0' : '#334155',
            lineHeight: 1,
            display: 'inline-block',
          }}
        >
          {isDarkMode ? 'Night' : 'Day'}
        </span>
      </div>

      {/* LEFT HALF: HERO IMAGE WITH THEME COLOR OVERLAY & CENTERED LOGO */}
      <div
        className="hide-mobile"
        style={{
          flex: 1.1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px',
          backgroundImage: `url(${fitnessBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Color Solid Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 56, 130, 0.90)',
            backdropFilter: 'blur(2px)',
            zIndex: 1,
          }}
        />

        {/* Centered Content: White Filter Logo, Brand Name & Description */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <img
            src={gymezyLogo}
            alt="GYMEZY Logo"
            style={{
              width: 110,
              height: 110,
              objectFit: 'contain',
              filter: 'brightness(0) invert(1)', // Pure white filter matching mobile app
              marginBottom: 20,
              userSelect: 'none',
            }}
          />

          <h1
            style={{
              fontSize: 34,
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              margin: '0 0 8px 0',
              lineHeight: 1.2,
            }}
          >
            GYMEZY
          </h1>

          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.75)',
              letterSpacing: '5px',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            SMART GYM OPERATING SYSTEM
          </p>
        </div>
      </div>

      {/* RIGHT HALF: MINIMAL PROFESSIONAL LOGIN FORM */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 32px',
          backgroundColor: isDarkMode ? '#000000' : '#ffffff',
          transition: 'background-color 0.3s ease',
        }}
      >
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Mobile Only Brand Emblem */}
          <div
            className="show-mobile"
            style={{ textAlign: 'center', marginBottom: 32 }}
          >
            <img
              src={gymezyLogo}
              alt="GYMEZY Logo"
              style={{
                width: 64,
                height: 64,
                objectFit: 'contain',
                filter: isDarkMode ? 'brightness(0) invert(1)' : 'none',
                marginBottom: 8,
              }}
            />
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '2px' }}>
              GYMEZY
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <h2
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: isDarkMode ? '#ffffff' : '#0f172a',
                margin: 0,
                letterSpacing: '-0.5px',
              }}
            >
              Sign In
            </h2>
          </div>

          {loginError && (
            <Alert
              message="Sign In Notice"
              description={loginError}
              type="error"
              showIcon
              closable
              onClose={() => setLoginError(null)}
              style={{
                marginBottom: 24,
                borderRadius: 'var(--radius-base)',
                fontSize: 13,
              }}
            />
          )}

          <Form
            form={form}
            layout="vertical"
            onFinish={handleLogin}
            autoComplete="off"
            initialValues={{
              email: '',
              password: '',
              remember: false,
            }}
            size="large"
          >
            <Form.Item
              label={<span style={{ color: isDarkMode ? '#cccccc' : '#334155', fontWeight: 600, fontSize: 13 }}>Email / Phone</span>}
              name="email"
              rules={[{ required: true, message: 'Please enter your email or phone number' }]}
              style={{ marginBottom: 20 }}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#1677ff' }} />}
                placeholder="e.g. owner@gym.com or +91 9876543210"
                autoComplete="username"
                style={{
                  height: 46,
                  borderRadius: 'var(--radius-base)',
                  backgroundColor: isDarkMode ? '#0d0d0d' : '#ffffff',
                  borderColor: isDarkMode ? '#222222' : '#d9d9d9',
                  color: isDarkMode ? '#ffffff' : '#0f172a',
                }}
              />
            </Form.Item>

            <Form.Item
              label={<span style={{ color: isDarkMode ? '#cccccc' : '#334155', fontWeight: 600, fontSize: 13 }}>Password</span>}
              name="password"
              rules={[{ required: true, message: 'Please enter your password' }]}
              style={{ marginBottom: 20 }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#1677ff' }} />}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{
                  height: 46,
                  borderRadius: 'var(--radius-base)',
                  backgroundColor: isDarkMode ? '#0d0d0d' : '#ffffff',
                  borderColor: isDarkMode ? '#222222' : '#d9d9d9',
                  color: isDarkMode ? '#ffffff' : '#0f172a',
                }}
              />
            </Form.Item>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 13 }}>
                  Remember me
                </Checkbox>
              </Form.Item>
              <a
                onClick={() => message.info('Reset instructions sent to registered phone.')}
                style={{ color: '#1677ff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                Forgot password?
              </a>
            </div>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={{
                  height: 48,
                  fontSize: 15,
                  fontWeight: 700,
                  borderRadius: 'var(--radius-base)',
                  backgroundColor: '#003882',
                  borderColor: '#003882',
                }}
              >
                Sign In
              </Button>
            </Form.Item>

            <Divider
              style={{
                margin: '18px 0',
                borderColor: isDarkMode ? '#27272a' : '#e2e8f0',
                color: isDarkMode ? '#71717a' : '#94a3b8',
                fontSize: 12,
              }}
            >
              OR CONTINUE WITH
            </Divider>

            <Button
              block
              onClick={handleGoogleLogin}
              loading={googleLoading}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ marginRight: 6 }}>
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              }
              style={{
                height: 46,
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 'var(--radius-base)',
                backgroundColor: isDarkMode ? '#18181b' : '#ffffff',
                borderColor: isDarkMode ? '#27272a' : '#e2e8f0',
                color: isDarkMode ? '#ffffff' : '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              Sign in with Google
            </Button>

            {/* Link to Gym Partner Registration */}
            <div
              style={{
                marginTop: 24,
                textAlign: 'center',
                fontSize: 13,
                color: isDarkMode ? '#94a3b8' : '#64748b',
              }}
            >
              Want to partner with GYMEZY?{' '}
              <a
                onClick={() => navigate('/register')}
                style={{
                  color: 'var(--color-primary)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Register your Gym
              </a>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default Login;
