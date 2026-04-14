export type QuranScriptStyle = 'uthmani' | 'indopak' | 'simple';

export const quranScriptStyleOptions: Array<{ id: QuranScriptStyle; label: string }> = [
  { id: 'uthmani', label: 'Uthmani' },
  { id: 'indopak', label: 'IndoPak' },
  { id: 'simple', label: 'Simple' },
];

export function getArabicFontFamily(scriptStyle: QuranScriptStyle) {
  if (scriptStyle === 'indopak') {
    return 'Noto Nastaliq Urdu, "Times New Roman", serif';
  }

  if (scriptStyle === 'simple') {
    return 'system-ui, sans-serif';
  }

  return '"Scheherazade New", Amiri, serif';
}

export function getArabicLineHeightMultiplier(scriptStyle: QuranScriptStyle) {
  if (scriptStyle === 'indopak') {
    return 1.8;
  }

  if (scriptStyle === 'simple') {
    return 1.45;
  }

  return 1.6;
}
