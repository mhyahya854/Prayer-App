import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppPalette } from '@/src/theme/palette';
import type { ThemePreference } from '@/src/theme/theme-provider';

const options: Array<{
  description: string;
  id: ThemePreference;
  label: string;
  title: string;
}> = [
  {
    description: 'Switch between day and night mode depending on the time of day.',
    id: 'system',
    label: 'AUTO',
    title: 'Auto',
  },
  {
    description: 'Stay fixed in day mode on the prayer time page.',
    id: 'light',
    label: 'DAY',
    title: 'Day Mode',
  },
  {
    description: 'Stay fixed in night mode on the prayer time page.',
    id: 'dark',
    label: 'NIGHT',
    title: 'Night Mode',
  },
];

interface ThemeModeSelectorProps {
  onChange: (preference: ThemePreference) => void;
  value: ThemePreference;
}

export function ThemeModeSelector({ onChange, value }: ThemeModeSelectorProps) {
  const palette = useAppPalette();

  return (
    <View style={styles.container}>
      {options.map((option) => {
        const isActive = option.id === value;

        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(option.id)}
            style={[
              styles.option,
              {
                backgroundColor: isActive ? palette.accentSoft : 'transparent',
                borderColor: isActive ? palette.accent : palette.border,
              },
            ]}
          >
            <View style={styles.optionTopRow}>
              <Text
                style={[
                  styles.optionBadge,
                  {
                    backgroundColor: isActive ? palette.accentSoft : palette.surface,
                    borderColor: isActive ? palette.accent : palette.border,
                    color: isActive ? palette.accent : palette.subtleText,
                  },
                ]}
              >
                {option.label}
              </Text>
              <Text
                style={[
                  styles.optionTitle,
                  {
                    color: isActive ? palette.accent : palette.text,
                  },
                ]}
              >
                {option.title}
              </Text>
            </View>
            <Text style={[styles.optionDescription, { color: palette.subtleText }]}>
              {option.description}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  option: {
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  optionBadge: {
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
});
