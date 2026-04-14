import { PropsWithChildren, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';

import { useAppPalette } from '@/src/theme/palette';

interface CollapsibleSectionProps extends PropsWithChildren {
  collapsible?: boolean;
  title: string;
  subtitle?: string;
  defaultExpanded?: boolean;
}

export function CollapsibleSection({
  children,
  title,
  subtitle,
  defaultExpanded = false,
  collapsible = true,
}: CollapsibleSectionProps) {
  const palette = useAppPalette();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isExpanded = collapsible ? expanded : true;

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Pressable
        style={[styles.header, isExpanded && styles.headerExpanded]}
        onPress={() => {
          if (collapsible) {
            setExpanded(!expanded);
          }
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
      >
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: palette.subtleText }]}>{subtitle}</Text> : null}
        </View>
        {collapsible ? (
          <Text style={[styles.chevron, { color: palette.subtleText }]}>
            {isExpanded ? '\u2303' : '\u2304'}
          </Text>
        ) : null}
      </Pressable>
      {isExpanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 0.5,
    padding: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
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
    fontSize: 16,
    fontWeight: '400',
    paddingLeft: 12,
  },
  body: {
    gap: 8,
  },
});
