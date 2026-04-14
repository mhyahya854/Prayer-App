import React from 'react';
import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { useAppPalette } from '@/src/theme/palette';

export default function TabLayout() {
  const palette = useAppPalette();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.subtleText,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: Platform.OS !== 'web',
        headerStyle: {
          backgroundColor: palette.surface,
        },
        headerShadowVisible: false,
        headerTitleStyle: {
          color: palette.text,
          fontSize: 17,
          fontWeight: '600',
        },
        headerTintColor: palette.text,
        sceneStyle: {
          backgroundColor: palette.background,
        },
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          height: Platform.select({ ios: 82, default: 70 }),
          paddingBottom: Platform.select({ ios: 20, default: 8 }),
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'moon.stars.fill',
                android: 'nights_stay',
                web: 'nights_stay',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="quran"
        options={{
          title: 'Quran',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'book.fill',
                android: 'menu_book',
                web: 'menu_book',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="duas"
        options={{
          title: 'Duas',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'sparkles',
                android: 'auto_awesome',
                web: 'auto_awesome',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          href: null,
          title: 'Progress',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'chart.bar.fill',
                android: 'bar_chart',
                web: 'bar_chart',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="mosques"
        options={{
          title: 'Mosques',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'mappin.and.ellipse',
                android: 'location_on',
                web: 'location_on',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="qibla"
        options={{
          title: 'Qibla',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'location.north.line.fill',
                android: 'explore',
                web: 'explore',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'gearshape.fill',
                android: 'settings',
                web: 'settings',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
    </Tabs>
  );
}



