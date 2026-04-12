import { StatusBar } from 'expo-status-bar';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useProductionStatus } from '@/src/hooks/useProductionStatus';
import { useAppPalette } from '@/src/theme/palette';
import { SectionCard } from '@/src/components/SectionCard';

export default function DiagnosticsScreen() {
  const palette = useAppPalette();
  const { error, health, isLoading, runtime } = useProductionStatus(true);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={[styles.hero, { backgroundColor: palette.hero, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>Developer Diagnostics</Text>
        <Text style={[styles.copy, { color: palette.subtleText }]}>
          Internal tooling and runtime checks for backend capability, connectivity, and development environment status. Not for end-users.
        </Text>
      </View>

      <SectionCard title="Runtime checks" subtitle="API and service health">
        <View style={[styles.infoRow, { borderBottomColor: palette.border }]}>
          <View style={styles.infoCopy}>
            <Text style={[styles.infoTitle, { color: palette.text }]}>API health</Text>
            <Text style={[styles.infoBody, { color: palette.subtleText }]}>
              {isLoading ? 'Checking API reachability...' : error ? error : health?.service ?? 'Unavailable'}
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: palette.text }]}>{health?.status ?? 'offline'}</Text>
        </View>
        <View style={[styles.infoRow, { borderBottomColor: palette.border }]}>
          <View style={styles.infoCopy}>
            <Text style={[styles.infoTitle, { color: palette.text }]}>Google server credentials</Text>
            <Text style={[styles.infoBody, { color: palette.subtleText }]}>
              API Google credentials for Drive sync.
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: palette.text }]}>
            {runtime?.googleServerCredentialsConfigured ? 'present' : 'missing'}
          </Text>
        </View>
        <View style={[styles.infoRow, { borderBottomColor: palette.border }]}>
          <View style={styles.infoCopy}>
            <Text style={[styles.infoTitle, { color: palette.text }]}>Google auth flow</Text>
            <Text style={[styles.infoBody, { color: palette.subtleText }]}>
              API callback and session token flow.
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: palette.text }]}>
            {runtime?.authFlowImplemented ? 'live' : 'not yet'}
          </Text>
        </View>
        <View style={[styles.infoRow, { borderBottomColor: palette.border }]}>
          <View style={styles.infoCopy}>
            <Text style={[styles.infoTitle, { color: palette.text }]}>Calendar sync</Text>
            <Text style={[styles.infoBody, { color: palette.subtleText }]}>
              Event sync is still pending.
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: palette.text }]}>
            {runtime?.calendarSyncImplemented ? 'live' : 'not yet'}
          </Text>
        </View>
        <View style={[styles.infoRow, { borderBottomColor: palette.border }]}>
          <View style={styles.infoCopy}>
            <Text style={[styles.infoTitle, { color: palette.text }]}>Drive backup</Text>
            <Text style={[styles.infoBody, { color: palette.subtleText }]}>
              Automatic lookup, merge, and write-back.
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: palette.text }]}>
            {runtime?.driveBackupImplemented ? 'live' : 'not yet'}
          </Text>
        </View>
      </SectionCard>

      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
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
  infoRow: {
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  infoCopy: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  infoBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 120,
    textAlign: 'right',
  },
});
