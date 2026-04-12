import { StatusBar } from 'expo-status-bar';
import { Platform, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';

import { useGoogleDriveSync } from '@/src/sync/google-drive-sync-provider';
import { useAppPalette } from '@/src/theme/palette';
import { SectionCard } from '@/src/components/SectionCard';

export default function DriveSyncScreen() {
  const palette = useAppPalette();
  const {
    account,
    connect,
    disconnect,
    hasLoadedSession,
    isConnecting,
    isSyncing: isSyncingDrive,
    lastSyncedAt,
    sessionToken,
    syncError: driveSyncError,
    syncNow: syncDriveNow,
  } = useGoogleDriveSync();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={[styles.hero, { backgroundColor: palette.hero, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>Google Drive Sync</Text>
        <Text style={[styles.copy, { color: palette.subtleText }]}>
          Automatic backup and merge for this account. Keep your prayer metrics and history seamlessly synced across all your devices using your Drive app-data folder.
        </Text>
      </View>

      <SectionCard title="Account Details" subtitle="Status and integration">
        <View style={[styles.infoRow, { borderBottomColor: palette.border }]}>
          <View style={styles.infoCopy}>
            <Text style={[styles.infoTitle, { color: palette.text }]}>Account</Text>
            <Text style={[styles.infoBody, { color: palette.subtleText }]}>
              {account
                ? 'Your merged backup is stored in Google Drive app data.'
                : 'Sign in once and the app will look up its backup automatically.'}
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: palette.text }]}>
            {hasLoadedSession ? account?.email ?? 'not linked' : 'loading'}
          </Text>
        </View>
        <View style={[styles.infoRow, { borderBottomColor: palette.border }]}>
          <View style={styles.infoCopy}>
            <Text style={[styles.infoTitle, { color: palette.text }]}>Merge rule</Text>
            <Text style={[styles.infoBody, { color: palette.subtleText }]}>
              Newer settings win, while older logs can still add missing completed prayers.
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: palette.text }]}>
            {lastSyncedAt ? 'synced' : 'idle'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => void (account ? syncDriveNow() : connect())}
          style={[styles.refreshButton, { backgroundColor: palette.accent }]}
        >
          <Text style={[styles.refreshButtonLabel, { color: palette.surface }]}>
            {account
              ? isSyncingDrive
                ? 'Merging backup...'
                : 'Sync Drive now'
              : isConnecting
                ? 'Connecting Google...'
                : 'Connect Google Drive'}
          </Text>
        </Pressable>
        {account ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void disconnect()}
            style={[styles.secondaryActionButton, { borderColor: palette.border, backgroundColor: palette.surface }]}
          >
            <Text style={[styles.secondaryActionButtonLabel, { color: palette.text }]}>Disconnect Google Drive</Text>
          </Pressable>
        ) : null}
        <Text style={[styles.supportText, { color: palette.subtleText }]}>
          {lastSyncedAt
            ? 'Last Drive merge: ' + lastSyncedAt
            : sessionToken
              ? 'Drive is linked. The first merge runs automatically after local state loads.'
              : 'No Google Drive session is linked on this device yet.'}
        </Text>
        {driveSyncError ? (
          <Text style={[styles.supportText, { color: palette.text }]}>{driveSyncError}</Text>
        ) : null}
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
  refreshButton: {
    alignItems: 'center',
    borderRadius: 14,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  refreshButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryActionButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryActionButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  supportText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
