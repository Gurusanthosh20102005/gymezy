import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Radio,
  DatePicker,
  Button,
  Space,
  Alert,
  Divider,
} from 'antd';
import {
  DownloadOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  CloudDownloadOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../theme/ThemeContext';

const { RangePicker } = DatePicker;

/**
 * Super Admin Universal Server-Side Export Modal
 * Allows administrators to customize export filename, format, and data scope
 * (fetching all unpaginated records directly from the database backend).
 */
export const ExportModal = ({
  open,
  onCancel,
  title = 'Export Data',
  defaultFileName = 'Gymezy_Export',
  totalAvailable = null,
  onExport,
  loading = false,
}) => {
  const { isDarkMode } = useTheme();
  const [form] = Form.useForm();
  const [scope, setScope] = useState('filtered');

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        fileName: defaultFileName,
        format: 'csv',
        scope: 'filtered',
        dateRange: null,
      });
      setScope('filtered');
    }
  }, [open, defaultFileName, form]);

  const handleFinish = async (values) => {
    if (onExport) {
      await onExport({
        fileName: values.fileName?.trim() || defaultFileName,
        format: values.format || 'csv',
        scope: values.scope || 'filtered',
        dateRange: values.dateRange || null,
      });
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              backgroundColor: isDarkMode ? 'rgba(79, 70, 229, 0.2)' : '#eef2ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4f46e5',
            }}
          >
            <CloudDownloadOutlined style={{ fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
              {title}
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
              Server-side dataset extraction (bypasses table page limits)
            </div>
          </div>
        </div>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      destroyOnClose
      centered
      width={520}
      styles={{
        content: {
          backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
          borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
        },
      }}
    >
      <div style={{ paddingTop: 16 }}>
        <Alert
          type="info"
          showIcon
          message="Complete Database Extraction"
          description={
            <span>
              This export queries all records directly from the database matching your requested scope.{' '}
              {totalAvailable !== null && (
                <strong>(Matching records available: {totalAvailable})</strong>
              )}
            </span>
          }
          style={{
            marginBottom: 20,
            borderRadius: 8,
            backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.1)' : '#f0f5ff',
            borderColor: isDarkMode ? '#312e81' : '#adc6ff',
          }}
        />

        <Form form={form} layout="vertical" onFinish={handleFinish}>
          {/* File Name */}
          <Form.Item
            label={
              <span style={{ fontWeight: 700, color: isDarkMode ? '#e2e8f0' : '#334155' }}>
                Export File Name
              </span>
            }
            name="fileName"
            rules={[{ required: true, message: 'Please enter a file name' }]}
          >
            <Input
              addonAfter=".csv"
              placeholder="e.g. Gymezy_Customers_Report"
              style={{ borderRadius: 6 }}
            />
          </Form.Item>

          {/* Export Format */}
          <Form.Item
            label={
              <span style={{ fontWeight: 700, color: isDarkMode ? '#e2e8f0' : '#334155' }}>
                File Format
              </span>
            }
            name="format"
            initialValue="csv"
          >
            <Radio.Group style={{ width: '100%' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Radio value="csv" style={{ color: isDarkMode ? '#cbd5e1' : '#334155' }}>
                  <Space>
                    <FileTextOutlined style={{ color: '#0ea5e9' }} />
                    <span style={{ fontWeight: 600 }}>CSV (.csv)</span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>- UTF-8 with BOM, Excel compatible</span>
                  </Space>
                </Radio>
                <Radio value="excel" style={{ color: isDarkMode ? '#cbd5e1' : '#334155' }}>
                  <Space>
                    <FileExcelOutlined style={{ color: '#16a34a' }} />
                    <span style={{ fontWeight: 600 }}>Excel Compatible Spreadsheet (.csv)</span>
                  </Space>
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          <Divider style={{ margin: '14px 0', borderColor: isDarkMode ? '#1e293b' : '#e2e8f0' }} />

          {/* Data Scope */}
          <Form.Item
            label={
              <span style={{ fontWeight: 700, color: isDarkMode ? '#e2e8f0' : '#334155' }}>
                Data Scope
              </span>
            }
            name="scope"
            initialValue="filtered"
          >
            <Radio.Group
              onChange={(e) => setScope(e.target.value)}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Radio value="filtered" style={{ color: isDarkMode ? '#cbd5e1' : '#334155' }}>
                  <span style={{ fontWeight: 600 }}>Matching Current Filters</span>
                  <div style={{ fontSize: 12, color: '#94a3b8', paddingLeft: 24 }}>
                    Includes current search query, status, and category dropdowns
                  </div>
                </Radio>
                <Radio value="all" style={{ color: isDarkMode ? '#cbd5e1' : '#334155' }}>
                  <span style={{ fontWeight: 600 }}>All Records (Entire Database)</span>
                  <div style={{ fontSize: 12, color: '#94a3b8', paddingLeft: 24 }}>
                    Exports all platform records without search/status filters
                  </div>
                </Radio>
                <Radio value="custom" style={{ color: isDarkMode ? '#cbd5e1' : '#334155' }}>
                  <span style={{ fontWeight: 600 }}>Custom Date Range</span>
                  <div style={{ fontSize: 12, color: '#94a3b8', paddingLeft: 24 }}>
                    Filter records created within specific dates
                  </div>
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          {/* Custom Date Range Picker */}
          {scope === 'custom' && (
            <Form.Item
              label={
                <span style={{ fontWeight: 700, color: isDarkMode ? '#e2e8f0' : '#334155' }}>
                  Select Date Range
                </span>
              }
              name="dateRange"
              rules={[{ required: true, message: 'Please select a date range' }]}
            >
              <RangePicker
                format="DD MMM YYYY"
                style={{ width: '100%', borderRadius: 6 }}
              />
            </Form.Item>
          )}

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              marginTop: 24,
              borderTop: `1px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'}`,
              paddingTop: 16,
            }}
          >
            <Button onClick={onCancel} disabled={loading} style={{ borderRadius: 6 }}>
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              icon={<DownloadOutlined />}
              loading={loading}
              style={{
                borderRadius: 6,
                backgroundColor: '#4f46e5',
                borderColor: '#4f46e5',
                fontWeight: 700,
              }}
            >
              Download Export
            </Button>
          </div>
        </Form>
      </div>
    </Modal>
  );
};

export default ExportModal;

