import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ThemePreference } from '@/src/theme/theme-provider';
import { useAppPalette } from '@/src/theme/palette';

const options: Array<{
  description: string;
  icon: string;
  id: ThemePreference;
  title: string;
}> = [
  {
    description: 'Switch between day & night mode depending on the time of day.',
    icon: '📱',
    id: 'system',
    title: 'Auto',
  },
  {
    description: 'Stay fixed in day mode on the prayer time page.',
    icon: '☀️',
    id: 'light',
    title: 'Day Mode',
  },
  {
    description: 'Stay fixed in night mode on the prayer time page.',
    icon: '🌙',
    id: 'dark',
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
              <Text style={styles.optionIcon}>{option.icon}</Text>
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
  optionIcon: {
    fontSize: 16,
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
