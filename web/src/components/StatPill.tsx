import { StyleSheet, Text, View } from 'react-native';

import { useAppPalette } from '@/src/theme/palette';

interface StatPillProps {
  label: string;
  value: string;
}

export function StatPill({ label, value }: StatPillProps) {
  const palette = useAppPalette();

  return (
    <View style={[styles.pill, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Text style={[styles.label, { color: palette.subtleText }]}>{label}</Text>
      <Text style={[styles.value, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    minWidth: 92,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
  },
});
