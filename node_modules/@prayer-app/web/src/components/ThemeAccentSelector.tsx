import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ThemeAccent } from '@/src/lib/storage/theme-storage';
import { useAppPalette } from '@/src/theme/palette';

const accentOptions: Array<{ key: ThemeAccent; label: string; color: string }> = [
  { key: 'default', label: 'Default', color: '#8B6F4E' },
  { key: 'gold', label: 'Gold', color: '#D4A017' },
  { key: 'emerald', label: 'Emerald', color: '#4FB68A' },
  { key: 'rose', label: 'Rose', color: '#D6829D' },
  { key: 'sky', label: 'Sky', color: '#69A8E0' },
  { key: 'violet', label: 'Violet', color: '#A38BE7' },
];

interface ThemeAccentSelectorProps {
  onChange: (accent: ThemeAccent) => void;
  value: ThemeAccent;
}

export function ThemeAccentSelector({ onChange, value }: ThemeAccentSelectorProps) {
  const palette = useAppPalette();

  return (
    <View style={styles.row}>
      {accentOptions.map((option) => {
        const isActive = option.key === value;

        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
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
              <Text style={styles.label}>{option.label}</Text>
              {isActive ? <Text style={styles.check}>{'✓'}</Text> : null}
            </View>
            <Text style={styles.helper}>Apply this app color theme</Text>
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
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
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
