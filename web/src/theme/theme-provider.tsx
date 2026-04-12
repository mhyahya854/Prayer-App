import {
  getDefaultThemePreference,
  type AppThemePreference,
  type TimestampedValue,
} from '@prayer-app/core';
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import {
  loadThemePreferenceSnapshot,
  saveThemePreference,
} from '@/src/lib/storage/theme-storage';

export type ResolvedTheme = 'light' | 'dark';
export type ThemePreference = AppThemePreference;

interface ThemePreferenceContextValue {
  hasLoadedPreference: boolean;
  replaceThemePreferenceSnapshot: (snapshot: TimestampedValue<ThemePreference>) => Promise<void>;
  resolvedTheme: ResolvedTheme;
  themePreference: ThemePreference;
  themePreferenceUpdatedAt: string;
  setThemePreference: (nextPreference: ThemePreference) => Promise<void>;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useSystemColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(getDefaultThemePreference());
  const [themePreferenceUpdatedAt, setThemePreferenceUpdatedAt] = useState<string>('');
  const [hasLoadedPreference, setHasLoadedPreference] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPreference() {
      try {
        const snapshot = await loadThemePreferenceSnapshot();

        if (isMounted) {
          setThemePreferenceState(snapshot.value);
          setThemePreferenceUpdatedAt(snapshot.updatedAt);
        }
      } catch {
        // Ignore storage issues and keep the system theme fallback.
      } finally {
        if (isMounted) {
          setHasLoadedPreference(true);
        }
      }
    }

    void loadPreference();

    return () => {
      isMounted = false;
    };
  }, []);

  const resolvedTheme: ResolvedTheme =
    themePreference === 'system'
      ? systemColorScheme === 'dark'
        ? 'dark'
      : 'light'
      : themePreference;

  async function setThemePreference(nextPreference: ThemePreference) {
    const updatedAt = new Date().toISOString();
    setThemePreferenceState(nextPreference);
    setThemePreferenceUpdatedAt(updatedAt);

    try {
      await saveThemePreference(nextPreference, updatedAt);
    } catch {
      // Ignore persistence failures for now; in-memory state still updates.
    }
  }

  async function replaceThemePreferenceSnapshot(snapshot: TimestampedValue<ThemePreference>) {
    setThemePreferenceState(snapshot.value);
    setThemePreferenceUpdatedAt(snapshot.updatedAt);
    await saveThemePreference(snapshot.value, snapshot.updatedAt);
  }

  return (
    <ThemePreferenceContext.Provider
      value={{
        hasLoadedPreference,
        replaceThemePreferenceSnapshot,
        resolvedTheme,
        themePreference,
        themePreferenceUpdatedAt,
        setThemePreference,
      }}
    >
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  const context = useContext(ThemePreferenceContext);

  if (!context) {
    throw new Error('useThemePreference must be used inside AppThemeProvider.');
  }

  return context;
}

export function useResolvedTheme(): ResolvedTheme {
  return useThemePreference().resolvedTheme;
}
