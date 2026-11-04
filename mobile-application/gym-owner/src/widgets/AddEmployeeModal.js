import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { useToast } from './CustomScaffoldMessage';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';
import { pickImageFromDevice, capturePhotoFromCamera } from '../utils/filePickerUtils';

export const ROLE_OPTIONS = [
  'Trainer',
  'Front Desk Manager',
  'Customer Support',
  'Housekeeping',
  'Nutritionist',
  'Maintenance',
  'Security',
];

export const ACCESS_LEVELS = [
  { value: 'Admin', label: 'Admin', desc: 'Full branch access & operations' },
  { value: 'Employee', label: 'Employee', desc: 'Member check-in & attendance' },
  { value: 'None', label: 'None', desc: 'Define what this employee can access in the system.' },
];

export const PREV_EXP_OPTIONS = ['1-2 Years', '3-5 Years', '5+ Years'];

export const RELATION_OPTIONS = [
  'Spouse',
  'Father',
  'Mother',
  'Sibling',
  'Friend',
  'Guardian',
  'Other',
];

export const EMPLOYMENT_DOC_TYPES = [
  'Offer Letter',
  'Experience Certificate',
  'Relieving Letter',
  'Salary Slip / Payslip',
  'Appointment Letter',
  'Other Employment Doc',
];

export const PERSONAL_DOC_TYPES = [
  'Aadhar Card',
  'PAN Card',
  'Driving License',
  'Passport',
  'Voter ID',
];

export const TRAINER_CERT_TYPES = [
  'CPT (Certified Personal Trainer)',
  'CSCS (Strength & Conditioning)',
  'CrossFit Level 1 / Level 2',
  'Yoga Alliance Certification',
  'Nutrition & Dietetics Certificate',
  'First Aid & CPR Certification',
  'Other Certification',
];

export const AVAILABLE_SERVICES = [
  'Weight Loss Program',
  'Muscle Gain',
  'Strength Training',
  'Fat Loss',
  'HIIT Workouts',
  'Diet & Nutrition',
  'Body Transformation',
];

export const getServiceIconName = (service) => {
  const s = (service || '').toLowerCase().trim();
  if (s.includes('weight loss')) return 'local-mall';
  if (s.includes('muscle')) return 'fitness-center';
  if (s.includes('strength')) return 'ad-units';
  if (s.includes('fat')) return 'local-fire-department';
  if (s.includes('hiit') || s.includes('cardio') || s.includes('run')) return 'directions-run';
  if (s.includes('diet') || s.includes('nutrition') || s.includes('meal')) return 'restaurant';
  if (s.includes('transformation') || s.includes('body')) return 'accessibility-new';
  if (s.includes('yoga')) return 'self-improvement';
  if (s.includes('crossfit')) return 'flash-on';
  return 'fitness-center';
};

export const AddEmployeeModal = ({
  visible,
  onClose,
  onSuccess,
  defaultRole = ROLE_OPTIONS[0],
  title = 'Add New Employee',
  subtitle = 'Add trainer, coach, or operational gym employee',
}) => {
  const { isDark } = useTheme();
  const { showToast } = useToast();
  const { gym } = useAuth();

  // Basic Form States
  const [name, setName] = useState('');
  const [role, setRole] = useState(defaultRole);
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [accessType, setAccessType] = useState('Admin');
  const [avatar, setAvatar] = useState(null);

  // Trainer Profile & Showcase
  const [aboutMe, setAboutMe] = useState(
    'Certified fitness trainer with 8+ years of experience helping clients achieve their fitness goals through personalized training and nutrition guidance.'
  );
  const [experience, setExperience] = useState('8+ Years');
  const [servicesOffered, setServicesOffered] = useState(AVAILABLE_SERVICES);
  const [certifications, setCertifications] = useState(
    'ACE Certified Personal Trainer\nCertified Strength & Conditioning Specialist (CSCS)\nNutrition & Weight Management Certification'
  );
  const [languages, setLanguages] = useState('English, Hindi');

  // Previous Employment
  const [prevCompany, setPrevCompany] = useState('');
  const [prevDesignation, setPrevDesignation] = useState('');
  const [prevExp, setPrevExp] = useState('1-2 Years');
  const [prevEmployments, setPrevEmployments] = useState([
    { id: 1, companyName: '', designation: '', experience: '1-2 Years' },
  ]);
  const [empDocs, setEmpDocs] = useState([]);

  // Family Details
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('Spouse');

  // Documents
  const [personalDocs, setPersonalDocs] = useState([]);
  const [trainerCerts, setTrainerCerts] = useState([]);

  // Modal & Async Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAttachDocModal, setShowAttachDocModal] = useState(false);
  const [attachCategory, setAttachCategory] = useState('employment');
  const [attachDocType, setAttachDocType] = useState('Offer Letter');
  const [attachDocNum, setAttachDocNum] = useState('');
  const [attachDocFile, setAttachDocFile] = useState(null);

  // Sync role when defaultRole changes or modal opens
  useEffect(() => {
    if (visible) {
      if (defaultRole) setRole(defaultRole);
    }
  }, [visible, defaultRole]);

  // Reset form
  const resetForm = () => {
    setName('');
    setRole(defaultRole || ROLE_OPTIONS[0]);
    setCountryCode('+91');
    setPhone('');
    setEmail('');
    setAccessType('Admin');
    setAvatar(null);
    setAboutMe(
      'Certified fitness trainer with 8+ years of experience helping clients achieve their fitness goals through personalized training and nutrition guidance.'
    );
    setExperience('8+ Years');
    setServicesOffered(AVAILABLE_SERVICES);
    setCertifications(
      'ACE Certified Personal Trainer\nCertified Strength & Conditioning Specialist (CSCS)\nNutrition & Weight Management Certification'
    );
    setLanguages('English, Hindi');
    setPrevCompany('');
    setPrevDesignation('');
    setPrevExp('1-2 Years');
    setPrevEmployments([{ id: 1, companyName: '', designation: '', experience: '1-2 Years' }]);
    setEmpDocs([]);
    setEmergencyName('');
    setEmergencyPhone('');
    setEmergencyRelation('Spouse');
    setPersonalDocs([]);
    setTrainerCerts([]);
  };

  const handleAddPrevEmployment = () => {
    setPrevEmployments((prev) => [
      ...prev,
      { id: Date.now(), companyName: '', designation: '', experience: '1-2 Years' },
    ]);
  };

  const handleRemovePrevEmployment = (index) => {
    setPrevEmployments((prev) => {
      const updated = prev.filter((_, idx) => idx !== index);
      return updated.length > 0
        ? updated
        : [{ id: Date.now(), companyName: '', designation: '', experience: '1-2 Years' }];
    });
  };

  const handleUpdatePrevEmployment = (index, field, value) => {
    setPrevEmployments((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  // Photo Picker
  const handlePickPhoto = () => {
    Alert.alert('Employee Profile Photo', 'Choose photo source:', [
      {
        text: 'Take Photo',
        onPress: async () => {
          try {
            const result = await capturePhotoFromCamera({ maxWidth: 800, maxHeight: 800 });
            if (result?.fileData || result?.uri) {
              setAvatar(result.fileData || result.uri);
            }
          } catch (err) {
            showToast({ message: err.message || 'Camera capture failed', isError: true });
          }
        },
      },
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          try {
            const result = await pickImageFromDevice({ maxWidth: 800, maxHeight: 800 });
            if (result?.fileData || result?.uri) {
              setAvatar(result.fileData || result.uri);
            }
          } catch (err) {
            showToast({ message: err.message || 'Photo selection failed', isError: true });
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Document Attachment Helpers
  const openAttachDocModal = (category = 'employment') => {
    setAttachCategory(category);
    if (category === 'employment') {
      setAttachDocType(EMPLOYMENT_DOC_TYPES[0]);
    } else if (category === 'personal') {
      setAttachDocType(PERSONAL_DOC_TYPES[0]);
    } else if (category === 'trainer') {
      setAttachDocType(TRAINER_CERT_TYPES[0]);
    }
    setAttachDocNum('');
    setAttachDocFile(null);
    setShowAttachDocModal(true);
  };

  const handleSelectDocFile = async () => {
    const picked = await pickImageFromDevice({ maxWidth: 1600, maxHeight: 1600 });
    if (picked) {
      setAttachDocFile(picked);
    }
  };

  const handleSaveAttachedDoc = () => {
    if (!attachDocType) {
      showToast({ message: 'Please select document type', isError: true });
      return;
    }
    const todayFormatted = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const docItem = {
      key: `doc-${Date.now()}`,
      docType: attachDocType,
      certType: attachDocType,
      docNum: attachDocNum.trim(),
      certNum: attachDocNum.trim(),
      fileName:
        attachDocFile?.name ||
        attachDocFile?.fileName ||
        `${attachDocType.replace(/\s+/g, '_').toLowerCase()}.jpg`,
      fileData: attachDocFile?.fileData || attachDocFile?.uri || '',
      addedOn: todayFormatted,
    };

    if (attachCategory === 'employment') {
      setEmpDocs((prev) => [...prev, docItem]);
    } else if (attachCategory === 'personal') {
      setPersonalDocs((prev) => [...prev, docItem]);
    } else if (attachCategory === 'trainer') {
      setTrainerCerts((prev) => [...prev, docItem]);
    }

    setShowAttachDocModal(false);
    showToast({ message: `${attachDocType} attached successfully!`, isSuccess: true });
  };

  // Form Submission
  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast({ message: 'Employee name is required', isError: true });
      return;
    }
    if (!phone.trim()) {
      showToast({ message: 'Phone number is required', isError: true });
      return;
    }
    if (!email.trim()) {
      showToast({ message: 'Email ID is required', isError: true });
      return;
    }
    if (!emergencyName.trim() || !emergencyPhone.trim()) {
      showToast({ message: 'Emergency contact name & phone are required', isError: true });
      return;
    }

    setIsSubmitting(true);
    try {
      const fullPhone = `${countryCode || '+91'} ${phone.trim()}`.trim();

      const payload = {
        name: name.trim(),
        role,
        phone: fullPhone,
        email: email.trim(),
        avatar:
          avatar ||
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop',
        joinDate: new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        status: 'Active',
        attendance: 'Present',
        accessType,
        approvalStatus: 'Pending Approval',
        previousEmployments: prevEmployments.filter(
          (p) => p.companyName?.trim() || p.designation?.trim()
        ),
        previousCompany: prevEmployments[0]?.companyName?.trim() || prevCompany.trim(),
        previousDesignation: prevEmployments[0]?.designation?.trim() || prevDesignation.trim(),
        previousExp: prevEmployments[0]?.experience || prevExp,
        description:
          aboutMe.trim() ||
          'Certified fitness trainer with 8+ years of experience helping clients achieve their fitness goals through personalized training and nutrition guidance.',
        aboutMe:
          aboutMe.trim() ||
          'Certified fitness trainer with 8+ years of experience helping clients achieve their fitness goals through personalized training and nutrition guidance.',
        experience: experience.trim() || prevExp || '8+ Years',
        servicesOffered: servicesOffered.length > 0 ? servicesOffered : AVAILABLE_SERVICES,
        certifications: certifications
          ? certifications
              .split('\n')
              .map((c) => c.trim().replace(/^[•\-*]\s*/, ''))
              .filter(Boolean)
          : [
              'ACE Certified Personal Trainer',
              'Certified Strength & Conditioning Specialist (CSCS)',
              'Nutrition & Weight Management Certification',
            ],
        languages: languages
          ? languages
              .split(',')
              .map((l) => l.trim())
              .filter(Boolean)
          : ['English', 'Hindi'],
        emergencyContact: {
          name: emergencyName.trim(),
          relationship: emergencyRelation.trim() || 'Spouse',
          phone: emergencyPhone.trim(),
        },
        documents: [...empDocs, ...personalDocs],
        trainerCerts,
        specialty: role,
        gymId: gym?._id || gym?.partnerId,
        gymPartnerId: gym?.partnerId || gym?._id,
        gymName: gym?.name || 'Main Facility',
      };

      const res = await apiService.createEmployee(payload);
      showToast({
        message: res.message || `Employee "${name.trim()}" submitted for Super Admin approval!`,
        isSuccess: true,
      });

      resetForm();
      onClose?.();
      onSuccess?.(res);
    } catch (err) {
      showToast({ message: err.message || 'Failed to add employee', isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Main Add Employee Modal */}
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', maxHeight: '92%' },
            ]}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  {title}
                </Text>
                <Text style={[styles.modalSub, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                  {subtitle}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialIcons name="close" size={24} color={isDark ? '#FFFFFF' : '#0F172A'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Photo Upload */}
              <View style={styles.addPhotoRow}>
                <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.8}>
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.addPhotoPreview} />
                  ) : (
                    <View
                      style={[
                        styles.addPhotoPlaceholder,
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9' },
                      ]}
                    >
                      <MaterialIcons name="add-a-photo" size={26} color={AppColors.primaryColor} />
                    </View>
                  )}
                </TouchableOpacity>
                <View style={{ marginLeft: 14, flex: 1 }}>
                  <Text style={[styles.photoHelpTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    Employee Photo
                  </Text>
                  <Text style={[styles.photoHelpSub, { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>
                    {avatar ? 'Photo attached. Tap to change.' : 'Upload Photo (JPG, PNG Max 2MB)'}
                  </Text>
                  <TouchableOpacity onPress={handlePickPhoto} style={{ marginTop: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: AppColors.primaryColor }}>
                      {avatar ? 'Change Photo' : 'Upload Photo'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Employee Name */}
              <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Employee Name <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                    borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                    color: isDark ? '#FFFFFF' : '#0F172A',
                  },
                ]}
                placeholder="Enter employee name"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
                value={name}
                onChangeText={setName}
              />

              {/* Phone Number with Country Code */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ width: 85 }}>
                  <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Code</Text>
                  <TextInput
                    value={countryCode}
                    onChangeText={setCountryCode}
                    placeholder="+91"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
                    style={[
                      styles.formInput,
                      {
                        textAlign: 'center',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                        color: isDark ? '#FFFFFF' : '#0F172A',
                      },
                    ]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    Phone Number <Text style={{ color: '#EF4444' }}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                        color: isDark ? '#FFFFFF' : '#0F172A',
                      },
                    ]}
                    placeholder="9876543210"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
              </View>

              {/* Email ID */}
              <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Email ID <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                    borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                    color: isDark ? '#FFFFFF' : '#0F172A',
                  },
                ]}
                placeholder="staff@gymezy.com"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              {/* Role Picker */}
              <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Role <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {ROLE_OPTIONS.map((r) => {
                  const isSel = role === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.chipBtn,
                        isSel && { backgroundColor: AppColors.primaryColor, borderColor: AppColors.primaryColor },
                        {
                          backgroundColor: isSel
                            ? AppColors.primaryColor
                            : isDark
                            ? 'rgba(255,255,255,0.05)'
                            : '#F8FAFC',
                          borderColor: isSel
                            ? AppColors.primaryColor
                            : isDark
                            ? AppColors.darkBorder
                            : '#E2E8F0',
                        },
                      ]}
                      onPress={() => setRole(r)}
                    >
                      <Text
                        style={[
                          styles.chipBtnText,
                          { color: isSel ? '#FFFFFF' : isDark ? '#FFFFFF' : '#0F172A' },
                        ]}
                      >
                        {r}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Access Level */}
              <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Access Level <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <View style={styles.accessLevelRow}>
                {ACCESS_LEVELS.map((al) => {
                  const isSel = accessType === al.value;
                  return (
                    <TouchableOpacity
                      key={al.value}
                      style={[
                        styles.accessLevelCard,
                        isSel && {
                          borderColor: AppColors.primaryColor,
                          backgroundColor: isDark ? 'rgba(0,102,204,0.12)' : '#EFF6FF',
                        },
                        {
                          borderColor: isSel
                            ? AppColors.primaryColor
                            : isDark
                            ? AppColors.darkBorder
                            : '#E2E8F0',
                          backgroundColor: isSel
                            ? isDark
                              ? 'rgba(0,102,204,0.12)'
                              : '#EFF6FF'
                            : isDark
                            ? 'rgba(255,255,255,0.04)'
                            : '#F8FAFC',
                        },
                      ]}
                      onPress={() => setAccessType(al.value)}
                    >
                      <Text
                        style={[
                          styles.accessLevelTitle,
                          { color: isSel ? AppColors.primaryColor : isDark ? '#FFFFFF' : '#0F172A' },
                        ]}
                      >
                        {al.label}
                      </Text>
                      <Text style={[styles.accessLevelDesc, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                        {al.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginTop: -6, marginBottom: 14 }}>
                Define what this employee can access in the system.
              </Text>

              {/* Trainer Profile & Showcase (Shown in User App) */}
              <View
                style={[
                  styles.trainerShowcaseBox,
                  {
                    backgroundColor: isDark ? 'rgba(0,102,204,0.06)' : '#F0F7FF',
                    borderColor: isDark ? 'rgba(0,102,204,0.25)' : '#BAE6FD',
                  },
                ]}
              >
                <View style={styles.showcaseHeaderRow}>
                  <MaterialIcons name="stars" size={18} color={AppColors.primaryColor} />
                  <Text style={[styles.showcaseHeaderTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    Trainer Profile & Showcase (Shown in User App)
                  </Text>
                </View>
                <Text style={[styles.showcaseHeaderSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  This info appears directly in the user mobile app when members view your trainer.
                </Text>

                {/* About Me / Trainer Description */}
                <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A', marginTop: 12 }]}>
                  About Me / Trainer Description
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    styles.textAreaInput,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
                      borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                      color: isDark ? '#FFFFFF' : '#0F172A',
                    },
                  ]}
                  multiline
                  numberOfLines={3}
                  value={aboutMe}
                  onChangeText={setAboutMe}
                  placeholder="e.g. Certified fitness trainer with 8+ years of experience helping clients achieve their fitness goals through personalized training and nutrition guidance."
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
                />

                {/* Services Offered Chips */}
                <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A', marginTop: 12 }]}>
                  Services Offered
                </Text>
                <View style={styles.servicesChipContainer}>
                  {AVAILABLE_SERVICES.map((srv) => {
                    const isSelected = servicesOffered.includes(srv);
                    return (
                      <TouchableOpacity
                        key={srv}
                        style={[
                          styles.serviceChipBtn,
                          isSelected && {
                            backgroundColor: AppColors.primaryColor,
                            borderColor: AppColors.primaryColor,
                          },
                          {
                            backgroundColor: isSelected
                              ? AppColors.primaryColor
                              : isDark
                              ? 'rgba(255,255,255,0.06)'
                              : '#FFFFFF',
                            borderColor: isSelected
                              ? AppColors.primaryColor
                              : isDark
                              ? AppColors.darkBorder
                              : '#E2E8F0',
                          },
                        ]}
                        onPress={() => {
                          if (isSelected) {
                            setServicesOffered(servicesOffered.filter((s) => s !== srv));
                          } else {
                            setServicesOffered([...servicesOffered, srv]);
                          }
                        }}
                      >
                        <MaterialIcons
                          name={getServiceIconName(srv)}
                          size={15}
                          color={isSelected ? '#FFFFFF' : isDark ? '#CBD5E1' : '#475569'}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.serviceChipText,
                            { color: isSelected ? '#FFFFFF' : isDark ? '#FFFFFF' : '#0F172A' },
                          ]}
                        >
                          {srv}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Experience & Languages */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      Experience
                    </Text>
                    <TextInput
                      style={[
                        styles.formInput,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
                          borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                          color: isDark ? '#FFFFFF' : '#0F172A',
                        },
                      ]}
                      value={experience}
                      onChangeText={setExperience}
                      placeholder="e.g. 8+ Years"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      Languages
                    </Text>
                    <TextInput
                      style={[
                        styles.formInput,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
                          borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                          color: isDark ? '#FFFFFF' : '#0F172A',
                        },
                      ]}
                      value={languages}
                      onChangeText={setLanguages}
                      placeholder="e.g. English, Hindi"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
                    />
                  </View>
                </View>

                {/* Certifications */}
                <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A', marginTop: 12 }]}>
                  Certifications (one per line)
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    styles.textAreaInput,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
                      borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                      color: isDark ? '#FFFFFF' : '#0F172A',
                    },
                  ]}
                  multiline
                  numberOfLines={3}
                  value={certifications}
                  onChangeText={setCertifications}
                  placeholder="ACE Certified Personal Trainer&#10;Certified Strength & Conditioning Specialist (CSCS)&#10;Nutrition & Weight Management Certification"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
                />
              </View>

              {/* Previous Employment Details */}
              <View
                style={[
                  styles.subSectionBox,
                  {
                    borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialIcons name="business-center" size={18} color={AppColors.primaryColor} />
                    <Text style={[styles.subSectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 0 }]}>
                      Previous Employment Details
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleAddPrevEmployment}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      borderRadius: 6,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                    }}
                  >
                    <MaterialIcons name="add" size={16} color={AppColors.primaryColor} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: AppColors.primaryColor }}>
                      Add Another
                    </Text>
                  </TouchableOpacity>
                </View>

                {prevEmployments.map((emp, index) => (
                  <View
                    key={emp.id || index}
                    style={{
                      marginBottom: index < prevEmployments.length - 1 ? 14 : 6,
                      padding: 10,
                      borderRadius: 8,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                      borderWidth: 1,
                      borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#94A3B8' : '#64748B' }}>
                        Experience #{index + 1}
                      </Text>
                      {prevEmployments.length > 1 && (
                        <TouchableOpacity
                          onPress={() => handleRemovePrevEmployment(index)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
                        >
                          <MaterialIcons name="delete-outline" size={16} color="#EF4444" />
                          <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '500' }}>Remove</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A', fontSize: 12 }]}>
                          Company Name
                        </Text>
                        <TextInput
                          value={emp.companyName}
                          onChangeText={(val) => handleUpdatePrevEmployment(index, 'companyName', val)}
                          placeholder="e.g. Golds Gym"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
                          style={[
                            styles.formInput,
                            {
                              color: isDark ? '#FFFFFF' : '#0F172A',
                              borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
                            },
                          ]}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A', fontSize: 12 }]}>
                          Designation
                        </Text>
                        <TextInput
                          value={emp.designation}
                          onChangeText={(val) => handleUpdatePrevEmployment(index, 'designation', val)}
                          placeholder="e.g. Senior Trainer"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
                          style={[
                            styles.formInput,
                            {
                              color: isDark ? '#FFFFFF' : '#0F172A',
                              borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
                            },
                          ]}
                        />
                      </View>
                    </View>

                    <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A', marginTop: 8, fontSize: 12 }]}>
                      Years of Experience
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      {PREV_EXP_OPTIONS.map((expOption) => {
                        const isSel = emp.experience === expOption;
                        return (
                          <TouchableOpacity
                            key={expOption}
                            style={[
                              styles.selectionChip,
                              {
                                paddingVertical: 4,
                                paddingHorizontal: 10,
                                backgroundColor: isSel
                                  ? AppColors.primaryColor
                                  : isDark
                                  ? 'rgba(255,255,255,0.05)'
                                  : '#FFFFFF',
                                borderColor: isSel
                                  ? AppColors.primaryColor
                                  : isDark
                                  ? AppColors.darkBorder
                                  : '#E2E8F0',
                              },
                            ]}
                            onPress={() => handleUpdatePrevEmployment(index, 'experience', expOption)}
                          >
                            <Text
                              style={[
                                styles.selectionChipText,
                                { fontSize: 11, color: isSel ? '#FFFFFF' : isDark ? '#FFFFFF' : '#0F172A' },
                              ]}
                            >
                              {expOption}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}

                {/* Employment Documents */}
                <View style={{ marginTop: 12 }}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <MaterialIcons name="description" size={17} color={AppColors.primaryColor} />
                      <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 0 }]}>
                        Employment Documents
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.countBadge,
                        {
                          backgroundColor: empDocs.length > 0
                            ? (isDark ? 'rgba(37,99,235,0.15)' : '#EFF6FF')
                            : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.countBadgeText,
                          { color: empDocs.length > 0 ? AppColors.primaryColor : isDark ? '#94A3B8' : '#64748B' },
                        ]}
                      >
                        {empDocs.length > 0 ? `${empDocs.length} Attached` : 'Optional'}
                      </Text>
                    </View>
                  </View>

                  {empDocs.length === 0 ? (
                    <TouchableOpacity
                      style={[
                        styles.uploadDropzone,
                        {
                          borderColor: isDark ? 'rgba(37,99,235,0.35)' : '#BFDBFE',
                          backgroundColor: isDark ? 'rgba(37,99,235,0.04)' : '#F8FAFC',
                        },
                      ]}
                      onPress={() => openAttachDocModal('employment')}
                      activeOpacity={0.75}
                    >
                      <View
                        style={[
                          styles.uploadDropzoneIconCircle,
                          { backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#DBEAFE' },
                        ]}
                      >
                        <MaterialIcons name="cloud-upload" size={22} color={AppColors.primaryColor} />
                      </View>
                      <Text style={[styles.uploadDropzoneTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        Attach Employment Documents
                      </Text>
                      <Text style={[styles.uploadDropzoneSub, { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>
                        Relieving letter, offer letter, pay slips, or experience proof
                      </Text>
                      <View
                        style={[
                          styles.uploadDropzoneActionBadge,
                          {
                            borderColor: isDark ? 'rgba(37,99,235,0.4)' : '#BFDBFE',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                          },
                        ]}
                      >
                        <MaterialIcons name="add" size={14} color={AppColors.primaryColor} />
                        <Text style={[styles.uploadDropzoneActionText, { color: AppColors.primaryColor }]}>
                          Choose Document / File
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View>
                      {empDocs.map((doc, idx) => (
                        <View
                          key={doc.key || idx}
                          style={[
                            styles.attachedDocCard,
                            {
                              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                              borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.docIconWrapper,
                              { backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#EFF6FF' },
                            ]}
                          >
                            <MaterialIcons name="description" size={18} color={AppColors.primaryColor} />
                          </View>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <Text style={[styles.docTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                                {doc.docType}
                              </Text>
                              {doc.docNum && doc.docNum !== '—' && (
                                <View
                                  style={[
                                    styles.docBadge,
                                    { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' },
                                  ]}
                                >
                                  <Text style={[styles.docBadgeText, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                                    {doc.docNum}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text
                              style={[styles.docSubText, { color: isDark ? 'rgba(255,255,255,0.45)' : '#64748B' }]}
                              numberOfLines={1}
                            >
                              {doc.fileName || 'Attached'} • {doc.addedOn}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => setEmpDocs(empDocs.filter((_, i) => i !== idx))}
                            style={styles.deleteDocBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      ))}

                      <TouchableOpacity
                        style={[
                          styles.addAnotherDocBtn,
                          {
                            borderColor: isDark ? 'rgba(37,99,235,0.35)' : '#BFDBFE',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                          },
                        ]}
                        onPress={() => openAttachDocModal('employment')}
                      >
                        <MaterialIcons name="add" size={16} color={AppColors.primaryColor} />
                        <Text style={[styles.addAnotherDocText, { color: AppColors.primaryColor }]}>
                          Attach Another Employment Doc
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              {/* Family Details */}
              <View
                style={[
                  styles.subSectionBox,
                  {
                    borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <MaterialIcons name="group" size={18} color={AppColors.primaryColor} />
                  <Text style={[styles.subSectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 0 }]}>
                    Family Details
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      Emergency Contact Name <Text style={{ color: '#EF4444' }}>*</Text>
                    </Text>
                    <TextInput
                      value={emergencyName}
                      onChangeText={setEmergencyName}
                      placeholder="e.g. Jane Doe"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
                      style={[
                        styles.formInput,
                        {
                          color: isDark ? '#FFFFFF' : '#0F172A',
                          borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
                        },
                      ]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      Relationship <Text style={{ color: '#EF4444' }}>*</Text>
                    </Text>
                    <TextInput
                      value={emergencyRelation}
                      onChangeText={setEmergencyRelation}
                      placeholder="e.g. Spouse"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
                      style={[
                        styles.formInput,
                        {
                          color: isDark ? '#FFFFFF' : '#0F172A',
                          borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Relationship Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {RELATION_OPTIONS.map((rel) => {
                    const isSel = emergencyRelation === rel;
                    return (
                      <TouchableOpacity
                        key={rel}
                        style={[
                          styles.selectionChipSmall,
                          {
                            marginRight: 6,
                            backgroundColor: isSel
                              ? AppColors.primaryColor
                              : isDark
                              ? 'rgba(255,255,255,0.05)'
                              : '#FFFFFF',
                            borderColor: isSel
                              ? AppColors.primaryColor
                              : isDark
                              ? AppColors.darkBorder
                              : '#E2E8F0',
                          },
                        ]}
                        onPress={() => setEmergencyRelation(rel)}
                      >
                        <Text
                          style={[
                            styles.selectionChipTextSmall,
                            { color: isSel ? '#FFFFFF' : isDark ? '#FFFFFF' : '#0F172A' },
                          ]}
                        >
                          {rel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Phone Number <Text style={{ color: '#EF4444' }}>*</Text>
                </Text>
                <TextInput
                  value={emergencyPhone}
                  onChangeText={setEmergencyPhone}
                  placeholder="e.g. 9876543210"
                  keyboardType="phone-pad"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
                  style={[
                    styles.formInput,
                    {
                      color: isDark ? '#FFFFFF' : '#0F172A',
                      borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
                    },
                  ]}
                />
              </View>

              {/* Personal Verification Documents */}
              <View
                style={[
                  styles.subSectionBox,
                  {
                    borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                  },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <MaterialIcons name="badge" size={18} color="#10B981" />
                    <Text style={[styles.subSectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 0 }]}>
                      Government ID / Verification
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.countBadge,
                      {
                        backgroundColor: personalDocs.length > 0
                          ? (isDark ? 'rgba(16,185,129,0.15)' : '#DCFCE7')
                          : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.countBadgeText,
                        { color: personalDocs.length > 0 ? '#10B981' : isDark ? '#94A3B8' : '#64748B' },
                      ]}
                    >
                      {personalDocs.length > 0 ? `${personalDocs.length} Attached` : 'Optional'}
                    </Text>
                  </View>
                </View>

                {personalDocs.length === 0 ? (
                  <TouchableOpacity
                    style={[
                      styles.uploadDropzone,
                      {
                        borderColor: isDark ? 'rgba(16,185,129,0.35)' : '#86EFAC',
                        backgroundColor: isDark ? 'rgba(16,185,129,0.04)' : '#F0FDF4',
                      },
                    ]}
                    onPress={() => openAttachDocModal('personal')}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.uploadDropzoneIconCircle,
                        { backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#DCFCE7' },
                      ]}
                    >
                      <MaterialIcons name="cloud-upload" size={22} color="#10B981" />
                    </View>
                    <Text style={[styles.uploadDropzoneTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      Attach Government ID Proof
                    </Text>
                    <Text style={[styles.uploadDropzoneSub, { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>
                      Aadhar Card, PAN Card, Passport, or Driving License
                    </Text>
                    <View
                      style={[
                        styles.uploadDropzoneActionBadge,
                        {
                          borderColor: isDark ? 'rgba(16,185,129,0.4)' : '#86EFAC',
                          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                        },
                      ]}
                    >
                      <MaterialIcons name="add" size={14} color="#10B981" />
                      <Text style={[styles.uploadDropzoneActionText, { color: '#10B981' }]}>
                        Choose ID Proof
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View>
                    {personalDocs.map((doc, idx) => (
                      <View
                        key={doc.key || idx}
                        style={[
                          styles.attachedDocCard,
                          {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.docIconWrapper,
                            { backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#DCFCE7' },
                          ]}
                        >
                          <MaterialIcons name="badge" size={18} color="#10B981" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={[styles.docTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                              {doc.docType}
                            </Text>
                            {doc.docNum && doc.docNum !== '—' && (
                              <View
                                style={[
                                  styles.docBadge,
                                  { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' },
                                ]}
                              >
                                <Text style={[styles.docBadgeText, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                                  {doc.docNum}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text
                            style={[styles.docSubText, { color: isDark ? 'rgba(255,255,255,0.45)' : '#64748B' }]}
                            numberOfLines={1}
                          >
                            {doc.fileName || 'Attached'} • {doc.addedOn}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => setPersonalDocs(personalDocs.filter((_, i) => i !== idx))}
                          style={styles.deleteDocBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}

                    <TouchableOpacity
                      style={[
                        styles.addAnotherDocBtn,
                        {
                          borderColor: isDark ? 'rgba(16,185,129,0.35)' : '#86EFAC',
                          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                        },
                      ]}
                      onPress={() => openAttachDocModal('personal')}
                    >
                      <MaterialIcons name="add" size={16} color="#10B981" />
                      <Text style={[styles.addAnotherDocText, { color: '#10B981' }]}>
                        Attach Another ID Proof
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Trainer Certificate */}
              <View
                style={[
                  styles.subSectionBox,
                  {
                    borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                  },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <MaterialIcons name="card-membership" size={18} color="#F59E0B" />
                    <Text style={[styles.subSectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 0 }]}>
                      Trainer Certificate & Proofs
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.countBadge,
                      {
                        backgroundColor: trainerCerts.length > 0
                          ? (isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7')
                          : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.countBadgeText,
                        { color: trainerCerts.length > 0 ? '#D97706' : isDark ? '#94A3B8' : '#64748B' },
                      ]}
                    >
                      {trainerCerts.length > 0 ? `${trainerCerts.length} Attached` : 'Optional'}
                    </Text>
                  </View>
                </View>

                {trainerCerts.length === 0 ? (
                  <TouchableOpacity
                    style={[
                      styles.uploadDropzone,
                      {
                        borderColor: isDark ? 'rgba(245,158,11,0.35)' : '#FDE68A',
                        backgroundColor: isDark ? 'rgba(245,158,11,0.04)' : '#FFFBEB',
                      },
                    ]}
                    onPress={() => openAttachDocModal('trainer')}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.uploadDropzoneIconCircle,
                        { backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7' },
                      ]}
                    >
                      <MaterialIcons name="cloud-upload" size={22} color="#F59E0B" />
                    </View>
                    <Text style={[styles.uploadDropzoneTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      Attach Trainer Certificate
                    </Text>
                    <Text style={[styles.uploadDropzoneSub, { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>
                      ACE CPT, CSCS, CPR/AED, Nutrition, or CrossFit certificate
                    </Text>
                    <View
                      style={[
                        styles.uploadDropzoneActionBadge,
                        {
                          borderColor: isDark ? 'rgba(245,158,11,0.4)' : '#FDE68A',
                          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                        },
                      ]}
                    >
                      <MaterialIcons name="add" size={14} color="#F59E0B" />
                      <Text style={[styles.uploadDropzoneActionText, { color: '#D97706' }]}>
                        Choose Certificate
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View>
                    {trainerCerts.map((cert, idx) => (
                      <View
                        key={cert.key || idx}
                        style={[
                          styles.attachedDocCard,
                          {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.docIconWrapper,
                            { backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7' },
                          ]}
                        >
                          <MaterialIcons name="verified" size={18} color="#F59E0B" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={[styles.docTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                              {cert.certType}
                            </Text>
                            {cert.certNum && cert.certNum !== '—' && (
                              <View
                                style={[
                                  styles.docBadge,
                                  { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' },
                                ]}
                              >
                                <Text style={[styles.docBadgeText, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                                  {cert.certNum}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text
                            style={[styles.docSubText, { color: isDark ? 'rgba(255,255,255,0.45)' : '#64748B' }]}
                            numberOfLines={1}
                          >
                            {cert.fileName || 'Attached'} • {cert.addedOn}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => setTrainerCerts(trainerCerts.filter((_, i) => i !== idx))}
                          style={styles.deleteDocBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}

                    <TouchableOpacity
                      style={[
                        styles.addAnotherDocBtn,
                        {
                          borderColor: isDark ? 'rgba(245,158,11,0.35)' : '#FDE68A',
                          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                        },
                      ]}
                      onPress={() => openAttachDocModal('trainer')}
                    >
                      <MaterialIcons name="add" size={16} color="#F59E0B" />
                      <Text style={[styles.addAnotherDocText, { color: '#D97706' }]}>
                        Attach Another Certificate
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Bottom Actions */}
              <View style={styles.bottomActionsRow}>
                <TouchableOpacity
                  style={[styles.backStepBtn, { borderColor: isDark ? AppColors.darkBorder : '#CBD5E1' }]}
                  onPress={handleClose}
                >
                  <Text style={{ color: isDark ? '#FFFFFF' : '#0F172A', fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    { flex: 1, marginTop: 0, marginBottom: 0, backgroundColor: AppColors.primaryColor, opacity: isSubmitting ? 0.7 : 1 },
                  ]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MaterialIcons name="person-add" size={18} color="#FFFFFF" />
                      <Text style={styles.submitBtnText}>Add Employee</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Attach Document Modal */}
      <Modal
        visible={showAttachDocModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttachDocModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerModalCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', maxHeight: 560, width: '100%' }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={[styles.pickerModalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {attachCategory === 'employment'
                  ? 'Attach Employment Document'
                  : attachCategory === 'personal'
                  ? 'Attach Government ID Proof'
                  : 'Attach Trainer Certificate'}
              </Text>
              <TouchableOpacity onPress={() => setShowAttachDocModal(false)}>
                <MaterialIcons name="close" size={24} color={isDark ? '#FFFFFF' : '#0F172A'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 14 }}>
              <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Document Type <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {(attachCategory === 'employment'
                  ? EMPLOYMENT_DOC_TYPES
                  : attachCategory === 'personal'
                  ? PERSONAL_DOC_TYPES
                  : TRAINER_CERT_TYPES
                ).map((dt) => {
                  const isSel = attachDocType === dt;
                  return (
                    <TouchableOpacity
                      key={dt}
                      style={[
                        styles.selectionChip,
                        {
                          marginRight: 6,
                          backgroundColor: isSel
                            ? AppColors.primaryColor
                            : isDark
                            ? 'rgba(255,255,255,0.05)'
                            : '#F8FAFC',
                          borderColor: isSel
                            ? AppColors.primaryColor
                            : isDark
                            ? AppColors.darkBorder
                            : '#E2E8F0',
                        },
                      ]}
                      onPress={() => setAttachDocType(dt)}
                    >
                      <Text
                        style={[
                          styles.selectionChipText,
                          { color: isSel ? '#FFFFFF' : isDark ? '#FFFFFF' : '#0F172A' },
                        ]}
                      >
                        {dt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {attachCategory === 'personal'
                  ? 'Document Number (e.g. Aadhar / PAN / Passport)'
                  : attachCategory === 'trainer'
                  ? 'Certificate ID / Number'
                  : 'Document Reference / ID (Optional)'}
              </Text>
              <TextInput
                value={attachDocNum}
                onChangeText={setAttachDocNum}
                placeholder={attachCategory === 'personal' ? 'e.g. 1234 5678 9012' : 'e.g. CPT-2024-984'}
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
                style={[
                  styles.formInput,
                  {
                    color: isDark ? '#FFFFFF' : '#0F172A',
                    borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                  },
                ]}
              />

              <Text style={[styles.formLabel, { color: isDark ? '#FFFFFF' : '#0F172A', marginTop: 10 }]}>
                Upload Document File <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <TouchableOpacity
                style={[
                  styles.fileUploadBox,
                  {
                    borderColor: attachDocFile
                      ? '#10B981'
                      : isDark
                      ? 'rgba(37,99,235,0.4)'
                      : '#93C5FD',
                    backgroundColor: attachDocFile
                      ? (isDark ? 'rgba(16,185,129,0.06)' : '#F0FDF4')
                      : (isDark ? 'rgba(37,99,235,0.03)' : '#F8FAFC'),
                  },
                ]}
                onPress={handleSelectDocFile}
                activeOpacity={0.75}
              >
                {attachDocFile ? (
                  <View style={{ alignItems: 'center', width: '100%' }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: isDark ? 'rgba(16,185,129,0.18)' : '#DCFCE7',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 6,
                      }}
                    >
                      <MaterialIcons name="check-circle" size={26} color="#10B981" />
                    </View>
                    <Text
                      style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A', textAlign: 'center' }}
                      numberOfLines={1}
                    >
                      {attachDocFile.name || 'File Attached'}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#10B981', fontWeight: '600', marginTop: 3 }}>
                      File selected • Tap to replace
                    </Text>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#DBEAFE',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 6,
                      }}
                    >
                      <MaterialIcons name="cloud-upload" size={24} color={AppColors.primaryColor} />
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                      Choose Document or Photo
                    </Text>
                    <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B', marginTop: 2 }}>
                      Supports PDF, JPG, PNG up to 5MB
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        borderRadius: 16,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#EFF6FF',
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#BFDBFE',
                      }}
                    >
                      <MaterialIcons name="folder-open" size={13} color={AppColors.primaryColor} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: AppColors.primaryColor }}>
                        Browse Device Files
                      </Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                <TouchableOpacity
                  style={[styles.backStepBtn, { flex: 1, borderColor: isDark ? AppColors.darkBorder : '#CBD5E1' }]}
                  onPress={() => setShowAttachDocModal(false)}
                >
                  <Text style={{ color: isDark ? '#FFFFFF' : '#0F172A', fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, { flex: 1, marginTop: 0, marginBottom: 0, backgroundColor: AppColors.primaryColor }]}
                  onPress={handleSaveAttachedDoc}
                >
                  <Text style={styles.submitBtnText}>Save Document</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.15)',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  modalSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  addPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  addPhotoPreview: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  addPhotoPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: AppColors.primaryColor,
    borderStyle: 'dashed',
  },
  photoHelpTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  photoHelpSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  formLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    marginBottom: 12,
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
  },
  chipBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  accessLevelRow: {
    gap: 8,
    marginBottom: 14,
  },
  accessLevelCard: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  accessLevelTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  accessLevelDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  trainerShowcaseBox: {
    marginTop: 8,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  showcaseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  showcaseHeaderTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  showcaseHeaderSub: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 6,
  },
  textAreaInput: {
    minHeight: 70,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  servicesChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  serviceChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  serviceChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  subSectionBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  uploadDropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  uploadDropzoneIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadDropzoneTitle: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  uploadDropzoneSub: {
    fontSize: 11,
    marginTop: 3,
    textAlign: 'center',
  },
  uploadDropzoneActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 10,
  },
  uploadDropzoneActionText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  attachedDocCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  docIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTitleText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  docSubText: {
    fontSize: 11,
    marginTop: 2,
  },
  docBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  docBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  deleteDocBtn: {
    padding: 6,
  },
  addAnotherDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addAnotherDocText: {
    fontSize: 12,
    fontWeight: '700',
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(114, 46, 209, 0.1)',
  },
  attachBtnText: {
    color: '#722ED1',
    fontSize: 11.5,
    fontWeight: '700',
  },
  docListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  docListTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  selectionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectionChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  selectionChipSmall: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  selectionChipTextSmall: {
    fontSize: 11,
    fontWeight: '700',
  },
  bottomActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  backStepBtn: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13.5,
  },
  pickerModalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  pickerModalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  fileUploadBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
