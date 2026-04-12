import { PropsWithChildren, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';

import { useAppPalette } from '@/src/theme/palette';

interface CollapsibleSectionProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  defaultExpanded?: boolean;
}

export function CollapsibleSection({ children, title, subtitle, defaultExpanded = false }: CollapsibleSectionProps) {
  const palette = useAppPalette();
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Pressable 
        style={[styles.header, expanded && styles.headerExpanded]} 
        onPress={() => setExpanded(!expanded)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: palette.subtleText }]}>{subtitle}</Text> : null}
        </View>
        <Text style={[styles.chevron, { color: palette.subtleText }]}>
          {expanded ? '?' : '?'}
        </Text>
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerExpanded: {
    marginBottom: 16,
  },
  headerText: {
    gap: 3,
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  chevron: {
    fontSize: 14,
    fontWeight: '600',
    paddingLeft: 12,
  },
  body: {
    gap: 8,
  },
});
