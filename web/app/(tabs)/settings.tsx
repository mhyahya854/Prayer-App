import {
  calculationMethodOptions,
  madhabOptions,
  notifiablePrayerNames,
  notificationPreReminderOptions,
  prayerAdjustmentOptions,
} from '@prayer-app/core';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CollapsibleSection } from '@/src/components/CollapsibleSection';
import { ThemeModeSelector } from '@/src/components/ThemeModeSelector';
import { usePrayerNotifications } from '@/src/notifications/notification-provider';
import { ManualLocationForm } from '@/src/prayer/ManualLocationForm';
import { usePrayerData } from '@/src/prayer/prayer-provider';
import { useGoogleDriveSync } from '@/src/sync/google-drive-sync-provider';
import { useAppPalette } from '@/src/theme/palette';
import { useThemePreference } from '@/src/theme/theme-provider';

export default function SettingsScreen() {
  const palette = useAppPalette();
  const { setThemePreference, themePreference } = useThemePreference();
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
    isHydrated: notificationsHydrated,
    isSyncing: isSyncingNotifications,
    permissionState,
    preferences: notificationPreferences,
    requestPermission,
    setPreReminderMinutes,
    setPrayerEnabled,
    syncError,
    syncNow,
  } = usePrayerNotifications();
  const {
    account,
    connect,
    disconnect,
    hasLoadedSession,
    isConnecting,
    isSyncing: isSyncingDrive,
    lastSyncedAt,
    syncError: driveSyncError,
    syncNow: syncDriveNow,
  } = useGoogleDriveSync();

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: palette.hero, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>Settings</Text>
        <Text style={[styles.copy, { color: palette.subtleText }]}>
          Personalize your prayer experience.
        </Text>
        {/* Subtle sync status line */}
        <View style={styles.syncStatusRow}>
          <Text style={[styles.syncStatusText, { color: palette.subtleText }]}>
            {'Device · '}
            <Text style={{ color: palette.subtleText }}>
              {savedLocation ? savedLocation.label : 'No location'}
            </Text>
          </Text>
          {hasLoadedSession ? (
            <Text style={[styles.syncStatusText, { color: palette.subtleText }]}>
              {'Drive · '}
              <Text style={{ color: lastSyncedAt ? palette.success : palette.subtleText }}>
                {lastSyncedAt ? lastSyncedAt : account ? 'not yet synced' : 'not linked'}
              </Text>
            </Text>
          ) : null}
        </View>
      </View>

      {/* Display */}
      <CollapsibleSection title="Display" subtitle="Theme preference">
        <ThemeModeSelector value={themePreference} onChange={setThemePreference} />
      </CollapsibleSection>

      {/* Prayer Time Calculation */}
      <CollapsibleSection title="Prayer Time Calculation" subtitle="Method and school of thought">
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
                <Text style={[styles.optionTitle, { color: isActive ? palette.accent : palette.text }]}>
                  {option.label}
                </Text>
                <Text style={[styles.optionDescription, { color: isActive ? palette.accent : palette.subtleText }]}>
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
                <Text style={[styles.optionTitle, { color: isActive ? palette.accent : palette.text }]}>
                  {option.label}
                </Text>
                <Text style={[styles.optionDescription, { color: isActive ? palette.accent : palette.subtleText }]}>
                  {option.description}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </CollapsibleSection>

      {/* Fine-Tune Times */}
      <CollapsibleSection title="Fine-Tune Times" subtitle="Adjust individual prayers by minutes">
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
                <Text style={[styles.adjustmentButtonLabel, { color: palette.text }]}>−1</Text>
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
      </CollapsibleSection>

      {/* Your Location */}
      <CollapsibleSection title="Your Location" subtitle="Prayer times follow the saved location">
        <View style={[styles.infoRow, { borderBottomColor: palette.border }]}>
          <View style={styles.infoCopy}>
            <Text style={[styles.infoTitle, { color: palette.text }]}>Saved location</Text>
            <Text style={[styles.infoBody, { color: palette.subtleText }]}>
              {savedLocation ? savedLocation.label : 'No location saved yet'}
            </Text>
          </View>
          {savedLocation?.source ? (
            <View style={[styles.badge, { backgroundColor: palette.accentSoft }]}>
              <Text style={[styles.badgeText, { color: palette.accent }]}>{savedLocation.source}</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.infoRow, { borderBottomColor: palette.border }]}>
          <View style={styles.infoCopy}>
            <Text style={[styles.infoTitle, { color: palette.text }]}>Local timezone</Text>
            <Text style={[styles.infoBody, { color: palette.subtleText }]}>
              Used to calculate your daily prayer schedule.
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: palette.text }]}>
            {savedLocation?.timeZone ?? 'Device default'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => void refreshLocation()}
          style={[styles.actionButton, { backgroundColor: palette.accent }]}
        >
          <Text style={[styles.actionButtonLabel, { color: palette.background }]}>
            {isRefreshingLocation ? 'Refreshing\u2026' : 'Use current location'}
          </Text>
        </Pressable>
        <ManualLocationForm
          helperText="Enter coordinates when location access is unavailable."
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
          submitLabel={savedLocation?.source === 'manual' ? 'Update location' : 'Save location'}
        />
        {savedLocation?.timeZoneSource === 'device-fallback' ? (
          <Text style={[styles.supportText, { color: palette.subtleText }]}>
            Using your device timezone as a fallback — coordinate lookup was unavailable.
          </Text>
        ) : null}
        {locationError ? (
          <Text style={[styles.supportText, { color: palette.danger }]}>{locationError}</Text>
        ) : null}
      </CollapsibleSection>

      {/* Prayer Reminders */}
      <CollapsibleSection
        title="Prayer Reminders"
        subtitle="Alerts and reminder timing"
      >
        {/* Permission state — shown only if not yet granted */}
        {notificationsHydrated && permissionState !== 'granted' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void requestPermission()}
            style={[styles.actionButton, { backgroundColor: palette.accent }]}
          >
            <Text style={[styles.actionButtonLabel, { color: palette.background }]}>
              Enable notifications
            </Text>
          </Pressable>
        ) : null}
        {notificationsHydrated && permissionState === 'granted' ? (
          <View style={[styles.permissionGranted, { borderColor: palette.successSoft }]}>
            <Text style={[styles.permissionGrantedText, { color: palette.subtleText }]}>
              {'✓ Notifications are enabled'}
            </Text>
          </View>
        ) : null}

        <Text style={[styles.sectionLabel, { color: palette.subtleText }]}>Which prayers</Text>
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
                <Text style={[styles.optionTitle, { color: isActive ? palette.accent : palette.text }]}>
                  {prayerName}
                </Text>
                <Text style={[styles.optionDescription, { color: isActive ? palette.accent : palette.subtleText }]}>
                  {isActive ? 'Alert on' : 'Alert off'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: palette.subtleText }]}>Reminder lead time</Text>
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
                <Text style={[styles.optionTitle, { color: isActive ? palette.accent : palette.text }]}>
                  {option.label}
                </Text>
                <Text style={[styles.optionDescription, { color: isActive ? palette.accent : palette.subtleText }]}>
                  {option.value ? 'Reminder before prayer' : 'Alert at prayer time only'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => void syncNow()}
          style={[styles.secondaryButton, { borderColor: palette.border, backgroundColor: palette.surface }]}
        >
          <Text style={[styles.secondaryButtonLabel, { color: palette.text }]}>
            {isSyncingNotifications ? 'Refreshing\u2026' : 'Refresh schedules'}
          </Text>
        </Pressable>
        {syncError ? (
          <Text style={[styles.supportText, { color: palette.danger }]}>{syncError}</Text>
        ) : null}
      </CollapsibleSection>
      {/* Backup & Sync */}
      <CollapsibleSection title="Backup &amp; Sync" subtitle="Google Drive backup and restore">
        <View style={[styles.infoRow, { borderBottomColor: palette.border }]}>
          <View style={styles.infoCopy}>
            <Text style={[styles.infoTitle, { color: palette.text }]}>Google account</Text>
            <Text style={[styles.infoBody, { color: palette.subtleText }]}>
              {account
                ? 'Prayer history syncs automatically to your Drive app-data folder.'
                : 'Sign in to back up and restore your data across devices.'}
            </Text>
          </View>
          {hasLoadedSession ? (
            <View style={[styles.badge, { backgroundColor: account ? palette.successSoft : palette.accentSoft }]}>
              <Text style={[styles.badgeText, { color: account ? palette.success : palette.subtleText }]}>
                {account ? 'linked' : 'not linked'}
              </Text>
            </View>
          ) : null}
        </View>

        {account ? (
          <View style={[styles.infoRow, { borderBottomColor: palette.border }]}>
            <View style={styles.infoCopy}>
              <Text style={[styles.infoTitle, { color: palette.text }]}>Account</Text>
            </View>
            <Text style={[styles.infoValue, { color: palette.subtleText }]} numberOfLines={1}>
              {account.email}
            </Text>
          </View>
        ) : null}

        {lastSyncedAt ? (
          <View style={[styles.infoRow, { borderBottomColor: palette.border }]}>
            <View style={styles.infoCopy}>
              <Text style={[styles.infoTitle, { color: palette.text }]}>Last Drive sync</Text>
            </View>
            <Text style={[styles.infoValue, { color: palette.subtleText }]}>{lastSyncedAt}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => void (account ? syncDriveNow() : connect())}
          style={[styles.actionButton, { backgroundColor: palette.accent }]}
        >
          <Text style={[styles.actionButtonLabel, { color: palette.background }]}>
            {account
              ? isSyncingDrive ? 'Syncing…' : 'Sync now'
              : isConnecting ? 'Connecting…' : 'Connect Google Drive'}
          </Text>
        </Pressable>

        {account ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void disconnect()}
            style={[styles.secondaryButton, { borderColor: palette.border, backgroundColor: palette.surface }]}
          >
            <Text style={[styles.secondaryButtonLabel, { color: palette.subtleText }]}>
              Disconnect Drive
            </Text>
          </Pressable>
        ) : null}

        {driveSyncError ? (
          <Text style={[styles.supportText, { color: palette.danger }]}>{driveSyncError}</Text>
        ) : null}
      </CollapsibleSection>
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
    borderWidth: 0.5,
    gap: 6,
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  copy: {
    fontSize: 14,
    lineHeight: 21,
  },
  supportText: {
    fontSize: 13,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 2,
  },
  optionGrid: {
    gap: 8,
  },
  optionCard: {
    borderRadius: 14,
    borderWidth: 0.5,
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
    borderBottomWidth: 0.5,
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
    borderWidth: 0.5,
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
    borderBottomWidth: 0.5,
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
    fontWeight: '500',
    maxWidth: 160,
    textAlign: 'right',
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 14,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  actionButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 0.5,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  permissionGranted: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  permissionGrantedText: {
    fontSize: 13,
    fontWeight: '500',
  },
  syncStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  syncStatusText: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.2,
    lineHeight: 17,
  },
});
