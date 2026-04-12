import {
  calculationMethodOptions,
  madhabOptions,
  notifiablePrayerNames,
  notificationPreReminderOptions,
  prayerAdjustmentOptions,
} from '@prayer-app/core';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/src/components/SectionCard';
import { ThemeModeSelector } from '@/src/components/ThemeModeSelector';
import { appConfig } from '@/src/config/app-config';
import { useProductionStatus } from '@/src/hooks/useProductionStatus';
import { usePrayerNotifications } from '@/src/notifications/notification-provider';
import { ManualLocationForm } from '@/src/prayer/ManualLocationForm';
import { usePrayerData } from '@/src/prayer/prayer-provider';
import { useGoogleDriveSync } from '@/src/sync/google-drive-sync-provider';
import { useAppPalette } from '@/src/theme/palette';
import { useThemePreference } from '@/src/theme/theme-provider';

export default function SettingsScreen() {
  const palette = useAppPalette();
  const showDiagnostics = __DEV__ || appConfig.buildStage !== 'production';
  const { hasLoadedPreference, resolvedTheme, setThemePreference, themePreference } = useThemePreference();
  const {
    adjustPrayerOffset,
    isRefreshingLocation,
    locationError,
    prayerPreferences,
    refreshLocation,
    saveManualLocation,
    savedLocation,
    setCalculationMethod,
    setMadhab,
  } = usePrayerData();
  const {
    capability,
    isHydrated: notificationsHydrated,
    isSyncing: isSyncingNotifications,
    lastScheduledCount,
    permissionState,
    preferences: notificationPreferences,
    requestPermission,
    setPreReminderMinutes,
    setPrayerEnabled,
    syncError,
    syncNow,
  } = usePrayerNotifications();
  const { error, health, isLoading, runtime } = useProductionStatus(showDiagnostics);
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
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: palette.hero, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>Settings</Text>
        <Text style={[styles.copy, { color: palette.subtleText }]}>
          Prayer calculation, reminders, location, and Drive sync for this device.
        </Text>
        <Text style={[styles.endpoint, { color: palette.subtleText }]}>Stage | {appConfig.buildStage}</Text>
      </View>

      <SectionCard title="Appearance" subtitle="Theme preference">
        <Text style={[styles.supportText, { color: palette.subtleText }]}>
          Saved: {hasLoadedPreference ? themePreference : 'loading'} | Resolved: {resolvedTheme}
        </Text>
        <ThemeModeSelector value={themePreference} onChange={setThemePreference} />
      </SectionCard>

      <SectionCard title="Prayer calculation" subtitle="Method and madhab">
        <Text style={[styles.sectionLabel, { color: palette.subtleText }]}>Calculation method</Text>
        <View style={styles.optionGrid}>
          {calculationMethodOptions.map((option) => {
            const isActive = option.id === prayerPreferences.calculationMethod;

            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                onPress={() => void setCalculationMethod(option.id)}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: isActive ? palette.accentSoft : palette.surface,
                    borderColor: isActive ? palette.accent : palette.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionTitle,
                    {
                      color: isActive ? palette.accent : palette.text,
                    },
                  ]}
                >
                  {option.label}
                </Text>
                <Text
                  style={[
                    styles.optionDescription,
                    {
                      color: isActive ? palette.accent : palette.subtleText,
                    },
                  ]}
                >
                  {option.description}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: palette.subtleText }]}>Madhab for Asr</Text>
        <View style={styles.optionGrid}>
          {madhabOptions.map((option) => {
            const isActive = option.id === prayerPreferences.madhab;

            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                onPress={() => void setMadhab(option.id)}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: isActive ? palette.accentSoft : palette.surface,
                    borderColor: isActive ? palette.accent : palette.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionTitle,
                    {
                      color: isActive ? palette.accent : palette.text,
                    },
                  ]}
                >
                  {option.label}
                </Text>
                <Text
                  style={[
                    styles.optionDescription,
                    {
                      color: isActive ? palette.accent : palette.subtleText,
                    },
                  ]}
                >
                  {option.description}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      <SectionCard title="Manual adjustments" subtitle="Per-prayer minute offsets">
        {prayerAdjustmentOptions.map((adjustment) => (
          <View key={adjustment.key} style={[styles.adjustmentRow, { borderBottomColor: palette.border }]}>
            <View style={styles.adjustmentCopy}>
              <Text style={[styles.adjustmentLabel, { color: palette.text }]}>{adjustment.label}</Text>
              <Text style={[styles.adjustmentValue, { color: palette.subtleText }]}>
                {prayerPreferences.adjustments[adjustment.key]} min
              </Text>
            </View>
            <View style={styles.adjustmentControls}>
              <Pressable
                accessibilityRole="button"
                onPress={() => void adjustPrayerOffset(adjustment.key, -1)}
                style={[styles.adjustmentButton, { borderColor: palette.border, backgroundColor: palette.surface }]}
              >
                <Text style={[styles.adjustmentButtonLabel, { color: palette.text }]}>-1</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => void adjustPrayerOffset(adjustment.key, 1)}
                style={[styles.adjustmentButton, { borderColor: palette.border, backgroundColor: palette.surface }]}
              >
                <Text style={[styles.adjustmentButtonLabel, { color: palette.text }]}>+1</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </SectionCard>

      <SectionCard title="Location" subtitle="Prayer day follows the saved location">
        <View style={[styles.infoRow, { borderBottomColor: palette.border }]}>
          <View style={styles.infoCopy}>
            <Text style={[styles.infoTitle, { color: palette.text }]}>Current location</Text>
            <Text style={[styles.infoBody, { color: palette.subtleText }]}>
              {savedLocation ? savedLocation.label : 'No saved location yet'}
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: palette.text }]}>{savedLocation?.source ?? 'none'}</Text>
        </View>
        <View style={[styles.infoRow, { borderBottomColor: palette.border }]}>
          <View style={styles.infoCopy}>
            <Text style={[styles.infoTitle, { color: palette.text }]}>Effective timezone</Text>
            <Text style={[styles.infoBody, { color: palette.subtleText }]}>
              Used for the prayer day and local prayer times.
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: palette.text }]}>{savedLocation?.timeZone ?? 'device default'}</Text>
        </View>
        <View style={[styles.infoRow, { borderBottomColor: palette.border }]}>
          <View style={styles.infoCopy}>
            <Text style={[styles.infoTitle, { color: palette.text }]}>Timezone source</Text>
            <Text style={[styles.infoBody, { color: palette.subtleText }]}>
              Geo-derived by default, with manual override when needed.
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: palette.text }]}>
            {savedLocation?.timeZoneSource ?? 'none'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => void refreshLocation()}
          style={[styles.refreshButton, { backgroundColor: palette.accent }]}
        >
          <Text style={[styles.refreshButtonLabel, { color: palette.surface }]}>
            {isRefreshingLocation ? 'Refreshing location...' : 'Use current location'}
          </Text>
        </Pressable>
        <ManualLocationForm
          helperText="Use coordinates when location access is unavailable. Leave timezone blank to derive it."
          initialValues={
            savedLocation?.source === 'manual'
              ? {
                  label: savedLocation.label,
                  latitude: String(savedLocation.coordinates.latitude),
                  longitude: String(savedLocation.coordinates.longitude),
                  timeZoneOverride:
                    savedLocation.timeZoneSource === 'manual' ? savedLocation.timeZone ?? '' : '',
                }
              : undefined
          }
          isSubmitting={isRefreshingLocation}
          onSubmit={saveManualLocation}
          submitLabel={savedLocation?.source === 'manual' ? 'Update manual location' : 'Save manual location'}
        />
        {savedLocation?.timeZoneSource === 'device-fallback' ? (
          <Text style={[styles.supportText, { color: palette.text }]}>
            Coordinate lookup could not resolve a timezone for this saved location, so the app is
            temporarily using the device timezone instead.
          </Text>
        ) : null}
        {locationError ? (
          <Text style={[styles.supportText, { color: palette.text }]}>{locationError}</Text>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Notifications"
        subtitle={
          capability === 'unsupported' ? 'Notifications are unavailable on this Android device' : 'Android reminders on this device'
        }
      >
        <View style={[styles.infoRow, { borderBottomColor: palette.border }]}>
          <View style={styles.infoCopy}>
            <Text style={[styles.infoTitle, { color: palette.text }]}>Permission state</Text>
            <Text style={[styles.infoBody, { color: palette.subtleText }]}>
              {capability === 'unsupported'
                ? 'This Android device cannot schedule the local prayer reminders used by this app.'
                : 'Android can schedule local prayer reminders with bundled sounds.'}
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: palette.text }]}>
            {notificationsHydrated ? permissionState : 'loading'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => void requestPermission()}
          style={[styles.refreshButton, { backgroundColor: palette.accent }]}
        >
          <Text style={[styles.refreshButtonLabel, { color: palette.surface }]}>
            {permissionState === 'granted' ? 'Permission granted' : 'Enable notifications'}
          </Text>
        </Pressable>
        <Text style={[styles.supportText, { color: palette.subtleText }]}>
          Scheduled jobs in the current window: {lastScheduledCount}
        </Text>
        <Text style={[styles.sectionLabel, { color: palette.subtleText }]}>Prayer alerts</Text>
        <View style={styles.optionGrid}>
          {notifiablePrayerNames.map((prayerName) => {
            const isActive = notificationPreferences.enabledPrayers[prayerName];

            return (
              <Pressable
                key={prayerName}
                accessibilityRole="switch"
                accessibilityState={{ checked: isActive }}
                onPress={() => void setPrayerEnabled(prayerName, !isActive)}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: isActive ? palette.accentSoft : palette.surface,
                    borderColor: isActive ? palette.accent : palette.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionTitle,
                    {
                      color: isActive ? palette.accent : palette.text,
                    },
                  ]}
                >
                  {prayerName}
                </Text>
                <Text
                  style={[
                    styles.optionDescription,
                    {
                      color: isActive ? palette.accent : palette.subtleText,
                    },
                  ]}
                >
                  {isActive ? 'Prayer-start alert enabled' : 'Prayer-start alert disabled'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.sectionLabel, { color: palette.subtleText }]}>Reminder timing</Text>
        <View style={styles.optionGrid}>
          {notificationPreReminderOptions.map((option) => {
            const isActive = option.value === notificationPreferences.preReminderMinutes;

            return (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                onPress={() => void setPreReminderMinutes(option.value)}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: isActive ? palette.accentSoft : palette.surface,
                    borderColor: isActive ? palette.accent : palette.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionTitle,
                    {
                      color: isActive ? palette.accent : palette.text,
                    },
                  ]}
                >
                  {option.label}
                </Text>
                <Text
                  style={[
                    styles.optionDescription,
                    {
                      color: isActive ? palette.accent : palette.subtleText,
                    },
                  ]}
                >
                  {option.value
                    ? 'Shared reminder window before every enabled prayer'
                    : 'Only notify right when the prayer begins'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => void syncNow()}
          style={[styles.secondaryActionButton, { borderColor: palette.border, backgroundColor: palette.surface }]}
        >
          <Text style={[styles.secondaryActionButtonLabel, { color: palette.text }]}>
            {isSyncingNotifications ? 'Refreshing schedules...' : 'Refresh schedules'}
          </Text>
        </Pressable>
        {syncError ? (
          <Text style={[styles.supportText, { color: palette.text }]}>{syncError}</Text>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Google Drive Sync"
        subtitle="Automatic backup and merge for this account"
      >
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
            ? `Last Drive merge: ${lastSyncedAt}`
            : sessionToken
              ? 'Drive is linked. The first merge runs automatically after local state loads.'
              : 'No Google Drive session is linked on this device yet.'}
        </Text>
        {driveSyncError ? (
          <Text style={[styles.supportText, { color: palette.text }]}>{driveSyncError}</Text>
        ) : null}
      </SectionCard>

      {showDiagnostics ? (
        <SectionCard title="Developer diagnostics" subtitle="Runtime checks">
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
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 18,
    gap: 14,
    paddingBottom: 112,
  },
  hero: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  copy: {
    fontSize: 14,
    lineHeight: 21,
  },
  endpoint: {
    fontSize: 12,
    fontWeight: '500',
  },
  supportText: {
    fontSize: 13,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  optionGrid: {
    gap: 8,
  },
  optionCard: {
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 12,
    lineHeight: 18,
  },
  adjustmentRow: {
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  adjustmentCopy: {
    gap: 4,
  },
  adjustmentLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  adjustmentValue: {
    fontSize: 13,
  },
  adjustmentControls: {
    flexDirection: 'row',
    gap: 8,
  },
  adjustmentButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 54,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  adjustmentButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
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
});
