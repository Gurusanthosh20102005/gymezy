import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { bookmarkService } from '../services/bookmarkService';
import { SkeletonBookmarkRow } from './Skeleton';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export const BookmarkedGymsModal = ({
  visible,
  onClose,
  navigation,
  userLocation,
}) => {
  const { colors, isDark } = useTheme();
  const [gyms, setGyms] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadBookmarks = useCallback(async () => {
    setIsLoading(true);
    try {
      const coords = userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : {};
      const list = await bookmarkService.fetchLiveBookmarks(coords);
      setGyms(list || []);
    } catch {
      setGyms(bookmarkService.getCachedGyms() || []);
    } finally {
      setIsLoading(false);
    }
  }, [userLocation]);

  useEffect(() => {
    if (visible) {
      loadBookmarks();
    }
  }, [visible, loadBookmarks]);

  useEffect(() => {
    // Subscribe to live bookmark updates
    const unsubscribe = bookmarkService.subscribe((_, cachedGyms) => {
      setGyms([...cachedGyms]);
    });
    return unsubscribe;
  }, []);

  const handleRemoveBookmark = async (gym) => {
    await bookmarkService.toggleBookmark(gym);
  };

  const handleGymPress = (gym) => {
    onClose?.();
    navigation?.navigate('GymDetails', { gym });
  };

  const formatRating = (val) => {
    const num = Number(val);
    if (Number.isNaN(num) || num <= 0) return 'No ratings';
    return num.toFixed(1);
  };

  const getGymCoverImage = (gym) => {
    const fallback = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=400&auto=format&fit=crop';
    if (!gym) return fallback;

    // Direct string URLs
    if (typeof gym.coverPhotoUrl === 'string' && gym.coverPhotoUrl.trim().length > 0) {
      return gym.coverPhotoUrl.trim();
    }
    if (typeof gym.coverPhoto === 'string' && gym.coverPhoto.trim().length > 0) {
      return gym.coverPhoto.trim();
    }
    if (typeof gym.imageUrl === 'string' && gym.imageUrl.trim().length > 0) {
      return gym.imageUrl.trim();
    }
    if (typeof gym.image === 'string' && gym.image.trim().length > 0) {
      return gym.image.trim();
    }
    if (typeof gym.thumbnailImage === 'string' && gym.thumbnailImage.trim().length > 0) {
      return gym.thumbnailImage.trim();
    }
    if (typeof gym.logoUrl === 'string' && gym.logoUrl.trim().length > 0) {
      return gym.logoUrl.trim();
    }
    if (typeof gym.logo === 'string' && gym.logo.trim().length > 0) {
      return gym.logo.trim();
    }

    // Object fields with fileData / url / secure_url
    if (gym.coverPhoto && typeof gym.coverPhoto === 'object') {
      if (typeof gym.coverPhoto.fileData === 'string' && gym.coverPhoto.fileData.trim().length > 0) {
        return gym.coverPhoto.fileData.trim();
      }
      if (typeof gym.coverPhoto.url === 'string' && gym.coverPhoto.url.trim().length > 0) {
        return gym.coverPhoto.url.trim();
      }
      if (typeof gym.coverPhoto.secure_url === 'string' && gym.coverPhoto.secure_url.trim().length > 0) {
        return gym.coverPhoto.secure_url.trim();
      }
    }

    if (gym.logo && typeof gym.logo === 'object') {
      if (typeof gym.logo.fileData === 'string' && gym.logo.fileData.trim().length > 0) {
        return gym.logo.fileData.trim();
      }
      if (typeof gym.logo.url === 'string' && gym.logo.url.trim().length > 0) {
        return gym.logo.url.trim();
      }
      if (typeof gym.logo.secure_url === 'string' && gym.logo.secure_url.trim().length > 0) {
        return gym.logo.secure_url.trim();
      }
    }

    // Images array
    if (Array.isArray(gym.images) && gym.images.length > 0 && typeof gym.images[0] === 'string' && gym.images[0].trim().length > 0) {
      return gym.images[0].trim();
    }

    return fallback;
  };

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
          <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.headerIconBox,
                  { backgroundColor: isDark ? 'rgba(0, 191, 98, 0.15)' : 'rgba(0, 191, 98, 0.10)' },
                ]}
              >
                <MaterialIcons name="bookmark" size={20} color={AppColors.secondaryColor} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Bookmarked Gyms</Text>
                <Text style={[styles.headerSub, { color: colors.subtitle }]}>
                  {gyms.length} {gyms.length === 1 ? 'gym' : 'gyms'} saved
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? '#262626' : '#F1F5F9' }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView
            contentContainerStyle={styles.scrollBody}
            showsVerticalScrollIndicator={false}
          >
            {isLoading && gyms.length === 0 ? (
              <View style={{ paddingTop: 8 }}>
                <SkeletonBookmarkRow />
                <SkeletonBookmarkRow />
                <SkeletonBookmarkRow />
              </View>
            ) : gyms.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View
                  style={[
                    styles.emptyIconCircle,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC' },
                  ]}
                >
                  <MaterialIcons name="bookmark-border" size={44} color={colors.subtitle} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No Bookmarked Gyms</Text>
                <Text style={[styles.emptySub, { color: colors.subtitle }]}>
                  Tap the bookmark icon on any gym card while exploring to save your favorite fitness centers here.
                </Text>
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.exploreBtn, { backgroundColor: AppColors.primaryColor }]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.exploreBtnText}>Explore Gyms</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.gymsList}>
                {gyms.map((gym, index) => {
                  const ratingStr = formatRating(gym.rating);
                  const price = gym.singleSessionPrice || gym.pricePerSession || 199;
                  const coverImg = getGymCoverImage(gym);

                  return (
                    <TouchableOpacity
                      key={gym._id || gym.id || index}
                      onPress={() => handleGymPress(gym)}
                      activeOpacity={0.85}
                      style={[
                        styles.gymCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Image source={{ uri: coverImg }} style={styles.gymCardImage} />

                      <View style={styles.gymCardContent}>
                        <View style={styles.gymCardTopRow}>
                          <Text
                            style={[styles.gymCardName, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {gym.name}
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleRemoveBookmark(gym)}
                            style={styles.unbookmarkBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <MaterialIcons
                              name="bookmark"
                              size={20}
                              color={AppColors.secondaryColor}
                            />
                          </TouchableOpacity>
                        </View>

                        {/* Location */}
                        <View style={styles.infoRow}>
                          <MaterialIcons name="location-on" size={13} color={colors.subtitle} />
                          <Text
                            style={[styles.gymCardLocation, { color: colors.subtitle }]}
                            numberOfLines={1}
                          >
                            {gym.area || gym.location || 'Chennai'}
                            {gym.distanceText ? ` • ${gym.distanceText}` : gym.distance ? ` • ${gym.distance} km` : ''}
                          </Text>
                        </View>

                        {/* Rating & Price Row */}
                        <View style={styles.gymCardBottomRow}>
                          <View
                            style={[
                              styles.ratingBadge,
                              { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7' },
                            ]}
                          >
                            <MaterialIcons name="star" size={12} color="#F59E0B" />
                            <Text style={styles.ratingText}>{ratingStr}</Text>
                          </View>

                          <View style={styles.priceRow}>
                            <Text style={[styles.priceAmount, { color: colors.text }]}>₹{price}</Text>
                            <Text style={[styles.pricePer, { color: colors.subtitle }]}>/session</Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 24,
  },
  exploreBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  gymsList: {
    gap: 12,
  },
  gymCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 10,
    gap: 12,
  },
  gymCardImage: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  gymCardContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  gymCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gymCardName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  unbookmarkBtn: {
    padding: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  gymCardLocation: {
    fontSize: 12,
    flex: 1,
  },
  gymCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#D97706',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  pricePer: {
    fontSize: 11,
    marginLeft: 2,
  },
});

export default BookmarkedGymsModal;

