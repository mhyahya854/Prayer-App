import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

import { useThemePreference } from '@/src/theme/theme-provider';
import type { ThemeAccent } from '@/src/lib/storage/theme-storage';

// "Quiet celestial minimalism" — deep navy / warm gold / moonlit ivory
const goldLightPalette = {
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
const goldDarkPalette = {
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

export type Palette = typeof goldLightPalette;

const accentThemes: Record<ThemeAccent, { light: Palette; dark: Palette }> = {
  default: {
    light: goldLightPalette,
    dark: goldDarkPalette,
  },
  gold: {
    light: {
      ...goldLightPalette,
      background: '#FBF6E8',
      surface: '#FFFBEF',
      card: '#F6ECD0',
      hero: '#F2E4BD',
      highlight: '#F8F0D8',
      border: '#E1CC8E',
      accent: '#C99200',
      accentSoft: '#F4E4B8',
      gold: '#A67900',
      subtleText: '#75623A',
    },
    dark: {
      ...goldDarkPalette,
      background: '#171104',
      surface: '#241A08',
      card: '#34260E',
      hero: '#3D2D10',
      highlight: '#4B3814',
      border: '#6A4F1C',
      accent: '#D4A017',
      accentSoft: '#3D2B0B',
      gold: '#E1B43A',
      subtleText: '#C7A96A',
    },
  },
  emerald: {
    light: {
      ...goldLightPalette,
      background: '#EEF8F2',
      surface: '#F8FFFB',
      card: '#E5F4EB',
      hero: '#DDF0E6',
      highlight: '#E8F7EF',
      border: '#BCDCCB',
      accent: '#4FB68A',
      accentSoft: '#DAF1E8',
      gold: '#74D7AA',
      subtleText: '#56756A',
    },
    dark: {
      ...goldDarkPalette,
      background: '#081610',
      surface: '#10211A',
      card: '#153025',
      hero: '#173529',
      highlight: '#1A3D30',
      border: '#23513F',
      accent: '#4FB68A',
      accentSoft: '#163127',
      gold: '#74D7AA',
      subtleText: '#85B6A4',
    },
  },
  rose: {
    light: {
      ...goldLightPalette,
      background: '#FBF0F4',
      surface: '#FFF8FA',
      card: '#F6E4EB',
      hero: '#F2DAE4',
      highlight: '#F8EAF0',
      border: '#E2C1CE',
      accent: '#D6829D',
      accentSoft: '#F4DFE7',
      gold: '#E49AB3',
      subtleText: '#7B6070',
    },
    dark: {
      ...goldDarkPalette,
      background: '#170C13',
      surface: '#261420',
      card: '#331B2A',
      hero: '#3A1E30',
      highlight: '#452338',
      border: '#5A2E49',
      accent: '#D6829D',
      accentSoft: '#311924',
      gold: '#E49AB3',
      subtleText: '#C79BB0',
    },
  },
  sky: {
    light: {
      ...goldLightPalette,
      background: '#ECF5FD',
      surface: '#F7FBFF',
      card: '#E1EEFA',
      hero: '#D7E9F9',
      highlight: '#E8F3FD',
      border: '#B9D2E7',
      accent: '#69A8E0',
      accentSoft: '#DDECFB',
      gold: '#87BFF0',
      subtleText: '#5B7289',
    },
    dark: {
      ...goldDarkPalette,
      background: '#091321',
      surface: '#102036',
      card: '#16304E',
      hero: '#1B3758',
      highlight: '#1F4068',
      border: '#2A4F7A',
      accent: '#69A8E0',
      accentSoft: '#16283D',
      gold: '#87BFF0',
      subtleText: '#93B3D3',
    },
  },
  violet: {
    light: {
      ...goldLightPalette,
      background: '#F1EEFC',
      surface: '#FBFAFF',
      card: '#E8E3F8',
      hero: '#E0D8F5',
      highlight: '#EFEAFB',
      border: '#C8BCE7',
      accent: '#A38BE7',
      accentSoft: '#E9E1FB',
      gold: '#B9A6F0',
      subtleText: '#6E648E',
    },
    dark: {
      ...goldDarkPalette,
      background: '#0E0C20',
      surface: '#1A1638',
      card: '#251F4A',
      hero: '#2A2356',
      highlight: '#322C64',
      border: '#43398A',
      accent: '#A38BE7',
      accentSoft: '#241C3D',
      gold: '#B9A6F0',
      subtleText: '#A89BD2',
    },
  },
};

function buildPalette(theme: 'light' | 'dark', accentTheme: ThemeAccent): Palette {
  return theme === 'dark' ? accentThemes[accentTheme].dark : accentThemes[accentTheme].light;
}

function buildNavigationTheme(theme: 'light' | 'dark', accentTheme: ThemeAccent): Theme {
  const palette = buildPalette(theme, accentTheme);
  const baseTheme = theme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: palette.background,
      card: palette.surface,
      text: palette.text,
      border: palette.border,
      primary: palette.accent,
      notification: palette.accent,
    },
  };
}

export function useAppPalette(): Palette {
  const { resolvedTheme, accentTheme } = useThemePreference();
  return buildPalette(resolvedTheme, accentTheme);
}

export function useAppNavigationTheme(): Theme {
  const { resolvedTheme, accentTheme } = useThemePreference();
  return buildNavigationTheme(resolvedTheme, accentTheme);
}
