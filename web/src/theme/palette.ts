import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

import { useResolvedTheme } from '@/src/theme/theme-provider';

const lightPalette = {
  background: '#F6F1E7',
  surface: '#FCF8F2',
  card: '#F5EEE3',
  hero: '#EEE4D4',
  highlight: '#EFF3EC',
  border: '#E3D7C6',
  text: '#18231E',
  subtleText: '#66716C',
  accent: '#47685A',
  accentSoft: '#E4ECE6',
  successSoft: '#E7EEE2',
};

const darkPalette = {
  background: '#0D1713',
  surface: '#141F1A',
  card: '#19251F',
  hero: '#1D2B24',
  highlight: '#1A2620',
  border: '#2A3832',
  text: '#F3EDE2',
  subtleText: '#A7B5AF',
  accent: '#87B39C',
  accentSoft: '#24352D',
  successSoft: '#22322A',
};

export type Palette = typeof lightPalette;

export const appNavigationThemes: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: lightPalette.background,
      card: lightPalette.surface,
      text: lightPalette.text,
      border: lightPalette.border,
      primary: lightPalette.accent,
      notification: lightPalette.accent,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: darkPalette.background,
      card: darkPalette.surface,
      text: darkPalette.text,
      border: darkPalette.border,
      primary: darkPalette.accent,
      notification: darkPalette.accent,
    },
  },
};

export function useAppPalette(): Palette {
  const resolvedTheme = useResolvedTheme();
  return resolvedTheme === 'dark' ? darkPalette : lightPalette;
}
