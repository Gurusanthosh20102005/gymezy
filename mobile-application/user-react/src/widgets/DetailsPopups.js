import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { formatTimeAgo } from '../utils/dateUtils';
import {
  getSafeImageUri,
  DEFAULT_TRAINER_AVATAR,
  DEFAULT_USER_AVATAR,
} from '../utils/mediaUtils';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Base modal wrapper
const BasePopupModal = ({ visible, onClose, title, children, showBack = false, onBack }) => {
  const { colors, isDark } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: colors.background, height: SCREEN_HEIGHT * 0.85 },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              {showBack && (
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                  <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
              )}
              <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Body */}
          <View style={styles.bodyWrapper}>{children}</View>

          {/* Bottom Persistent Close Button */}
          <View style={styles.bottomBtnWrapper}>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.persistentCloseBtn,
                { borderColor: isDark ? AppColors.darkAccentColor : AppColors.accentColor },
              ]}
            >
              <Text
                style={[
                  styles.persistentCloseBtnText,
                  { color: isDark ? AppColors.darkAccentColor : AppColors.accentColor },
                ]}
              >
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Helper resolvers for relatable icons and descriptions
const getFacilityData = (item = '') => {
  const n = String(item).toLowerCase();
  if (n.includes('ac') || n.includes('air')) return { icon: 'ac-unit', desc: 'Fully air-conditioned workout area' };
  if (n.includes('lock') || n.includes('safe')) return { icon: 'lock-outline', desc: 'Secure lockers for your belongings' };
  if (n.includes('show') || n.includes('bath')) return { icon: 'shower', desc: 'Clean hot & cold showers available' };
  if (n.includes('chang') || n.includes('dress') || n.includes('room')) return { icon: 'checkroom', desc: 'Spacious and hygienic changing rooms' };
  if (n.includes('steam') || n.includes('sauna') || n.includes('spa')) return { icon: 'hot-tub', desc: 'Rejuvenating steam & sauna facility' };
  if (n.includes('park') || n.includes('valet')) return { icon: 'local-parking', desc: 'Safe & dedicated vehicle parking' };
  if (n.includes('wifi') || n.includes('internet')) return { icon: 'wifi', desc: 'High-speed Wi-Fi internet for members' };
  if (n.includes('music') || n.includes('sound') || n.includes('audio')) return { icon: 'music-note', desc: 'Premium surround sound system' };
  if (n.includes('dumbbell') || n.includes('free weight') || n.includes('weight')) return { icon: 'fitness-center', desc: 'Complete free weights & dumbbell station' };
  if (n.includes('cardio') || n.includes('treadmill') || n.includes('deck')) return { icon: 'directions-run', desc: 'Advanced cardio deck & machines' };
  if (n.includes('olympic') || n.includes('platform') || n.includes('squat')) return { icon: 'sports-gymnastics', desc: 'Olympic lifting platforms & power racks' };
  if (n.includes('aid') || n.includes('medical')) return { icon: 'medical-services', desc: 'Emergency first aid station on floor' };
  if (n.includes('water') || n.includes('drink')) return { icon: 'water-drop', desc: 'Purified drinking water dispenser' };
  return { icon: 'verified', desc: 'Verified gym floor facility' };
};

const getAmenityData = (item = '') => {
  const n = String(item).toLowerCase();
  if (n.includes('water') || n.includes('ro')) return { icon: 'water-drop', desc: 'RO purified drinking water' };
  if (n.includes('towel')) return { icon: 'dry-cleaning', desc: 'Clean sanitized workout towels provided' };
  if (n.includes('protein') || n.includes('shake')) return { icon: 'local-bar', desc: 'Fresh protein shakes & recovery drinks' };
  if (n.includes('juice') || n.includes('smoothie')) return { icon: 'local-cafe', desc: 'Freshly pressed juices & fruit smoothies' };
  if (n.includes('personal lock') || n.includes('locker rent') || n.includes('locker')) return { icon: 'lock-outline', desc: 'Private personal locker storage' };
  if (n.includes('inbody') || n.includes('bmi') || n.includes('weigh') || n.includes('scan') || n.includes('scale')) return { icon: 'monitor-weight', desc: 'InBody body composition & BMI analysis' };
  if (n.includes('nutrition') || n.includes('diet')) return { icon: 'assignment-ind', desc: 'Certified nutritionist & diet planning desk' };
  if (n.includes('lounge') || n.includes('rest') || n.includes('relax')) return { icon: 'weekend', desc: 'Comfortable member lounge & chill-out area' };
  if (n.includes('park')) return { icon: 'local-parking', desc: 'Safe vehicle parking' };
  if (n.includes('wifi') || n.includes('internet')) return { icon: 'wifi', desc: 'High-speed Wi-Fi internet zone' };
  if (n.includes('mat') || n.includes('sanitiz')) return { icon: 'clean-hands', desc: 'Sanitized workout mats and equipment wipes' };
  if (n.includes('aid') || n.includes('medic')) return { icon: 'medical-services', desc: 'First aid and emergency medical kit' };
  if (n.includes('shower')) return { icon: 'shower', desc: 'Clean hot showers and toiletries' };
  if (n.includes('steam') || n.includes('sauna')) return { icon: 'hot-tub', desc: 'Relaxing steam room and sauna' };
  if (n.includes('ac') || n.includes('air')) return { icon: 'ac-unit', desc: 'Comfortable AC environment' };
  return { icon: 'star', desc: 'Premium member amenity' };
};

const getWorkoutData = (item = '') => {
  const n = String(item).toLowerCase();
  if (n.includes('hiit') || n.includes('interval')) return { icon: 'flash-on', desc: 'High-intensity interval conditioning' };
  if (n.includes('yoga') || n.includes('stretch') || n.includes('mobility')) return { icon: 'self-improvement', desc: 'Flexibility, core mobility & mindful yoga' };
  if (n.includes('zumba') || n.includes('dance') || n.includes('aerobic')) return { icon: 'music-note', desc: 'High-energy dance fitness & cardio beats' };
  if (n.includes('box') || n.includes('kickbox') || n.includes('mma') || n.includes('combat') || n.includes('martial')) return { icon: 'sports-mma', desc: 'Boxing, kickboxing & combat striking' };
  if (n.includes('crossfit') || n.includes('functional')) return { icon: 'sports-kabaddi', desc: 'Functional strength training for all levels' };
  if (n.includes('powerlift') || n.includes('deadlift') || n.includes('squat')) return { icon: 'hardware', desc: 'Heavy barbell & strength powerlifting' };
  if (n.includes('bodybuild') || n.includes('hypertrophy') || n.includes('muscle')) return { icon: 'fitness-center', desc: 'Targeted muscle hypertrophy & sculpting' };
  if (n.includes('calisthenic') || n.includes('bodyweight') || n.includes('gymnast')) return { icon: 'sports-gymnastics', desc: 'Bodyweight control & bar strength' };
  if (n.includes('cardio') || n.includes('endurance') || n.includes('run')) return { icon: 'directions-run', desc: 'Cardiovascular endurance & fat loss' };
  if (n.includes('pilates')) return { icon: 'accessibility', desc: 'Core stability, posture & spine alignment' };
  if (n.includes('cycle') || n.includes('spin') || n.includes('bike')) return { icon: 'directions-bike', desc: 'Indoor cycling & heart-rate endurance' };
  if (n.includes('core') || n.includes('abs')) return { icon: 'center-focus-strong', desc: 'Core strength & abdominal definition' };
  if (n.includes('gym') || n.includes('weight') || n.includes('strength')) return { icon: 'fitness-center', desc: 'Complete strength & conditioning routines' };
  return { icon: 'fitness-center', desc: 'Professional guided workout routine' };
};

// 1. Facilities Popup
export const FacilitiesPopup = ({ visible, onClose, facilities = [] }) => {
  const { colors, isDark } = useTheme();

  return (
    <BasePopupModal visible={visible} onClose={onClose} title="All Facilities">
      <ScrollView contentContainerStyle={styles.gridContainer}>
        {facilities.length > 0 ? (
          facilities.map((item, idx) => {
            const data = getFacilityData(item);
            return (
              <View
                key={idx}
                style={[
                  styles.featureCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
                  },
                ]}
              >
                <MaterialIcons
                  name={data.icon}
                  size={28}
                  color={AppColors.accentColor}
                />
                <Text style={[styles.cardTitle, { color: colors.text }]}>{item}</Text>
                <Text style={[styles.cardDesc, { color: colors.subtitle }]} numberOfLines={2}>
                  {data.desc}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={{ color: colors.subtitle, padding: 20, textAlign: 'center' }}>
            No custom facilities listed for this gym.
          </Text>
        )}
      </ScrollView>
    </BasePopupModal>
  );
};

// 2. Amenities Popup
export const AmenitiesPopup = ({ visible, onClose, amenities = [] }) => {
  const { colors, isDark } = useTheme();

  return (
    <BasePopupModal visible={visible} onClose={onClose} title="All Amenities">
      <ScrollView contentContainerStyle={styles.gridContainer}>
        {amenities.map((item, idx) => {
          const data = getAmenityData(item);
          return (
            <View
              key={idx}
              style={[
                styles.featureCard,
                {
                  backgroundColor: colors.card,
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
                },
              ]}
            >
              <MaterialIcons
                name={data.icon}
                size={28}
                color={AppColors.accentColor}
              />
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item}</Text>
              <Text style={[styles.cardDesc, { color: colors.subtitle }]} numberOfLines={2}>
                {data.desc}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </BasePopupModal>
  );
};

// 3. Workouts Popup
export const WorkoutsPopup = ({ visible, onClose, workouts = [] }) => {
  const { colors, isDark } = useTheme();

  return (
    <BasePopupModal visible={visible} onClose={onClose} title="All Workouts Offered">
      <ScrollView contentContainerStyle={styles.gridContainer}>
        {workouts.map((item, idx) => {
          const data = getWorkoutData(item);
          return (
            <View
              key={idx}
              style={[
                styles.featureCard,
                {
                  backgroundColor: colors.card,
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
                },
              ]}
            >
              <MaterialIcons
                name={data.icon}
                size={28}
                color={AppColors.accentColor}
              />
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item}</Text>
              <Text style={[styles.cardDesc, { color: colors.subtitle }]} numberOfLines={2}>
                {data.desc}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </BasePopupModal>
  );
};

// 4. Trainers Popup
export const TrainersPopup = ({ visible, onClose, trainers = [], onTrainerTap }) => {
  const { colors, isDark } = useTheme();

  return (
    <BasePopupModal visible={visible} onClose={onClose} title="All Trainers">
      <ScrollView contentContainerStyle={styles.listContainer}>
        {trainers.map((trainer, idx) => (
          <TouchableOpacity
            key={idx}
            onPress={() => onTrainerTap(trainer)}
            style={[
              styles.trainerCard,
              {
                backgroundColor: colors.card,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
              },
            ]}
          >
            <Image
              source={{
                uri:
                  getSafeImageUri(trainer.imageUrl) ||
                  getSafeImageUri(trainer.avatar) ||
                  getSafeImageUri(trainer.image) ||
                  DEFAULT_TRAINER_AVATAR,
              }}
              style={styles.trainerAvatar}
            />
            <View style={styles.trainerInfo}>
              <Text style={[styles.trainerName, { color: colors.text }]}>{trainer.name}</Text>
              <View style={styles.trainerMetaRow}>
                <Text style={[styles.trainerExp, { color: colors.subtitle }]}>
                  {trainer.experienceYears} Yrs Exp.
                </Text>
                <Text style={[styles.dotSep, { color: colors.subtitle }]}>•</Text>
                <View style={styles.specialtyBadge}>
                  <Text style={styles.specialtyText}>{trainer.specialty}</Text>
                </View>
              </View>
              <View style={styles.ratingRow}>
                {trainer.rating !== undefined && trainer.rating !== null && Number(trainer.rating) > 0 ? (
                  <>
                    <MaterialIcons name="star" size={14} color="#F59E0B" />
                    <Text style={[styles.ratingVal, { color: colors.text }]}>
                      {trainer.rating}
                      {trainer.reviewsCount ? ` (${trainer.reviewsCount})` : ''}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.ratingVal, { color: colors.subtitle, fontSize: 12 }]}>
                    No ratings
                  </Text>
                )}
                {(trainer.trainerPricing?.monthly || trainer.monthlyFee) ? (
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#00BF62', marginLeft: 8 }}>
                    ₹{Math.round(trainer.trainerPricing?.monthly || trainer.monthlyFee)}/mo
                  </Text>
                ) : null}
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={AppColors.accentColor} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </BasePopupModal>
  );
};

const getServiceIconName = (service) => {
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

// 5. Trainer Reviews & Profile Showcase Popup
export const TrainerReviewsPopup = ({ visible, onClose, trainer, reviews = [], onBack }) => {
  const { colors, isDark } = useTheme();
  if (!trainer) return null;

  const aboutMeText =
    trainer.aboutMe ||
    trainer.description ||
    'Certified fitness trainer with 8+ years of experience helping clients achieve their fitness goals through personalized training and nutrition guidance.';

  const services =
    Array.isArray(trainer.servicesOffered) && trainer.servicesOffered.length > 0
      ? trainer.servicesOffered
      : [
          'Weight Loss Program',
          'Muscle Gain',
          'Strength Training',
          'Fat Loss',
          'HIIT Workouts',
          'Diet & Nutrition',
          'Body Transformation',
        ];

  const experienceText =
    trainer.experience ||
    (trainer.experienceYears ? `${trainer.experienceYears}+ Years` : '8+ Years');

  const certifications =
    Array.isArray(trainer.certifications) && trainer.certifications.length > 0
      ? trainer.certifications
      : typeof trainer.certifications === 'string' && trainer.certifications.trim()
      ? trainer.certifications.split('\n').filter(Boolean)
      : [
          'ACE Certified Personal Trainer',
          'Certified Strength & Conditioning Specialist (CSCS)',
          'Nutrition & Weight Management Certification',
        ];

  const languagesText =
    Array.isArray(trainer.languages) && trainer.languages.length > 0
      ? trainer.languages.join(', ')
      : typeof trainer.languages === 'string' && trainer.languages.trim()
      ? trainer.languages
      : 'English, Hindi';

  return (
    <BasePopupModal
      visible={visible}
      onClose={onClose}
      title={trainer.name ? `${trainer.name}` : 'Trainer Profile'}
      showBack={true}
      onBack={onBack}
    >
      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        {/* Trainer Header Card */}
        <View
          style={[
            styles.trainerDetailCard,
            {
              backgroundColor: colors.card,
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
            },
          ]}
        >
          <Image
            source={{
              uri:
                getSafeImageUri(trainer.imageUrl) ||
                getSafeImageUri(trainer.avatar) ||
                getSafeImageUri(trainer.image) ||
                DEFAULT_TRAINER_AVATAR,
            }}
            style={styles.largeTrainerAvatar}
          />
          <View style={styles.largeTrainerInfo}>
            <Text style={[styles.largeTrainerName, { color: colors.text }]}>{trainer.name}</Text>
            <Text style={[styles.trainerSpecText, { color: colors.subtitle }]}>
              {trainer.specialty || trainer.specialization || 'Trainer'} Specialist
            </Text>
            <Text style={[styles.trainerExpText, { color: colors.subtitle }]}>
              {experienceText} Experience
            </Text>
            <View style={styles.ratingRow}>
              {trainer.rating !== undefined && trainer.rating !== null && Number(trainer.rating) > 0 ? (
                <>
                  <MaterialIcons name="star" size={14} color="#F59E0B" />
                  <Text style={[styles.ratingVal, { color: colors.text }]}>
                    {trainer.rating}
                    {trainer.reviewsCount ? ` (${trainer.reviewsCount} Reviews)` : ''}
                  </Text>
                </>
              ) : (
                <Text style={[styles.ratingVal, { color: colors.subtitle, fontSize: 12 }]}>
                  No ratings
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* About Me */}
        <View style={styles.trainerShowcaseSection}>
          <Text style={[styles.showcaseSecTitle, { color: colors.text }]}>About Me</Text>
          <Text style={[styles.showcaseSecBody, { color: isDark ? 'rgba(255,255,255,0.7)' : '#64748B' }]}>
            {aboutMeText}
          </Text>
        </View>

        <View style={[styles.showcaseDivider, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]} />

        {/* Services Offered */}
        <View style={styles.trainerShowcaseSection}>
          <Text style={[styles.showcaseSecTitle, { color: colors.text, marginBottom: 14 }]}>
            Services Offered
          </Text>
          <View style={styles.showcaseServicesGrid}>
            {services.map((srv, idx) => (
              <View key={idx} style={styles.showcaseServiceCol}>
                <MaterialIcons
                  name={getServiceIconName(srv)}
                  size={19}
                  color={isDark ? 'rgba(255,255,255,0.85)' : '#334155'}
                  style={{ marginRight: 10 }}
                />
                <Text
                  style={[styles.showcaseServiceText, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {srv}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.showcaseDivider, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]} />

        {/* Experience */}
        <View style={styles.showcaseRowBetween}>
          <Text style={[styles.showcaseSecTitle, { color: colors.text }]}>Experience</Text>
          <Text style={[styles.showcaseRowVal, { color: isDark ? 'rgba(255,255,255,0.7)' : '#64748B' }]}>
            {experienceText}
          </Text>
        </View>

        <View style={[styles.showcaseDivider, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]} />

        {/* Certifications */}
        <View style={styles.trainerShowcaseSection}>
          <Text style={[styles.showcaseSecTitle, { color: colors.text, marginBottom: 10 }]}>
            Certifications
          </Text>
          {certifications.map((cert, idx) => (
            <Text
              key={idx}
              style={[styles.showcaseBulletText, { color: isDark ? 'rgba(255,255,255,0.7)' : '#64748B' }]}
            >
              • {cert.replace(/^[•\-*]\s*/, '')}
            </Text>
          ))}
        </View>

        <View style={[styles.showcaseDivider, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]} />

        {/* Languages */}
        <View style={styles.showcaseRowBetween}>
          <Text style={[styles.showcaseSecTitle, { color: colors.text }]}>Languages</Text>
          <Text style={[styles.showcaseRowVal, { color: isDark ? 'rgba(255,255,255,0.7)' : '#64748B' }]}>
            {languagesText}
          </Text>
        </View>

        {/* Client Reviews Section (if any exist) */}
        {reviews.length > 0 && (
          <>
            <View style={[styles.showcaseDivider, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0', marginTop: 24 }]} />
            <Text style={[styles.showcaseSecTitle, { color: colors.text, marginBottom: 14 }]}>
              Client Reviews ({reviews.length})
            </Text>
            {reviews.map((rev, idx) => (
              <View
                key={idx}
                style={[
                  styles.reviewItemCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
                  },
                ]}
              >
                <View style={styles.revHeaderRow}>
                  <View style={styles.revUserRow}>
                    <Image
                      source={{
                        uri:
                          getSafeImageUri(rev.userImageUrl) ||
                          DEFAULT_USER_AVATAR,
                      }}
                      style={styles.revUserAvatar}
                    />
                    <View style={styles.revUserNameCol}>
                      <Text style={[styles.revUserName, { color: colors.text }]}>
                        {rev.userName}
                      </Text>
                      <View style={styles.starsRow}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <MaterialIcons
                            key={i}
                            name={i < Math.floor(rev.rating) ? 'star' : 'star-border'}
                            size={10}
                            color="#F59E0B"
                          />
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={styles.revTypeCol}>
                    <View style={styles.bookingTypeBadge}>
                      <Text style={styles.bookingTypeText}>{rev.bookingType}</Text>
                    </View>
                    <Text style={[styles.revDate, { color: colors.subtitle }]}>
                      {formatTimeAgo(rev.createdAt || rev.date)}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.revComment, { color: colors.text }]}>{rev.comment}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </BasePopupModal>
  );
};

// 6. All Reviews Popup with Score Histogram
export const AllReviewsPopup = ({
  visible,
  onClose,
  rating = '0.0',
  reviewsCount = 0,
  reviews = [],
  histograms = null,
}) => {
  const { colors, isDark } = useTheme();

  const activeHistograms = Array.isArray(histograms) && histograms.length > 0
    ? histograms
    : [5, 4, 3, 2, 1].map((s) => ({ stars: s, ratio: 0, percent: '0%' }));

  const numericRating = Number(rating) || 0;
  const formattedRating = numericRating > 0 ? numericRating.toFixed(1) : (reviewsCount > 0 ? '5.0' : '0.0');
  const hasReviews = reviewsCount > 0 || reviews.length > 0;

  return (
    <BasePopupModal visible={visible} onClose={onClose} title="All Reviews">
      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        {/* Score Summary Dashboard */}
        {hasReviews ? (
          <>
            <View style={styles.scoreRow}>
              <View style={styles.scoreNumberCol}>
                <Text style={[styles.scoreBigNum, { color: colors.text }]}>
                  {formattedRating}
                </Text>
                <View style={styles.starsRow}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <MaterialIcons
                      key={i}
                      name={
                        i < Math.floor(numericRating)
                          ? 'star'
                          : i < numericRating
                          ? 'star-half'
                          : 'star-border'
                      }
                      size={16}
                      color="#F59E0B"
                    />
                  ))}
                </View>
                <Text style={[styles.reviewsCountText, { color: colors.subtitle }]}>
                  ({reviewsCount} Reviews)
                </Text>
              </View>

              {/* Histograms */}
              <View style={styles.histogramsCol}>
                {activeHistograms.map((h) => (
                  <View key={h.stars} style={styles.histoRow}>
                    <Text style={[styles.histoStarNum, { color: colors.text }]}>{h.stars}</Text>
                    <MaterialIcons name="star" size={10} color="#F59E0B" style={{ marginLeft: 2 }} />
                    <View
                      style={[
                        styles.histoBarBg,
                        { backgroundColor: isDark ? '#262626' : '#E2E8F0' },
                      ]}
                    >
                      <View
                        style={[
                          styles.histoBarFill,
                          {
                            width: `${(h.ratio || 0) * 100}%`,
                            backgroundColor: AppColors.accentColor,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.histoPercent, { color: colors.subtitle }]}>
                      {h.percent}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* List of Reviews */}
            {reviews.map((rev, idx) => (
              <View
                key={idx}
                style={[
                  styles.reviewItemCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
                  },
                ]}
              >
                <View style={styles.revHeaderRow}>
                  <View style={styles.revUserRow}>
                    <Image
                      source={{
                        uri:
                          getSafeImageUri(rev.userImageUrl) ||
                          DEFAULT_USER_AVATAR,
                      }}
                      style={styles.revUserAvatar}
                    />
                    <View style={styles.revUserNameCol}>
                      <Text style={[styles.revUserName, { color: colors.text }]}>
                        {rev.userName}
                      </Text>
                      <View style={styles.starsRow}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <MaterialIcons
                            key={i}
                            name={i < Math.floor(rev.rating) ? 'star' : 'star-border'}
                            size={10}
                            color="#F59E0B"
                          />
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={styles.revTypeCol}>
                    <View style={styles.bookingTypeBadge}>
                      <Text style={styles.bookingTypeText}>{rev.bookingType || 'Member'}</Text>
                    </View>
                    <Text style={[styles.revDate, { color: colors.subtitle }]}>
                      {formatTimeAgo(rev.createdAt || rev.date)}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.revComment, { color: colors.text }]}>{rev.comment}</Text>
              </View>
            ))}
          </>
        ) : (
          <View style={{ paddingVertical: 48, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="rate-review" size={36} color={colors.subtitle} />
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 12 }}>
              No ratings yet
            </Text>
            <Text style={{ color: colors.subtitle, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
              Be the first member to rate and review after your workout!
            </Text>
          </View>
        )}
      </ScrollView>
    </BasePopupModal>
  );
};

// 7. Rules Popup
export const RulesPopup = ({ visible, onClose, rules = [] }) => {
  const { colors } = useTheme();

  return (
    <BasePopupModal visible={visible} onClose={onClose} title="Rules & Regulations">
      <ScrollView contentContainerStyle={styles.listContainer}>
        {rules.map((rule, idx) => (
          <View key={idx} style={styles.ruleRow}>
            <MaterialIcons
              name="check-circle-outline"
              size={20}
              color={AppColors.accentColor}
              style={{ marginRight: 10, marginTop: 2 }}
            />
            <Text style={[styles.ruleText, { color: colors.text }]}>{rule}</Text>
          </View>
        ))}
      </ScrollView>
    </BasePopupModal>
  );
};

// 8. Safety Popup
export const SafetyPopup = ({ visible, onClose, safety = [] }) => {
  const { colors } = useTheme();

  return (
    <BasePopupModal visible={visible} onClose={onClose} title="Safety Measures">
      <ScrollView contentContainerStyle={styles.listContainer}>
        {safety.map((item, idx) => (
          <View key={idx} style={styles.ruleRow}>
            <MaterialIcons
              name="verified-user"
              size={20}
              color={AppColors.secondaryColor}
              style={{ marginRight: 10, marginTop: 2 }}
            />
            <Text style={[styles.ruleText, { color: colors.text }]}>{item}</Text>
          </View>
        ))}
      </ScrollView>
    </BasePopupModal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  bodyWrapper: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  featureCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 15,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  cardDesc: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
  listContainer: {
    paddingBottom: 20,
  },
  trainerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 15,
    borderWidth: 1,
    marginBottom: 12,
  },
  trainerAvatar: {
    width: 55,
    height: 55,
    borderRadius: 28,
  },
  trainerInfo: {
    flex: 1,
    marginLeft: 15,
  },
  trainerName: {
    fontSize: 16,
    fontWeight: '700',
  },
  trainerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  trainerExp: {
    fontSize: 12,
  },
  dotSep: {
    marginHorizontal: 6,
  },
  specialtyBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  specialtyText: {
    color: AppColors.accentColor,
    fontSize: 9,
    fontWeight: '700',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  ratingVal: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  trainerDetailCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 15,
    borderWidth: 1,
    marginBottom: 20,
  },
  largeTrainerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  largeTrainerInfo: {
    flex: 1,
    marginLeft: 15,
  },
  largeTrainerName: {
    fontSize: 18,
    fontWeight: '700',
  },
  trainerSpecText: {
    fontSize: 12,
    marginTop: 3,
  },
  trainerExpText: {
    fontSize: 12,
    marginTop: 2,
  },
  reviewItemCard: {
    padding: 12,
    borderRadius: 15,
    borderWidth: 1,
    marginBottom: 12,
  },
  revHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  revUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  revUserAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  revUserNameCol: {
    marginLeft: 8,
  },
  revUserName: {
    fontSize: 12,
    fontWeight: '700',
  },
  starsRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  revTypeCol: {
    alignItems: 'flex-end',
  },
  bookingTypeBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bookingTypeText: {
    color: AppColors.accentColor,
    fontSize: 8,
    fontWeight: '700',
  },
  revDate: {
    fontSize: 10,
    marginTop: 3,
  },
  revComment: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  scoreNumberCol: {
    alignItems: 'center',
    marginRight: 20,
  },
  scoreBigNum: {
    fontSize: 38,
    fontWeight: '900',
  },
  reviewsCountText: {
    fontSize: 10,
    marginTop: 4,
  },
  histogramsCol: {
    flex: 1,
  },
  histoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  histoStarNum: {
    fontSize: 10,
    fontWeight: '700',
    width: 10,
  },
  histoBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  histoBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  histoPercent: {
    fontSize: 10,
    width: 25,
    textAlign: 'right',
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  bottomBtnWrapper: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  persistentCloseBtn: {
    height: 48,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  persistentCloseBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  trainerShowcaseSection: {
    marginVertical: 4,
  },
  showcaseSecTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'Outfit-Bold',
  },
  showcaseSecBody: {
    fontSize: 13.5,
    lineHeight: 21,
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'Outfit-Regular',
  },
  showcaseDivider: {
    borderBottomWidth: 1,
    marginVertical: 18,
  },
  showcaseServicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  showcaseServiceCol: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  showcaseServiceText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'Outfit-Medium',
  },
  showcaseRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  showcaseRowVal: {
    fontSize: 13.5,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'Outfit-Medium',
  },
  showcaseBulletText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'Outfit-Regular',
  },
});
