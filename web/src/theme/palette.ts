import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

import { useResolvedTheme } from '@/src/theme/theme-provider';

// "Quiet celestial minimalism" — deep navy / warm gold / moonlit ivory
const lightPalette = {
  background: '#F4F0E8',
  surface: '#FDFAF5',
  card: '#F0EBE0',
  hero: '#E8E1D4',
  highlight: '#ECE9E1',
  border: '#D8D0C4',
  text: '#1A2030',
  subtleText: '#6B778A',
  accent: '#8B6F4E',
  accentSoft: '#EDE3D5',
  successSoft: '#E2EDE8',
  gold: '#7A5C3A',
  danger: '#D9534F',
  success: '#3A8C5C',
};

// Dark palette — primary brand experience
const darkPalette = {
  background: '#0B1120',
  surface: '#111828',
  card: '#16202F',
  hero: '#1B2A3E',
  highlight: '#1C2E42',
  border: '#243347',
  text: '#EDE8DC',
  subtleText: '#8A99B0',
  accent: '#C9A96E',
  accentSoft: '#2A2218',
  successSoft: '#182C22',
  gold: '#C9A96E',
  danger: '#E87070',
  success: '#5BC87A',
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
