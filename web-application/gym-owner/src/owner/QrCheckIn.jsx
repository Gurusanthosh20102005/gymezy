import React, { useState, useRef, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Input,
  Button,
  Table,
  Tag,
  Space,
  Typography,
  Avatar,
  message,
  Segmented,
  Tooltip,
  Divider,
  Select,
  Empty,
  Badge,
} from 'antd';
import { useSelector, useDispatch } from 'react-redux';
import {
  QrcodeOutlined,
  ScanOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ClockCircleOutlined,
  ThunderboltOutlined,
  UserOutlined,
  SafetyCertificateFilled,
  LockOutlined,
  UnlockOutlined,
  VideoCameraOutlined,
  LoadingOutlined,
  StopOutlined,
  BarcodeOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  SearchOutlined,
  PhoneOutlined,
  IdcardOutlined,
  FileTextOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import confetti from 'canvas-confetti';
import jsQR from 'jsqr';
import { useTheme } from '../theme/ThemeContext';
import { recordCheckIn, recordCheckOut } from '../redux/slices/gymSlice';
import { apiClient } from '../services/apiClient';

const { Title, Text } = Typography;

export const QrCheckIn = () => {
  const dispatch = useDispatch();
  const { isDarkMode } = useTheme();
  const { user } = useSelector((state) => state.auth || {});
  const gym = user?.gym || {};
  const gymId = gym._id || gym.id || user?.gymId || user?.partnerId || user?._id;
  const { liveOccupancy: reduxOccupancy, capacity: reduxCapacity } = useSelector((state) => state.gym || {});

  const [occupancy, setOccupancy] = useState(reduxOccupancy || 0);
  const totalCapacity = reduxCapacity || 120;
  const [logs, setLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [searchableMembers, setSearchableMembers] = useState([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);

  const [activeOption, setActiveOption] = useState('qr'); // 'qr' | 'otp' | 'search'
  const [otpInput, setOtpInput] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Search by Mobile, User ID, Membership ID, Booking ID
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('all'); // 'all' | 'phone' | 'userId' | 'membershipId' | 'bookingId'

  // Live Camera WebRTC State
  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const [cameraState, setCameraState] = useState('idle'); // 'idle' | 'requesting' | 'active' | 'denied'
  const cameraStateRef = useRef('idle');
  const animFrameIdRef = useRef(null);
  const canvasRef = useRef(null);
  const barcodeDetectorRef = useRef(null);
  const isScanningCooldownRef = useRef(false);

  const [qrDetectedHighlight, setQrDetectedHighlight] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [lastVerified, setLastVerified] = useState(null);

  useEffect(() => {
    cameraStateRef.current = cameraState;
  }, [cameraState]);

  const fireSuccessConfetti = () => {
    try {
      confetti({
        particleCount: 35,
        spread: 55,
        origin: { y: 0.7 },
        colors: ['#52c41a', '#1677ff', '#faad14'],
      });
    } catch (e) {
      // safe fallback
    }
  };

  // Play audio chime on successful QR scan
  const playScanBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880Hz A5
      osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.12); // chime up
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.16);
    } catch {
      // safe audio fallback
    }
  };

  // Callback when QR code is detected
  const handleQrDetected = (rawCode) => {
    if (!rawCode || isScanningCooldownRef.current) return;
    const cleanCode = rawCode.trim();
    if (!cleanCode) return;

    isScanningCooldownRef.current = true;
    setQrDetectedHighlight(true);
    setLastScannedCode(cleanCode);
    playScanBeep();

    let parsed = null;
    if (cleanCode.startsWith('{') && cleanCode.endsWith('}')) {
      try {
        parsed = JSON.parse(cleanCode);
      } catch {}
    }

    const displayName = parsed?.customerId || parsed?.name || parsed?.id || parsed?.entryOtp || cleanCode;
    message.success(`QR Detected: ${displayName}`);

    handleVerify({
      code: cleanCode,
      raw: cleanCode,
      id: parsed?.id || parsed?.membershipId || undefined,
      membershipId: parsed?.id || parsed?.membershipId || undefined,
      entryOtp: parsed?.entryOtp || parsed?.otp || undefined,
    });

    setTimeout(() => {
      setQrDetectedHighlight(false);
    }, 1500);

    setTimeout(() => {
      isScanningCooldownRef.current = false;
    }, 3000);
  };

  // Continuous frame analysis loop
  const scanVideoFrame = () => {
    if (
      videoRef.current &&
      videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA &&
      cameraStateRef.current === 'active'
    ) {
      const video = videoRef.current;
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;

      if (video.videoWidth > 0 && video.videoHeight > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Hardware-accelerated BarcodeDetector (Chrome, Edge, Android Chrome)
        if ('BarcodeDetector' in window) {
          try {
            if (!barcodeDetectorRef.current) {
              barcodeDetectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
            }
            barcodeDetectorRef.current
              .detect(video)
              .then((barcodes) => {
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  handleQrDetected(barcodes[0].rawValue);
                } else {
                  // Fallback to jsQR
                  decodeFrameWithJsQr(ctx, canvas);
                }
              })
              .catch(() => {
                decodeFrameWithJsQr(ctx, canvas);
              });
          } catch {
            decodeFrameWithJsQr(ctx, canvas);
          }
        } else {
          decodeFrameWithJsQr(ctx, canvas);
        }
      }
    }

    if (cameraStateRef.current === 'active') {
      animFrameIdRef.current = requestAnimationFrame(scanVideoFrame);
    }
  };

  const decodeFrameWithJsQr = (ctx, canvas) => {
    if (isScanningCooldownRef.current) return;
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });
      if (code && code.data) {
        handleQrDetected(code.data);
      }
    } catch {
      // ignore frame decode error
    }
  };

  // Start Camera
  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      message.error('Camera API not supported in this browser environment.');
      setCameraState('denied');
      return;
    }

    setCameraState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraState('active');
      cameraStateRef.current = 'active';

      // Start frame scanning loop
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      animFrameIdRef.current = requestAnimationFrame(scanVideoFrame);
    } catch (err) {
      setCameraState('denied');
      cameraStateRef.current = 'denied';
      message.warning('Camera permission was not granted.');
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraState('idle');
    cameraStateRef.current = 'idle';
  };

  useEffect(() => {
    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (cameraState === 'active' && videoRef.current && mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
      if (!animFrameIdRef.current) {
        animFrameIdRef.current = requestAnimationFrame(scanVideoFrame);
      }
    }
  }, [cameraState]);

  // Load live today attendance logs
  const fetchTodayAttendance = async () => {
    if (!gymId) return;
    try {
      setIsLoadingLogs(true);
      const res = await apiClient.get(`/attendance/today?gymId=${gymId}`);
      if (res.data?.success && res.data?.data) {
        setLogs(res.data.data.logs || []);
        if (typeof res.data.data.summary?.currentlyInside === 'number') {
          setOccupancy(res.data.data.summary.currentlyInside);
        }
      }
    } catch (err) {
      console.warn('Failed to load today attendance logs:', err.message);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Load searchable gym members
  const fetchMembers = async (query = '') => {
    if (!gymId) return;
    try {
      setIsSearchingMembers(true);
      const res = await apiClient.get(`/attendance/members?gymId=${gymId}&query=${encodeURIComponent(query)}`);
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setSearchableMembers(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to search members:', err.message);
    } finally {
      setIsSearchingMembers(false);
    }
  };

  useEffect(() => {
    if (gymId) {
      fetchTodayAttendance();
      fetchMembers('');
    }
  }, [gymId]);

  useEffect(() => {
    if (activeOption === 'search' && gymId) {
      fetchMembers(searchQuery);
    }
  }, [searchQuery, activeOption, gymId]);

  // Member verification
  const handleVerify = async (customData = null) => {
    let rawString = '';
    let parsedJson = null;

    if (typeof customData === 'string') {
      rawString = customData.trim();
    } else if (typeof customData?.code === 'string') {
      rawString = customData.code.trim();
    } else if (typeof customData?.raw === 'string') {
      rawString = customData.raw.trim();
    }

    if (rawString.startsWith('{') && rawString.endsWith('}')) {
      try {
        parsedJson = JSON.parse(rawString);
      } catch {}
    }

    const rawLookup =
      parsedJson?.id ||
      parsedJson?.membershipId ||
      parsedJson?.entryOtp ||
      customData?.id ||
      customData?.membershipId ||
      customData?.entryOtp ||
      customData?.code ||
      customData?.raw ||
      customData?.membershipDbId ||
      customData?.userId ||
      (activeOption === 'otp' ? otpInput : manualInput);

    const lookupCode = (rawLookup || '').toString().trim();
    if (!lookupCode) {
      message.warning('Please enter or scan an OTP, QR code, or Member ID.');
      return;
    }

    setIsVerifying(true);
    let checkInMethod = 'QR';
    if (activeOption === 'otp') {
      checkInMethod = 'OTP';
    } else if (activeOption === 'search') {
      checkInMethod = 'Manual';
    }

    const otpVal =
      parsedJson?.entryOtp ||
      parsedJson?.otp ||
      (activeOption === 'otp' ? otpInput : (customData?.entryOtp || customData?.otp || undefined));

    try {
      const payload = {
        gymId,
        code: rawString || lookupCode,
        otp: otpVal,
        method: checkInMethod,
        area: 'General Workout',
        verifiedBy: 'Turnstile Fast Check-In',
      };

      const res = await apiClient.post('/attendance/check-in', payload);
      if (res.data?.success && res.data?.data) {
        const verified = res.data.data;
        const memberInfo = verified.member || {};

        if (verified.action === 'CHECK_OUT') {
          const verifiedItem = {
            key: verified.attendanceId,
            attendanceId: verified.attendanceId,
            action: 'CHECK_OUT',
            passId: memberInfo.membershipId || memberInfo.bookingId || lookupCode,
            userId: memberInfo.id || 'N/A',
            customerId: memberInfo.id || 'N/A',
            membershipId: memberInfo.membershipId || null,
            bookingId: memberInfo.bookingId || null,
            memberName: memberInfo.name || 'Gym Member',
            avatar: memberInfo.avatar || null,
            plan: memberInfo.tier ? `${memberInfo.tier} Pass` : (memberInfo.title || 'Gym Pass'),
            checkInTime: verified.checkInTime
              ? new Date(verified.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : null,
            checkOutTime: verified.checkOutTime
              ? new Date(verified.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            time: new Date(verified.checkOutTime || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            durationStr: verified.durationStr || 'Completed',
            area: verified.area || 'General Workout',
            status: 'CHECKED_OUT',
            attendanceStatus: 'Completed',
            method: verified.method === 'OTP' ? 'OTP Passcode' : 'QR Code',
          };

          setLastVerified(verifiedItem);
          message.success(`Check-Out Recorded: ${verifiedItem.memberName} (Time spent: ${verified.durationStr})`);
          setOtpInput('');
          setManualInput('');
          setSearchQuery('');
          await fetchTodayAttendance();
          return;
        }

        const verifiedItem = {
          key: verified.attendanceId,
          attendanceId: verified.attendanceId,
          action: 'CHECK_IN',
          passId: memberInfo.membershipId || memberInfo.bookingId || lookupCode,
          userId: memberInfo.id || 'N/A',
          customerId: memberInfo.id || 'N/A',
          membershipId: memberInfo.membershipId || null,
          bookingId: memberInfo.bookingId || null,
          bookingType: memberInfo.bookingType || null,
          attendedSessionsCount: memberInfo.attendedSessionsCount,
          durationDays: memberInfo.durationDays,
          memberName: memberInfo.name || 'Gym Member',
          avatar: memberInfo.avatar || null,
          plan: memberInfo.tier
            ? `${memberInfo.tier} Pass`
            : (memberInfo.title ? `${memberInfo.title}${memberInfo.bookingType === 'SECTION' ? ' (Section Batch)' : ''}` : 'Membership Pass'),
          area: verified.area || memberInfo.title || 'General Workout',
          time: new Date(verified.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          otp: memberInfo.entryOtp || otpInput || '------',
          status: 'GRANTED',
          attendanceStatus: 'Checked-In',
          method: verified.method === 'OTP' ? 'OTP Passcode' : 'QR Code',
          planExpiry: memberInfo.endDate ? new Date(memberInfo.endDate).toLocaleDateString() : 'Active',
        };

        setLastVerified(verifiedItem);
        message.success(`Access Granted: ${verifiedItem.memberName}`);
        fireSuccessConfetti();
        setOtpInput('');
        setManualInput('');
        setSearchQuery('');
        await fetchTodayAttendance();
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Access Denied: Verification failed.';
      message.error(errMsg);
      setLastVerified({
        status: 'DENIED',
        memberName: customData?.name || 'Visitor / Member',
        membershipId: lookupCode,
        passId: lookupCode,
        plan: customData?.plan || 'Unknown Pass',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        method: activeOption === 'otp' ? 'OTP Passcode' : 'QR Code',
        denialReason: errMsg,
        avatar: customData?.avatar || null,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleManualExit = async (record) => {
    try {
      const attId = record.attendanceId || record.key;
      await apiClient.post('/attendance/check-out', {
        attendanceId: attId,
        gymId,
      });
      message.info(`Exit recorded for ${record.memberName}`);
      await fetchTodayAttendance();
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'Failed to record check-out.');
    }
  };

  // Filter Search Results
  const filteredSearchResults = (searchableMembers || []).filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return false;

    const cleanQuery = q.replace(/[\s+-]/g, '');
    const cleanPhone = item.phone.replace(/[\s+-]/g, '');

    if (searchCategory === 'phone') {
      return cleanPhone.includes(cleanQuery) || item.phone.toLowerCase().includes(q);
    }
    if (searchCategory === 'userId') {
      return item.userId.toLowerCase().includes(q);
    }
    if (searchCategory === 'membershipId') {
      return item.membershipId.toLowerCase().includes(q);
    }
    if (searchCategory === 'bookingId') {
      return item.bookingId.toLowerCase().includes(q);
    }
    // 'all' category
    return (
      cleanPhone.includes(cleanQuery) ||
      item.phone.toLowerCase().includes(q) ||
      item.userId.toLowerCase().includes(q) ||
      item.membershipId.toLowerCase().includes(q) ||
      item.bookingId.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q)
    );
  });

  const getPlaceholderForCategory = () => {
    switch (searchCategory) {
      case 'phone':
        return 'Enter 10-digit mobile number (e.g. 9876543210)...';
      case 'userId':
        return 'Enter Customer ID (e.g. GYZ0001)...';
      case 'membershipId':
        return 'Enter Membership ID (e.g. MBR-2024-089)...';
      case 'bookingId':
        return 'Enter Booking ID (e.g. BKG-78210)...';
      default:
        return 'Search by Mobile No, User ID, Member ID, or Booking ID...';
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 32 }}>
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0, color: isDarkMode ? '#ffffff' : '#0f172a', fontWeight: 700 }}>
            QR Turnstile & Fast Check-In
          </Title>
          <Text style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 13.5 }}>
            Verify member access through optical QR Scanner, OTP passcode, or direct ID / Phone lookup.
          </Text>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
              border: `1px solid ${isDarkMode ? '#222222' : '#e2e8f0'}`,
              borderRadius: 'var(--radius-base)',
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#52c41a' }} />
            <span style={{ color: isDarkMode ? '#ffffff' : '#0f172a' }}>Gate 01 Online</span>
          </div>

          <div
            style={{
              padding: '6px 14px',
              backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
              border: `1px solid ${isDarkMode ? '#222222' : '#e2e8f0'}`,
              borderRadius: 'var(--radius-base)',
              fontSize: 12.5,
              fontWeight: 600,
              color: isDarkMode ? '#cccccc' : '#475569',
            }}
          >
            Floor Occupancy: <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{occupancy}</span> / {totalCapacity}
          </div>
        </div>
      </div>

      {/* Main Verification Row */}
      <Row gutter={[20, 20]}>
        {/* Left Column: Verification Terminal */}
        <Col xs={24} lg={13}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
              height: '100%',
            }}
            styles={{ body: { padding: '22px' } }}
          >
            {/* 3-Option Segmented Control */}
            <Segmented
              block
              size="large"
              value={activeOption}
              onChange={(val) => {
                setActiveOption(val);
                if (val !== 'qr') {
                  stopCamera();
                }
              }}
              options={[
                {
                  label: (
                    <div style={{ padding: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
                      <ScanOutlined style={{ fontSize: 15 }} />
                      <span>Scan QR Code</span>
                    </div>
                  ),
                  value: 'qr',
                },
                {
                  label: (
                    <div style={{ padding: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
                      <ThunderboltOutlined style={{ fontSize: 15 }} />
                      <span>Enter OTP</span>
                    </div>
                  ),
                  value: 'otp',
                },
                {
                  label: (
                    <div style={{ padding: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
                      <SearchOutlined style={{ fontSize: 15 }} />
                      <span>Other</span>
                    </div>
                  ),
                  value: 'search',
                },
              ]}
              style={{ marginBottom: 20 }}
            />

            {/* OPTION 1: SCAN QR CODE */}
            {activeOption === 'qr' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Viewport Box */}
                <div
                  style={{
                    position: 'relative',
                    height: 250,
                    borderRadius: 'var(--radius-base)',
                    backgroundColor: isDarkMode ? '#0d1117' : '#0f172a',
                    border: `1px solid ${isDarkMode ? '#21262d' : '#334155'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {/* Active Camera Video */}
                  {cameraState === 'active' && (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  )}

                  {/* Corner Guide Reticles for Professional Viewfinder */}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 2,
                      width: 150,
                      height: 150,
                      pointerEvents: 'none',
                    }}
                  >
                    {/* Top-Left Corner */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: 24,
                        height: 24,
                        borderTop: '3px solid #52c41a',
                        borderLeft: '3px solid #52c41a',
                        borderTopLeftRadius: 4,
                      }}
                    />
                    {/* Top-Right Corner */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: 24,
                        height: 24,
                        borderTop: '3px solid #52c41a',
                        borderRight: '3px solid #52c41a',
                        borderTopRightRadius: 4,
                      }}
                    />
                    {/* Bottom-Left Corner */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: 24,
                        height: 24,
                        borderBottom: '3px solid #52c41a',
                        borderLeft: '3px solid #52c41a',
                        borderBottomLeftRadius: 4,
                      }}
                    />
                    {/* Bottom-Right Corner */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 24,
                        height: 24,
                        borderBottom: '3px solid #52c41a',
                        borderRight: '3px solid #52c41a',
                        borderBottomRightRadius: 4,
                      }}
                    />

                    {/* Subtle Center Scan Line */}
                    {cameraState === 'active' && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 2,
                          backgroundColor: '#52c41a',
                          boxShadow: '0 0 8px #52c41a',
                          animation: 'scanLaser 2.2s infinite ease-in-out',
                        }}
                      />
                    )}

                    {cameraState !== 'active' && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <QrcodeOutlined style={{ fontSize: 56, color: 'rgba(255, 255, 255, 0.25)' }} />
                      </div>
                    )}
                  </div>

                  {/* Camera Status Label */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 12,
                      left: 12,
                      right: 12,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      zIndex: 3,
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 8px',
                        borderRadius: 4,
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        backdropFilter: 'blur(4px)',
                        fontSize: 11,
                        color: '#ffffff',
                        fontWeight: 600,
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: cameraState === 'active' ? '#52c41a' : '#888888',
                        }}
                      />
                      <span>{cameraState === 'active' ? 'Camera Live' : 'Camera Ready'}</span>
                    </div>

                    {cameraState === 'active' && (
                      <Button
                        size="small"
                        icon={<StopOutlined />}
                        onClick={stopCamera}
                        style={{
                          backgroundColor: 'rgba(0, 0, 0, 0.65)',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: 11,
                          height: 24,
                          borderRadius: 4,
                        }}
                      >
                        Stop
                      </Button>
                    )}
                  </div>
                </div>

                {/* Action Buttons: Start Camera & Upload Image */}
                <div style={{ display: 'flex', gap: 10 }}>
                  {cameraState !== 'active' ? (
                    <Button
                      type="primary"
                      icon={<VideoCameraOutlined />}
                      loading={cameraState === 'requesting'}
                      onClick={startCamera}
                      style={{
                        flex: 1,
                        height: 40,
                        borderRadius: 'var(--radius-base)',
                        fontWeight: 600,
                        backgroundColor: 'var(--color-primary)',
                      }}
                    >
                      Start Camera Scanner
                    </Button>
                  ) : (
                    <Button
                      danger
                      icon={<StopOutlined />}
                      onClick={stopCamera}
                      style={{
                        flex: 1,
                        height: 40,
                        borderRadius: 'var(--radius-base)',
                        fontWeight: 600,
                      }}
                    >
                      Stop Camera
                    </Button>
                  )}
                </div>

                {/* Manual Fast Input */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input
                    prefix={<BarcodeOutlined style={{ color: isDarkMode ? '#888888' : '#94a3b8' }} />}
                    placeholder="Enter Mobile No / User ID / Member ID / Booking ID"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onPressEnter={() => {
                      if (manualInput.trim()) {
                        handleVerify();
                      }
                    }}
                    style={{ borderRadius: 'var(--radius-base)' }}
                  />
                  <Button
                    type="default"
                    loading={isVerifying}
                    onClick={() => handleVerify()}
                    style={{ borderRadius: 'var(--radius-base)', fontWeight: 600 }}
                  >
                    Verify
                  </Button>
                </div>
              </div>
            )}

            {/* OPTION 2: ENTER OTP */}
            {activeOption === 'otp' && (
              <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 600 }}>
                  Enter 6-Digit Member OTP Passcode
                </Text>

                <Input
                  maxLength={6}
                  placeholder="000000"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  onPressEnter={() => {
                    if (otpInput.length >= 4) {
                      handleVerify({ otp: otpInput });
                    }
                  }}
                  style={{
                    height: 52,
                    fontSize: 24,
                    fontWeight: 700,
                    letterSpacing: 8,
                    textAlign: 'center',
                    borderRadius: 'var(--radius-base)',
                    fontFamily: 'monospace',
                    maxWidth: 280,
                    width: '100%',
                  }}
                />

                <Button
                  type="primary"
                  loading={isVerifying}
                  disabled={!otpInput}
                  onClick={() => handleVerify({ otp: otpInput })}
                  style={{
                    width: '100%',
                    maxWidth: 280,
                    height: 42,
                    borderRadius: 'var(--radius-base)',
                    fontWeight: 600,
                    backgroundColor: 'var(--color-primary)',
                  }}
                >
                  Verify & Unlock Gate
                </Button>
              </div>
            )}

            {/* OPTION 3: SEARCH BY MOBILE NUMBER / USER ID / MEMBERSHIP ID / BOOKING ID */}
            {activeOption === 'search' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Search Filter & Bar */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Select
                    value={searchCategory}
                    onChange={setSearchCategory}
                    style={{ width: 175 }}
                    options={[
                      {
                        value: 'all',
                        label: (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <SearchOutlined style={{ fontSize: 13, color: '#1677ff' }} />
                            <span>All Fields</span>
                          </div>
                        ),
                      },
                      {
                        value: 'phone',
                        label: (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <PhoneOutlined style={{ fontSize: 13, color: '#52c41a' }} />
                            <span>Mobile Number</span>
                          </div>
                        ),
                      },
                      {
                        value: 'userId',
                        label: (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <UserOutlined style={{ fontSize: 13, color: '#1677ff' }} />
                            <span>User ID</span>
                          </div>
                        ),
                      },
                      {
                        value: 'membershipId',
                        label: (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <IdcardOutlined style={{ fontSize: 13, color: '#fa8c16' }} />
                            <span>Membership ID</span>
                          </div>
                        ),
                      },
                      {
                        value: 'bookingId',
                        label: (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FileTextOutlined style={{ fontSize: 13, color: '#9254de' }} />
                            <span>Booking ID</span>
                          </div>
                        ),
                      },
                    ]}
                  />

                  <Input
                    allowClear
                    prefix={<SearchOutlined style={{ color: isDarkMode ? '#888888' : '#94a3b8' }} />}
                    placeholder={getPlaceholderForCategory()}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ flex: 1, minWidth: 220, borderRadius: 'var(--radius-base)' }}
                  />
                </div>

                {/* Search Results Display */}
                <div
                  style={{
                    maxHeight: 290,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    paddingRight: 4,
                  }}
                >
                  {searchQuery.trim() ? (
                    filteredSearchResults.length > 0 ? (
                      filteredSearchResults.map((member) => (
                        <div
                          key={member.key}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 14px',
                            backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
                            borderRadius: 'var(--radius-base)',
                            border: `1px solid ${isDarkMode ? '#222222' : '#e2e8f0'}`,
                            gap: 12,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                            <Avatar size={42} src={member.avatar} icon={<UserOutlined />} style={{ flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: 14, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                                  {member.name}
                                </span>
                                <Tag
                                  color={member.status === 'ACTIVE' ? 'success' : member.status === 'UPCOMING' ? 'blue' : 'error'}
                                  style={{ fontWeight: 700, fontSize: 10, margin: 0, borderRadius: 3 }}
                                >
                                  {member.status}
                                </Tag>
                                <Tag
                                  color={member.source === 'WALK_IN' ? 'purple' : 'blue'}
                                  style={{ fontWeight: 700, fontSize: 10, margin: 0, borderRadius: 3 }}
                                >
                                  {member.source === 'WALK_IN' ? 'WALK-IN' : 'APP'}
                                </Tag>
                              </div>
                              <div style={{ fontSize: 12, color: isDarkMode ? '#aaaaaa' : '#64748b', marginTop: 2 }}>
                                {member.plan}
                              </div>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 12,
                                  fontSize: 11.5,
                                  color: isDarkMode ? '#888888' : '#64748b',
                                  marginTop: 6,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <PhoneOutlined style={{ color: '#1677ff', fontSize: 12 }} />
                                  <span>{member.phone}</span>
                                </span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <UserOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                                  <span>{member.userId}</span>
                                </span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <IdcardOutlined style={{ color: '#fa8c16', fontSize: 12 }} />
                                  <span>{member.membershipId}</span>
                                </span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <FileTextOutlined style={{ color: '#9254de', fontSize: 12 }} />
                                  <span>{member.bookingId}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <Button
                            type="primary"
                            size="small"
                            loading={isVerifying}
                            danger={member.status === 'EXPIRED' || member.status === 'CANCELLED'}
                            onClick={() => handleVerify(member)}
                            style={{
                              borderRadius: 'var(--radius-base)',
                              fontWeight: 600,
                              fontSize: 12,
                              height: 32,
                              padding: '0 14px',
                              flexShrink: 0,
                              backgroundColor: member.status === 'UPCOMING' ? '#d97706' : undefined,
                              borderColor: member.status === 'UPCOMING' ? '#d97706' : undefined,
                            }}
                          >
                            {member.status === 'EXPIRED' ? 'Expired (Check)' : member.status === 'UPCOMING' ? 'Upcoming (Check)' : 'Verify & Check In'}
                          </Button>
                        </div>
                      ))
                    ) : (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <span style={{ fontSize: 12.5, color: isDarkMode ? '#888888' : '#94a3b8' }}>
                            No member or booking found matching "<strong>{searchQuery}</strong>"
                          </span>
                        }
                      />
                    )
                  ) : (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '24px 16px',
                        backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
                        borderRadius: 'var(--radius-base)',
                        border: `1px dashed ${isDarkMode ? '#262626' : '#cbd5e1'}`,
                      }}
                    >
                      <SearchOutlined style={{ fontSize: 28, color: 'var(--color-primary)', marginBottom: 8 }} />
                      <div style={{ fontWeight: 600, fontSize: 13, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                        Search any member or booking
                      </div>
                      <div style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', marginTop: 4 }}>
                        Type a mobile number, User ID, Membership ID, or Booking ID above for instant verification.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </Col>

        {/* Right Column: Member Verification Status */}
        <Col xs={24} lg={11}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
                <SafetyCertificateFilled
                  style={{
                    color:
                      lastVerified?.status === 'GRANTED'
                        ? '#52c41a'
                        : lastVerified?.status === 'CHECKED_OUT'
                        ? '#fa8c16'
                        : lastVerified
                        ? '#ff4d4f'
                        : '#1677ff',
                  }}
                />
                <span>Verification Result</span>
              </div>
            }
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
              height: '100%',
            }}
            styles={{ body: { padding: '20px' } }}
          >
            {lastVerified ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Member Profile */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '16px 18px',
                    backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
                    borderRadius: 'var(--radius-base)',
                    border: `1px solid ${isDarkMode ? '#222222' : '#e2e8f0'}`,
                  }}
                >
                  <Avatar size={54} src={lastVerified.avatar} icon={<UserOutlined />} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 16, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                        {lastVerified.memberName}
                      </span>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {lastVerified.status === 'GRANTED' && (
                          <Tag color="success" style={{ fontWeight: 700, borderRadius: 4, margin: 0 }}>
                            ACCESS GRANTED
                          </Tag>
                        )}
                        {lastVerified.status === 'CHECKED_OUT' && (
                          <Tag color="warning" style={{ fontWeight: 700, borderRadius: 4, margin: 0 }}>
                            CHECK-OUT RECORDED
                          </Tag>
                        )}
                        {lastVerified.status === 'DENIED' && (
                          <Tag color="error" style={{ fontWeight: 700, borderRadius: 4, margin: 0 }}>
                            ACCESS DENIED
                          </Tag>
                        )}
                        {lastVerified.durationStr && lastVerified.status === 'CHECKED_OUT' && (
                          <Tag color="processing" style={{ fontWeight: 600, borderRadius: 4, margin: 0 }}>
                            Duration: {lastVerified.durationStr}
                          </Tag>
                        )}
                        {lastVerified.bookingType === 'SECTION' && (
                          <Tag color="purple" style={{ fontWeight: 600, borderRadius: 4, margin: 0 }}>
                            Section Batch
                          </Tag>
                        )}
                        {typeof lastVerified.attendedSessionsCount === 'number' && (
                          <Tag color="cyan" style={{ fontWeight: 600, borderRadius: 4, margin: 0 }}>
                            Session {lastVerified.attendedSessionsCount}
                            {lastVerified.durationDays ? ` of ${lastVerified.durationDays}` : ''}
                          </Tag>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, color: isDarkMode ? '#888888' : '#64748b', marginTop: 3 }}>
                      {lastVerified.plan}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12, marginTop: 6 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: isDarkMode ? '#cccccc' : '#475569' }}>
                        <UserOutlined style={{ color: '#52c41a' }} />
                        <span>Client ID: </span>
                        <strong style={{ fontFamily: 'monospace', color: '#52c41a' }}>{lastVerified.customerId || lastVerified.userId || 'USR-1029'}</strong>
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: isDarkMode ? '#cccccc' : '#475569' }}>
                        <IdcardOutlined style={{ color: '#fa8c16' }} />
                        <span>Member / Booking ID: </span>
                        <strong style={{ fontFamily: 'monospace', color: '#1677ff' }}>{lastVerified.membershipId || lastVerified.passId}</strong>
                        {lastVerified.bookingId && (
                          <span style={{ color: '#9254de', fontFamily: 'monospace' }}>({lastVerified.bookingId})</span>
                        )}
                      </span>
                    </div>
                    {lastVerified.status === 'CHECKED_OUT' ? (
                      <div style={{ fontSize: 11.5, color: isDarkMode ? '#aaaaaa' : '#94a3b8', marginTop: 4 }}>
                        Checked Out: {lastVerified.checkOutTime} {lastVerified.checkInTime ? `(In: ${lastVerified.checkInTime})` : ''} • Via {lastVerified.method} • {lastVerified.area}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11.5, color: isDarkMode ? '#aaaaaa' : '#94a3b8', marginTop: 4 }}>
                        {lastVerified.time} • Via {lastVerified.method} • {lastVerified.area}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '36px 0', color: isDarkMode ? '#888888' : '#94a3b8', fontSize: 13 }}>
                Waiting for member verification...
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Today's Check-In Activity Table */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
            <ClockCircleOutlined style={{ color: 'var(--color-primary)' }} />
            <span>Today's Check-In Log</span>
          </div>
        }
        style={{
          marginTop: 20,
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-color)',
          borderRadius: 'var(--radius-base)',
        }}
        styles={{ body: { padding: '12px 18px' } }}
      >
        <Table
          dataSource={logs}
          rowKey="key"
          pagination={{ pageSize: 5 }}
          size="middle"
          scroll={{ x: 800 }}
          columns={[
            {
              title: 'Time',
              dataIndex: 'time',
              key: 'time',
              width: 90,
              render: (time) => <span style={{ fontWeight: 600, fontSize: 12 }}>{time}</span>,
            },
            {
              title: 'Client ID',
              key: 'clientId',
              width: 130,
              render: (_, record) => {
                const clientId = record.customerId || record.userId || record.passId || 'USR-1029';
                return (
                  <Tag
                    color="green"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontWeight: 650,
                      fontSize: 11.5,
                      fontFamily: 'monospace',
                      borderRadius: 4,
                      padding: '2px 8px',
                      margin: 0,
                    }}
                  >
                    <UserOutlined style={{ fontSize: 11 }} />
                    {clientId}
                  </Tag>
                );
              },
            },
            {
              title: 'Member',
              key: 'member',
              render: (_, record) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar size={30} src={record.avatar} icon={<UserOutlined />} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                      {record.memberName}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              title: 'Membership / Booking ID',
              key: 'membershipBookingId',
              width: 220,
              render: (_, record) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                  {record.membershipId && (
                    <Tag
                      color="orange"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontWeight: 650,
                        fontSize: 11,
                        fontFamily: 'monospace',
                        borderRadius: 4,
                        padding: '1px 7px',
                        margin: 0,
                      }}
                    >
                      <IdcardOutlined style={{ fontSize: 11 }} />
                      <span>{record.membershipId}</span>
                    </Tag>
                  )}
                  {record.bookingId && (
                    <Tag
                      color="purple"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontWeight: 600,
                        fontSize: 10.5,
                        fontFamily: 'monospace',
                        borderRadius: 4,
                        padding: '1px 7px',
                        margin: 0,
                      }}
                    >
                      <FileTextOutlined style={{ fontSize: 10 }} />
                      <span>{record.bookingId}</span>
                    </Tag>
                  )}
                  {!record.membershipId && !record.bookingId && record.passId && (
                    <Tag
                      color="blue"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontWeight: 650,
                        fontSize: 11,
                        fontFamily: 'monospace',
                        borderRadius: 4,
                        padding: '1px 7px',
                        margin: 0,
                      }}
                    >
                      <IdcardOutlined style={{ fontSize: 11 }} />
                      <span>{record.passId}</span>
                    </Tag>
                  )}
                </div>
              ),
            },
            {
              title: 'Membership Plan',
              dataIndex: 'plan',
              key: 'plan',
              render: (plan) => (
                <Text style={{ fontSize: 12, color: isDarkMode ? '#cccccc' : '#475569' }}>
                  {plan}
                </Text>
              ),
            },
            {
              title: 'Method',
              dataIndex: 'method',
              key: 'method',
              render: (method) => (
                <Tag color={method === 'QR Code' ? 'blue' : method === 'Manual Lookup' ? 'cyan' : 'purple'} style={{ borderRadius: 4, fontWeight: 600, fontSize: 11 }}>
                  {method}
                </Tag>
              ),
            },
            {
              title: 'Status',
              dataIndex: 'status',
              key: 'status',
              render: (status, record) => {
                const isInside = record.attendanceStatus === 'Checked-In' || status === 'GRANTED';
                return (
                  <Tag
                    color={isInside ? 'success' : status === 'DENIED' ? 'error' : 'blue'}
                    style={{ borderRadius: 4, fontWeight: 700, fontSize: 11 }}
                  >
                    {isInside ? 'INSIDE' : status === 'DENIED' ? 'DENIED' : 'CHECKED OUT'}
                  </Tag>
                );
              },
            },
            {
              title: 'Action',
              key: 'action',
              align: 'right',
              render: (_, record) =>
                (record.attendanceStatus === 'Checked-In' || record.status === 'GRANTED') ? (
                  <Button
                    size="small"
                    danger
                    onClick={() => handleManualExit(record)}
                    style={{ borderRadius: 'var(--radius-base)', fontSize: 11, fontWeight: 600 }}
                  >
                    Check Out
                  </Button>
                ) : (
                  <span style={{ fontSize: 11.5, color: isDarkMode ? '#888888' : '#94a3b8' }}>
                    {record.checkOutStr && record.checkOutStr !== '-' ? `Out at ${record.checkOutStr}` : 'Completed'}
                  </span>
                ),
            },
          ]}
        />
      </Card>

      {/* Global CSS for Scanner Laser */}
      <style>{`
        @keyframes scanLaser {
          0% { top: 0%; opacity: 0.8; }
          50% { top: 95%; opacity: 1; }
          100% { top: 0%; opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default QrCheckIn;
