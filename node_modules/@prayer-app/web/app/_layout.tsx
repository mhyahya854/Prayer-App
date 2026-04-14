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

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

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

function RootLayoutNav() {
  const resolvedTheme = useResolvedTheme();
  const navigationTheme = useAppNavigationTheme();

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth-complete" options={{ headerShown: false }} />
        {/* modal route intentionally removed from product experience */}
      </Stack>
    </ThemeProvider>
  );
}
