import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';

export const CustomFloatingNavBar = ({ currentIndex, onTap }) => {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomMargin = insets.bottom > 0
    ? insets.bottom + 6
    : (Platform.OS === 'ios' ? 24 : 16);

  const navItems = [
    {
      label: 'Explore',
      iconName: 'explore',
      iconFamily: 'MaterialIcons',
      outlineIcon: 'explore',
    },
    {
      label: 'Bookings',
      iconName: 'calendar-today',
      iconFamily: 'MaterialIcons',
      outlineIcon: 'calendar-today',
    },
    {
      label: 'Memberships',
      iconName: 'card-membership',
      iconFamily: 'MaterialIcons',
      outlineIcon: 'card-membership',
    },
    {
      label: 'Profile',
      iconName: 'person',
      iconFamily: 'Ionicons',
      outlineIcon: 'person-outline',
    },
  ];

  return (
    <View style={styles.outerWrapper} pointerEvents="box-none">
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark
              ? 'rgba(24, 24, 27, 0.88)'
              : 'rgba(255, 255, 255, 0.88)',
            borderColor: isDark
              ? 'rgba(255, 255, 255, 0.12)'
              : 'rgba(226, 232, 240, 0.85)',
            marginBottom: bottomMargin,
          },
        ]}
      >
        <View style={styles.navRow}>
          {navItems.map((item, index) => {
            const isSelected = currentIndex === index;
            const activeColor = isDark ? AppColors.secondaryColor : AppColors.primaryColor;
            const inactiveColor = isDark ? 'rgba(255, 255, 255, 0.54)' : '#94A3B8';

            return (
              <TouchableOpacity
                key={item.label}
                activeOpacity={0.7}
                onPress={() => onTap(index)}
                style={[
                  styles.navItem,
                  {
                    paddingHorizontal: isSelected ? 16 : 12,
                  },
                ]}
              >
                {item.iconFamily === 'MaterialIcons' ? (
                  <MaterialIcons
                    name={item.iconName}
                    size={24}
                    color={isSelected ? activeColor : inactiveColor}
                  />
                ) : (
                  <Ionicons
                    name={isSelected ? item.iconName : item.outlineIcon}
                    size={24}
                    color={isSelected ? activeColor : inactiveColor}
                  />
                )}
                <Text
                  style={[
                    styles.navLabel,
                    {
                      fontSize: isSelected ? 10 : 9,
                      fontWeight: isSelected ? '700' : '500',
                      color: isSelected ? activeColor : inactiveColor,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
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
  },
  container: {
    marginHorizontal: 16,
    marginBottom: Platform.OS === 'ios' ? 24 : 18,
    borderRadius: 28,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
    width: '92%',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  navLabel: {
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'Outfit-Medium',
  },
});
