import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { ContentDataProvider } from '@/src/content/content-provider';
import { PrayerNotificationProvider } from '@/src/notifications/notification-provider';
import { useAppNavigationTheme } from '@/src/theme/palette';
import { PrayerDataProvider } from '@/src/prayer/prayer-provider';
import { GoogleDriveSyncProvider } from '@/src/sync/google-drive-sync-provider';
import { AppThemeProvider, useResolvedTheme } from '@/src/theme/theme-provider';
import '@/src/lib/i18n/config';

export function ErrorBoundary(props: { error: Error; retry: () => void }) {
  return <GlobalErrorBoundary {...props} />;
}

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AppThemeProvider>
      <ContentDataProvider>
        <PrayerDataProvider>
          <PrayerNotificationProvider>
            <GoogleDriveSyncProvider>
              <RootLayoutNav />
            </GoogleDriveSyncProvider>
          </PrayerNotificationProvider>
        </PrayerDataProvider>
      </ContentDataProvider>
    </AppThemeProvider>
  );
}

function GlobalErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={errorStyles.container}>
      <Text style={errorStyles.title}>Something went wrong</Text>
      <Text style={errorStyles.message}>{error.message}</Text>
      <Pressable onPress={retry} style={errorStyles.button}>
        <Text style={errorStyles.buttonText}>Retry App</Text>
      </Pressable>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#0B1120',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  message: {
    color: '#94A3B8',
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#8B6F4E',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

function RootLayoutNav() {
  const resolvedTheme = useResolvedTheme();
  const navigationTheme = useAppNavigationTheme();

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth-complete" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
