import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ThemePreference } from '@/src/theme/theme-provider';
import { useAppPalette } from '@/src/theme/palette';

const options: ThemePreference[] = ['system', 'light', 'dark'];

interface ThemeModeSelectorProps {
  onChange: (preference: ThemePreference) => void;
  value: ThemePreference;
}

export function ThemeModeSelector({ onChange, value }: ThemeModeSelectorProps) {
  const palette = useAppPalette();

  return (
    <View style={[styles.container, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      {options.map((option) => {
        const isActive = option === value;

        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            onPress={() => onChange(option)}
            style={[
              styles.option,
              {
                backgroundColor: isActive ? palette.accentSoft : 'transparent',
                borderColor: isActive ? palette.accent : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                styles.optionText,
                {
                  color: isActive ? palette.accent : palette.subtleText,
                },
              ]}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    padding: 3,
  },
  option: {
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
