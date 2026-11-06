import React, { useState } from 'react';
import {
  Card,
  Typography,
  Switch,
  Tag,
  Divider,
  message,
  Alert,
  Row,
  Col,
} from 'antd';
import {
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../hooks';
import { apiClient } from '../services/apiClient';

const { Title, Text, Paragraph } = Typography;

export const SettingsManagement = () => {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();

  const [isSsoEnabled, setIsSsoEnabled] = useState(() => user?.isSsoEnabled !== false);
  const [loadingSso, setLoadingSso] = useState(false);

  const handleToggleSso = async (newVal) => {
    setLoadingSso(true);
    try {
      const res = await apiClient.patch('/auth/toggle-sso', { enabled: newVal });
      if (res.data?.success) {
        setIsSsoEnabled(newVal);
        message.success(`Google SSO ${newVal ? 'enabled' : 'disabled'} successfully.`);
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update Google SSO setting.');
    } finally {
      setLoadingSso(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0, color: isDarkMode ? '#ffffff' : '#0f172a', fontWeight: 700 }}>
          Platform & Security Settings
        </Title>
        <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 14 }}>
          Manage global authentication policies, Single Sign-On (SSO) permissions, and administrator access control.
        </Text>
      </div>

      <Row gutter={[24, 24]}>
        {/* Security & SSO Settings Card */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <SafetyCertificateOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                <span style={{ fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  Single Sign-On (SSO) & Authentication
                </span>
              </div>
            }
            style={{
              backgroundColor: isDarkMode ? '#121214' : '#ffffff',
              borderColor: isDarkMode ? '#27272a' : '#e2e8f0',
              borderRadius: 12,
              boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Google SSO Policy Toggle */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 16,
                  padding: '16px 20px',
                  borderRadius: 10,
                  backgroundColor: isDarkMode ? '#18181b' : '#f8fafc',
                  border: `1px solid ${isDarkMode ? '#27272a' : '#f1f5f9'}`,
                }}
              >
                <div style={{ maxWidth: 460 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                      Google Single Sign-On (SSO)
                    </span>
                    <Tag color={isSsoEnabled ? 'blue' : 'default'} style={{ margin: 0 }}>
                      {isSsoEnabled ? 'Active' : 'Disabled'}
                    </Tag>
                  </div>
                  <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 13 }}>
                    Allow Super Administrator account authentication via verified Google OAuth. When disabled, administrators must sign in using their master password credentials.
                  </Text>
                </div>
                <div>
                  <Switch
                    checked={isSsoEnabled}
                    loading={loadingSso}
                    onChange={handleToggleSso}
                  />
                </div>
              </div>

              {/* Status Banner */}
              {isSsoEnabled ? (
                <Alert
                  type="info"
                  showIcon
                  message="Google SSO Enabled for Super Admin"
                  description={`You can log in to this portal using "Sign in with Google" at /login. Your active administrator account: ${user?.email || 'admin@gymezy.com'}`}
                  style={{
                    backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff',
                    borderColor: isDarkMode ? '#334155' : '#bfdbfe',
                  }}
                />
              ) : (
                <Alert
                  type="warning"
                  showIcon
                  message="Google SSO Currently Disabled"
                  description="Password-only authentication mode is active. You must enter your master email and password to log in."
                  style={{
                    backgroundColor: isDarkMode ? '#272015' : '#fffbeb',
                    borderColor: isDarkMode ? '#45351a' : '#fef3c7',
                  }}
                />
              )}
            </div>
          </Card>
        </Col>

        {/* Account Info Card */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <span style={{ fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                Account Security Summary
              </span>
            }
            style={{
              backgroundColor: isDarkMode ? '#121214' : '#ffffff',
              borderColor: isDarkMode ? '#27272a' : '#e2e8f0',
              borderRadius: 12,
              boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <Text style={{ fontSize: 12, color: isDarkMode ? '#71717a' : '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                  Signed In As
                </Text>
                <div style={{ fontSize: 14, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', marginTop: 2 }}>
                  {user?.fullName || 'Super Administrator'}
                </div>
                <div style={{ fontSize: 13, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  {user?.email || 'admin@gymezy.com'}
                </div>
              </div>

              <Divider style={{ margin: '6px 0' }} />

              <div>
                <Text style={{ fontSize: 12, color: isDarkMode ? '#71717a' : '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                  Role Level
                </Text>
                <div style={{ fontSize: 14, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', marginTop: 2 }}>
                  Super Admin
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SettingsManagement;
