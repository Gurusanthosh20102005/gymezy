import React, { useState, useMemo } from 'react';
import {
  Row,
  Col,
  Card,
  Select,
  Button,
  DatePicker,
  Tag,
  Badge,
  Tooltip,
  Empty,
  Spin,
} from 'antd';
import {
  CalendarOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  HourglassOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
  CrownOutlined,
  TeamOutlined,
  MobileOutlined,
  AuditOutlined,
  FireOutlined,
  StarFilled,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../theme/ThemeContext';
import { useDashboard } from '../hooks/useDashboard';
import gym3dBuilding from '../assets/images/gym_3d_building.jpg';
import booking3dPhone from '../assets/images/booking_3d_phone.jpg';

const { Option } = Select;
const { RangePicker } = DatePicker;

// Currency formatter utility
const formatCurrency = (amount = 0) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
};

// Clean Donut Chart Component
const SubscriptionDonutChart = ({ isDarkMode, data = {} }) => {
  const r = 70;
  const c = 2 * Math.PI * r;

  const total = (data.hybrid || 0) + (data.appOnly || 0) + (data.gms || 0) + (data.listing || 0);

  const hybridPct = total > 0 ? (data.hybrid || 0) / total : 0;
  const appOnlyPct = total > 0 ? (data.appOnly || 0) / total : 0;
  const gmsPct = total > 0 ? (data.gms || 0) / total : 0;
  const listingPct = total > 0 ? (data.listing || 0) / total : 0;

  const hybridDash = c * hybridPct;
  const appOnlyDash = c * appOnlyPct;
  const gmsDash = c * gmsPct;
  const listingDash = c * listingPct;

  const hybridOffset = 0;
  const appOnlyOffset = -hybridDash;
  const gmsOffset = -(hybridDash + appOnlyDash);
  const listingOffset = -(hybridDash + appOnlyDash + gmsDash);

  return (
    <div style={{ position: 'relative', width: 170, height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="170" height="170" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="100" cy="100" r={r} fill="transparent" stroke={isDarkMode ? '#1f2937' : '#f1f5f9'} strokeWidth="26" />
        {total > 0 && (
          <>
            <circle
              cx="100"
              cy="100"
              r={r}
              fill="transparent"
              stroke="#22c55e"
              strokeWidth="26"
              strokeDasharray={`${hybridDash} ${c}`}
              strokeDashoffset={hybridOffset}
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
            <circle
              cx="100"
              cy="100"
              r={r}
              fill="transparent"
              stroke="#3b82f6"
              strokeWidth="26"
              strokeDasharray={`${appOnlyDash} ${c}`}
              strokeDashoffset={appOnlyOffset}
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
            <circle
              cx="100"
              cy="100"
              r={r}
              fill="transparent"
              stroke="#6366f1"
              strokeWidth="26"
              strokeDasharray={`${gmsDash} ${c}`}
              strokeDashoffset={gmsOffset}
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
            <circle
              cx="100"
              cy="100"
              r={r}
              fill="transparent"
              stroke="#f97316"
              strokeWidth="26"
              strokeDasharray={`${listingDash} ${c}`}
              strokeDashoffset={listingOffset}
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
          </>
        )}
      </svg>

      <div
        style={{
          position: 'absolute',
          width: 80,
          height: 80,
          borderRadius: '50%',
          backgroundColor: isDarkMode ? '#111827' : '#ffffff',
          boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.5)' : '0 2px 10px rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CrownOutlined style={{ fontSize: 30, color: total > 0 ? '#6366f1' : '#94a3b8' }} />
      </div>
    </div>
  );
};

// Computes smooth cubic Bezier spline path through points
const getSmoothSplinePath = (pts) => {
  if (!pts || pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
};

const getSmoothAreaPath = (pts, bottomY) => {
  if (!pts || pts.length === 0) return '';
  const spline = getSmoothSplinePath(pts);
  const first = pts[0];
  const last = pts[pts.length - 1];
  return `${spline} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
};

// Revenue Growth Spline Chart Component (Dual-Curve Area Chart with Interactive Hover)
const RevenueGrowthSplineChart = ({ isDarkMode, data = [] }) => {
  const hasData = Array.isArray(data) && data.length > 0;

  const series = useMemo(() => {
    if (hasData) {
      return data.map((d, i) => ({
        label: d.name ? `${d.name} '${String(d.year || new Date().getFullYear()).slice(-2)}` : `Month ${i + 1}`,
        current: Number(d.subscription || 0),
        previous: Number(d.commission || 0),
        total: Number(d.total || (Number(d.subscription || 0) + Number(d.commission || 0))),
      }));
    }
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fallback = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      fallback.push({
        label: `${months[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`,
        current: 0,
        previous: 0,
        total: 0,
      });
    }
    return fallback;
  }, [data, hasData]);

  const [activeIndex, setActiveIndex] = React.useState(null);
  const effectiveIndex = activeIndex !== null ? activeIndex : Math.max(0, series.length - 1);
  const svgRef = React.useRef(null);

  // Layout boundaries
  const width = 680;
  const height = 250;
  const plotLeft = 58;
  const plotRight = 655;
  const plotTop = 25;
  const plotBottom = 205;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  // Calculate highest value dynamically for proportional scaling
  const maxDataVal = Math.max(
    ...series.map((s) => Math.max(s.current || 0, s.previous || 0)),
    0
  );

  const maxVal = maxDataVal > 0 ? Math.ceil((maxDataVal * 1.2) / 100) * 100 : 1000;
  const yTicks = [0, 1, 2, 3, 4, 5].map((i) => Math.round((maxVal / 5) * i));

  const formatYTick = (val) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
    return `₹${val}`;
  };

  const stepX = series.length > 1 ? plotWidth / (series.length - 1) : plotWidth;

  // Compute points
  const currentPoints = series.map((item, idx) => {
    const x = plotLeft + idx * stepX;
    const y = plotBottom - (Math.min(maxVal, item.current) / maxVal) * plotHeight;
    return { x, y, ...item };
  });

  const prevPoints = series.map((item, idx) => {
    const x = plotLeft + idx * stepX;
    const y = plotBottom - (Math.min(maxVal, item.previous) / maxVal) * plotHeight;
    return { x, y, ...item };
  });

  const activeCurrent = currentPoints[effectiveIndex] || currentPoints[0];
  const activePrev = prevPoints[effectiveIndex] || prevPoints[0];
  const activeItem = series[effectiveIndex] || series[0];
  const activeX = activeCurrent.x;

  // Tooltip position
  const tooltipWidth = 145;
  const tooltipHeight = 74;
  const tooltipX = Math.min(Math.max(activeX - tooltipWidth / 2, plotLeft + 5), plotRight - tooltipWidth - 5);
  const tooltipY = Math.max(plotTop + 5, Math.min(activeCurrent.y, activePrev.y) - 50);

  const handlePointerMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    if (!clientX) return;
    const relX = ((clientX - rect.left) / rect.width) * width;
    const closestIdx = Math.round((relX - plotLeft) / stepX);
    const clampedIdx = Math.max(0, Math.min(series.length - 1, closestIdx));
    setActiveIndex(clampedIdx);
  };

  return (
    <div style={{ width: '100%', position: 'relative', userSelect: 'none' }}>
      {/* Top Right Legend */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 20,
          marginBottom: 8,
          paddingRight: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: '#4361ee',
              boxShadow: '0 0 6px rgba(67, 97, 238, 0.4)',
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#cbd5e1' : '#334155' }}>
            Subscription Plans
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: '#e5a03b',
              boxShadow: '0 0 6px rgba(229, 160, 59, 0.4)',
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#cbd5e1' : '#334155' }}>
            Session Bookings
          </span>
        </div>
      </div>

      {/* Responsive SVG Chart */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', overflow: 'visible', display: 'block' }}
        onMouseMove={handlePointerMove}
        onTouchMove={handlePointerMove}
      >
        <defs>
          {/* Blue Current Area Gradient */}
          <linearGradient id="currentAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4361ee" stopOpacity={isDarkMode ? 0.35 : 0.22} />
            <stop offset="65%" stopColor="#4361ee" stopOpacity={isDarkMode ? 0.12 : 0.05} />
            <stop offset="100%" stopColor="#4361ee" stopOpacity="0" />
          </linearGradient>

          {/* Amber Previous Area Gradient */}
          <linearGradient id="prevAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e5a03b" stopOpacity={isDarkMode ? 0.32 : 0.20} />
            <stop offset="65%" stopColor="#e5a03b" stopOpacity={isDarkMode ? 0.10 : 0.04} />
            <stop offset="100%" stopColor="#e5a03b" stopOpacity="0" />
          </linearGradient>

          {/* Floating Tooltip Shadow Filter */}
          <filter id="tooltipShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor={isDarkMode ? '#000000' : '#0f172a'} floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Horizontal Gridlines & Y-Axis Labels */}
        {yTicks.map((tick) => {
          const y = plotBottom - (tick / maxVal) * plotHeight;
          return (
            <g key={tick}>
              <line
                x1={plotLeft - 5}
                y1={y}
                x2={plotRight + 10}
                y2={y}
                stroke={isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}
                strokeWidth="1"
              />
              <text
                x={plotLeft - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fontWeight="500"
                fill={isDarkMode ? '#64748b' : '#94a3b8'}
              >
                {formatYTick(tick)}
              </text>
            </g>
          );
        })}

        {/* 1. Previous Area Fill */}
        <path
          d={getSmoothAreaPath(prevPoints, plotBottom)}
          fill="url(#prevAreaGradient)"
        />

        {/* 2. Current Area Fill */}
        <path
          d={getSmoothAreaPath(currentPoints, plotBottom)}
          fill="url(#currentAreaGradient)"
        />

        {/* 3. Previous Spline Curve Line */}
        <path
          d={getSmoothSplinePath(prevPoints)}
          fill="none"
          stroke="#e5a03b"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 4. Current Spline Curve Line */}
        <path
          d={getSmoothSplinePath(currentPoints)}
          fill="none"
          stroke="#4361ee"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data Point Dots for Bookings (Amber) */}
        {prevPoints.map((pt, i) => (
          <circle
            key={`prev-dot-${i}`}
            cx={pt.x}
            cy={pt.y}
            r="3.2"
            fill="#e5a03b"
            stroke={isDarkMode ? '#0f172a' : '#ffffff'}
            strokeWidth="1.2"
          />
        ))}

        {/* Data Point Dots for Plans (Blue) */}
        {currentPoints.map((pt, i) => (
          <circle
            key={`curr-dot-${i}`}
            cx={pt.x}
            cy={pt.y}
            r="3.2"
            fill="#4361ee"
            stroke={isDarkMode ? '#0f172a' : '#ffffff'}
            strokeWidth="1.2"
          />
        ))}

        {/* 5. Active Hover Interaction Guides */}
        {effectiveIndex !== null && (
          <g>
            {/* Vertical Dashed Guide Line */}
            <line
              x1={activeX}
              y1={plotTop - 6}
              x2={activeX}
              y2={plotBottom}
              stroke={isDarkMode ? '#64748b' : '#94a3b8'}
              strokeDasharray="3 3"
              strokeWidth="1.2"
            />

            {/* Hovered Current Dot */}
            <circle
              cx={activeCurrent.x}
              cy={activeCurrent.y}
              r="4.5"
              fill="#4361ee"
              stroke="#ffffff"
              strokeWidth="2"
            />

            {/* Hovered Previous Dot */}
            <circle
              cx={activePrev.x}
              cy={activePrev.y}
              r="4.5"
              fill="#e5a03b"
              stroke="#ffffff"
              strokeWidth="2"
            />

            {/* Floating Tooltip Card */}
            <g transform={`translate(${tooltipX}, ${tooltipY})`} filter="url(#tooltipShadow)">
              <rect
                width={tooltipWidth}
                height={tooltipHeight}
                rx="8"
                ry="8"
                fill={isDarkMode ? '#1e293b' : '#ffffff'}
                stroke={isDarkMode ? '#334155' : '#e2e8f0'}
                strokeWidth="1"
              />
              {/* Tooltip Header (Month Name) */}
              <text
                x="12"
                y="18"
                fontSize="12"
                fontWeight="700"
                fill={isDarkMode ? '#f8fafc' : '#0f172a'}
              >
                {activeItem.label}
              </text>

              {/* Plans */}
              <circle cx="16" cy="36" r="4" fill="#4361ee" />
              <text x="26" y="40" fontSize="11" fontWeight="500" fill={isDarkMode ? '#94a3b8' : '#64748b'}>
                Plans: <tspan fontWeight="800" fill={isDarkMode ? '#ffffff' : '#0f172a'}>{formatCurrency(activeItem.current)}</tspan>
              </text>

              {/* Bookings */}
              <circle cx="16" cy="56" r="4" fill="#e5a03b" />
              <text x="26" y="60" fontSize="11" fontWeight="500" fill={isDarkMode ? '#94a3b8' : '#64748b'}>
                Bookings: <tspan fontWeight="800" fill={isDarkMode ? '#ffffff' : '#0f172a'}>{formatCurrency(activeItem.previous)}</tspan>
              </text>
            </g>
          </g>
        )}

        {/* 6. X-Axis Monthly Labels */}
        {series.map((item, idx) => {
          const x = plotLeft + idx * stepX;
          const isActive = idx === effectiveIndex;

          if (isActive) {
            const pillW = 60;
            const pillH = 22;
            const pillX = x - pillW / 2;
            const pillY = plotBottom + 8;
            return (
              <g key={`axis-active-${idx}`}>
                {/* Upward caret notch pointing to dashed line */}
                <polygon
                  points={`${x - 4},${pillY} ${x},${pillY - 4} ${x + 4},${pillY}`}
                  fill={isDarkMode ? '#1e293b' : '#f1f5f9'}
                  stroke={isDarkMode ? '#475569' : '#cbd5e1'}
                  strokeWidth="1"
                />
                {/* Pill rectangle */}
                <rect
                  x={pillX}
                  y={pillY}
                  width={pillW}
                  height={pillH}
                  rx="4"
                  ry="4"
                  fill={isDarkMode ? '#1e293b' : '#f1f5f9'}
                  stroke={isDarkMode ? '#475569' : '#cbd5e1'}
                  strokeWidth="1"
                />
                {/* Active Month Label */}
                <text
                  x={x}
                  y={pillY + 15}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill={isDarkMode ? '#ffffff' : '#0f172a'}
                >
                  {item.label}
                </text>
              </g>
            );
          }

          return (
            <text
              key={`axis-${idx}`}
              x={x}
              y={plotBottom + 22}
              textAnchor="middle"
              fontSize="11"
              fontWeight="500"
              fill={isDarkMode ? '#64748b' : '#94a3b8'}
              style={{ cursor: 'pointer' }}
              onClick={() => setActiveIndex(idx)}
            >
              {item.label}
            </text>
          );
        })}

        {/* Transparent Interactive Overlay to capture mouse movement smoothly */}
        <rect
          x={plotLeft - 10}
          y={plotTop}
          width={plotWidth + 20}
          height={plotHeight + 35}
          fill="transparent"
          style={{ cursor: 'crosshair' }}
        />
      </svg>
    </div>
  );
};

const RevenueBarChart = RevenueGrowthSplineChart;

export const Dashboard = () => {
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState('month');
  const [customRange, setCustomRange] = useState(null);

  const filterParams = useMemo(() => {
    if (filterType === 'custom') {
      return {
        filterType,
        startDate: customRange?.[0]
          ? (typeof customRange[0].toISOString === 'function'
              ? customRange[0].toISOString()
              : typeof customRange[0].toDate === 'function'
                ? customRange[0].toDate().toISOString()
                : String(customRange[0]))
          : undefined,
        endDate: customRange?.[1]
          ? (typeof customRange[1].toISOString === 'function'
              ? customRange[1].toISOString()
              : typeof customRange[1].toDate === 'function'
                ? customRange[1].toDate().toISOString()
                : String(customRange[1]))
          : undefined,
      };
    }
    return { filterType };
  }, [filterType, customRange]);

  const { stats, loading, refreshDashboard } = useDashboard(filterParams);

  const activeDateLabel = useMemo(() => {
    if (stats.dateFilter?.label) return stats.dateFilter.label;
    if (filterType === 'today') return 'Today';
    if (filterType === 'yesterday') return 'Yesterday';
    if (filterType === 'week') return 'This Week';
    if (filterType === 'month') return 'This Month';
    return 'Selected Period';
  }, [stats.dateFilter?.label, filterType]);

  const totalGyms = stats.totalGyms || 0;
  const activeGyms = stats.activeGyms || 0;
  const activeGymsPct = stats.activeGymsPct || 0;
  const completedWorkouts = stats.completedWorkouts || 0;
  const completionRate = stats.completionRate || 0;
  const pendingApprovalsCount = stats.pendingApprovalsCount || 0;

  const totalBookings = stats.bookings?.total || 0;
  const confirmedPct = totalBookings > 0 ? (((stats.bookings?.confirmed || 0) / totalBookings) * 100).toFixed(1) : 0;
  const completedPct = totalBookings > 0 ? (((stats.bookings?.completed || 0) / totalBookings) * 100).toFixed(1) : 0;
  const cancelledPct = totalBookings > 0 ? (((stats.bookings?.cancelled || 0) / totalBookings) * 100).toFixed(1) : 0;
  const noShowPct = totalBookings > 0 ? (((stats.bookings?.noShow || 0) / totalBookings) * 100).toFixed(1) : 0;

  const totalSubs = (stats.subscriptionShare?.hybrid || 0) +
    (stats.subscriptionShare?.appOnly || 0) +
    (stats.subscriptionShare?.gms || 0) +
    (stats.subscriptionShare?.listing || 0);

  const hybridPct = totalSubs > 0 ? (((stats.subscriptionShare?.hybrid || 0) / totalSubs) * 100).toFixed(1) : '0.0';
  const appOnlyPct = totalSubs > 0 ? (((stats.subscriptionShare?.appOnly || 0) / totalSubs) * 100).toFixed(1) : '0.0';
  const gmsPct = totalSubs > 0 ? (((stats.subscriptionShare?.gms || 0) / totalSubs) * 100).toFixed(1) : '0.0';
  const listingPct = totalSubs > 0 ? (((stats.subscriptionShare?.listing || 0) / totalSubs) * 100).toFixed(1) : '0.0';

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 36 }}>
      {/* Top Header & Time Filter Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: isDarkMode ? '#ffffff' : '#0f172a',
              margin: 0,
              letterSpacing: '-0.3px',
            }}
          >
            Super Admin Executive Command Center
          </h1>
          <div style={{ fontSize: 12, color: isDarkMode ? '#94a3b8' : '#64748b', marginTop: 2 }}>
            Real-time platform overview, financial performance & operations health
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {filterType === 'custom' && (
            <RangePicker
              onChange={(dates) => setCustomRange(dates)}
              format="DD MMM YYYY"
              style={{ borderRadius: 'var(--radius-base)' }}
              placeholder={['Start Date', 'End Date']}
            />
          )}

          <Select
            value={filterType}
            onChange={(val) => {
              setFilterType(val);
              if (val !== 'custom') setCustomRange(null);
            }}
            style={{ width: 150 }}
            size="middle"
            suffixIcon={<CalendarOutlined style={{ color: '#6366f1' }} />}
          >
            <Option value="today">Today</Option>
            <Option value="yesterday">Yesterday</Option>
            <Option value="week">This Week</Option>
            <Option value="month">This Month</Option>
            <Option value="custom">Custom Range</Option>
          </Select>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/admin/onboarding')}
            style={{
              backgroundColor: '#4f46e5',
              borderColor: '#4f46e5',
              fontWeight: 700,
              borderRadius: 'var(--radius-base)',
            }}
          >
            Onboard New Gym
          </Button>
        </div>
      </div>

      <Spin spinning={loading} tip="Fetching live platform data...">
        {/* 1. EXECUTIVE KPI STRIP (4 KEY PLATFORM METRICS) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 16,
            marginBottom: 20,
          }}
        >
          {/* Metric 1: Total Platform GMV */}
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
            }}
            styles={{ body: { padding: '18px 20px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                Total Platform GMV
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: Number(stats.gmvGrowthPct || 0) >= 0 ? '#16a34a' : '#dc2626',
                  backgroundColor: isDarkMode
                    ? (Number(stats.gmvGrowthPct || 0) >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)')
                    : (Number(stats.gmvGrowthPct || 0) >= 0 ? '#f0fdf4' : '#fef2f2'),
                  padding: '2px 8px',
                  borderRadius: 6,
                }}
              >
                {Number(stats.gmvGrowthPct || 0) >= 0 ? `+${stats.gmvGrowthPct || '0.0'}%` : `${stats.gmvGrowthPct || '0.0'}%`}
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2 }}>
              {formatCurrency(stats.totalGmv || 0)}
            </div>
            <div style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8', marginTop: 4 }}>
              Subscriptions + Booking gross volume ({activeDateLabel})
            </div>
          </Card>

          {/* Metric 2: Total Platform Users */}
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
              cursor: 'pointer',
            }}
            styles={{ body: { padding: '18px 20px' } }}
            onClick={() => navigate('/admin/customers')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                Total Users
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#6366f1',
                  backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#f3effe',
                  padding: '2px 8px',
                  borderRadius: 6,
                }}
              >
                {stats.usersStats?.activePct ?? 100}% Active
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2 }}>
              {(stats.usersStats?.total ?? stats.registeredUsers ?? 0).toLocaleString('en-IN')}{' '}
              <span style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8' }}>
                / {(stats.usersStats?.active ?? stats.registeredUsers ?? 0).toLocaleString('en-IN')} active
              </span>
            </div>
            <div style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8', marginTop: 4 }}>
              +{stats.usersStats?.new30d ?? 0} added this month
            </div>
          </Card>

          {/* Metric 3: Total Completed Workouts */}
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
              cursor: 'pointer',
            }}
            styles={{ body: { padding: '18px 20px' } }}
            onClick={() => navigate('/admin/bookings')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                Completed Workouts
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#3b82f6',
                  backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
                  padding: '2px 8px',
                  borderRadius: 6,
                }}
              >
                {completionRate}% Fulfilled
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2 }}>
              {completedWorkouts.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8', marginTop: 4 }}>
              {completionRate}% completion rate ({activeDateLabel})
            </div>
          </Card>

          {/* Metric 4: Pending Approvals Queue */}
          <Card
            style={{
              backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.08)' : '#fffbeb',
              borderColor: isDarkMode ? 'rgba(245, 158, 11, 0.3)' : '#fde68a',
              borderRadius: 'var(--radius-base)',
              cursor: 'pointer',
            }}
            styles={{ body: { padding: '18px 20px' } }}
            onClick={() => navigate('/admin/gyms?tab=pending')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#d97706' }}>
                Action Required
              </span>
              <Badge status="default" text={<span style={{ fontSize: 11, color: '#d97706', fontWeight: 700 }}>Review Now →</span>} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#b45309', lineHeight: 1.2 }}>
              {pendingApprovalsCount} Pending
            </div>
            <div style={{ fontSize: 11, color: '#d97706', marginTop: 4 }}>
              New gyms awaiting verification
            </div>
          </Card>
        </div>

        {/* 2. CORE 3D OVERVIEW & BOOKING PLATFORM CARDS */}
        <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
          {/* Left Card: Gym Network Overview */}
          <Col xs={24} lg={12}>
            <Card
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-color)',
                borderRadius: 'var(--radius-base)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
              styles={{ body: { padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' } }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    Gym Network Overview
                  </span>
                  <Button
                    type="link"
                    onClick={() => navigate('/admin/gyms?tab=approved')}
                    style={{ color: '#4f46e5', fontWeight: 700, fontSize: 12, padding: 0 }}
                  >
                    Manage Partner Gyms <RightOutlined style={{ fontSize: 10 }} />
                  </Button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '10px 0 20px 0' }}>
                  <img
                    src={gym3dBuilding}
                    alt="3D Gym Building"
                    style={{
                      width: 125,
                      height: 125,
                      objectFit: 'cover',
                      borderRadius: 16,
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                      Total Registered Gyms
                    </div>
                    <div style={{ fontSize: 44, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.1, margin: '4px 0' }}>
                      {stats.registeredGyms?.total || 0}
                    </div>
                    <div style={{ fontSize: 12, color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                      Across active metropolitan fitness hubs
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 12,
                  paddingTop: 16,
                  borderTop: `1px solid ${isDarkMode ? '#1e293b' : '#f1f5f9'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#f3effe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <SafetyCertificateOutlined style={{ fontSize: 18, color: '#6366f1' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                      Active
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                      {stats.registeredGyms?.active || 0}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fdeeed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <HourglassOutlined style={{ fontSize: 18, color: '#ef4444' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                      Inactive
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                      {stats.registeredGyms?.inactive || 0}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#fef4e8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <PlusOutlined style={{ fontSize: 18, color: '#f59e0b' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                      New (30d)
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                      {stats.registeredGyms?.new30d || 0}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </Col>

          {/* Right Card: Booking Overview */}
          <Col xs={24} lg={12}>
            <Card
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-color)',
                borderRadius: 'var(--radius-base)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
              styles={{ body: { padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' } }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    Booking Throughput & Fulfillment
                  </span>
                  <Button
                    type="link"
                    onClick={() => navigate('/admin/bookings')}
                    style={{ color: '#4f46e5', fontWeight: 700, fontSize: 12, padding: 0 }}
                  >
                    View Bookings Ledger <RightOutlined style={{ fontSize: 10 }} />
                  </Button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 20px 0' }}>
                  <div>
                    <div style={{ fontSize: 44, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.1, marginBottom: 6 }}>
                      {totalBookings.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                      Total App Bookings Generated ({activeDateLabel})
                    </div>
                  </div>
                  <img
                    src={booking3dPhone}
                    alt="3D Booking Phone"
                    style={{
                      width: 125,
                      height: 125,
                      objectFit: 'cover',
                      borderRadius: 16,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 10,
                  paddingTop: 16,
                  borderTop: `1px solid ${isDarkMode ? '#1e293b' : '#f1f5f9'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircleOutlined style={{ fontSize: 20, color: '#22c55e' }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                      Confirmed
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                      {stats.bookings?.confirmed || 0}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#22c55e' }}>
                      {confirmedPct}%
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircleOutlined style={{ fontSize: 20, color: '#3b82f6' }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                      Completed
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                      {stats.bookings?.completed || 0}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>
                      {completedPct}%
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CloseCircleOutlined style={{ fontSize: 20, color: '#ef4444' }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                      Cancelled
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                      {stats.bookings?.cancelled || 0}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444' }}>
                      {cancelledPct}%
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StopOutlined style={{ fontSize: 20, color: '#f59e0b' }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                      No Show
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                      {stats.bookings?.noShow || 0}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>
                      {noShowPct}%
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* 3. REVENUE TREND & SUBSCRIPTION TIER INTELLIGENCE */}
        <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
          {/* Monthly Revenue Breakdown Chart */}
          <Col xs={24} lg={13}>
            <Card
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-color)',
                borderRadius: 'var(--radius-base)',
                height: '100%',
              }}
              styles={{ body: { padding: '24px' } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    Platform Revenue Growth
                  </span>
                  <div style={{ fontSize: 12, color: isDarkMode ? '#94a3b8' : '#64748b', marginTop: 2 }}>
                    Monthly recurring subscriptions vs app booking fees
                  </div>
                </div>
                <Tag
                  color={Number(stats.gmvGrowthPct || 0) >= 0 ? 'green' : 'red'}
                  style={{ fontWeight: 700, borderRadius: 6 }}
                >
                  {Number(stats.gmvGrowthPct || 0) >= 0
                    ? `+${stats.gmvGrowthPct || '0.0'}% MoM`
                    : `${stats.gmvGrowthPct || '0.0'}% MoM`}
                </Tag>
              </div>

              <RevenueBarChart isDarkMode={isDarkMode} data={stats.revenueMonthly || []} />
            </Card>
          </Col>

          {/* Subscription Tier Distribution */}
          <Col xs={24} lg={11}>
            <Card
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-color)',
                borderRadius: 'var(--radius-base)',
                height: '100%',
              }}
              styles={{ body: { padding: '24px' } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#4f46e5' }}>
                  Subscription Tier Share
                </span>
                <Button
                  type="link"
                  onClick={() => navigate('/admin/subscriptions')}
                  style={{ color: '#4f46e5', fontWeight: 700, fontSize: 12, padding: 0 }}
                >
                  View Partners <RightOutlined style={{ fontSize: 10 }} />
                </Button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 170px', display: 'flex', justifyContent: 'center' }}>
                  <SubscriptionDonutChart isDarkMode={isDarkMode} data={stats.subscriptionShare} />
                </div>

                <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Hybrid Plan */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>
                        Hybrid Plan
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <strong style={{ fontSize: 14, color: isDarkMode ? '#fff' : '#0f172a' }}>
                        {stats.subscriptionShare?.hybrid || 0}
                      </strong>
                      <span style={{ fontSize: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>{hybridPct}%</span>
                    </div>
                  </div>

                  {/* App Only Plan */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>
                        App Only
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <strong style={{ fontSize: 14, color: isDarkMode ? '#fff' : '#0f172a' }}>
                        {stats.subscriptionShare?.appOnly || 0}
                      </strong>
                      <span style={{ fontSize: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>{appOnlyPct}%</span>
                    </div>
                  </div>

                  {/* GMS Plan */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#6366f1' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>
                        GMS Software
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <strong style={{ fontSize: 14, color: isDarkMode ? '#fff' : '#0f172a' }}>
                        {stats.subscriptionShare?.gms || 0}
                      </strong>
                      <span style={{ fontSize: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>{gmsPct}%</span>
                    </div>
                  </div>

                  {/* Listing Only */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f97316' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>
                        Listing Only
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <strong style={{ fontSize: 14, color: isDarkMode ? '#fff' : '#0f172a' }}>
                        {stats.subscriptionShare?.listing || 0}
                      </strong>
                      <span style={{ fontSize: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>{listingPct}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* 4. OPERATIONAL COMMAND: GYM APPROVALS QUEUE & TOP GYMS LEADERBOARD */}
        <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
          {/* Left Column: Actionable Gym Approvals Queue */}
          <Col xs={24} lg={12}>
            <Card
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-color)',
                borderRadius: 'var(--radius-base)',
                height: '100%',
              }}
              styles={{ body: { padding: '24px' } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AuditOutlined style={{ fontSize: 18, color: '#f59e0b' }} />
                  <span style={{ fontSize: 16, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    Pending Verification Queue
                  </span>
                </div>
                <Button
                  size="small"
                  onClick={() => navigate('/admin/gyms?tab=pending')}
                  style={{ borderRadius: 6, fontWeight: 700, color: '#4f46e5', borderColor: '#c7d2fe' }}
                >
                  View All ({stats.pendingApprovals?.length || 0})
                </Button>
              </div>

              {stats.pendingApprovals && stats.pendingApprovals.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {stats.pendingApprovals.map((gym, idx) => (
                    <div
                      key={idx}
                      onClick={() => navigate('/admin/gyms?tab=pending')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: 8,
                        backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
                        border: `1px solid ${isDarkMode ? '#222' : '#e2e8f0'}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: isDarkMode ? '#fff' : '#0f172a', fontSize: 13 }}>
                          {gym.name}
                        </div>
                        <div style={{ fontSize: 11, color: isDarkMode ? '#888' : '#64748b' }}>
                          {gym.city} • {gym.phone}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Tag color="orange">{gym.subscriptionType || 'Pending'}</Tag>
                        <Button size="small" type="primary" style={{ fontSize: 11, height: 26, borderRadius: 6 }}>
                          Review
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ color: isDarkMode ? '#888' : '#64748b', fontSize: 13 }}>
                      No pending gym onboarding applications to review
                    </span>
                  }
                />
              )}
            </Card>
          </Col>

          {/* Right Column: Top Performing Gyms Leaderboard */}
          <Col xs={24} lg={12}>
            <Card
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-color)',
                borderRadius: 'var(--radius-base)',
                height: '100%',
              }}
              styles={{ body: { padding: '24px' } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FireOutlined style={{ fontSize: 18, color: '#ea580c' }} />
                  <span style={{ fontSize: 16, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    Top Performing Gym Partners
                  </span>
                </div>
                <Tag color="purple" style={{ fontWeight: 700, borderRadius: 6 }}>
                  Monthly Leaderboard
                </Tag>
              </div>

              {stats.topGyms && stats.topGyms.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {stats.topGyms.map((gym, idx) => (
                    <div
                      key={idx}
                      onClick={() => navigate('/admin/gyms?tab=approved')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 8,
                        backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
                        border: `1px solid ${isDarkMode ? '#222' : '#e2e8f0'}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 800, color: '#6366f1', width: 18 }}>#{idx + 1}</span>
                        <div>
                          <div style={{ fontWeight: 700, color: isDarkMode ? '#fff' : '#0f172a', fontSize: 13 }}>
                            {gym.name}
                          </div>
                          <div style={{ fontSize: 11, color: isDarkMode ? '#888' : '#64748b' }}>
                            {gym.city} • {gym.membersCount || 0} members
                          </div>
                        </div>
                      </div>
                      <Tag color="green" icon={<StarFilled style={{ color: '#fbbf24', marginRight: 2 }} />}>{gym.rating || 0}</Tag>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ color: isDarkMode ? '#888' : '#64748b', fontSize: 13 }}>
                      No gym partner performance records available yet
                    </span>
                  }
                />
              )}
            </Card>
          </Col>
        </Row>

        {/* 5. BOTTOM ROW: 3 Platform Metric Cards */}
        <Card
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-color)',
            borderRadius: 'var(--radius-base)',
            marginBottom: 24,
          }}
          styles={{ body: { padding: '20px 28px' } }}
        >
          <Row gutter={[24, 24]} align="middle">
            {/* Total Registered Users */}
            <Col xs={24} md={8}>
              <div
                onClick={() => navigate('/admin/customers')}
                style={{ display: 'flex', alignItems: 'center', gap: 18, cursor: 'pointer' }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#f3effe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <TeamOutlined style={{ fontSize: 24, color: '#6366f1' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                    Total Registered Users
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                    {stats.registeredUsers || 0}
                  </div>
                  <div style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                    Active platform-wide accounts →
                  </div>
                </div>
              </div>
            </Col>

            {/* Total App Opens / Check-ins */}
            <Col xs={24} md={8} style={{ borderLeft: isDarkMode ? '1px solid #1e293b' : '1px solid #f1f5f9' }}>
              <div
                onClick={() => navigate('/admin/bookings')}
                style={{ display: 'flex', alignItems: 'center', gap: 18, paddingLeft: 12, cursor: 'pointer' }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#f3effe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <MobileOutlined style={{ fontSize: 24, color: '#6366f1' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                    Total App Check-ins & Activity
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                    {stats.totalAppOpens || 0}
                  </div>
                  <div style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                    Customer engagement records →
                  </div>
                </div>
              </div>
            </Col>

            {/* Total Completed Sessions */}
            <Col xs={24} md={8} style={{ borderLeft: isDarkMode ? '1px solid #1e293b' : '1px solid #f1f5f9' }}>
              <div
                onClick={() => navigate('/admin/bookings')}
                style={{ display: 'flex', alignItems: 'center', gap: 18, paddingLeft: 12, cursor: 'pointer' }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#f3effe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <CalendarOutlined style={{ fontSize: 24, color: '#6366f1' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                    Total Completed Sessions
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                    {stats.completedSessions || 0}
                  </div>
                  <div style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                    Across all partner venues →
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </Card>
      </Spin>

      {/* Footer Copyright */}
      <div style={{ textAlign: 'center', paddingBottom: 24, color: isDarkMode ? '#64748b' : '#94a3b8', fontSize: 13 }}>
        © {new Date().getFullYear()} GYMEZY Technologies Pvt. Ltd. All rights reserved.
      </div>
    </div>
  );
};

export default Dashboard;
