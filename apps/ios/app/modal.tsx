import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { roadmapMilestones } from '@prayer-app/core';

import { SectionCard } from '@/src/components/SectionCard';
import { useAppPalette } from '@/src/theme/palette';

export default function ModalScreen() {
  const palette = useAppPalette();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={[styles.hero, { backgroundColor: palette.hero, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>Build Direction</Text>
        <Text style={[styles.copy, { color: palette.subtleText }]}>
          We are starting with the reliable daily worship experience first, then layering in Google
          integrations, tracking, and advanced notifications.
        </Text>
      </View>

      <SectionCard title="Delivery Plan" subtitle="Build depth before bloat">
        {roadmapMilestones.map((milestone) => (
          <View key={milestone.phase} style={[styles.row, { borderBottomColor: palette.border }]}>
            <Text style={[styles.phase, { color: palette.text }]}>{milestone.phase}</Text>
            <Text style={[styles.rowCopy, { color: palette.subtleText }]}>{milestone.objective}</Text>
          </View>
        ))}
      </SectionCard>

      <SectionCard title="Architecture Rules" subtitle="Guardrails for future work">
        <Text style={[styles.rule, { color: palette.text }]}>Google Drive backup uses one account-linked app-data file with automatic merge and restore.</Text>
        <Text style={[styles.rule, { color: palette.text }]}>Prayer times and Quran basics stay available offline.</Text>
        <Text style={[styles.rule, { color: palette.text }]}>Widgets, athan audio, and watch features land after the core is stable.</Text>
      </SectionCard>

      <StatusBar style="light" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 18,
    paddingBottom: 48,
  },
  hero: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  copy: {
    fontSize: 15,
    lineHeight: 24,
  },
  row: {
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  phase: {
    fontSize: 16,
    fontWeight: '700',
  },
  rowCopy: {
    fontSize: 14,
    lineHeight: 21,
  },
  rule: {
    fontSize: 15,
    lineHeight: 24,
  },
});
