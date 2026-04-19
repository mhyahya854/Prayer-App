import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ThemeAccent } from '@/src/lib/storage/theme-storage';
import { useAppPalette } from '@/src/theme/palette';

const accentOptions: Array<{ color: string; key: ThemeAccent }> = [
  { key: 'default', color: '#8B6F4E' },
  { key: 'gold', color: '#D4A017' },
  { key: 'emerald', color: '#4FB68A' },
  { key: 'rose', color: '#D6829D' },
  { key: 'sky', color: '#69A8E0' },
  { key: 'violet', color: '#A38BE7' },
];

interface ThemeAccentSelectorProps {
  onChange: (accent: ThemeAccent) => void;
  value: ThemeAccent;
}

export function ThemeAccentSelector({ onChange, value }: ThemeAccentSelectorProps) {
  const { t } = useTranslation();
  const palette = useAppPalette();

  return (
    <View style={styles.row}>
      {accentOptions.map((option) => {
        const isActive = option.key === value;
        const label = t(`theme.accent_${option.key}`);

        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={t('theme.accent_selector_label', { label })}
            onPress={() => onChange(option.key)}
            style={[
              styles.swatch,
              {
                backgroundColor: option.color,
                borderColor: isActive ? palette.text : palette.border,
                borderWidth: isActive ? 2 : 1,
              },
            ]}
          >
            <View style={styles.swatchTopRow}>
              <Text style={styles.label}>{label}</Text>
              {isActive ? <Text style={styles.check}>{t('common.active')}</Text> : null}
            </View>
            <Text style={styles.helper}>{t('common.apply_theme')}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  swatch: {
    gap: 6,
    borderRadius: 12,
    minWidth: 140,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  swatchTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  check: {
    color: '#0B1120',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  label: {
    color: '#0B1120',
    fontSize: 14,
    fontWeight: '700',
  },
  helper: {
    color: '#0B1120',
    fontSize: 11,
    opacity: 0.8,
  },
});
