import AsyncStorage from '@react-native-async-storage/async-storage';

import type { QuranScriptStyle } from '@/src/content/quran-display-style';

const quranScriptStyleStorageKey = 'prayer-app.quran-script-style';

function isQuranScriptStyle(value: unknown): value is QuranScriptStyle {
  return value === 'uthmani' || value === 'indopak' || value === 'simple';
}

export async function loadQuranScriptStyle(): Promise<QuranScriptStyle> {
  const rawValue = await AsyncStorage.getItem(quranScriptStyleStorageKey);
  if (!rawValue) {
    return 'uthmani';
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return isQuranScriptStyle(parsed) ? parsed : 'uthmani';
  } catch {
    return isQuranScriptStyle(rawValue) ? rawValue : 'uthmani';
  }
}

export async function saveQuranScriptStyle(style: QuranScriptStyle) {
  await AsyncStorage.setItem(quranScriptStyleStorageKey, JSON.stringify(style));
}
