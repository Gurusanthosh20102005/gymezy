import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Card,
  Table,
  Tag,
  Button,
  Row,
  Col,
  Input,
  InputNumber,
  Tabs,
  Select,
  Typography,
  Avatar,
  Dropdown,
  Modal,
  Form,
  DatePicker,
  TimePicker,
  Checkbox,
  Pagination,
  message,
  Space,
  Spin,
  Alert,
  Switch,
} from 'antd';
import {
  DollarOutlined,
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  CalendarOutlined,
  TeamOutlined,
  UserOutlined,
  UserAddOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  MoreOutlined,
  EyeOutlined,
  EditOutlined,
  PhoneOutlined,
  MailOutlined,
  IdcardOutlined,
  CrownOutlined,
  CameraOutlined,
  UploadOutlined,
  DeleteOutlined,
  PoweroffOutlined,
  SaveOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  CheckOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  CheckCircleFilled,
  DownOutlined,
  UsergroupAddOutlined,
  ShopOutlined,
  InfoCircleOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import confetti from 'canvas-confetti';
import { useTheme } from '../../theme/ThemeContext';
import { apiClient } from '../../services/apiClient';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const getGymInitials = (name) => {
  if (!name) return 'E';
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const INITIAL_EMPLOYEES = [];

/**
 * Automatically determine system access type from role (Automatic RBAC)
 * Manager -> Admin
 * Trainer / Head Trainer / Front Desk / Support / Physio / Nutritionist -> Employee
 * Housekeeping / Maintenance / Security -> None
 */
export const computeAccessTypeFromRole = (role) => {
  if (!role) return 'Employee';
  const norm = String(role).trim().toLowerCase();
  if (norm.includes('front desk') || norm.includes('reception')) return 'Employee';
  if (norm.includes('manager')) return 'Admin';
  if (
    norm.includes('trainer') ||
    norm.includes('support') ||
    norm.includes('physio') ||
    norm.includes('nutrition')
  ) {
    return 'Employee';
  }
  return 'None';
};

export const formatAmountWithCommas = (val) => {
  if (val === undefined || val === null || val === '') return '';
  const str = String(val).replace(/,/g, '');
  const [intPart, decimalPart] = str.split('.');
  const parsed = Number(intPart);
  const formattedInt = Number.isNaN(parsed) ? intPart : parsed.toLocaleString('en-IN');
  return decimalPart !== undefined ? `${formattedInt}.${decimalPart}` : formattedInt;
};

export const parseAmountWithoutCommas = (val) => (val ? String(val).replace(/[^0-9.]/g, '') : '');

// Canvas Confetti Popper Trigger
export const triggerConfettiPopper = () => {
  try {
    const end = Date.now() + 1.2 * 1000;
    const colors = ['#722ed1', '#003882', '#00bf62', '#fa8c16', '#eb2f96', '#1677ff'];

    (function frame() {
      confetti({
        particleCount: 6,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.65 },
        colors: colors,
        zIndex: 99999,
      });
      confetti({
        particleCount: 6,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.65 },
        colors: colors,
        zIndex: 99999,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();

    confetti({
      particleCount: 75,
      spread: 90,
      origin: { y: 0.5 },
      colors: colors,
      zIndex: 99999,
    });
  } catch (err) {
    console.error('Confetti error:', err);
  }
};

/**
 * Reusable Employee Management Component
 */
export const EmployeeManagement = ({
  initialData = INITIAL_EMPLOYEES,
  onAddEmployee,
}) => {
  const { isDarkMode } = useTheme();
  const { user } = useSelector((state) => state.auth);
  const gym = user?.gym || {};
  const gymId = gym._id || gym.id || user?.gymId;
  const gymPartnerId = gym.partnerId || user?.partnerId || (typeof gymId === 'string' && !gymId.match(/^[0-9a-fA-F]{24}$/) ? gymId : '');
  const gymName = gym.name || 'Main Facility';

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }, []);

  const oneYearLaterFormatted = useMemo(() => {
    return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }, []);

  // Forms
  const [addEmployeeForm] = Form.useForm();
  const [editEmployeeForm] = Form.useForm();
  const [tempStaffForm] = Form.useForm();
  const [attachDocForm] = Form.useForm();

  const addRoleWatch = Form.useWatch('role', addEmployeeForm);
  const editRoleWatch = Form.useWatch('role', editEmployeeForm);

  // Map live gym trainers & staff from database fallback
  const mappedGymStaff = useMemo(() => {
    const list = [];
    if (Array.isArray(gym.trainers) && gym.trainers.length > 0) {
      gym.trainers.forEach((t, index) => {
        list.push({
          key: t.id || t._id || `tr-${index}`,
          id: t.id || t._id || `tr-${index}`,
          employeeId: `TR00${index + 1}`,
          name: t.name || 'Trainer',
          role: 'Trainer',
          phone: t.phone || gym.phone || '—',
          specialty: t.specialty || 'Fitness Coach',
          email: t.email || gym.email || '—',
          attendance: 'Present',
          status: 'Active',
          approvalStatus: 'Approved',
          type: 'Full-Time',
          experience: `${t.experienceYears || 2} Years`,
          avatar: t.image?.fileData || (typeof t.image === 'string' ? t.image : ''),
          gender: 'All',
          joinDate: todayFormatted,
          branch: gymName,
          gymId,
          gymPartnerId,
        });
      });
    }
    if (Array.isArray(gym.staff) && gym.staff.length > 0) {
      gym.staff.forEach((s, index) => {
        list.push({
          key: s.id || s._id || `staff-${index}`,
          id: s.id || s._id || `staff-${index}`,
          employeeId: `EMP00${index + 1}`,
          name: s.name || 'Staff Member',
          role: s.designation || 'Staff',
          phone: s.phone || gym.phone || '—',
          email: s.email || gym.email || '—',
          attendance: 'Present',
          status: 'Active',
          approvalStatus: 'Approved',
          type: s.type || 'Full-Time',
          avatar: s.image?.fileData || (typeof s.image === 'string' ? s.image : ''),
          gender: 'All',
          joinDate: todayFormatted,
          branch: gymName,
          gymId,
          gymPartnerId,
        });
      });
    }
    return list;
  }, [gym.trainers, gym.staff, gym.phone, gym.email, gymName, gymId, gymPartnerId, todayFormatted]);

  // Data, Pagination & Filters
  const [employeesList, setEmployeesList] = useState(mappedGymStaff);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [isSubmittingTemp, setIsSubmittingTemp] = useState(false);
  const [isAttachingDoc, setIsAttachingDoc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [totalServerEmployees, setTotalServerEmployees] = useState(0);

  const [namePhoneSearch, setNamePhoneSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [attendanceFilter, setAttendanceFilter] = useState('ALL');
  const [staffTypeFilter, setStaffTypeFilter] = useState('ALL');
  const [selectedDateRange, setSelectedDateRange] = useState(`${todayFormatted} - ${oneYearLaterFormatted}`);
  const [isDifferentDays, setIsDifferentDays] = useState(false);
  const [dayWiseHours, setDayWiseHours] = useState({});

  // Fetch live employees from server with pagination & filters
  const loadEmployees = async (page = currentPage, limit = pageSize) => {
    try {
      setIsLoadingEmployees(true);
      const params = {
        page,
        limit,
      };
      if (gymId) params.gymId = gymId;
      if (gymPartnerId) params.gymPartnerId = gymPartnerId;
      if (namePhoneSearch) params.search = namePhoneSearch;
      if (roleFilter && roleFilter !== 'ALL') params.role = roleFilter;
      if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;
      if (staffTypeFilter && staffTypeFilter !== 'ALL') params.type = staffTypeFilter;

      const response = await apiClient.get('/employees', { params });
      const rawData = response.data?.data;
      const serverEmployees = Array.isArray(rawData) ? rawData : rawData?.employees || [];

      const totalCount = rawData?.total !== undefined ? rawData.total : (rawData?.count || serverEmployees.length);
      setTotalServerEmployees(totalCount);

      const normalized = serverEmployees.map((emp, index) => ({
        ...emp,
        key: emp._id || emp.id || emp.key || `emp-srv-${index}`,
        id: emp._id || emp.id || emp.key || `emp-srv-${index}`,
        branch: emp.branch || emp.gymName || gymName,
      }));

      if (normalized.length > 0) {
        setEmployeesList(normalized);
      } else if (mappedGymStaff.length > 0 && !namePhoneSearch && roleFilter === 'ALL' && statusFilter === 'ALL' && staffTypeFilter === 'ALL') {
        setEmployeesList(mappedGymStaff);
        setTotalServerEmployees(mappedGymStaff.length);
      } else {
        setEmployeesList([]);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
      // Graceful fallback to embedded gym trainers/staff
      if (mappedGymStaff.length > 0) {
        setEmployeesList(mappedGymStaff);
        setTotalServerEmployees(mappedGymStaff.length);
      }
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  useEffect(() => {
    loadEmployees(currentPage, pageSize);
  }, [gymId, gymPartnerId, currentPage, pageSize, namePhoneSearch, roleFilter, statusFilter, staffTypeFilter]);

  const currentMonthName = useMemo(() => {
    return new Date().toLocaleDateString('en-GB', { month: 'long' });
  }, []);

  const totalEmployeesCount = totalServerEmployees || employeesList.length;
  const activeEmployeesCount = employeesList.filter((e) => e.status === 'Active').length;
  const onLeaveEmployeesCount = employeesList.filter((e) => e.attendance === 'On Leave' || e.attendance === 'Absent').length;
  const newThisMonthCount = employeesList.filter((e) => {
    const monthShort = new Date().toLocaleDateString('en-GB', { month: 'short' });
    return e.joinDate && e.joinDate.includes(monthShort);
  }).length;

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addStep, setAddStep] = useState(1);
  const [isTempStaffModalOpen, setIsTempStaffModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const [isAttachDocModalOpen, setIsAttachDocModalOpen] = useState(false);
  const [targetDocSection, setTargetDocSection] = useState('personal'); // 'personal' | 'employment' | 'trainer'
  const [docFile, setDocFile] = useState(null);

  // Selected Records & Form Aux States
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [addedEmployeeData, setAddedEmployeeData] = useState(null);
  const [tempDateRange, setTempDateRange] = useState(null);

  // Add Employee Form States
  const [addPhoto, setAddPhoto] = useState(null);
  const [empDocs, setEmpDocs] = useState([]);
  const [personalDocs, setPersonalDocs] = useState([]);
  const [trainerCerts, setTrainerCerts] = useState([]);
  const [addPrevEmployments, setAddPrevEmployments] = useState([
    { id: 1, companyName: '', designation: '', experience: '1-2 Years' },
  ]);
  const [editPrevEmployments, setEditPrevEmployments] = useState([
    { id: 1, companyName: '', designation: '', experience: '1-2 Years' },
  ]);

  // Document Attachment Handlers
  const openAttachDocModal = (section = 'personal') => {
    setTargetDocSection(section);
    setDocFile(null);
    attachDocForm.resetFields();
    let defaultType = 'Aadhaar Card';
    if (section === 'employment') defaultType = 'Experience Letter';
    if (section === 'trainer') defaultType = 'Personal Trainer Certificate';
    attachDocForm.setFieldsValue({
      docType: defaultType,
      docNum: '',
    });
    setIsAttachDocModalOpen(true);
  };

  const handleAttachDocSubmit = async (values) => {
    setIsAttachingDoc(true);
    try {
      const fileName = docFile?.name || `${values.docType.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.pdf`;
      const addedOn = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

      if (targetDocSection === 'personal') {
        const newDoc = {
          key: `pdoc-${Date.now()}`,
          docType: values.docType,
          docNum: values.docNum || '---',
          fileName: fileName,
          addedOn: addedOn,
        };
        setPersonalDocs((prev) => [...prev, newDoc]);
        message.success(`${values.docType} attached successfully!`);
      } else if (targetDocSection === 'employment') {
        const newDoc = {
          key: `edoc-${Date.now()}`,
          docType: values.docType,
          docNum: values.docNum || '---',
          fileName: fileName,
          addedOn: addedOn,
        };
        setEmpDocs((prev) => [...prev, newDoc]);
        message.success(`${values.docType} attached to Employment Documents!`);
      } else if (targetDocSection === 'trainer') {
        const newDoc = {
          key: `tcert-${Date.now()}`,
          certType: values.docType,
          certNum: values.docNum || '---',
          fileName: fileName,
          addedOn: addedOn,
        };
        setTrainerCerts((prev) => [...prev, newDoc]);
        message.success(`${values.docType} attached to Trainer Certificates!`);
      } else if (targetDocSection === 'edit_emp') {
        const newDoc = {
          key: `editdoc-${Date.now()}`,
          docType: values.docType,
          docNum: values.docNum || '---',
          fileName: fileName,
          addedOn: addedOn,
        };
        setEditEmpDocs((prev) => [...prev, newDoc]);
        message.success(`${values.docType} attached to Employee Documents!`);
      }

      setIsAttachDocModalOpen(false);
      setDocFile(null);
      attachDocForm.resetFields();
    } finally {
      setIsAttachingDoc(false);
    }
  };

  // Temp Staff Form States
  const [tempStaffPhoto, setTempStaffPhoto] = useState(null);
  const [tempEmploymentType, setTempEmploymentType] = useState('Temporary');
  const [workingDays, setWorkingDays] = useState(['Mon', 'Wed', 'Fri', 'Sat']);

  // Employee Details / Full Edit States
  const [detailAccessType, setDetailAccessType] = useState('Employee');
  const [detailRole, setDetailRole] = useState('Trainer');
  const [detailEmpType, setDetailEmpType] = useState('Full-Time');
  const [editPhoto, setEditPhoto] = useState(null);
  const [editEmpDocs, setEditEmpDocs] = useState([]);
  const [editWorkingDays, setEditWorkingDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const [editActiveTab, setEditActiveTab] = useState('personal');
  const [showTrainerShowcaseTab, setShowTrainerShowcaseTab] = useState(true);

  // Filter Logic
  const filteredEmployees = employeesList.filter((item) => {
    const searchLower = (namePhoneSearch || '').toLowerCase();
    const matchSearch =
      !namePhoneSearch ||
      item.name?.toLowerCase().includes(searchLower) ||
      item.phone?.includes(namePhoneSearch) ||
      item.employeeId?.toLowerCase().includes(searchLower);

    const matchRole = roleFilter === 'ALL' || item.role === roleFilter;
    const matchType = staffTypeFilter === 'ALL' || (item.type || 'Full-Time') === staffTypeFilter;
    const matchStatus =
      statusFilter === 'ALL' ||
      item.status === statusFilter ||
      item.approvalStatus === statusFilter;
    const matchAttendance = attendanceFilter === 'ALL' || item.attendance === attendanceFilter;

    return matchSearch && matchRole && matchType && matchStatus && matchAttendance;
  });

  const clearFilters = () => {
    setNamePhoneSearch('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setAttendanceFilter('ALL');
    setStaffTypeFilter('ALL');
    setSelectedDateRange(`${todayFormatted} - ${oneYearLaterFormatted}`);
    message.info('Filters cleared');
  };

  const handleOpenDetails = (record) => {
    setSelectedEmployee(record);
    setDetailAccessType(record.accessType || computeAccessTypeFromRole(record.role || 'Trainer'));
    setDetailRole(record.role || 'Trainer');
    setDetailEmpType(record.type || 'Full-Time');
    setEditPhoto(record.avatar || null);
    setEditEmpDocs(Array.isArray(record.documents) ? record.documents : []);
    setEditWorkingDays(
      Array.isArray(record.schedule?.workingDays) && record.schedule.workingDays.length > 0
        ? record.schedule.workingDays
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    );
    setEditActiveTab('personal');

    if (Array.isArray(record.previousEmployments) && record.previousEmployments.length > 0) {
      setEditPrevEmployments(
        record.previousEmployments.map((pe, idx) => ({
          id: pe.id || pe._id || idx + 1,
          companyName: pe.companyName || '',
          designation: pe.designation || '',
          experience: pe.experience || '1-2 Years',
        }))
      );
    } else if (record.previousCompany || record.previousDesignation || record.prevCompany) {
      setEditPrevEmployments([
        {
          id: 1,
          companyName: record.previousCompany || record.prevCompany || '',
          designation: record.previousDesignation || record.prevDesignation || '',
          experience: record.previousExp || record.prevExp || '1-2 Years',
        },
      ]);
    } else {
      setEditPrevEmployments([{ id: 1, companyName: '', designation: '', experience: '1-2 Years' }]);
    }

    const rawPhone = String(record.phone || '');
    const cleanPhone = rawPhone.replace(/^\+91\s*/, '').replace(/^\+\d+\s*/, '');
    const countryCode = rawPhone.startsWith('+') ? rawPhone.split(' ')[0] : '+91';

    editEmployeeForm.setFieldsValue({
      name: record.name || '',
      phone: cleanPhone,
      countryCode: countryCode || '+91',
      email: record.email || '',
      role: record.role || 'Trainer',
      accessType: record.accessType || 'Employee',
      gender: record.gender || 'Male',
      type: record.type || 'Full-Time',
      status: record.status || 'Active',
      joinDate: record.joinDate || '',
      specialty: record.specialty || '',
      experienceYears: record.experienceYears || 1,
      prevCompany: record.previousCompany || record.prevCompany || '',
      prevDesignation: record.previousDesignation || record.prevDesignation || '',
      prevExp: record.previousExp || record.prevExp || '1-2 Years',
      workingTimeStart: record.schedule?.workingTimeStart || '06:00 AM',
      workingTimeEnd: record.schedule?.workingTimeEnd || '02:00 PM',
      payType: record.compensation?.payType || 'Monthly',
      payAmount: record.compensation?.payAmount || record.salary || 25000,
      trainerMonthly: record.trainerPricing?.monthly ?? (typeof record.personalTrainingFee === 'number' ? record.personalTrainingFee : (record.personalTrainingFee?.monthly ?? 0)),
      trainerQuarterly: record.trainerPricing?.quarterly ?? (record.personalTrainingFee?.quarterly ?? 0),
      trainerHalfYearly: record.trainerPricing?.halfYearly ?? (record.personalTrainingFee?.halfYearly ?? 0),
      trainerAnnual: record.trainerPricing?.annual ?? (record.personalTrainingFee?.annual ?? 0),
      trainerSingleSession: record.trainerPricing?.singleSession ?? (record.personalTrainingFee?.singleSession ?? 0),
      emergencyName: record.emergencyContact?.name || '',
      emergencyRel: record.emergencyContact?.relationship || '',
      emergencyPhone: record.emergencyContact?.phone || '',
      notes: record.notes || '',
      description: record.description || record.aboutMe || '',
      servicesOffered: Array.isArray(record.servicesOffered) ? record.servicesOffered : [],
      experience: record.experience || (record.experienceYears ? `${record.experienceYears}+ Years` : ''),
      certifications: Array.isArray(record.certifications) ? record.certifications : [],
      languages: Array.isArray(record.languages) ? record.languages : [],
      requireStaffApproval: record.managerPermissions?.requireStaffApproval ?? true,
      requirePlanSwitchApproval: record.managerPermissions?.requirePlanSwitchApproval ?? true,
      requireCancellationApproval: record.managerPermissions?.requireCancellationApproval ?? true,
      requireProfileEditApproval: record.managerPermissions?.requireProfileEditApproval ?? true,
    });

    const empType = (record.type || '').toLowerCase();
    const isTempOrPart = empType === 'temporary' || empType === 'part-time' || empType === 'parttime';
    const hasShowcaseData = Boolean(
      record.description?.trim() ||
      record.aboutMe?.trim() ||
      (Array.isArray(record.servicesOffered) && record.servicesOffered.length > 0) ||
      (Array.isArray(record.certifications) && record.certifications.length > 0)
    );
    setShowTrainerShowcaseTab(!isTempOrPart || hasShowcaseData);

    setIsDetailsModalOpen(true);
  };

  const handleSaveDetails = async (values) => {
    if (!selectedEmployee) return;
    const targetId = selectedEmployee.id || selectedEmployee._id || selectedEmployee.key;
    setIsSavingDetails(true);

    const formattedPhone = values.phone
      ? (values.phone.startsWith('+') ? values.phone : `${values.countryCode || '+91'} ${values.phone.trim()}`)
      : selectedEmployee.phone;

    const updatePayload = {
      gymId,
      gymPartnerId,
      gymName,
      name: values.name ? values.name.trim() : (selectedEmployee.name || ''),
      phone: formattedPhone,
      email: values.email ? values.email.trim() : (selectedEmployee.email || ''),
      role: detailRole || values.role || selectedEmployee.role || 'Trainer',
      accessType: computeAccessTypeFromRole(detailRole || values.role || selectedEmployee.role || 'Trainer'),
      gender: values.gender || selectedEmployee.gender || 'All',
      type: values.type || selectedEmployee.type || 'Full-Time',
      status: values.status || selectedEmployee.status || 'Active',
      avatar: editPhoto !== null ? editPhoto : (selectedEmployee.avatar || ''),
      specialty: values.specialty !== undefined ? values.specialty.trim() : (selectedEmployee.specialty || ''),
      description: values.description || values.aboutMe || selectedEmployee.description || '',
      aboutMe: values.aboutMe || values.description || selectedEmployee.aboutMe || '',
      servicesOffered: Array.isArray(values.servicesOffered) ? values.servicesOffered : (selectedEmployee.servicesOffered || []),
      experience: values.experience || (values.experienceYears ? `${values.experienceYears}+ Years` : (selectedEmployee.experience || '')),
      certifications: Array.isArray(values.certifications) ? values.certifications : (selectedEmployee.certifications || []),
      languages: Array.isArray(values.languages) ? values.languages : (selectedEmployee.languages || []),
      experienceYears: values.experienceYears !== undefined
        ? (Number(values.experienceYears) || 0)
        : (Number(selectedEmployee.experienceYears) || 1),
      previousEmployments: editPrevEmployments
        .filter((pe) => pe.companyName?.trim() || pe.designation?.trim())
        .map((pe) => ({
          companyName: pe.companyName?.trim() || '',
          designation: pe.designation?.trim() || '',
          experience: pe.experience || '1-2 Years',
        })),
      previousCompany: editPrevEmployments[0]?.companyName?.trim() || (values.prevCompany !== undefined ? values.prevCompany.trim() : (selectedEmployee.previousCompany || '')),
      previousDesignation: editPrevEmployments[0]?.designation?.trim() || (values.prevDesignation !== undefined ? values.prevDesignation.trim() : (selectedEmployee.previousDesignation || '')),
      previousExp: editPrevEmployments[0]?.experience || (values.prevExp !== undefined ? values.prevExp.trim() : (selectedEmployee.previousExp || '')),
      schedule: {
        workingDays: editWorkingDays && editWorkingDays.length > 0
          ? editWorkingDays
          : (Array.isArray(selectedEmployee.schedule?.workingDays) ? selectedEmployee.schedule.workingDays : []),
        workingTimeStart: values.workingTimeStart || selectedEmployee.schedule?.workingTimeStart || '09:00 AM',
        workingTimeEnd: values.workingTimeEnd || selectedEmployee.schedule?.workingTimeEnd || '06:00 PM',
        isDifferentDays: selectedEmployee.schedule?.isDifferentDays || false,
      },
      compensation: {
        payType: values.payType || selectedEmployee.compensation?.payType || 'Monthly',
        payAmount: values.payAmount !== undefined && values.payAmount !== null && values.payAmount !== ''
          ? Number(values.payAmount)
          : (Number(selectedEmployee.compensation?.payAmount) || 0),
        payFreq: (values.payType || selectedEmployee.compensation?.payType) === 'Monthly'
          ? 'Monthly'
          : (selectedEmployee.compensation?.payFreq || 'Monthly'),
      },
      trainerPricing: {
        monthly: values.trainerMonthly !== undefined && values.trainerMonthly !== null && values.trainerMonthly !== ''
          ? Number(String(values.trainerMonthly).replace(/,/g, ''))
          : (Number(selectedEmployee.trainerPricing?.monthly) || 0),
        quarterly: values.trainerQuarterly !== undefined && values.trainerQuarterly !== null && values.trainerQuarterly !== ''
          ? Number(String(values.trainerQuarterly).replace(/,/g, ''))
          : (Number(selectedEmployee.trainerPricing?.quarterly) || 0),
        halfYearly: values.trainerHalfYearly !== undefined && values.trainerHalfYearly !== null && values.trainerHalfYearly !== ''
          ? Number(String(values.trainerHalfYearly).replace(/,/g, ''))
          : (Number(selectedEmployee.trainerPricing?.halfYearly) || 0),
        annual: values.trainerAnnual !== undefined && values.trainerAnnual !== null && values.trainerAnnual !== ''
          ? Number(String(values.trainerAnnual).replace(/,/g, ''))
          : (Number(selectedEmployee.trainerPricing?.annual) || 0),
        singleSession: values.trainerSingleSession !== undefined && values.trainerSingleSession !== null && values.trainerSingleSession !== ''
          ? Number(String(values.trainerSingleSession).replace(/,/g, ''))
          : (Number(selectedEmployee.trainerPricing?.singleSession) || 0),
      },
      personalTrainingFee: values.trainerMonthly !== undefined && values.trainerMonthly !== null && values.trainerMonthly !== ''
        ? Number(String(values.trainerMonthly).replace(/,/g, ''))
        : (Number(selectedEmployee.trainerPricing?.monthly) || Number(selectedEmployee.personalTrainingFee) || 0),
      emergencyContact: {
        name: values.emergencyName !== undefined ? values.emergencyName.trim() : (selectedEmployee.emergencyContact?.name || ''),
        relationship: values.emergencyRel !== undefined ? values.emergencyRel.trim() : (selectedEmployee.emergencyContact?.relationship || ''),
        phone: values.emergencyPhone !== undefined ? values.emergencyPhone.trim() : (selectedEmployee.emergencyContact?.phone || ''),
      },
      documents: editEmpDocs && editEmpDocs.length > 0 ? editEmpDocs : (selectedEmployee.documents || []),
      notes: values.notes !== undefined ? values.notes : (selectedEmployee.notes || ''),
      managerPermissions: {
        requireStaffApproval: values.requireStaffApproval !== undefined ? values.requireStaffApproval : (selectedEmployee.managerPermissions?.requireStaffApproval ?? true),
        requirePlanSwitchApproval: values.requirePlanSwitchApproval !== undefined ? values.requirePlanSwitchApproval : (selectedEmployee.managerPermissions?.requirePlanSwitchApproval ?? true),
        requireCancellationApproval: values.requireCancellationApproval !== undefined ? values.requireCancellationApproval : (selectedEmployee.managerPermissions?.requireCancellationApproval ?? true),
        requireProfileEditApproval: values.requireProfileEditApproval !== undefined ? values.requireProfileEditApproval : (selectedEmployee.managerPermissions?.requireProfileEditApproval ?? true),
      },
    };

    try {
      let finalStatus = 'Approved';
      if (targetId && !targetId.startsWith('tr-') && !targetId.startsWith('staff-')) {
        const res = await apiClient.put(`/employees/${targetId}`, updatePayload);
        if (res.data?.approvalStatus) {
          finalStatus = res.data.approvalStatus;
        }
      }
      const updated = employeesList.map((emp) => {
        if (emp.key === selectedEmployee.key || emp.id === targetId || emp._id === targetId) {
          return {
            ...emp,
            ...updatePayload,
            approvalStatus: finalStatus,
          };
        }
        return emp;
      });
      setEmployeesList(updated);
      setIsDetailsModalOpen(false);
      message.success(
        finalStatus === 'Approved'
          ? `All updates applied directly for ${updatePayload.name}.`
          : `All updates submitted for ${updatePayload.name}. Pending Gym Admin approval.`
      );
      await loadEmployees(currentPage, pageSize);
    } catch {
      message.success(`Changes saved locally.`);
      setIsDetailsModalOpen(false);
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedEmployee) return;
    const targetId = selectedEmployee.id || selectedEmployee._id || selectedEmployee.key;
    setIsDeactivating(true);
    try {
      if (targetId && !targetId.startsWith('tr-') && !targetId.startsWith('staff-')) {
        await apiClient.delete(`/employees/${targetId}`);
      }
      const updated = employeesList.map((emp) =>
        emp.key === selectedEmployee.key || emp.id === targetId
          ? { ...emp, status: 'Inactive', attendance: '—', approvalStatus: 'Pending Approval' }
          : emp
      );
      setEmployeesList(updated);
      setIsDetailsModalOpen(false);
      message.warning(`Deactivation request for ${selectedEmployee.name} sent to Super Admin.`);
    } catch {
      message.warning(`Employee ${selectedEmployee.name} marked for deactivation.`);
      setIsDetailsModalOpen(false);
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReviewApproval = async (employeeId, action, reason = '') => {
    try {
      await apiClient.put(`/employees/${employeeId}/approval`, {
        action,
        rejectionReason: reason,
      });
      message.success(action === 'approve' ? 'Employee approved successfully!' : 'Employee approval rejected.');
      await loadEmployees(currentPage, pageSize);
    } catch (err) {
      message.error(err.response?.data?.message || `Failed to ${action} employee.`);
    }
  };

  const handleNextToAddStep2 = async () => {
    try {
      await addEmployeeForm.validateFields(['name', 'phone', 'email', 'role']);
      setAddStep(2);
    } catch {
      message.warning('Please complete all required fields on Page 1 before proceeding.');
    }
  };

  const handleCompleteAddEmployee = async (values) => {
    setIsSubmittingAdd(true);
    const allFormValues = { ...addEmployeeForm.getFieldsValue(true), ...values };

    const activeGymId = gymId || user?.gym?._id || user?.gym?.id || user?.gymId || user?.id || user?.userId;
    const activeGymPartnerId = gymPartnerId || user?.gym?.partnerId || user?.partnerId || 'GYM1';
    const activeGymName = gymName || user?.gym?.name || 'Main Facility';

    const cleanDocs = (personalDocs || []).concat(empDocs || []).map((doc) => ({
      docType: doc.docType || 'Document',
      docNum: doc.docNum || '',
      fileName: doc.fileName || 'document.pdf',
      fileData: doc.fileData || '',
      addedOn: doc.addedOn || todayFormatted,
    }));

    const cleanCerts = (trainerCerts || []).map((cert) => ({
      certType: cert.certType || cert.docType || 'Certification',
      certNum: cert.certNum || cert.docNum || '',
      fileName: cert.fileName || 'certificate.pdf',
      fileData: cert.fileData || '',
      addedOn: cert.addedOn || todayFormatted,
    }));

    const newEmpPayload = {
      gymId: activeGymId,
      gymPartnerId: activeGymPartnerId,
      gymName: activeGymName,
      name: allFormValues.name?.trim() || 'New Staff',
      role: allFormValues.role || 'Trainer',
      phone: `${allFormValues.countryCode || '+91'} ${allFormValues.phone || ''}`.trim(),
      email: allFormValues.email?.trim() || `${allFormValues.name?.toLowerCase().replace(/\s+/g, '') || 'staff'}@gymezy.com`,
      avatar:
        addPhoto ||
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop',
      joinDate: todayFormatted,
      status: 'Active',
      attendance: 'Present',
      accessType: computeAccessTypeFromRole(allFormValues.role),
      managerPermissions: {
        requireStaffApproval: allFormValues.requireStaffApproval ?? true,
        requirePlanSwitchApproval: allFormValues.requirePlanSwitchApproval ?? true,
        requireCancellationApproval: allFormValues.requireCancellationApproval ?? true,
        requireProfileEditApproval: allFormValues.requireProfileEditApproval ?? true,
      },
      previousEmployments: addPrevEmployments
        .filter((pe) => pe.companyName?.trim() || pe.designation?.trim())
        .map((pe) => ({
          companyName: pe.companyName?.trim() || '',
          designation: pe.designation?.trim() || '',
          experience: pe.experience || '1-2 Years',
        })),
      previousCompany: addPrevEmployments[0]?.companyName?.trim() || allFormValues.prevCompany || '',
      previousDesignation: addPrevEmployments[0]?.designation?.trim() || allFormValues.prevDesignation || '',
      previousExp: addPrevEmployments[0]?.experience || allFormValues.prevExp || '',
      description: allFormValues.description || allFormValues.aboutMe || '',
      aboutMe: allFormValues.description || allFormValues.aboutMe || '',
      servicesOffered: Array.isArray(allFormValues.servicesOffered) ? allFormValues.servicesOffered : [],
      experience: allFormValues.experience || allFormValues.prevExp || '',
      certifications: Array.isArray(allFormValues.certifications) ? allFormValues.certifications : [],
      languages: Array.isArray(allFormValues.languages) ? allFormValues.languages : [],
      emergencyContact: {
        name: allFormValues.emergencyName || '',
        relationship: allFormValues.emergencyRel || '',
        phone: allFormValues.emergencyPhone || '',
      },
      documents: cleanDocs,
      trainerCerts: cleanCerts,
    };

    try {
      const response = await apiClient.post('/employees', newEmpPayload);
      const savedEmp = response.data?.data || { ...newEmpPayload, key: Date.now().toString() };
      const updated = [savedEmp, ...employeesList.filter((e) => (e.id || e._id) !== (savedEmp.id || savedEmp._id))];
      setEmployeesList(updated);
      setAddedEmployeeData(savedEmp);
      if (savedEmp.approvalStatus === 'Approved') {
        message.success(`Employee "${savedEmp.name}" added successfully!`);
      } else {
        message.success(`Employee "${savedEmp.name}" submitted for Gym Admin approval!`);
      }

      setIsAddModalOpen(false);
      setAddStep(1);
      addEmployeeForm.resetFields();
      setAddPhoto(null);
      setPersonalDocs([]);
      setEmpDocs([]);
      setTrainerCerts([]);
      setAddPrevEmployments([{ id: 1, companyName: '', designation: '', experience: '1-2 Years' }]);

      // Trigger Success Confirmation Modal & Canvas Confetti
      setIsSuccessModalOpen(true);
      triggerConfettiPopper();

      if (onAddEmployee) onAddEmployee(newEmpPayload);
    } catch (err) {
      console.error('Failed to create employee:', err);
      message.error(err?.response?.data?.message || err.message || 'Failed to save employee to database.');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const handleAddTempStaffSubmit = async (values) => {
    setIsSubmittingTemp(true);
    const activeGymId = gymId || user?.gym?._id || user?.gym?.id || user?.gymId || user?.id || user?.userId;
    const activeGymPartnerId = gymPartnerId || user?.gym?.partnerId || user?.partnerId || 'GYM1';
    const activeGymName = gymName || user?.gym?.name || 'Main Facility';

    const dayWiseArray = isDifferentDays
      ? workingDays.map((d) => ({
          day: d,
          startTime: dayWiseHours[d]?.startTime ? dayWiseHours[d].startTime.format('hh:mm A') : '09:00 AM',
          endTime: dayWiseHours[d]?.endTime ? dayWiseHours[d].endTime.format('hh:mm A') : '06:00 PM',
        }))
      : [];

    const newStaffPayload = {
      gymId: activeGymId,
      gymPartnerId: activeGymPartnerId,
      gymName: activeGymName,
      name: values.name?.trim(),
      role: values.role || 'Trainer',
      phone: `${values.countryCode || '+91'} ${values.phone || ''}`.trim(),
      email: values.email?.trim() || `${values.name?.toLowerCase().replace(/\s+/g, '') || 'staff'}@gymezy.com`,
      avatar:
        tempStaffPhoto ||
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop',
      joinDate: todayFormatted,
      status: 'Active',
      attendance: 'Present',
      accessType: 'Employee',
      approvalStatus: 'Approved',
      pendingAction: 'NONE',
      type: tempEmploymentType || 'Temporary',
      schedule: {
        workingDays,
        workingTimeStart: values.workingTimeStart ? values.workingTimeStart.format('hh:mm A') : '09:00 AM',
        workingTimeEnd: values.workingTimeEnd ? values.workingTimeEnd.format('hh:mm A') : '06:00 PM',
        isDifferentDays,
        dayWiseHours: dayWiseArray,
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : '',
        endDate: values.endDate ? values.endDate.format('YYYY-MM-DD') : '',
      },
      compensation: {
        payType: values.payType || 'Hourly',
        payAmount: Number(values.payAmount) || 500,
        payFreq: values.payFreq || 'Weekly',
      },
      notes: values.notes || '',
    };

    try {
      const response = await apiClient.post('/employees', newStaffPayload);
      const savedStaff = response.data?.data || { ...newStaffPayload, key: Date.now().toString() };
      const updated = [savedStaff, ...employeesList.filter((e) => (e.id || e._id) !== (savedStaff.id || savedStaff._id))];
      setEmployeesList(updated);
      setAddedEmployeeData(savedStaff);
      message.success(`Staff "${savedStaff.name}" added successfully.`);

      setIsTempStaffModalOpen(false);
      tempStaffForm.resetFields();
      setTempStaffPhoto(null);
      setIsDifferentDays(false);
      setDayWiseHours({});

      setIsSuccessModalOpen(true);
      triggerConfettiPopper();

      if (onAddEmployee) onAddEmployee(newStaffPayload);
    } catch (err) {
      console.error('Failed to create staff:', err);
      message.error(err?.response?.data?.message || err.message || 'Failed to save staff to database.');
    } finally {
      setIsSubmittingTemp(false);
    }
  };

  // Date Range Quick Menu
  const dateRangeMenu = {
    items: [
      { key: 'today', label: `Today (${todayFormatted})`, onClick: () => setSelectedDateRange(`${todayFormatted} - ${todayFormatted}`) },
      { key: 'this_year', label: `Current Year (${todayFormatted} - ${oneYearLaterFormatted})`, onClick: () => setSelectedDateRange(`${todayFormatted} - ${oneYearLaterFormatted}`) },
      { type: 'divider' },
      {
        key: 'custom',
        label: 'Custom Date Range...',
        icon: <CalendarOutlined style={{ color: 'var(--color-primary)' }} />,
        onClick: () => setIsDateRangeModalOpen(true),
      },
    ],
  };

  const getRoleTagColor = (role) => {
    switch (role) {
      case 'Front Desk Manager':
        return { bg: isDarkMode ? 'rgba(114, 46, 209, 0.2)' : '#f3effe', color: isDarkMode ? '#b37feb' : '#722ed1' };
      case 'Trainer':
        return { bg: isDarkMode ? 'rgba(22, 119, 255, 0.2)' : '#e6f4ff', color: '#1677ff' };
      case 'Customer Support':
        return { bg: isDarkMode ? 'rgba(250, 140, 22, 0.2)' : '#fef4e8', color: '#fa8c16' };
      case 'Housekeeping':
        return { bg: isDarkMode ? 'rgba(114, 46, 209, 0.2)' : '#f3effe', color: isDarkMode ? '#b37feb' : '#722ed1' };
      case 'Maintenance':
        return { bg: isDarkMode ? 'rgba(250, 140, 22, 0.2)' : '#fef4e8', color: '#fa8c16' };
      case 'Nutritionist':
        return { bg: isDarkMode ? 'rgba(0, 191, 98, 0.2)' : '#eaf8ef', color: '#00bf62' };
      case 'Security':
        return { bg: isDarkMode ? '#1e1e1e' : '#f1f5f9', color: isDarkMode ? '#aaaaaa' : '#64748b' };
      default:
        return { bg: isDarkMode ? '#1e1e1e' : '#f1f5f9', color: isDarkMode ? '#cccccc' : '#475569' };
    }
  };

  const columns = [
    {
      title: 'Employee ID',
      dataIndex: 'employeeId',
      key: 'employeeId',
      render: (text) => (
        <span style={{ fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', fontSize: 13 }}>
          {text}
        </span>
      ),
    },
    {
      title: 'Employee Name',
      key: 'employeeName',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar src={record.avatar} size={38} style={{ flexShrink: 0 }} />
          <div style={{ fontWeight: 650, color: isDarkMode ? '#ffffff' : '#0f172a', fontSize: 13 }}>
            {record.name}
          </div>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => {
        const style = getRoleTagColor(role);
        return (
          <Tag
            style={{
              backgroundColor: style.bg,
              color: style.color,
              border: 'none',
              borderRadius: 'var(--radius-base)',
              fontWeight: 600,
              fontSize: 11,
              padding: '2px 10px',
            }}
          >
            {role}
          </Tag>
        );
      },
    },
    {
      title: 'Employment Type',
      dataIndex: 'type',
      key: 'type',
      render: (type, record) => {
        const empType = type || 'Full-Time';
        if (empType === 'Temporary') {
          return (
            <div>
              <Tag
                style={{
                  backgroundColor: isDarkMode ? 'rgba(250, 140, 22, 0.2)' : '#fff7e6',
                  color: '#d46b08',
                  border: '1px solid #ffd591',
                  borderRadius: 'var(--radius-base)',
                  fontWeight: 650,
                  fontSize: 11,
                  padding: '2px 8px',
                }}
              >
                Temporary
              </Tag>
              {record.schedule?.endDate && (
                <div style={{ fontSize: 10.5, color: isDarkMode ? '#888888' : '#8c8c8c', marginTop: 2 }}>
                  Until {record.schedule.endDate}
                </div>
              )}
            </div>
          );
        }
        if (empType === 'Part-Time') {
          return (
            <div>
              <Tag
                style={{
                  backgroundColor: isDarkMode ? 'rgba(19, 194, 194, 0.2)' : '#e6fffb',
                  color: '#08979c',
                  border: '1px solid #87e8de',
                  borderRadius: 'var(--radius-base)',
                  fontWeight: 650,
                  fontSize: 11,
                  padding: '2px 8px',
                }}
              >
                Part-Time
              </Tag>
              {Array.isArray(record.schedule?.workingDays) && record.schedule.workingDays.length > 0 && (
                <div style={{ fontSize: 10.5, color: isDarkMode ? '#888888' : '#8c8c8c', marginTop: 2 }}>
                  {record.schedule.workingDays.slice(0, 3).join(', ')}{record.schedule.workingDays.length > 3 ? '...' : ''}
                </div>
              )}
            </div>
          );
        }
        return (
          <Tag
            style={{
              backgroundColor: isDarkMode ? 'rgba(22, 119, 255, 0.15)' : '#e6f4ff',
              color: '#0958d9',
              border: '1px solid #91caff',
              borderRadius: 'var(--radius-base)',
              fontWeight: 650,
              fontSize: 11,
              padding: '2px 8px',
            }}
          >
            Full-Time
          </Tag>
        );
      },
    },
    {
      title: 'Phone Number',
      dataIndex: 'phone',
      key: 'phone',
      render: (text) => (
        <span style={{ color: isDarkMode ? '#cccccc' : '#334155', fontSize: 13, fontWeight: 500 }}>
          {text}
        </span>
      ),
    },
    {
      title: 'Join Date',
      dataIndex: 'joinDate',
      key: 'joinDate',
      render: (text) => (
        <span style={{ fontSize: 13, color: isDarkMode ? '#ffffff' : '#0f172a', fontWeight: 500 }}>
          {text}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        if (status === 'Active') {
          return (
            <Tag
              style={{
                backgroundColor: isDarkMode ? 'rgba(0, 191, 98, 0.15)' : '#eaf8ef',
                color: '#00bf62',
                border: 'none',
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                fontSize: 11,
                padding: '2px 10px',
              }}
            >
              Active
            </Tag>
          );
        }
        if (status === 'On Leave') {
          return (
            <Tag
              style={{
                backgroundColor: isDarkMode ? 'rgba(250, 140, 22, 0.15)' : '#fef4e8',
                color: '#fa8c16',
                border: 'none',
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                fontSize: 11,
                padding: '2px 10px',
              }}
            >
              On Leave
            </Tag>
          );
        }
        return (
          <Tag
            style={{
              backgroundColor: isDarkMode ? '#1e1e1e' : '#f1f5f9',
              color: isDarkMode ? '#888888' : '#64748b',
              border: 'none',
              borderRadius: 'var(--radius-base)',
              fontWeight: 600,
              fontSize: 11,
              padding: '2px 10px',
            }}
          >
            Inactive
          </Tag>
        );
      },
    },
    {
      title: 'Approval Status',
      dataIndex: 'approvalStatus',
      key: 'approvalStatus',
      render: (approvalStatus, record) => {
        const status = approvalStatus || 'Approved';
        if (status === 'Approved') {
          return (
            <Tag
              color="success"
              style={{
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                fontSize: 11,
                padding: '2px 10px',
              }}
            >
              Approved
            </Tag>
          );
        }
        if (status === 'Pending Approval') {
          return (
            <Tag
              color="warning"
              style={{
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                fontSize: 11,
                padding: '2px 10px',
              }}
            >
              Pending Approval {record.pendingAction ? `(${record.pendingAction})` : ''}
            </Tag>
          );
        }
        if (status === 'Rejected') {
          return (
            <Tag
              color="error"
              style={{
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                fontSize: 11,
                padding: '2px 10px',
              }}
            >
              Rejected
            </Tag>
          );
        }
        return <Tag>{status}</Tag>;
      },
    },
    {
      title: "Today's Attendance",
      dataIndex: 'attendance',
      key: 'attendance',
      render: (att) => {
        if (att === 'Present') {
          return (
            <Tag
              style={{
                backgroundColor: isDarkMode ? 'rgba(0, 191, 98, 0.15)' : '#eaf8ef',
                color: '#00bf62',
                border: 'none',
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                fontSize: 11,
                padding: '2px 10px',
              }}
            >
              Present
            </Tag>
          );
        }
        if (att === 'Absent') {
          return (
            <Tag
              style={{
                backgroundColor: isDarkMode ? 'rgba(225, 29, 72, 0.15)' : '#fdeeed',
                color: '#e11d48',
                border: 'none',
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                fontSize: 11,
                padding: '2px 10px',
              }}
            >
              Absent
            </Tag>
          );
        }
        if (att === 'On Leave') {
          return (
            <Tag
              style={{
                backgroundColor: isDarkMode ? 'rgba(250, 140, 22, 0.15)' : '#fef4e8',
                color: '#fa8c16',
                border: 'none',
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                fontSize: 11,
                padding: '2px 10px',
              }}
            >
              On Leave
            </Tag>
          );
        }
        return <span style={{ color: isDarkMode ? '#666666' : '#94a3b8' }}>—</span>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 170,
      render: (_, record) => {
        const isPendingApproval = record.approvalStatus === 'Pending Approval';
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {isPendingApproval ? (
              <>
                <Button
                  type="primary"
                  size="small"
                  style={{
                    backgroundColor: '#10b981',
                    borderColor: '#10b981',
                    borderRadius: 'var(--radius-base)',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                  onClick={() => handleReviewApproval(record.id || record._id, 'approve')}
                >
                  Approve
                </Button>
                <Button
                  danger
                  size="small"
                  style={{
                    borderRadius: 'var(--radius-base)',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                  onClick={() => handleReviewApproval(record.id || record._id, 'reject', 'Rejected by Gym Admin')}
                >
                  Reject
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="text"
                  size="small"
                  onClick={() => handleOpenDetails(record)}
                  icon={<EyeOutlined style={{ color: '#722ed1', fontSize: 15 }} />}
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(114, 46, 209, 0.15)' : '#f3effe',
                    borderRadius: 'var(--radius-base)',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
                <Button
                  type="text"
                  size="small"
                  onClick={() => handleOpenDetails(record)}
                  icon={<EditOutlined style={{ color: '#722ed1', fontSize: 15 }} />}
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(114, 46, 209, 0.15)' : '#f3effe',
                    borderRadius: 'var(--radius-base)',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
              </>
            )}
            <Dropdown
              menu={{
                items: [
                  { key: 'view', label: 'View Profile', icon: <EyeOutlined />, onClick: () => handleOpenDetails(record) },
                  { key: 'edit', label: 'Edit Permissions', icon: <EditOutlined />, onClick: () => handleOpenDetails(record) },
                  {
                    key: 'deactivate',
                    label: 'Deactivate',
                    icon: <DeleteOutlined style={{ color: '#ef4444' }} />,
                    onClick: () => {
                      setEmployeesList(employeesList.map((e) => (e.key === record.key ? { ...e, status: 'Inactive', attendance: '—' } : e)));
                      message.warning(`Employee ${record.name} deactivated.`);
                    },
                  },
                ],
              }}
              trigger={['click']}
            >
              <Button
                type="text"
                size="small"
                icon={<MoreOutlined style={{ fontSize: 16, color: isDarkMode ? '#888888' : '#64748b' }} />}
                style={{ width: 28, height: 32 }}
              />
            </Dropdown>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0, color: isDarkMode ? '#ffffff' : '#0f172a', fontWeight: 700 }}>
            Employee Management
          </Title>
          <Text style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 14 }}>
            Manage your gym staff, roles, attendance and permissions.
          </Text>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            icon={<ReloadOutlined spin={isLoadingEmployees} />}
            loading={isLoadingEmployees}
            onClick={() => loadEmployees(currentPage, pageSize)}
            style={{
              borderRadius: 'var(--radius-base)',
              fontWeight: 600,
              height: 42,
              padding: '0 16px',
              borderColor: isDarkMode ? '#333333' : '#d0d7de',
              color: isDarkMode ? '#ffffff' : '#0f172a',
              backgroundColor: isDarkMode ? '#141414' : '#ffffff',
            }}
          >
            Refresh
          </Button>
          <Button
            onClick={() => setIsTempStaffModalOpen(true)}
            style={{
              borderRadius: 'var(--radius-base)',
              fontWeight: 600,
              height: 42,
              padding: '0 16px',
              borderColor: isDarkMode ? '#333333' : '#d0d7de',
              color: isDarkMode ? '#ffffff' : '#0f172a',
              backgroundColor: isDarkMode ? '#141414' : '#ffffff',
            }}
            icon={<UsergroupAddOutlined />}
          >
            Add Temp / Part-Time
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setAddStep(1);
              setIsAddModalOpen(true);
            }}
            style={{
              backgroundColor: 'var(--color-primary)',
              borderColor: 'var(--color-primary)',
              borderRadius: 'var(--radius-base)',
              fontWeight: 600,
              height: 42,
              padding: '0 20px',
              boxShadow: isDarkMode ? 'none' : '0 2px 6px rgba(0, 56, 130, 0.2)',
            }}
          >
            Add New Employee
          </Button>
        </div>
      </div>

      {/* 4 SUMMARY STAT CARDS */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Card 1: Total Employees */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
              boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
            }}
            styles={{ body: { padding: '20px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  backgroundColor: isDarkMode ? 'rgba(114, 46, 209, 0.2)' : '#f3effe',
                  color: isDarkMode ? '#b37feb' : '#722ed1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                <TeamOutlined />
              </div>
              <div>
                <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 500 }}>
                  Total Employees
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, marginTop: 2 }}>
                  {totalEmployeesCount}
                </div>
                <div style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <TeamOutlined /> All Staff
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* Card 2: Active Employees */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
              boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
            }}
            styles={{ body: { padding: '20px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  backgroundColor: isDarkMode ? 'rgba(0, 191, 98, 0.2)' : '#eaf8ef',
                  color: '#00bf62',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                <UserOutlined />
              </div>
              <div>
                <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 500 }}>
                  Active Employees
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, marginTop: 2 }}>
                  {activeEmployeesCount}
                </div>
                <div style={{ fontSize: 12, color: '#00bf62', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <span style={{ fontSize: 8 }}>●</span> Currently Working
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* Card 3: On Leave Today */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
              boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
            }}
            styles={{ body: { padding: '20px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  backgroundColor: isDarkMode ? 'rgba(250, 140, 22, 0.2)' : '#fef4e8',
                  color: '#fa8c16',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                <CalendarOutlined />
              </div>
              <div>
                <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 500 }}>
                  On Leave Today
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, marginTop: 2 }}>
                  {onLeaveEmployeesCount}
                </div>
                <div style={{ fontSize: 12, color: '#fa8c16', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <CalendarOutlined /> On Leave
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* Card 4: New This Month */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
              boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
            }}
            styles={{ body: { padding: '20px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  backgroundColor: isDarkMode ? 'rgba(22, 119, 255, 0.2)' : '#edf4fe',
                  color: '#1677ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                <UserAddOutlined />
              </div>
              <div>
                <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 500 }}>
                  New This Month
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, marginTop: 2 }}>
                  {newThisMonthCount}
                </div>
                <div style={{ fontSize: 12, color: '#1677ff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  Joined in {currentMonthName}
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* FILTER & SEARCH CARD */}
      <Card
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-color)',
          borderRadius: 'var(--radius-base)',
          marginBottom: 24,
          boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
        }}
        styles={{ body: { padding: '20px 24px' } }}
      >
        <Row gutter={[16, 16]} align="bottom">
          {/* Search by Name / Phone */}
          <Col xs={24} sm={12} lg={6}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#475569', marginBottom: 6 }}>
              Search by Name / Phone
            </div>
            <Input
              prefix={<SearchOutlined style={{ color: isDarkMode ? '#888888' : '#94a3b8' }} />}
              placeholder="Enter name or phone number"
              value={namePhoneSearch}
              onChange={(e) => setNamePhoneSearch(e.target.value)}
              allowClear
              style={{ height: 42, borderRadius: 'var(--radius-base)' }}
            />
          </Col>

          {/* Role */}
          <Col xs={24} sm={12} lg={4}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#475569', marginBottom: 6 }}>
              Role
            </div>
            <Select
              value={roleFilter}
              onChange={setRoleFilter}
              style={{ width: '100%', height: 42 }}
            >
              <Option value="ALL">All Roles</Option>
              <Option value="Front Desk Manager">Front Desk Manager</Option>
              <Option value="Trainer">Trainer</Option>
              <Option value="Customer Support">Customer Support</Option>
              <Option value="Housekeeping">Housekeeping</Option>
              <Option value="Maintenance">Maintenance</Option>
              <Option value="Nutritionist">Nutritionist</Option>
              <Option value="Security">Security</Option>
            </Select>
          </Col>

          {/* Status */}
          <Col xs={24} sm={12} lg={4}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#475569', marginBottom: 6 }}>
              Status
            </div>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: '100%', height: 42 }}
            >
              <Option value="ALL">All Status</Option>
              <Option value="Active">Active</Option>
              <Option value="On Leave">On Leave</Option>
              <Option value="Inactive">Inactive</Option>
            </Select>
          </Col>

          {/* Attendance */}
          <Col xs={24} sm={12} lg={4}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#475569', marginBottom: 6 }}>
              Attendance
            </div>
            <Select
              value={attendanceFilter}
              onChange={setAttendanceFilter}
              style={{ width: '100%', height: 42 }}
            >
              <Option value="ALL">All</Option>
              <Option value="Present">Present</Option>
              <Option value="Absent">Absent</Option>
              <Option value="On Leave">On Leave</Option>
            </Select>
          </Col>

          {/* Date Range */}
          <Col xs={24} sm={12} lg={6}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#475569', marginBottom: 6 }}>
              Date Range
            </div>
            <Dropdown menu={dateRangeMenu} trigger={['click']}>
              <div
                style={{
                  height: 42,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 14px',
                  backgroundColor: isDarkMode ? '#141414' : '#ffffff',
                  border: `1px solid ${isDarkMode ? '#262626' : '#d9d9d9'}`,
                  borderRadius: 'var(--radius-base)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  color: isDarkMode ? '#ffffff' : '#0f172a',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <CalendarOutlined style={{ color: isDarkMode ? '#888888' : '#64748b', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedDateRange}</span>
                </div>
                <DownOutlined style={{ fontSize: 10, color: isDarkMode ? '#888888' : '#64748b', flexShrink: 0 }} />
              </div>
            </Dropdown>
          </Col>
        </Row>

        {/* Row 2: Filter & Clear Filters Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 18 }}>
          <Button
            type="primary"
            icon={<FilterOutlined />}
            loading={isLoadingEmployees}
            onClick={() => loadEmployees(1, pageSize)}
            style={{
              height: 40,
              padding: '0 22px',
              borderRadius: 'var(--radius-base)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Filter
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={clearFilters}
            style={{
              height: 40,
              padding: '0 22px',
              borderRadius: 'var(--radius-base)',
              fontWeight: 600,
              color: isDarkMode ? '#aaaaaa' : '#64748b',
              borderColor: isDarkMode ? '#333333' : '#d0d7de',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Clear Filters
          </Button>
        </div>
      </Card>

      {/* EMPLOYEES TABLE CARD */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
              Employees
            </div>
            {/* Filter Segment Tabs */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { key: 'ALL', label: 'All Staff' },
                { key: 'Full-Time', label: 'Full-Time' },
                { key: 'Part-Time', label: 'Part-Time' },
                { key: 'Temporary', label: 'Temporary' },
              ].map((tab) => {
                const count = tab.key === 'ALL'
                  ? employeesList.length
                  : employeesList.filter((e) => (e.type || 'Full-Time') === tab.key).length;
                const isSelected = staffTypeFilter === tab.key;
                return (
                  <Button
                    key={tab.key}
                    size="small"
                    onClick={() => setStaffTypeFilter(tab.key)}
                    type={isSelected ? 'primary' : 'default'}
                    style={{
                      borderRadius: 16,
                      fontSize: 12,
                      fontWeight: 600,
                      height: 30,
                      padding: '0 12px',
                    }}
                  >
                    {tab.label} ({count})
                  </Button>
                );
              })}
            </div>
          </div>
        }
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-color)',
          borderRadius: 'var(--radius-base)',
          boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
        }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Table
          loading={isLoadingEmployees}
          pagination={false}
          size="middle"
          scroll={{ x: 'max-content' }}
          dataSource={filteredEmployees}
          columns={columns}
        />

        {/* Custom Table Footer with Pagination & Show Dropdown */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            marginTop: 20,
            paddingTop: 16,
            borderTop: `1px solid ${isDarkMode ? '#1e1e1e' : '#f1f5f9'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b' }}>
              {totalServerEmployees === 0
                ? 'Showing 0 employees'
                : `Showing ${Math.min((currentPage - 1) * pageSize + 1, totalServerEmployees)} to ${Math.min(currentPage * pageSize, totalServerEmployees)} of ${totalServerEmployees} employee${totalServerEmployees === 1 ? '' : 's'}`}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: isDarkMode ? '#8c8c8c' : '#64748b' }}>Show</span>
              <Select
                value={pageSize}
                onChange={(newSize) => {
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
                options={[
                  { value: 5, label: '5 / page' },
                  { value: 8, label: '8 / page' },
                  { value: 10, label: '10 / page' },
                  { value: 20, label: '20 / page' },
                  { value: 50, label: '50 / page' },
                  { value: 100, label: '100 / page' },
                ]}
                size="small"
                style={{ width: 115 }}
              />
            </div>
          </div>

          <Pagination
            current={currentPage}
            onChange={(p, ps) => {
              setCurrentPage(p);
              if (ps && ps !== pageSize) {
                setPageSize(ps);
              }
            }}
            total={totalServerEmployees}
            pageSize={pageSize}
            showSizeChanger={false}
          />
        </div>
      </Card>

      {/* 1. EMPLOYEE DETAILS MODAL (PIXEL PERFECT SCREENSHOT 2) */}
      {/* 1. EMPLOYEE EDIT & DETAILS MODAL (FULL COMPREHENSIVE ATTRIBUTE EDITOR) */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
              Edit Employee Details
            </span>
            <Tag color="purple" style={{ fontWeight: 700, borderRadius: 4, margin: 0 }}>
              {selectedEmployee?.employeeId || 'STAFF'}
            </Tag>
          </div>
        }
        open={isDetailsModalOpen}
        onCancel={() => setIsDetailsModalOpen(false)}
        footer={null}
        width={780}
        centered
        destroyOnClose
        styles={{ body: { padding: '12px 16px 20px 16px' } }}
      >
        {selectedEmployee && (
          <Form form={editEmployeeForm} layout="vertical" onFinish={handleSaveDetails}>
            {/* Top Profile Summary Card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: 'var(--radius-base)',
                backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
                border: `1px solid ${isDarkMode ? '#222222' : '#e2e8f0'}`,
                marginBottom: 16,
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (re) => {
                          setEditPhoto(re.target?.result);
                          message.success('Employee photo updated');
                        };
                        reader.readAsDataURL(file);
                      }
                    };
                    input.click();
                  }}
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    borderRadius: '50%',
                    flexShrink: 0,
                  }}
                  title="Click to change employee photo"
                >
                  <Avatar
                    src={editPhoto || selectedEmployee.avatar}
                    size={64}
                    style={{ border: '2px solid #722ed1' }}
                  >
                    {getGymInitials(selectedEmployee.name)}
                  </Avatar>
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      backgroundColor: '#722ed1',
                      color: '#ffffff',
                      borderRadius: '50%',
                      width: 22,
                      height: 22,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      border: '2px solid #ffffff',
                    }}
                  >
                    <CameraOutlined />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    {selectedEmployee.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    <Tag color="purple" style={{ borderRadius: 4, fontWeight: 600, fontSize: 11, margin: 0 }}>
                      {detailRole}
                    </Tag>
                    <Tag color={selectedEmployee.status === 'Active' ? 'green' : 'orange'} style={{ borderRadius: 4, fontWeight: 600, fontSize: 11, margin: 0 }}>
                      ● {selectedEmployee.status || 'Active'}
                    </Tag>
                    <Tag color="blue" style={{ borderRadius: 4, fontWeight: 600, fontSize: 11, margin: 0 }}>
                      {detailAccessType} Access
                    </Tag>
                  </div>
                </div>
              </div>

              {/* Right Meta Badges */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b' }}>Employee ID</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#722ed1', marginTop: 1 }}>{selectedEmployee.employeeId}</div>
                <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', marginTop: 6 }}>Start Date</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a', marginTop: 1 }}>{selectedEmployee.joinDate || '05 Oct 2026'}</div>
              </div>
            </div>

            {/* Comprehensive Tabbed Sections */}
            <Tabs
              defaultActiveKey="basic"
              destroyInactiveTabPane={false}
              items={[
                {
                  key: 'basic',
                  label: (
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      <UserOutlined /> Basic & Role
                    </span>
                  ),
                  children: (
                    <div style={{ paddingTop: 8 }}>
                      <Row gutter={16}>
                        <Col xs={24} sm={12}>
                          <Form.Item
                            label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Employee Full Name <span style={{ color: '#ef4444' }}>*</span></span>}
                            name="name"
                            rules={[{ required: true, message: 'Please enter employee name' }]}
                            style={{ marginBottom: 14 }}
                          >
                            <Input placeholder="Full name" style={{ height: 40, borderRadius: 'var(--radius-base)' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item
                            label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Phone Number <span style={{ color: '#ef4444' }}>*</span></span>}
                            required
                            style={{ marginBottom: 14 }}
                          >
                            <Input.Group compact style={{ display: 'flex' }}>
                              <Form.Item name="countryCode" initialValue="+91" noStyle>
                                <Select style={{ width: '35%', height: 40 }}>
                                  <Option value="+91">+91</Option>
                                  <Option value="+1">+1</Option>
                                  <Option value="+44">+44</Option>
                                  <Option value="+971">+971</Option>
                                </Select>
                              </Form.Item>
                              <Form.Item name="phone" noStyle rules={[{ required: true, message: 'Enter phone' }]}>
                                <Input placeholder="9876543210" style={{ width: '65%', height: 40, borderRadius: '0 8px 8px 0' }} />
                              </Form.Item>
                            </Input.Group>
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={16}>
                        <Col xs={24} sm={12}>
                          <Form.Item
                            label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Email Address <span style={{ color: '#ef4444' }}>*</span></span>}
                            name="email"
                            rules={[{ required: true, type: 'email', message: 'Valid email required' }]}
                            style={{ marginBottom: 14 }}
                          >
                            <Input placeholder="email@gymezy.com" style={{ height: 40, borderRadius: 'var(--radius-base)' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={6}>
                          <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Gender</span>} name="gender" initialValue="Male" style={{ marginBottom: 14 }}>
                            <Select style={{ height: 40 }}>
                              <Option value="Male">Male</Option>
                              <Option value="Female">Female</Option>
                              <Option value="Other">Other</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={6}>
                          <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Employment Type</span>} name="type" initialValue="Full-Time" style={{ marginBottom: 14 }}>
                            <Select
                              style={{ height: 40 }}
                              onChange={(val) => {
                                setDetailEmpType(val);
                                const vLower = (val || '').toLowerCase();
                                const isTemp = vLower === 'temporary' || vLower === 'part-time' || vLower === 'parttime';
                                setShowTrainerShowcaseTab(!isTemp);
                              }}
                            >
                              <Option value="Full-Time">Full-Time</Option>
                              <Option value="Part-Time">Part-Time</Option>
                              <Option value="Temporary">Temporary</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>

                      {((detailEmpType || '').toLowerCase() === 'temporary' ||
                        (detailEmpType || '').toLowerCase() === 'part-time' ||
                        (detailEmpType || '').toLowerCase() === 'parttime') && (
                        <div
                          style={{
                            marginTop: 4,
                            marginBottom: 16,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: 'var(--radius-base)',
                            backgroundColor: isDarkMode ? '#1e1e1e' : '#f8fafc',
                            border: `1px dashed ${isDarkMode ? '#333333' : '#cbd5e1'}`,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 12.5, color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>
                              <CrownOutlined style={{ color: '#722ed1', marginRight: 6 }} />
                              Showcase Trainer Profile in User App
                            </div>
                            <div style={{ fontSize: 11.5, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                              By default, temporary/part-time staff profiles are hidden from the user app. Toggle on to customize their showcase card.
                            </div>
                          </div>
                          <Switch
                            checked={showTrainerShowcaseTab}
                            onChange={(checked) => setShowTrainerShowcaseTab(checked)}
                          />
                        </div>
                      )}

                      <Row gutter={16}>
                        <Col xs={24} sm={12}>
                          <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Role / Designation <span style={{ color: '#ef4444' }}>*</span></span>} style={{ marginBottom: 14 }}>
                            <Select
                              value={detailRole}
                              onChange={(newRole) => {
                                setDetailRole(newRole);
                                setDetailAccessType(computeAccessTypeFromRole(newRole));
                              }}
                              style={{ height: 40 }}
                            >
                              <Option value="Manager">Manager</Option>
                              <Option value="Trainer">Trainer</Option>
                              <Option value="Head Trainer">Head Trainer</Option>
                              <Option value="Front Desk Manager">Front Desk Manager</Option>
                              <Option value="Customer Support">Customer Support</Option>
                              <Option value="Housekeeping">Housekeeping</Option>
                              <Option value="Nutritionist">Nutritionist</Option>
                              <Option value="Physiotherapist">Physiotherapist</Option>
                              <Option value="Maintenance">Maintenance</Option>
                              <Option value="Security">Security</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Platform Status</span>} name="status" initialValue="Active" style={{ marginBottom: 14 }}>
                            <Select style={{ height: 40 }}>
                              <Option value="Active">Active (Live in System)</Option>
                              <Option value="Inactive">Inactive</Option>
                              <Option value="On Leave">On Leave</Option>
                              <Option value="Suspended">Suspended</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>

                      {detailRole === 'Manager' && (
                        <Card
                          size="small"
                          style={{
                            marginBottom: 16,
                            borderRadius: 'var(--radius-base)',
                            backgroundColor: isDarkMode ? '#1e1b4b' : '#f5f3ff',
                            borderColor: isDarkMode ? '#4338ca' : '#c7d2fe',
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#4f46e5', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <CrownOutlined /> Manager Delegation Permissions (Admin Approval Required)
                          </div>
                          <div style={{ fontSize: 11.5, color: isDarkMode ? '#c7d2fe' : '#475569', marginBottom: 12 }}>
                            Check the operations that require your (Gym Admin) approval before taking effect. Uncheck to allow direct manager execution.
                          </div>
                          <Row gutter={[12, 10]}>
                            <Col xs={24} sm={12}>
                              <Form.Item name="requireStaffApproval" valuePropName="checked" style={{ marginBottom: 8 }}>
                                <Checkbox style={{ fontSize: 12 }}>Staff & Trainers (Add/Edit/Remove)</Checkbox>
                              </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                              <Form.Item name="requirePlanSwitchApproval" valuePropName="checked" style={{ marginBottom: 8 }}>
                                <Checkbox style={{ fontSize: 12 }}>Plan Switches & Prorations</Checkbox>
                              </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                              <Form.Item name="requireCancellationApproval" valuePropName="checked" style={{ marginBottom: 8 }}>
                                <Checkbox style={{ fontSize: 12 }}>Cancellations & Refund Claims</Checkbox>
                              </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                              <Form.Item name="requireProfileEditApproval" valuePropName="checked" style={{ marginBottom: 8 }}>
                                <Checkbox style={{ fontSize: 12 }}>Gym Profile & Operating Timings</Checkbox>
                              </Form.Item>
                            </Col>
                          </Row>
                        </Card>
                      )}

                      {/* Automatic System Access (RBAC) */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155', marginBottom: 8 }}>
                          System Access Level (Automatic RBAC)
                        </div>
                        <div
                          style={{
                            padding: '12px 16px',
                            borderRadius: 'var(--radius-base)',
                            border: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`,
                            backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 12,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 8,
                                backgroundColor:
                                  detailAccessType === 'Admin'
                                    ? 'rgba(114, 46, 209, 0.12)'
                                    : detailAccessType === 'Employee'
                                    ? 'rgba(22, 119, 255, 0.12)'
                                    : isDarkMode ? '#262626' : '#f1f5f9',
                                color:
                                  detailAccessType === 'Admin'
                                    ? '#722ed1'
                                    : detailAccessType === 'Employee'
                                    ? '#1677ff'
                                    : isDarkMode ? '#888888' : '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 18,
                              }}
                            >
                              {detailAccessType === 'Admin' ? (
                                <CrownOutlined />
                              ) : detailAccessType === 'Employee' ? (
                                <TeamOutlined />
                              ) : (
                                <CloseCircleOutlined />
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                                {detailAccessType} Access
                              </div>
                              <div style={{ fontSize: 11.5, color: isDarkMode ? '#888888' : '#64748b' }}>
                                {detailAccessType === 'Admin'
                                  ? 'Delegated Manager administrative access (governed by permissions above)'
                                  : detailAccessType === 'Employee'
                                  ? 'Can check in members, scan QR codes, and view scheduled sessions'
                                  : 'Staff roster profile only (no app console credentials needed)'}
                              </div>
                            </div>
                          </div>
                          <Tag
                            color={detailAccessType === 'Admin' ? 'purple' : detailAccessType === 'Employee' ? 'blue' : 'default'}
                            style={{ borderRadius: 6, fontWeight: 600, fontSize: 11.5, padding: '2px 10px' }}
                          >
                            Automated by Role
                          </Tag>
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'experience',
                  label: (
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      <IdcardOutlined /> Professional & Experience
                    </span>
                  ),
                  children: (
                    <div style={{ paddingTop: 8 }}>
                      <Row gutter={16}>
                        <Col xs={24} sm={14}>
                          <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Specialization / Key Skills</span>} name="specialty" style={{ marginBottom: 14 }}>
                            <Input placeholder="e.g. Strength Training, HIIT, Yoga, Nutrition" style={{ height: 40, borderRadius: 'var(--radius-base)' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={10}>
                          <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Years of Experience</span>} name="experienceYears" style={{ marginBottom: 14 }}>
                            <Select style={{ height: 40 }}>
                              <Option value={1}>1 Year</Option>
                              <Option value={2}>2 Years</Option>
                              <Option value={3}>3-5 Years</Option>
                              <Option value={5}>5-8 Years</Option>
                              <Option value={10}>10+ Years</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>

                      <div style={{ marginTop: 16, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#722ed1', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CalendarOutlined /> Previous Employment Details
                        </span>
                        <Button
                          size="small"
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() =>
                            setEditPrevEmployments((prev) => [
                              ...prev,
                              { id: Date.now(), companyName: '', designation: '', experience: '1-2 Years' },
                            ])
                          }
                          style={{
                            borderRadius: 'var(--radius-base)',
                            fontWeight: 600,
                            fontSize: 11.5,
                            color: '#722ed1',
                            borderColor: '#722ed1',
                          }}
                        >
                          Add Another
                        </Button>
                      </div>

                      {editPrevEmployments.map((emp, index) => (
                        <div
                          key={emp.id}
                          style={{
                            position: 'relative',
                            backgroundColor: isDarkMode ? '#1a1a1a' : '#f8fafc',
                            border: `1px solid ${isDarkMode ? '#2d2d2d' : '#e2e8f0'}`,
                            borderRadius: 8,
                            padding: '10px 12px 2px',
                            marginBottom: 10,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#722ed1' }}>
                              Employment #{index + 1}
                            </span>
                            {editPrevEmployments.length > 1 && (
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => setEditPrevEmployments((prev) => prev.filter((e) => e.id !== emp.id))}
                                style={{ height: 22, padding: '0 6px', fontSize: 11 }}
                              >
                                Remove
                              </Button>
                            )}
                          </div>

                          <Row gutter={12}>
                            <Col xs={24} sm={8}>
                              <div style={{ marginBottom: 8 }}>
                                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, color: isDarkMode ? '#e2e8f0' : '#334155' }}>
                                  Company Name
                                </div>
                                <Input
                                  placeholder="e.g. Gold's Gym"
                                  value={emp.companyName}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditPrevEmployments((prev) =>
                                      prev.map((item) => (item.id === emp.id ? { ...item, companyName: val } : item))
                                    );
                                  }}
                                  style={{
                                    height: 38,
                                    borderRadius: 'var(--radius-base)',
                                    backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
                                  }}
                                />
                              </div>
                            </Col>
                            <Col xs={24} sm={8}>
                              <div style={{ marginBottom: 8 }}>
                                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, color: isDarkMode ? '#e2e8f0' : '#334155' }}>
                                  Designation
                                </div>
                                <Input
                                  placeholder="e.g. Senior Trainer"
                                  value={emp.designation}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditPrevEmployments((prev) =>
                                      prev.map((item) => (item.id === emp.id ? { ...item, designation: val } : item))
                                    );
                                  }}
                                  style={{
                                    height: 38,
                                    borderRadius: 'var(--radius-base)',
                                    backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
                                  }}
                                />
                              </div>
                            </Col>
                            <Col xs={24} sm={8}>
                              <div style={{ marginBottom: 8 }}>
                                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, color: isDarkMode ? '#e2e8f0' : '#334155' }}>
                                  Years of Experience
                                </div>
                                <Select
                                  placeholder="Select experience"
                                  value={emp.experience || '1-2 Years'}
                                  onChange={(val) => {
                                    setEditPrevEmployments((prev) =>
                                      prev.map((item) => (item.id === emp.id ? { ...item, experience: val } : item))
                                    );
                                  }}
                                  style={{ width: '100%', height: 38 }}
                                >
                                  <Option value="1-2 Years">1-2 Years</Option>
                                  <Option value="3-5 Years">3-5 Years</Option>
                                  <Option value="5+ Years">5+ Years</Option>
                                </Select>
                              </div>
                            </Col>
                          </Row>
                        </div>
                      ))}
                    </div>
                  ),
                },
                ...(showTrainerShowcaseTab
                  ? [
                      {
                        key: 'trainer_profile',
                        label: (
                          <span style={{ fontWeight: 600, fontSize: 13 }}>
                            <CrownOutlined /> Trainer Profile & Showcase
                          </span>
                        ),
                        children: (
                          <div style={{ paddingTop: 8 }}>
                            <Form.Item
                              label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>About Me / Trainer Description</span>}
                              name="description"
                              style={{ marginBottom: 14 }}
                            >
                              <TextArea
                                rows={3}
                                placeholder="e.g. Certified fitness trainer helping clients achieve their fitness goals through personalized training."
                                style={{ borderRadius: 'var(--radius-base)' }}
                              />
                            </Form.Item>

                            <Row gutter={16}>
                              <Col xs={24} sm={12}>
                                <Form.Item
                                  label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Services Offered</span>}
                                  name="servicesOffered"
                                  style={{ marginBottom: 14 }}
                                >
                                  <Select mode="multiple" placeholder="Select services" style={{ width: '100%' }}>
                                    <Option value="Weight Loss Program">Weight Loss Program</Option>
                                    <Option value="Muscle Gain">Muscle Gain</Option>
                                    <Option value="Strength Training">Strength Training</Option>
                                    <Option value="Fat Loss">Fat Loss</Option>
                                    <Option value="HIIT Workouts">HIIT Workouts</Option>
                                    <Option value="Diet & Nutrition">Diet & Nutrition</Option>
                                    <Option value="Body Transformation">Body Transformation</Option>
                                  </Select>
                                </Form.Item>
                              </Col>
                              <Col xs={24} sm={6}>
                                <Form.Item
                                  label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Experience</span>}
                                  name="experience"
                                  style={{ marginBottom: 14 }}
                                >
                                  <Input placeholder="e.g. 3+ Years" style={{ height: 40, borderRadius: 'var(--radius-base)' }} />
                                </Form.Item>
                              </Col>
                              <Col xs={24} sm={6}>
                                <Form.Item
                                  label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Languages</span>}
                                  name="languages"
                                  style={{ marginBottom: 14 }}
                                >
                                  <Select mode="tags" placeholder="Languages" style={{ width: '100%' }}>
                                    <Option value="English">English</Option>
                                    <Option value="Hindi">Hindi</Option>
                                    <Option value="Tamil">Tamil</Option>
                                    <Option value="Telugu">Telugu</Option>
                                    <Option value="Kannada">Kannada</Option>
                                  </Select>
                                </Form.Item>
                              </Col>
                            </Row>

                            <Form.Item
                              label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Certifications</span>}
                              name="certifications"
                              style={{ marginBottom: 14 }}
                            >
                              <Select mode="tags" placeholder="Add certifications" style={{ width: '100%' }} />
                            </Form.Item>
                          </div>
                        ),
                      },
                    ]
                  : []),
                {
                  key: 'schedule_pay',
                  label: (
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      <ClockCircleOutlined /> Schedule & Compensation
                    </span>
                  ),
                  children: (
                    <div style={{ paddingTop: 8 }}>
                      <Row gutter={16}>
                        <Col xs={24} sm={12}>
                          <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Shift Start Time</span>} name="workingTimeStart" initialValue="06:00 AM" style={{ marginBottom: 14 }}>
                            <Input placeholder="06:00 AM" style={{ height: 40, borderRadius: 'var(--radius-base)' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Shift End Time</span>} name="workingTimeEnd" initialValue="02:00 PM" style={{ marginBottom: 14 }}>
                            <Input placeholder="02:00 PM" style={{ height: 40, borderRadius: 'var(--radius-base)' }} />
                          </Form.Item>
                        </Col>
                      </Row>

                      {/* Working Days Selector */}
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155', marginBottom: 8 }}>
                          Assigned Working Days
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                            const isSelected = editWorkingDays.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setEditWorkingDays(editWorkingDays.filter((d) => d !== day));
                                  } else {
                                    setEditWorkingDays([...editWorkingDays, day]);
                                  }
                                }}
                                style={{
                                  padding: '6px 14px',
                                  borderRadius: 8,
                                  border: `1.5px solid ${isSelected ? '#722ed1' : isDarkMode ? '#333' : '#d0d7de'}`,
                                  backgroundColor: isSelected ? '#722ed1' : isDarkMode ? '#1e1e1e' : '#ffffff',
                                  color: isSelected ? '#ffffff' : isDarkMode ? '#cccccc' : '#334155',
                                  fontWeight: 700,
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <Row gutter={16}>
                        <Col xs={24} sm={12}>
                          <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Compensation Model</span>} name="payType" initialValue="Monthly" style={{ marginBottom: 14 }}>
                            <Select style={{ height: 40 }}>
                              <Option value="Monthly">Monthly Fixed Salary</Option>
                              <Option value="Session">Per Session / Personal Training</Option>
                              <Option value="Hourly">Hourly Rate</Option>
                              <Option value="Daily">Daily Pay</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Salary / Pay Amount (₹)</span>} name="payAmount" initialValue={25000} style={{ marginBottom: 14 }}>
                            <InputNumber
                              prefix="₹"
                              formatter={formatAmountWithCommas}
                              parser={parseAmountWithoutCommas}
                              style={{ width: '100%', height: 40, borderRadius: 'var(--radius-base)' }}
                            />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Internal Admin Notes</span>} name="notes" style={{ marginBottom: 10 }}>
                        <TextArea rows={2} placeholder="Optional internal notes about shift, performance, or agreements" />
                      </Form.Item>
                    </div>
                  ),
                },
                {
                  key: 'emergency_docs',
                  label: (
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      <PaperClipOutlined /> Emergency & Documents
                    </span>
                  ),
                  children: (
                    <div style={{ paddingTop: 8 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#722ed1', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <TeamOutlined /> Emergency Contact Details
                      </div>

                      <Row gutter={12}>
                        <Col xs={24} sm={8}>
                          <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12 }}>Contact Person Name</span>} name="emergencyName" style={{ marginBottom: 12 }}>
                            <Input placeholder="Full name" style={{ height: 38, borderRadius: 'var(--radius-base)' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                          <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12 }}>Relationship</span>} name="emergencyRel" style={{ marginBottom: 12 }}>
                            <Input placeholder="e.g. Spouse / Brother" style={{ height: 38, borderRadius: 'var(--radius-base)' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                          <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12 }}>Emergency Phone</span>} name="emergencyPhone" style={{ marginBottom: 12 }}>
                            <Input placeholder="+91 98765 43210" style={{ height: 38, borderRadius: 'var(--radius-base)' }} />
                          </Form.Item>
                        </Col>
                      </Row>

                      {/* Documents Section */}
                      <div style={{ borderTop: `1px solid ${isDarkMode ? '#222222' : '#f1f5f9'}`, paddingTop: 14, marginTop: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#722ed1', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <PaperClipOutlined /> Attached Documents ({editEmpDocs.length})
                          </div>
                          <Button
                            size="small"
                            type="primary"
                            ghost
                            icon={<PaperClipOutlined />}
                            onClick={() => openAttachDocModal('edit_emp')}
                            style={{
                              borderRadius: 'var(--radius-base)',
                              fontWeight: 600,
                              fontSize: 12,
                              borderColor: '#722ed1',
                              color: '#722ed1',
                            }}
                          >
                            Attach New Document
                          </Button>
                        </div>

                        {editEmpDocs.length > 0 ? (
                          <div style={{ width: '100%', overflowX: 'hidden', borderRadius: 8, border: `1px solid ${isDarkMode ? '#333333' : '#f0f0f0'}` }}>
                            <Table
                              size="small"
                              pagination={false}
                              tableLayout="fixed"
                              dataSource={editEmpDocs}
                              columns={[
                                {
                                  title: 'Document Type',
                                  dataIndex: 'docType',
                                  key: 'docType',
                                  width: 150,
                                  ellipsis: true,
                                  render: (t) => <span style={{ fontWeight: 600 }}>{t}</span>,
                                },
                                {
                                  title: 'Doc Number',
                                  dataIndex: 'docNum',
                                  key: 'docNum',
                                  width: 130,
                                  ellipsis: true,
                                  render: (n) => <span style={{ fontFamily: 'monospace' }}>{n || '—'}</span>,
                                },
                                {
                                  title: 'File Name',
                                  dataIndex: 'fileName',
                                  key: 'fileName',
                                  ellipsis: true,
                                  render: (f) => (
                                    <span
                                      title={f}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        color: '#1677ff',
                                        cursor: 'pointer',
                                        maxWidth: 160,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                      onClick={() => message.info(`Viewing ${f}`)}
                                    >
                                      <FilePdfOutlined style={{ color: '#ef4444', flexShrink: 0 }} />
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
                                    </span>
                                  ),
                                },
                                {
                                  title: 'Action',
                                  key: 'action',
                                  width: 60,
                                  align: 'center',
                                  render: (_, rec) => (
                                    <Button
                                      type="text"
                                      size="small"
                                      danger
                                      icon={<DeleteOutlined />}
                                      onClick={() => setEditEmpDocs(editEmpDocs.filter((d) => d.key !== rec.key && d._id !== rec._id))}
                                    />
                                  ),
                                },
                              ]}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              padding: '16px',
                              textAlign: 'center',
                              borderRadius: 'var(--radius-base)',
                              backgroundColor: isDarkMode ? '#141414' : '#fafafa',
                              border: `1px dashed ${isDarkMode ? '#262626' : '#e2e8f0'}`,
                              color: isDarkMode ? '#888888' : '#64748b',
                              fontSize: 12.5,
                            }}
                          >
                            No documents attached yet. Click "Attach New Document" to add ID proofs, certificates, or salary slips.
                          </div>
                        )}
                      </div>
                    </div>
                  ),
                },
                ...((detailRole === 'Trainer' || selectedEmployee?.role === 'Trainer')
                  ? [
                      {
                        key: 'trainer_pricing',
                        label: (
                          <span style={{ fontWeight: 600, fontSize: 13, color: '#722ed1' }}>
                            <DollarOutlined /> Membership Tier Rates
                          </span>
                        ),
                        children: (
                          <div style={{ paddingTop: 8 }}>
                            <Alert
                              type="info"
                              showIcon
                              message="Member Personal Training Pricing per Membership Tier"
                              description="Specify what members are charged when they add this trainer to their Standard Membership package. These rates reflect directly in the user mobile app booking screen."
                              style={{ marginBottom: 16, borderRadius: 'var(--radius-base)' }}
                            />
                            <Row gutter={16}>
                              <Col xs={24} sm={12}>
                                <Form.Item
                                  label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Monthly Plan Add-on (₹)</span>}
                                  name="trainerMonthly"
                                  initialValue={0}
                                  style={{ marginBottom: 14 }}
                                >
                                  <InputNumber
                                    prefix="₹"
                                    placeholder="e.g. 1,500"
                                    min={0}
                                    formatter={formatAmountWithCommas}
                                    parser={parseAmountWithoutCommas}
                                    style={{ width: '100%', height: 40, borderRadius: 'var(--radius-base)' }}
                                  />
                                </Form.Item>
                              </Col>
                              <Col xs={24} sm={12}>
                                <Form.Item
                                  label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Quarterly Plan Add-on (₹)</span>}
                                  name="trainerQuarterly"
                                  initialValue={0}
                                  style={{ marginBottom: 14 }}
                                >
                                  <InputNumber
                                    prefix="₹"
                                    placeholder="e.g. 4,000"
                                    min={0}
                                    formatter={formatAmountWithCommas}
                                    parser={parseAmountWithoutCommas}
                                    style={{ width: '100%', height: 40, borderRadius: 'var(--radius-base)' }}
                                  />
                                </Form.Item>
                              </Col>
                            </Row>
                            <Row gutter={16}>
                              <Col xs={24} sm={12}>
                                <Form.Item
                                  label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Half Yearly Plan Add-on (₹)</span>}
                                  name="trainerHalfYearly"
                                  initialValue={0}
                                  style={{ marginBottom: 14 }}
                                >
                                  <InputNumber
                                    prefix="₹"
                                    placeholder="e.g. 7,500"
                                    min={0}
                                    formatter={formatAmountWithCommas}
                                    parser={parseAmountWithoutCommas}
                                    style={{ width: '100%', height: 40, borderRadius: 'var(--radius-base)' }}
                                  />
                                </Form.Item>
                              </Col>
                              <Col xs={24} sm={12}>
                                <Form.Item
                                  label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Annual Plan Add-on (₹)</span>}
                                  name="trainerAnnual"
                                  initialValue={0}
                                  style={{ marginBottom: 14 }}
                                >
                                  <InputNumber
                                    prefix="₹"
                                    placeholder="e.g. 14,000"
                                    min={0}
                                    formatter={formatAmountWithCommas}
                                    parser={parseAmountWithoutCommas}
                                    style={{ width: '100%', height: 40, borderRadius: 'var(--radius-base)' }}
                                  />
                                </Form.Item>
                              </Col>
                            </Row>
                            <Row gutter={16}>
                              <Col xs={24} sm={12}>
                                <Form.Item
                                  label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Single Session Rate (₹)</span>}
                                  name="trainerSingleSession"
                                  initialValue={0}
                                  style={{ marginBottom: 14 }}
                                >
                                  <InputNumber
                                    prefix="₹"
                                    placeholder="e.g. 200"
                                    min={0}
                                    formatter={formatAmountWithCommas}
                                    parser={parseAmountWithoutCommas}
                                    style={{ width: '100%', height: 40, borderRadius: 'var(--radius-base)' }}
                                  />
                                </Form.Item>
                              </Col>
                            </Row>
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
            />

            {/* Modal Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 14,
                marginTop: 20,
                paddingTop: 14,
                borderTop: `1px solid ${isDarkMode ? '#222222' : '#f1f5f9'}`,
              }}
            >
              <Button
                danger
                icon={<PoweroffOutlined />}
                loading={isDeactivating}
                onClick={handleDeactivate}
                style={{
                  height: 42,
                  padding: '0 16px',
                  borderRadius: 'var(--radius-base)',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Deactivate Employee
              </Button>

              <Space>
                <Button
                  onClick={() => setIsDetailsModalOpen(false)}
                  style={{ height: 42, padding: '0 20px', borderRadius: 'var(--radius-base)', fontWeight: 600 }}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={isSavingDetails}
                  icon={<CheckOutlined />}
                  style={{
                    height: 42,
                    padding: '0 28px',
                    borderRadius: 'var(--radius-base)',
                    fontWeight: 700,
                    fontSize: 13.5,
                    backgroundColor: 'var(--color-primary)',
                    borderColor: 'var(--color-primary)',
                    color: '#ffffff',
                  }}
                >
                  Save All Changes
                </Button>
              </Space>
            </div>
          </Form>
        )}
      </Modal>

      {/* 2. ADD NEW EMPLOYEE 2-STEP MULTI-STEP MODAL (SCREENSHOT 3) */}
      <Modal
        title={
          <div style={{ fontSize: 18, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
            Add New Employee
          </div>
        }
        open={isAddModalOpen}
        onCancel={() => {
          setIsAddModalOpen(false);
          setAddStep(1);
          addEmployeeForm.resetFields();
          setAddPhoto(null);
          setPersonalDocs([]);
          setEmpDocs([]);
          setTrainerCerts([]);
          setAddPrevEmployments([{ id: 1, companyName: '', designation: '', experience: '1-2 Years' }]);
        }}
        footer={null}
        width={760}
        centered
        styles={{ body: { padding: '16px 24px 24px 24px', maxHeight: '85vh', overflowY: 'auto' } }}
      >
        <Form
          form={addEmployeeForm}
          layout="vertical"
          preserve={true}
          onFinish={handleCompleteAddEmployee}
        >
          {/* Unified Single Page Form */}
          <div>
            {/* Photo + Basic Details */}
            <Row gutter={16} align="top" style={{ marginBottom: 16 }}>
              <Col xs={24} sm={8}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155', marginBottom: 6 }}>
                  Employee Photo
                </div>
                <div
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (re) => setAddPhoto(re.target?.result);
                        reader.readAsDataURL(file);
                        message.success('Photo attached');
                      }
                    };
                    input.click();
                  }}
                  style={{
                    height: 130,
                    borderRadius: 'var(--radius-base)',
                    border: `2px dashed ${addPhoto ? '#722ed1' : isDarkMode ? '#333333' : '#d0d7de'}`,
                    backgroundColor: isDarkMode ? '#141414' : '#fafafa',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 8,
                    textAlign: 'center',
                  }}
                >
                  {addPhoto ? (
                    <img src={addPhoto} alt="Employee" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                  ) : (
                    <>
                      <CameraOutlined style={{ fontSize: 28, color: '#722ed1', marginBottom: 6 }} />
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#722ed1' }}>Upload Photo</div>
                      <div style={{ fontSize: 10, color: isDarkMode ? '#888888' : '#64748b', marginTop: 2 }}>JPG, PNG (Max 2MB)</div>
                    </>
                  )}
                </div>
              </Col>

              <Col xs={24} sm={16}>
                <Form.Item
                  label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Employee Name <span style={{ color: '#ef4444' }}>*</span></span>}
                  name="name"
                  rules={[{ required: true, message: 'Please enter employee name' }]}
                  style={{ marginBottom: 12 }}
                >
                  <Input placeholder="Enter employee name" style={{ height: 40, borderRadius: 'var(--radius-base)', backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff' }} />
                </Form.Item>

                <Row gutter={10}>
                  <Col xs={24} sm={12}>
                    <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Phone Number <span style={{ color: '#ef4444' }}>*</span></span>} required style={{ marginBottom: 12 }}>
                      <Input.Group compact style={{ display: 'flex' }}>
                        <Form.Item name="countryCode" initialValue="+91" noStyle>
                          <Select style={{ width: '38%', height: 40 }}>
                            <Option value="+91">+91</Option>
                            <Option value="+1">+1</Option>
                            <Option value="+44">+44</Option>
                            <Option value="+971">+971</Option>
                          </Select>
                        </Form.Item>
                        <Form.Item name="phone" noStyle rules={[{ required: true, message: 'Enter phone' }]}>
                          <Input placeholder="9876543210" style={{ width: '62%', height: 40, borderRadius: '0 8px 8px 0', backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff' }} />
                        </Form.Item>
                      </Input.Group>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Email ID <span style={{ color: '#ef4444' }}>*</span></span>}
                      name="email"
                      rules={[{ required: true, type: 'email', message: 'Enter valid email' }]}
                      style={{ marginBottom: 12 }}
                    >
                      <Input placeholder="staff@gymezy.com" style={{ height: 40, borderRadius: 'var(--radius-base)', backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={24}>
                <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Role <span style={{ color: '#ef4444' }}>*</span></span>} name="role" initialValue="Trainer" rules={[{ required: true }]} style={{ marginBottom: 14 }}>
                  <Select style={{ height: 40 }}>
                    <Option value="Manager">Manager (Operational Admin)</Option>
                    <Option value="Trainer">Trainer</Option>
                    <Option value="Front Desk Manager">Front Desk Manager</Option>
                    <Option value="Customer Support">Customer Support</Option>
                    <Option value="Housekeeping">Housekeeping</Option>
                    <Option value="Nutritionist">Nutritionist</Option>
                    <Option value="Maintenance">Maintenance</Option>
                    <Option value="Security">Security</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {addRoleWatch === 'Manager' && (
              <Card
                size="small"
                style={{
                  marginBottom: 16,
                  borderRadius: 'var(--radius-base)',
                  backgroundColor: isDarkMode ? '#1e1b4b' : '#f5f3ff',
                  borderColor: isDarkMode ? '#4338ca' : '#c7d2fe',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: '#4f46e5', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CrownOutlined /> Manager Delegation Permissions (Admin Approval Required)
                </div>
                <div style={{ fontSize: 11.5, color: isDarkMode ? '#c7d2fe' : '#475569', marginBottom: 12 }}>
                  Check the operations that require your (Gym Admin) approval before taking effect. Uncheck to allow direct manager execution.
                </div>
                <Row gutter={[12, 10]}>
                  <Col xs={24} sm={12}>
                    <Form.Item name="requireStaffApproval" valuePropName="checked" initialValue={true} style={{ marginBottom: 8 }}>
                      <Checkbox style={{ fontSize: 12 }}>Staff & Trainers (Add/Edit/Remove)</Checkbox>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="requirePlanSwitchApproval" valuePropName="checked" initialValue={true} style={{ marginBottom: 8 }}>
                      <Checkbox style={{ fontSize: 12 }}>Plan Switches & Prorations</Checkbox>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="requireCancellationApproval" valuePropName="checked" initialValue={true} style={{ marginBottom: 8 }}>
                      <Checkbox style={{ fontSize: 12 }}>Cancellations & Refund Claims</Checkbox>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="requireProfileEditApproval" valuePropName="checked" initialValue={true} style={{ marginBottom: 8 }}>
                      <Checkbox style={{ fontSize: 12 }}>Gym Profile & Operating Timings</Checkbox>
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            )}

            {/* Trainer Profile & Showcase (Shown in User App) */}
            <div style={{ borderTop: `1px solid ${isDarkMode ? '#222222' : '#f1f5f9'}`, paddingTop: 14, marginTop: 6, marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#722ed1', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <CrownOutlined /> Trainer Profile & Showcase (Shown in User App)
              </div>

              <Form.Item
                label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>About Me / Trainer Description</span>}
                name="description"
                style={{ marginBottom: 12 }}
              >
                <TextArea
                  rows={3}
                  placeholder="e.g. Certified fitness trainer helping clients achieve their fitness goals through personalized training."
                  style={{ borderRadius: 'var(--radius-base)', backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff' }}
                />
              </Form.Item>

              <Row gutter={12}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Services Offered</span>}
                    name="servicesOffered"
                    style={{ marginBottom: 12 }}
                  >
                    <Select mode="multiple" placeholder="Select services offered" style={{ width: '100%' }}>
                      <Option value="Weight Loss Program">Weight Loss Program</Option>
                      <Option value="Muscle Gain">Muscle Gain</Option>
                      <Option value="Strength Training">Strength Training</Option>
                      <Option value="Fat Loss">Fat Loss</Option>
                      <Option value="HIIT Workouts">HIIT Workouts</Option>
                      <Option value="Diet & Nutrition">Diet & Nutrition</Option>
                      <Option value="Body Transformation">Body Transformation</Option>
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} sm={6}>
                  <Form.Item
                    label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Experience</span>}
                    name="experience"
                    style={{ marginBottom: 12 }}
                  >
                    <Input
                      placeholder="e.g. 3+ Years"
                      style={{ height: 40, borderRadius: 'var(--radius-base)', backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff' }}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={6}>
                  <Form.Item
                    label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Languages</span>}
                    name="languages"
                    style={{ marginBottom: 12 }}
                  >
                    <Select mode="tags" placeholder="Languages spoken" style={{ width: '100%' }}>
                      <Option value="English">English</Option>
                      <Option value="Hindi">Hindi</Option>
                      <Option value="Tamil">Tamil</Option>
                      <Option value="Telugu">Telugu</Option>
                      <Option value="Kannada">Kannada</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Certifications</span>}
                name="certifications"
                style={{ marginBottom: 12 }}
              >
                <Select mode="tags" placeholder="Type certification and press enter" style={{ width: '100%' }} />
              </Form.Item>
            </div>

            {/* Previous Employment Details */}
            <div style={{ borderTop: `1px solid ${isDarkMode ? '#222222' : '#f1f5f9'}`, paddingTop: 14, marginTop: 6, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#722ed1', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CalendarOutlined /> Previous Employment Details
                </div>
                <Button
                  size="small"
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() =>
                    setAddPrevEmployments((prev) => [
                      ...prev,
                      { id: Date.now(), companyName: '', designation: '', experience: '1-2 Years' },
                    ])
                  }
                  style={{
                    borderRadius: 'var(--radius-base)',
                    fontWeight: 600,
                    fontSize: 11.5,
                    color: '#722ed1',
                    borderColor: '#722ed1',
                  }}
                >
                  Add Another
                </Button>
              </div>

              {addPrevEmployments.map((emp, index) => (
                <div
                  key={emp.id}
                  style={{
                    position: 'relative',
                    backgroundColor: isDarkMode ? '#1a1a1a' : '#f8fafc',
                    border: `1px solid ${isDarkMode ? '#2d2d2d' : '#e2e8f0'}`,
                    borderRadius: 8,
                    padding: '10px 12px 2px',
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#722ed1' }}>
                      Employment #{index + 1}
                    </span>
                    {addPrevEmployments.length > 1 && (
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => setAddPrevEmployments((prev) => prev.filter((e) => e.id !== emp.id))}
                        style={{ height: 22, padding: '0 6px', fontSize: 11 }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <Row gutter={12}>
                    <Col xs={24} sm={8}>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, color: isDarkMode ? '#e2e8f0' : '#334155' }}>
                          Company Name
                        </div>
                        <Input
                          placeholder="e.g. Gold's Gym"
                          value={emp.companyName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAddPrevEmployments((prev) =>
                              prev.map((item) => (item.id === emp.id ? { ...item, companyName: val } : item))
                            );
                          }}
                          style={{
                            height: 38,
                            borderRadius: 'var(--radius-base)',
                            backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
                          }}
                        />
                      </div>
                    </Col>
                    <Col xs={24} sm={8}>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, color: isDarkMode ? '#e2e8f0' : '#334155' }}>
                          Designation
                        </div>
                        <Input
                          placeholder="e.g. Senior Trainer"
                          value={emp.designation}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAddPrevEmployments((prev) =>
                              prev.map((item) => (item.id === emp.id ? { ...item, designation: val } : item))
                            );
                          }}
                          style={{
                            height: 38,
                            borderRadius: 'var(--radius-base)',
                            backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
                          }}
                        />
                      </div>
                    </Col>
                    <Col xs={24} sm={8}>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, color: isDarkMode ? '#e2e8f0' : '#334155' }}>
                          Years of Experience
                        </div>
                        <Select
                          placeholder="Select experience"
                          value={emp.experience || '1-2 Years'}
                          onChange={(val) => {
                            setAddPrevEmployments((prev) =>
                              prev.map((item) => (item.id === emp.id ? { ...item, experience: val } : item))
                            );
                          }}
                          style={{ width: '100%', height: 38 }}
                        >
                          <Option value="1-2 Years">1-2 Years</Option>
                          <Option value="3-5 Years">3-5 Years</Option>
                          <Option value="5+ Years">5+ Years</Option>
                        </Select>
                      </div>
                    </Col>
                  </Row>
                </div>
              ))}

              {/* Added Employment Documents Table */}
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#475569' }}>
                    Added Employment Documents ({empDocs.length})
                  </div>
                  <Button
                    size="small"
                    type="dashed"
                    icon={<PaperClipOutlined />}
                    onClick={() => openAttachDocModal('employment')}
                    style={{
                      borderRadius: 'var(--radius-base)',
                      fontWeight: 600,
                      fontSize: 11.5,
                      color: '#722ed1',
                      borderColor: '#722ed1',
                    }}
                  >
                    Attach Document
                  </Button>
                </div>
                <div style={{ width: '100%', overflowX: 'hidden', borderRadius: 8, border: `1px solid ${isDarkMode ? '#333333' : '#f0f0f0'}` }}>
                  <Table
                    size="small"
                    pagination={false}
                    tableLayout="fixed"
                    dataSource={empDocs}
                    columns={[
                      {
                        title: 'Document Type',
                        dataIndex: 'docType',
                        key: 'docType',
                        width: 150,
                        ellipsis: true,
                        render: (t) => <span style={{ fontWeight: 600 }}>{t}</span>,
                      },
                      {
                        title: 'Document Number',
                        dataIndex: 'docNum',
                        key: 'docNum',
                        width: 140,
                        ellipsis: true,
                        render: (n) => <span style={{ fontFamily: 'monospace' }}>{n || '—'}</span>,
                      },
                      {
                        title: 'File Name',
                        dataIndex: 'fileName',
                        key: 'fileName',
                        ellipsis: true,
                        render: (f) => (
                          <span
                            title={f}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              color: '#1677ff',
                              cursor: 'pointer',
                              maxWidth: 170,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            onClick={() => message.info(`Viewing ${f}`)}
                          >
                            <FilePdfOutlined style={{ color: '#ef4444', flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
                          </span>
                        ),
                      },
                      {
                        title: 'Added On',
                        dataIndex: 'addedOn',
                        key: 'addedOn',
                        width: 105,
                      },
                      {
                        title: 'Action',
                        key: 'action',
                        width: 60,
                        align: 'center',
                        render: (_, rec) => (
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => setEmpDocs(empDocs.filter((d) => d.key !== rec.key))}
                          />
                        ),
                      },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Family Details */}
            <div style={{ borderTop: `1px solid ${isDarkMode ? '#222222' : '#f1f5f9'}`, paddingTop: 14, marginTop: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#722ed1', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <TeamOutlined /> Family Details
              </div>

              <Row gutter={12}>
                <Col xs={24} sm={8}>
                  <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12 }}>Emergency Contact Name <span style={{ color: '#ef4444' }}>*</span></span>} name="emergencyName" rules={[{ required: true, message: 'Enter emergency contact' }]} style={{ marginBottom: 12 }}>
                    <Input placeholder="Contact full name" style={{ height: 38, borderRadius: 'var(--radius-base)', backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12 }}>Relationship <span style={{ color: '#ef4444' }}>*</span></span>} name="emergencyRel" rules={[{ required: true, message: 'Enter relationship' }]} style={{ marginBottom: 12 }}>
                    <Input placeholder="e.g. Spouse / Brother" style={{ height: 38, borderRadius: 'var(--radius-base)', backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12 }}>Phone Number <span style={{ color: '#ef4444' }}>*</span></span>} name="emergencyPhone" rules={[{ required: true, message: 'Enter emergency phone' }]} style={{ marginBottom: 12 }}>
                    <Input placeholder="+91 98765 43210" style={{ height: 38, borderRadius: 'var(--radius-base)', backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff' }} />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            {/* Documents Section */}
            <div style={{ borderTop: `1px solid ${isDarkMode ? '#222222' : '#f1f5f9'}`, paddingTop: 14, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#722ed1', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IdcardOutlined /> Documents ({personalDocs.length})
                </div>
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<PaperClipOutlined />}
                  onClick={() => openAttachDocModal('personal')}
                  style={{
                    borderRadius: 'var(--radius-base)',
                    fontWeight: 600,
                    fontSize: 12,
                    borderColor: '#722ed1',
                    color: '#722ed1',
                  }}
                >
                  Attach Document
                </Button>
              </div>

              <div style={{ width: '100%', overflowX: 'hidden', borderRadius: 8, border: `1px solid ${isDarkMode ? '#333333' : '#f0f0f0'}` }}>
                <Table
                  size="small"
                  pagination={false}
                  tableLayout="fixed"
                  dataSource={personalDocs}
                  columns={[
                    {
                      title: 'Document Type',
                      dataIndex: 'docType',
                      key: 'docType',
                      width: 150,
                      ellipsis: true,
                      render: (t) => <span style={{ fontWeight: 600 }}>{t}</span>,
                    },
                    {
                      title: 'Document Number',
                      dataIndex: 'docNum',
                      key: 'docNum',
                      width: 140,
                      ellipsis: true,
                      render: (n) => <span style={{ fontFamily: 'monospace' }}>{n || '—'}</span>,
                    },
                    {
                      title: 'File Name',
                      dataIndex: 'fileName',
                      key: 'fileName',
                      ellipsis: true,
                      render: (f) => (
                        <span
                          title={f}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            color: '#1677ff',
                            cursor: 'pointer',
                            maxWidth: 170,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          onClick={() => message.info(`Viewing ${f}`)}
                        >
                          <FilePdfOutlined style={{ color: '#ef4444', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
                        </span>
                      ),
                    },
                    {
                      title: 'Added On',
                      dataIndex: 'addedOn',
                      key: 'addedOn',
                      width: 105,
                    },
                    {
                      title: 'Action',
                      key: 'action',
                      width: 60,
                      align: 'center',
                      render: (_, rec) => (
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => setPersonalDocs(personalDocs.filter((d) => d.key !== rec.key))}
                        />
                      ),
                    },
                  ]}
                />
              </div>
            </div>

            {/* Trainer Certificate (If Employee is a Trainer) */}
            <div style={{ borderTop: `1px solid ${isDarkMode ? '#222222' : '#f1f5f9'}`, paddingTop: 14, marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#722ed1', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CrownOutlined /> Trainer Certificate ({trainerCerts.length})
                </div>
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<PaperClipOutlined />}
                  onClick={() => openAttachDocModal('trainer')}
                  style={{
                    borderRadius: 'var(--radius-base)',
                    fontWeight: 600,
                    fontSize: 12,
                    borderColor: '#722ed1',
                    color: '#722ed1',
                  }}
                >
                  Attach Certificate
                </Button>
              </div>

              <div style={{ width: '100%', overflowX: 'hidden', borderRadius: 8, border: `1px solid ${isDarkMode ? '#333333' : '#f0f0f0'}` }}>
                <Table
                  size="small"
                  pagination={false}
                  tableLayout="fixed"
                  dataSource={trainerCerts}
                  columns={[
                    {
                      title: 'Certificate Type',
                      dataIndex: 'certType',
                      key: 'certType',
                      width: 150,
                      ellipsis: true,
                      render: (t) => <span style={{ fontWeight: 600 }}>{t}</span>,
                    },
                    {
                      title: 'Document Number',
                      dataIndex: 'certNum',
                      key: 'certNum',
                      width: 140,
                      ellipsis: true,
                      render: (n) => <span style={{ fontFamily: 'monospace' }}>{n || '—'}</span>,
                    },
                    {
                      title: 'File Name',
                      dataIndex: 'fileName',
                      key: 'fileName',
                      ellipsis: true,
                      render: (f) => (
                        <span
                          title={f}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            color: '#1677ff',
                            cursor: 'pointer',
                            maxWidth: 170,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          onClick={() => message.info(`Viewing ${f}`)}
                        >
                          <FilePdfOutlined style={{ color: '#ef4444', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
                        </span>
                      ),
                    },
                    {
                      title: 'Added On',
                      dataIndex: 'addedOn',
                      key: 'addedOn',
                      width: 105,
                    },
                    {
                      title: 'Action',
                      key: 'action',
                      width: 60,
                      align: 'center',
                      render: (_, rec) => (
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => setTrainerCerts(trainerCerts.filter((c) => c.key !== rec.key))}
                        />
                      ),
                    },
                  ]}
                />
              </div>
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center', marginTop: 24, borderTop: `1px solid ${isDarkMode ? '#222222' : '#f1f5f9'}`, paddingTop: 16 }}>
              <Button onClick={() => setIsAddModalOpen(false)} style={{ borderRadius: 'var(--radius-base)', height: 42, padding: '0 24px' }}>
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={isSubmittingAdd}
                icon={<UserAddOutlined />}
                style={{
                  borderRadius: 'var(--radius-base)',
                  height: 42,
                  padding: '0 28px',
                  backgroundColor: 'var(--color-primary)',
                  borderColor: 'var(--color-primary)',
                  color: '#ffffff',
                  fontWeight: 600,
                }}
              >
                Add Employee
              </Button>
            </div>
          </div>
        </Form>
      </Modal>

      {/* ATTACH DOCUMENT MODAL */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
            <PaperClipOutlined style={{ color: '#722ed1' }} />
            <span>
              {targetDocSection === 'personal'
                ? 'Attach Personal Document'
                : targetDocSection === 'employment'
                ? 'Attach Employment Document'
                : 'Attach Trainer Certificate'}
            </span>
          </div>
        }
        open={isAttachDocModalOpen}
        onCancel={() => {
          setIsAttachDocModalOpen(false);
          setDocFile(null);
          attachDocForm.resetFields();
        }}
        footer={null}
        width={500}
        centered
        destroyOnClose
      >
        <Form form={attachDocForm} layout="vertical" onFinish={handleAttachDocSubmit} style={{ marginTop: 16 }}>
          <Form.Item
            label={<span style={{ fontWeight: 600, fontSize: 13 }}>Document / Certificate Type <span style={{ color: '#ef4444' }}>*</span></span>}
            name="docType"
            rules={[{ required: true, message: 'Please select or enter document type' }]}
          >
            {targetDocSection === 'personal' ? (
              <Select style={{ height: 40 }} placeholder="Select document type">
                <Option value="Aadhaar Card">Aadhaar Card</Option>
                <Option value="PAN Card">PAN Card</Option>
                <Option value="Driving License">Driving License</Option>
                <Option value="Passport">Passport</Option>
                <Option value="Address Proof">Address Proof</Option>
                <Option value="Voter ID Card">Voter ID Card</Option>
                <Option value="Bank Passbook">Bank Passbook</Option>
                <Option value="Other">Other</Option>
              </Select>
            ) : targetDocSection === 'employment' ? (
              <Select style={{ height: 40 }} placeholder="Select document type">
                <Option value="Experience Letter">Experience Letter</Option>
                <Option value="Relieving Letter">Relieving Letter</Option>
                <Option value="Salary Slip">Salary Slip</Option>
                <Option value="Appointment Letter">Appointment Letter</Option>
                <Option value="Other">Other</Option>
              </Select>
            ) : (
              <Select style={{ height: 40 }} placeholder="Select certificate type">
                <Option value="Personal Trainer Certificate">Personal Trainer Certificate</Option>
                <Option value="CPR / First Aid Certificate">CPR / First Aid Certificate</Option>
                <Option value="Certified Strength & Conditioning Specialist (CSCS)">Certified Strength & Conditioning Specialist (CSCS)</Option>
                <Option value="Yoga Teacher Training (YTT)">Yoga Teacher Training (YTT)</Option>
                <Option value="CrossFit Level 1 Coach">CrossFit Level 1 Coach</Option>
                <Option value="Sports Nutrition Certification">Sports Nutrition Certification</Option>
                <Option value="Other">Other</Option>
              </Select>
            )}
          </Form.Item>

          <Form.Item
            label={<span style={{ fontWeight: 600, fontSize: 13 }}>Document / ID Number</span>}
            name="docNum"
          >
            <Input placeholder="e.g. XXXX XXXX 1234 or PTC987654" style={{ height: 40, borderRadius: 'var(--radius-base)' }} />
          </Form.Item>

          {/* File Upload Trigger */}
          <Form.Item
            label={<span style={{ fontWeight: 600, fontSize: 13 }}>Upload File</span>}
            style={{ marginBottom: 24 }}
          >
            <div
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf,.png,.jpg,.jpeg,.doc,.docx';
                input.onchange = (e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setDocFile(file);
                    message.success(`Selected file: ${file.name}`);
                  }
                };
                input.click();
              }}
              style={{
                border: `2px dashed ${docFile ? '#52c41a' : isDarkMode ? '#333333' : '#d0d7de'}`,
                backgroundColor: isDarkMode ? '#141414' : '#fafafa',
                borderRadius: 'var(--radius-base)',
                padding: '20px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {docFile ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <FilePdfOutlined style={{ fontSize: 24, color: '#ef4444' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                      {docFile.name}
                    </div>
                    <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b' }}>
                      {(docFile.size / 1024).toFixed(1)} KB • Click to change file
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <UploadOutlined style={{ fontSize: 26, color: '#722ed1', marginBottom: 8 }} />
                  <div style={{ fontWeight: 600, fontSize: 13, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    Click to browse or drop file here
                  </div>
                  <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', marginTop: 4 }}>
                    Supports PDF, PNG, JPG, DOCX (Max 10MB)
                  </div>
                </>
              )}
            </div>
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button
              onClick={() => {
                setIsAttachDocModalOpen(false);
                setDocFile(null);
                attachDocForm.resetFields();
              }}
              style={{ borderRadius: 'var(--radius-base)', height: 38 }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={isAttachingDoc}
              icon={<PaperClipOutlined />}
              style={{
                borderRadius: 'var(--radius-base)',
                height: 38,
                backgroundColor: '#722ed1',
                borderColor: '#722ed1',
                color: '#ffffff',
                fontWeight: 600,
              }}
            >
              Attach Document
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 3. ADD TEMPORARY / PART-TIME STAFF MODAL (SCREENSHOT 4) */}
      <Modal
        title={
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
              Add Temporary / Part-Time Staff
            </div>
            <div style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', marginTop: 2 }}>
              Add trainer or coach who will work for a limited period or specific hours.
            </div>
          </div>
        }
        open={isTempStaffModalOpen}
        onCancel={() => {
          setIsTempStaffModalOpen(false);
          tempStaffForm.resetFields();
          setTempStaffPhoto(null);
        }}
        footer={null}
        width={760}
        centered
        destroyOnClose
        styles={{ body: { padding: '12px 4px 16px 4px' } }}
      >
        <Form form={tempStaffForm} layout="vertical" onFinish={handleAddTempStaffSubmit}>
          <Row gutter={24}>
            {/* Left Column: Basic Details & Engagement Period */}
            <Col xs={24} sm={12}>
              <Row gutter={12} align="top" style={{ marginBottom: 12 }}>
                <Col span={9}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155', marginBottom: 4 }}>
                    Staff Photo
                  </div>
                  <div
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (re) => setTempStaffPhoto(re.target?.result);
                          reader.readAsDataURL(file);
                          message.success('Photo uploaded');
                        }
                      };
                      input.click();
                    }}
                    style={{
                      height: 110,
                      borderRadius: 'var(--radius-base)',
                      border: `2px dashed ${tempStaffPhoto ? '#722ed1' : isDarkMode ? '#333333' : '#d0d7de'}`,
                      backgroundColor: isDarkMode ? '#141414' : '#fafafa',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 6,
                      textAlign: 'center',
                    }}
                  >
                    {tempStaffPhoto ? (
                      <img src={tempStaffPhoto} alt="Staff" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                    ) : (
                      <>
                        <CameraOutlined style={{ fontSize: 24, color: '#722ed1', marginBottom: 4 }} />
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#722ed1' }}>Upload Photo</div>
                        <div style={{ fontSize: 9.5, color: isDarkMode ? '#888888' : '#64748b' }}>JPG, PNG (Max 2MB)</div>
                      </>
                    )}
                  </div>
                </Col>

                <Col span={15}>
                  <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12 }}>Full Name <span style={{ color: '#ef4444' }}>*</span></span>} name="name" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 10 }}>
                    <Input placeholder="Enter full name" style={{ height: 38, borderRadius: 'var(--radius-base)' }} />
                  </Form.Item>

                  <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12 }}>Phone Number <span style={{ color: '#ef4444' }}>*</span></span>} required style={{ marginBottom: 10 }}>
                    <Input.Group compact>
                      <Form.Item name="countryCode" initialValue="+91" noStyle>
                        <Select style={{ width: '38%', height: 38 }}>
                          <Option value="+91">+91</Option>
                          <Option value="+1">+1</Option>
                        </Select>
                      </Form.Item>
                      <Form.Item name="phone" noStyle rules={[{ required: true, message: 'Required' }]}>
                        <Input placeholder="Enter phone" style={{ width: '62%', height: 38, borderRadius: '0 8px 8px 0' }} />
                      </Form.Item>
                    </Input.Group>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12 }}>Email ID</span>} name="email" style={{ marginBottom: 12 }}>
                <Input placeholder="Enter email address" style={{ height: 38, borderRadius: 'var(--radius-base)' }} />
              </Form.Item>

              <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12 }}>Role / Designation <span style={{ color: '#ef4444' }}>*</span></span>} name="role" initialValue="Trainer" rules={[{ required: true }]} style={{ marginBottom: 4 }}>
                <Select style={{ height: 38 }}>
                  <Option value="Trainer">Trainer</Option>
                  <Option value="Coach">Coach</Option>
                  <Option value="Yoga Instructor">Yoga Instructor</Option>
                  <Option value="Zumba Instructor">Zumba Instructor</Option>
                </Select>
              </Form.Item>
              <div style={{ fontSize: 10.5, color: isDarkMode ? '#888888' : '#64748b', marginBottom: 14 }}>
                e.g., Trainer, Coach, Yoga Instructor
              </div>

              {/* Employment Type Selection */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155', marginBottom: 6 }}>
                  Employment Type <span style={{ color: '#ef4444' }}>*</span>
                </div>
                <Row gutter={10}>
                  <Col span={12}>
                    <div
                      onClick={() => setTempEmploymentType('Temporary')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-base)',
                        border: `1.5px solid ${tempEmploymentType === 'Temporary' ? 'var(--color-primary)' : isDarkMode ? '#262626' : '#e2e8f0'}`,
                        backgroundColor: tempEmploymentType === 'Temporary' ? (isDarkMode ? 'rgba(0, 56, 130, 0.25)' : '#edf4fe') : isDarkMode ? '#141414' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <CalendarOutlined style={{ fontSize: 18, color: tempEmploymentType === 'Temporary' ? 'var(--color-primary)' : '#888888' }} />
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: tempEmploymentType === 'Temporary' ? 'var(--color-primary)' : isDarkMode ? '#ffffff' : '#0f172a' }}>
                          Temporary
                        </div>
                        <div style={{ fontSize: 10, color: isDarkMode ? '#888888' : '#64748b' }}>For a specific period</div>
                      </div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div
                      onClick={() => setTempEmploymentType('Part-Time')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-base)',
                        border: `1.5px solid ${tempEmploymentType === 'Part-Time' ? 'var(--color-primary)' : isDarkMode ? '#262626' : '#e2e8f0'}`,
                        backgroundColor: tempEmploymentType === 'Part-Time' ? (isDarkMode ? 'rgba(0, 56, 130, 0.25)' : '#edf4fe') : isDarkMode ? '#141414' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <ClockCircleOutlined style={{ fontSize: 18, color: tempEmploymentType === 'Part-Time' ? 'var(--color-primary)' : '#888888' }} />
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: tempEmploymentType === 'Part-Time' ? 'var(--color-primary)' : isDarkMode ? '#ffffff' : '#0f172a' }}>
                          Part-Time
                        </div>
                        <div style={{ fontSize: 10, color: isDarkMode ? '#888888' : '#64748b' }}>Work specific days</div>
                      </div>
                    </div>
                  </Col>
                </Row>
              </div>

              {/* Engagement Period */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155', marginBottom: 6 }}>
                  Engagement Period (For Temporary Staff)
                </div>
                <Row gutter={10}>
                  <Col span={12}>
                    <Form.Item label={<span style={{ fontSize: 11 }}>Start Date <span style={{ color: '#ef4444' }}>*</span></span>} name="startDate" style={{ marginBottom: 4 }}>
                      <DatePicker placeholder="Select start date" style={{ width: '100%', height: 38, borderRadius: 'var(--radius-base)' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label={<span style={{ fontSize: 11 }}>End Date <span style={{ color: '#ef4444' }}>*</span></span>} name="endDate" style={{ marginBottom: 4 }}>
                      <DatePicker placeholder="Select end date" style={{ width: '100%', height: 38, borderRadius: 'var(--radius-base)' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <div style={{ fontSize: 10.5, color: isDarkMode ? '#888888' : '#64748b', marginTop: 4 }}>
                  Staff will be active only between the selected dates.
                </div>
              </div>
            </Col>

            {/* Right Column: Schedule & Pay */}
            <Col xs={24} sm={12}>
              {/* Working Days */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155', marginBottom: 6 }}>
                  Schedule (For Part-Time Staff)
                </div>
                <div style={{ fontSize: 11.5, color: isDarkMode ? '#888888' : '#64748b', marginBottom: 6 }}>
                  Working Days <span style={{ color: '#ef4444' }}>*</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                    const isSelected = workingDays.includes(day);
                    return (
                      <div
                        key={day}
                        onClick={() => {
                          if (isSelected) setWorkingDays(workingDays.filter((d) => d !== day));
                          else setWorkingDays([...workingDays, day]);
                        }}
                        style={{
                          width: 44,
                          height: 38,
                          borderRadius: 'var(--radius-base)',
                          backgroundColor: isSelected ? 'var(--color-primary)' : isDarkMode ? '#1a1a1a' : '#f1f5f9',
                          color: isSelected ? '#ffffff' : isDarkMode ? '#cccccc' : '#334155',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <span>{day}</span>
                        {isSelected && <CheckOutlined style={{ fontSize: 9, marginTop: 1 }} />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Working Time */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155', marginBottom: 6 }}>
                  Working Time <span style={{ color: '#ef4444' }}>*</span>
                </div>
                {!isDifferentDays ? (
                  <Row gutter={8} align="middle">
                    <Col span={11}>
                      <Form.Item name="workingTimeStart" noStyle>
                        <TimePicker use12Hours format="h:mm a" placeholder="09:00 AM" style={{ width: '100%', height: 38, borderRadius: 'var(--radius-base)' }} />
                      </Form.Item>
                    </Col>
                    <Col span={2} style={{ textAlign: 'center', color: '#888888' }}>to</Col>
                    <Col span={11}>
                      <Form.Item name="workingTimeEnd" noStyle>
                        <TimePicker use12Hours format="h:mm a" placeholder="06:00 PM" style={{ width: '100%', height: 38, borderRadius: 'var(--radius-base)' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                ) : (
                  <div style={{ maxHeight: 160, overflowY: 'auto', paddingRight: 4 }}>
                    {workingDays.length === 0 ? (
                      <div style={{ fontSize: 11, color: '#fa8c16' }}>Please select working days first.</div>
                    ) : (
                      workingDays.map((day) => (
                        <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <span style={{ width: 36, fontSize: 11, fontWeight: 700 }}>{day}</span>
                          <TimePicker
                            use12Hours
                            format="h:mm a"
                            placeholder="Start"
                            value={dayWiseHours[day]?.startTime}
                            onChange={(t) => setDayWiseHours((prev) => ({ ...prev, [day]: { ...prev[day], startTime: t } }))}
                            style={{ flex: 1, height: 32 }}
                          />
                          <span style={{ fontSize: 10, color: '#888888' }}>-</span>
                          <TimePicker
                            use12Hours
                            format="h:mm a"
                            placeholder="End"
                            value={dayWiseHours[day]?.endTime}
                            onChange={(t) => setDayWiseHours((prev) => ({ ...prev, [day]: { ...prev[day], endTime: t } }))}
                            style={{ flex: 1, height: 32 }}
                          />
                        </div>
                      ))
                    )}
                  </div>
                )}
                <Checkbox
                  checked={isDifferentDays}
                  onChange={(e) => setIsDifferentDays(e.target.checked)}
                  style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', marginTop: 6 }}
                >
                  Different time for different days
                </Checkbox>
              </div>

              {/* Pay / Compensation */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155', marginBottom: 6 }}>
                  Pay / Compensation
                </div>
                <Row gutter={10}>
                  <Col span={12}>
                    <Form.Item label={<span style={{ fontSize: 11 }}>Pay Type <span style={{ color: '#ef4444' }}>*</span></span>} name="payType" initialValue="Hourly" style={{ marginBottom: 8 }}>
                      <Select style={{ height: 38 }}>
                        <Option value="Hourly">Per Hour</Option>
                        <Option value="Session">Per Session</Option>
                        <Option value="Daily">Daily</Option>
                        <Option value="Weekly">Weekly</Option>
                        <Option value="Monthly">Monthly</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label={<span style={{ fontSize: 11 }}>Amount <span style={{ color: '#ef4444' }}>*</span></span>} name="payAmount" initialValue="500" style={{ marginBottom: 8 }}>
                      <Input prefix="₹" style={{ height: 38, borderRadius: 'var(--radius-base)' }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label={<span style={{ fontSize: 11 }}>Payment Frequency <span style={{ color: '#ef4444' }}>*</span></span>} name="payFreq" initialValue="Weekly" style={{ marginBottom: 4 }}>
                  <Select style={{ height: 38 }}>
                    <Option value="Daily">Daily</Option>
                    <Option value="Weekly">Weekly</Option>
                    <Option value="Monthly">Monthly</Option>
                    <Option value="Per Session">Per Session</Option>
                    <Option value="Per Hour">Per Hour</Option>
                  </Select>
                </Form.Item>
                <div style={{ fontSize: 10.5, color: isDarkMode ? '#888888' : '#64748b', marginBottom: 12 }}>
                  e.g., Per Hour, Per Session, Daily, Weekly
                </div>
              </div>

              {/* Additional Notes */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155', marginBottom: 6 }}>
                  Additional Notes (Optional)
                </div>
                <Form.Item name="notes" style={{ marginBottom: 0 }}>
                  <TextArea rows={2} placeholder="Enter any additional information..." maxLength={250} showCount style={{ borderRadius: 'var(--radius-base)' }} />
                </Form.Item>
              </div>
            </Col>
          </Row>

          {/* Bottom Deactivation Notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 'var(--radius-base)',
              backgroundColor: isDarkMode ? 'rgba(114, 46, 209, 0.12)' : '#f3effe',
              color: isDarkMode ? '#d3adf7' : '#531dab',
              fontSize: 12,
              fontWeight: 500,
              marginTop: 18,
              marginBottom: 18,
            }}
          >
            <InfoCircleOutlined style={{ color: '#722ed1', fontSize: 14 }} />
            <span>Temporary staff will be automatically deactivated after the end date.</span>
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button
              onClick={() => setIsTempStaffModalOpen(false)}
              style={{ borderRadius: 'var(--radius-base)', height: 42, padding: '0 24px' }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={isSubmittingTemp}
              icon={<UserAddOutlined />}
              style={{
                backgroundColor: 'var(--color-primary)',
                borderColor: 'var(--color-primary)',
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                height: 42,
                padding: '0 28px',
                color: '#ffffff',
              }}
            >
              Add Staff
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 4. EMPLOYEE ADDED SUCCESSFULLY CONFIRMATION MODAL (CANVAS CONFETTI POPPER) */}
      <Modal
        open={isSuccessModalOpen}
        onCancel={() => setIsSuccessModalOpen(false)}
        footer={null}
        width={460}
        centered
        destroyOnClose
        styles={{ body: { padding: '24px 20px 16px 20px' } }}
      >
        {addedEmployeeData && (
          <div>
            {/* Header: Success Icon Badge & Confetti Animation */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  backgroundColor: isDarkMode ? 'rgba(0, 191, 98, 0.15)' : '#eaf8ef',
                  border: `2px solid ${isDarkMode ? 'rgba(0, 191, 98, 0.3)' : '#b7eb8f'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                  fontSize: 30,
                  color: '#00bf62',
                  boxShadow: '0 4px 16px rgba(0, 191, 98, 0.25)',
                }}
              >
                <CheckOutlined style={{ strokeWidth: 2.5 }} />
              </div>

              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: isDarkMode ? '#ffffff' : '#0f172a',
                  fontFamily: 'var(--font-display)',
                }}
              >
                Employee Added Successfully!
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: isDarkMode ? '#888888' : '#64748b',
                  marginTop: 4,
                }}
              >
                The employee has been added to your team.
              </div>
            </div>

            {/* Profile Highlight Card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '16px',
                borderRadius: 'var(--radius-base)',
                backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
                border: `1px solid ${isDarkMode ? '#222222' : '#e2e8f0'}`,
                marginBottom: 18,
              }}
            >
              <Avatar src={addedEmployeeData.avatar} size={60} style={{ border: '2px solid #722ed1', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {addedEmployeeData.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 650, color: '#722ed1' }}>{addedEmployeeData.role}</span>
                  <Tag
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(0, 191, 98, 0.15)' : '#eaf8ef',
                      color: '#00bf62',
                      border: 'none',
                      borderRadius: 'var(--radius-base)',
                      fontWeight: 600,
                      fontSize: 10.5,
                      padding: '1px 8px',
                      margin: 0,
                    }}
                  >
                    ● Active
                  </Tag>
                </div>
                <div style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PhoneOutlined /> {addedEmployeeData.phone}
                </div>
                <div style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MailOutlined /> {addedEmployeeData.email}
                </div>
              </div>
            </div>

            {/* Details Specifications Rows */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                padding: '14px 0',
                borderTop: `1px solid ${isDarkMode ? '#1e1e1e' : '#f1f5f9'}`,
                borderBottom: `1px solid ${isDarkMode ? '#1e1e1e' : '#f1f5f9'}`,
                marginBottom: 20,
              }}
            >
              {/* Row 1: Employee ID */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#475569', fontSize: 13.5, fontWeight: 500 }}>
                  <IdcardOutlined style={{ color: isDarkMode ? '#888888' : '#64748b' }} />
                  <span>Employee ID</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {addedEmployeeData.employeeId}
                </div>
              </div>

              {/* Row 2: Start Date */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#475569', fontSize: 13.5, fontWeight: 500 }}>
                  <CalendarOutlined style={{ color: isDarkMode ? '#888888' : '#64748b' }} />
                  <span>Start Date</span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {addedEmployeeData.joinDate}
                </div>
              </div>

              {/* Row 3: Branch */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#475569', fontSize: 13.5, fontWeight: 500 }}>
                  <ShopOutlined style={{ color: isDarkMode ? '#888888' : '#64748b' }} />
                  <span>Branch</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155' }}>
                  {addedEmployeeData.branch}
                </div>
              </div>

              {/* Row 4: Designation */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#475569', fontSize: 13.5, fontWeight: 500 }}>
                  <TeamOutlined style={{ color: isDarkMode ? '#888888' : '#64748b' }} />
                  <span>Designation</span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {addedEmployeeData.role}
                </div>
              </div>

              {/* Row 5: Access Type */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#475569', fontSize: 13.5, fontWeight: 500 }}>
                  <CrownOutlined style={{ color: isDarkMode ? '#888888' : '#64748b' }} />
                  <span>Access Type</span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#722ed1' }}>
                  {addedEmployeeData.accessType}
                </div>
              </div>
            </div>

            {/* Bottom Full-Width Action */}
            <Button
              type="primary"
              block
              onClick={() => {
                setIsSuccessModalOpen(false);
                handleOpenDetails(addedEmployeeData);
              }}
              style={{
                height: 46,
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                fontSize: 15,
                backgroundColor: 'var(--color-primary)',
                borderColor: 'var(--color-primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              View Employee <ArrowRightOutlined />
            </Button>
          </div>
        )}
      </Modal>

      {/* 5. CUSTOM DATE RANGE MODAL */}
      <Modal
        title="Select Custom Date Range"
        open={isDateRangeModalOpen}
        onCancel={() => {
          setIsDateRangeModalOpen(false);
          setTempDateRange(null);
        }}
        onOk={() => {
          if (tempDateRange && tempDateRange.length === 2 && tempDateRange[0] && tempDateRange[1]) {
            const start = tempDateRange[0].format('DD MMM YYYY');
            const end = tempDateRange[1].format('DD MMM YYYY');
            setSelectedDateRange(`${start} - ${end}`);
            setIsDateRangeModalOpen(false);
            message.success(`Date filter set: ${start} - ${end}`);
          } else {
            message.warning('Please pick both start and end dates');
          }
        }}
        okText="Apply Filter"
        cancelText="Cancel"
        destroyOnClose
      >
        <div style={{ padding: '16px 0' }}>
          <Paragraph style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 13, marginBottom: 16 }}>
            Pick start date and end date to filter employee attendance and records:
          </Paragraph>
          <DatePicker.RangePicker
            style={{ width: '100%', height: 42 }}
            onChange={(dates) => setTempDateRange(dates)}
          />
        </div>
      </Modal>
    </div>
  );
};

export default EmployeeManagement;
