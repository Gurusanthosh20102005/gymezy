import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  Pressable,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';

const AlertContext = createContext(null);

let imperativeAlertHandler = null;

/**
 * Imperative drop-in replacement for React Native's Alert.alert(title, message, buttons, options)
 */
export const customAlert = (title, message = '', buttons, options = {}) => {
  if (typeof imperativeAlertHandler === 'function') {
    imperativeAlertHandler({ title, message, buttons, options });
  }
};

const inferVariant = (title = '', message = '', buttons = []) => {
  const text = `${title} ${message}`.toLowerCase();
  const hasDestructive = Array.isArray(buttons) && buttons.some((b) => b?.style === 'destructive');
  if (
    hasDestructive ||
    text.includes('denied') ||
    text.includes('failed') ||
    text.includes('error') ||
    text.includes('cancelled') ||
    text.includes('delete') ||
    text.includes('remove')
  ) {
    return 'error';
  }
  if (
    text.includes('expired') ||
    text.includes('upcoming') ||
    text.includes('warning') ||
    text.includes('required') ||
    text.includes('hold') ||
    text.includes('sign out')
  ) {
    return 'warning';
  }
  if (text.includes('success') || text.includes('granted') || text.includes('approved')) {
    return 'success';
  }
  return 'info';
};

const VARIANT_CONFIG = {
  error: {
    icon: 'error-outline',
    color: '#EF4444',
    bgLight: '#FEF2F2',
    bgDark: 'rgba(239, 68, 68, 0.16)',
  },
  warning: {
    icon: 'warning-amber',
    color: '#F59E0B',
    bgLight: '#FFFBEB',
    bgDark: 'rgba(245, 158, 11, 0.16)',
  },
  success: {
    icon: 'check-circle-outline',
    color: '#10B981',
    bgLight: '#ECFDF5',
    bgDark: 'rgba(16, 185, 129, 0.16)',
  },
  info: {
    icon: 'info-outline',
    color: '#2563EB',
    bgLight: '#EFF6FF',
    bgDark: 'rgba(37, 99, 235, 0.16)',
  },
};

export const AlertProvider = ({ children }) => {
  const { isDark } = useTheme();
  const [alertState, setAlertState] = useState(null);
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const showAlert = useCallback(
    ({ title, message = '', buttons, options = {} }) => {
      const normalizedButtons =
        Array.isArray(buttons) && buttons.length > 0
          ? buttons
          : [{ text: 'OK', style: 'default' }];

      setAlertState({
        title: title ? String(title) : '',
        message: message ? String(message) : '',
        buttons: normalizedButtons,
        options: options || {},
      });

      scaleAnim.setValue(0.92);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [opacityAnim, scaleAnim]
  );

  const dismissAlert = useCallback(() => {
    const onDismiss = alertState?.options?.onDismiss;
    setAlertState(null);
    if (typeof onDismiss === 'function') {
      onDismiss();
    }
  }, [alertState]);

  useEffect(() => {
    imperativeAlertHandler = showAlert;
    // Override native Alert.alert globally so no native Android/iOS dialog can appear
    Alert.alert = (title, message, buttons, options) => {
      showAlert({ title, message, buttons, options });
    };
    return () => {
      if (imperativeAlertHandler === showAlert) {
        imperativeAlertHandler = null;
      }
    };
  }, [showAlert]);

  const variantKey = alertState
    ? inferVariant(alertState.title, alertState.message, alertState.buttons)
    : 'info';
  const variant = VARIANT_CONFIG[variantKey];
  const isStacked = (alertState?.buttons?.length || 0) > 2;

  const cardBg = isDark ? AppColors.darkCard : '#FFFFFF';
  const borderColor = isDark ? AppColors.darkBorder : '#E2E8F0';
  const titleColor = isDark ? '#FFFFFF' : '#0F172A';
  const messageColor = isDark ? 'rgba(255,255,255,0.75)' : '#475569';

  return (
    <AlertContext.Provider value={{ showAlert: customAlert }}>
      {children}
      <Modal
        visible={Boolean(alertState)}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => {
          if (alertState?.options?.cancelable !== false) {
            dismissAlert();
          }
        }}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (alertState?.options?.cancelable) {
              dismissAlert();
            }
          }}
        >
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.cardWrapper}>
            <Animated.View
              style={[
                styles.card,
                {
                  backgroundColor: cardBg,
                  borderColor,
                  opacity: opacityAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <View
                style={[
                  styles.iconBadge,
                  { backgroundColor: isDark ? variant.bgDark : variant.bgLight },
                ]}
              >
                <Icon name={variant.icon} size={28} color={variant.color} />
              </View>

              {Boolean(alertState?.title) && (
                <Text style={[styles.title, { color: titleColor }]}>
                  {alertState.title}
                </Text>
              )}

              {Boolean(alertState?.message) && (
                <Text style={[styles.message, { color: messageColor }]}>
                  {alertState.message}
                </Text>
              )}

              <View
                style={[
                  styles.actionsContainer,
                  isStacked ? styles.actionsStacked : styles.actionsRow,
                ]}
              >
                {(alertState?.buttons || []).map((btn, idx) => {
                  const isCancel = btn?.style === 'cancel';
                  const isDestructive = btn?.style === 'destructive';
                  const isPrimary = !isCancel && !isDestructive && idx === alertState.buttons.length - 1;

                  let btnBg = isDark ? '#1E293B' : '#F1F5F9';
                  let btnTextColor = isDark ? '#E2E8F0' : '#334155';
                  let btnBorderColor = borderColor;

                  if (isDestructive) {
                    btnBg = '#EF4444';
                    btnTextColor = '#FFFFFF';
                    btnBorderColor = '#EF4444';
                  } else if (isPrimary) {
                    btnBg = AppColors.primaryColor;
                    btnTextColor = '#FFFFFF';
                    btnBorderColor = AppColors.primaryColor;
                  }

                  return (
                    <TouchableOpacity
                      key={`${btn?.text || 'btn'}-${idx}`}
                      activeOpacity={0.8}
                      onPress={() => {
                        setAlertState(null);
                        if (typeof btn?.onPress === 'function') {
                          btn.onPress();
                        }
                      }}
                      style={[
                        styles.actionBtn,
                        !isStacked && { flex: 1 },
                        {
                          backgroundColor: btnBg,
                          borderColor: btnBorderColor,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.actionBtnText,
                          {
                            color: btnTextColor,
                            fontWeight: isCancel ? '600' : '700',
                          },
                        ]}
                      >
                        {btn?.text || 'OK'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>
    </AlertContext.Provider>
  );
};

export const useCustomAlert = () => {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    return { showAlert: customAlert };
  }
  return ctx;
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 360,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  iconBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
  },
  actionsContainer: {
    width: '100%',
    gap: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionsStacked: {
    flexDirection: 'column',
  },
  actionBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  actionBtnText: {
    fontSize: 14,
  },
});

export default AlertProvider;
