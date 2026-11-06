import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';

const NAV_ITEMS = [
  {
    label: 'Overview',
    iconName: 'dashboard',
    iconFamily: 'MaterialIcons',
    outlineIcon: 'dashboard',
  },
  {
    label: 'Members',
    iconName: 'people',
    iconFamily: 'MaterialIcons',
    outlineIcon: 'people-outline',
  },
  {
    label: 'Bookings',
    iconName: 'confirmation-number',
    iconFamily: 'MaterialIcons',
    outlineIcon: 'confirmation-number',
  },
  {
    label: 'Employee',
    iconName: 'badge',
    iconFamily: 'MaterialIcons',
    outlineIcon: 'badge',
  },
  {
    label: 'Sections',
    iconName: 'fitness-center',
    iconFamily: 'MaterialIcons',
    outlineIcon: 'fitness-center',
  },
];

const AnimatedNavItem = ({ item, isSelected, onTap, isDark }) => {
  const scaleAnim = useRef(new Animated.Value(isSelected ? 1.08 : 1.0)).current;
  const translateYAnim = useRef(new Animated.Value(isSelected ? -2 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: isSelected ? 1.1 : 1.0,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: isSelected ? -2 : 0,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isSelected, scaleAnim, translateYAnim]);

  const activeColor = isDark ? AppColors.secondaryColor : AppColors.primaryColor;
  const inactiveColor = isDark ? 'rgba(255, 255, 255, 0.48)' : '#94A3B8';

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onTap}
      style={styles.navItem}
    >
      <Animated.View
        style={[
          styles.iconContainer,
          {
            transform: [
              { scale: scaleAnim },
              { translateY: translateYAnim },
            ],
          },
        ]}
      >
        {item.iconFamily === 'MaterialIcons' ? (
          <MaterialIcons
            name={item.iconName}
            size={22}
            color={isSelected ? activeColor : inactiveColor}
          />
        ) : (
          <Ionicons
            name={isSelected ? item.iconName : item.outlineIcon}
            size={22}
            color={isSelected ? activeColor : inactiveColor}
          />
        )}
      </Animated.View>
      <Text
        style={[
          styles.navLabel,
          {
            fontSize: isSelected ? 10 : 9,
            fontWeight: isSelected ? '700' : '500',
            color: isSelected ? activeColor : inactiveColor,
          },
        ]}
        numberOfLines={1}
      >
        {item.label}
      </Text>
    </TouchableOpacity>
  );
};

export const CustomFloatingNavBar = ({ currentIndex, onTap }) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomMargin =
    insets.bottom > 0
      ? insets.bottom + 6
      : Platform.OS === 'ios'
      ? 20
      : 16;
  const [rowWidth, setRowWidth] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scalePillAnim = useRef(new Animated.Value(1)).current;

  const tabCount = NAV_ITEMS.length;
  const tabWidth = rowWidth > 0 ? (rowWidth - 12) / tabCount : 0;

  useEffect(() => {
    if (tabWidth > 0) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: currentIndex * tabWidth,
          tension: 72,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(scalePillAnim, {
            toValue: 0.92,
            duration: 90,
            useNativeDriver: true,
          }),
          Animated.spring(scalePillAnim, {
            toValue: 1,
            tension: 80,
            friction: 7,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [currentIndex, tabWidth, slideAnim, scalePillAnim]);

  const onRowLayout = (event) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0 && width !== rowWidth) {
      setRowWidth(width);
      slideAnim.setValue(currentIndex * ((width - 12) / tabCount));
    }
  };

  return (
    <View style={styles.outerWrapper} pointerEvents="box-none">
      <View
        style={[
          styles.container,
          {
            marginBottom: bottomMargin,
            backgroundColor: isDark
              ? 'rgba(22, 22, 26, 0.92)'
              : 'rgba(255, 255, 255, 0.94)',
            borderColor: isDark
              ? 'rgba(255, 255, 255, 0.14)'
              : 'rgba(226, 232, 240, 0.9)',
          },
        ]}
      >
        <View
          style={styles.navRow}
          onLayout={onRowLayout}
        >
          {/* Animated Sliding Background Active Pill */}
          {tabWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.slidingPill,
                {
                  width: tabWidth,
                  transform: [
                    { translateX: slideAnim },
                    { scale: scalePillAnim },
                  ],
                  backgroundColor: isDark
                    ? 'rgba(0, 191, 98, 0.12)'
                    : 'rgba(0, 56, 130, 0.08)',
                  borderColor: isDark
                    ? 'rgba(0, 191, 98, 0.28)'
                    : 'rgba(0, 56, 130, 0.18)',
                },
              ]}
            />
          )}

          {NAV_ITEMS.map((item, index) => (
            <AnimatedNavItem
              key={item.label}
              item={item}
              isSelected={currentIndex === index}
              onTap={() => onTap(index)}
              isDark={isDark}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  container: {
    marginHorizontal: 12,
    borderRadius: 30,
    borderWidth: 1.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 10,
    width: '92%',
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 7,
    position: 'relative',
  },
  slidingPill: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 6,
    borderRadius: 22,
    borderWidth: 1,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    zIndex: 2,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
  },
  navLabel: {
    marginTop: 3,
    fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'Outfit-Medium',
  },
});
