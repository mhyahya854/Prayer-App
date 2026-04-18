import {
  calculationMethodOptions,
  madhabOptions,
  notifiablePrayerNames,
  notificationPreReminderOptions,
  prayerAdjustmentOptions,
  resolveCalculationMethodForTimeZone,
} from '@prayer-app/core';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CollapsibleSection } from '@/src/components/CollapsibleSection';
import { ThemeAccentSelector } from '@/src/components/ThemeAccentSelector';
import { ThemeModeSelector } from '@/src/components/ThemeModeSelector';
import { usePrayerNotifications } from '@/src/notifications/notification-provider';
import { ManualLocationForm } from '@/src/prayer/ManualLocationForm';
import { usePrayerData } from '@/src/prayer/prayer-provider';
import { useGoogleDriveSync } from '@/src/sync/google-drive-sync-provider';
import { useAppPalette } from '@/src/theme/palette';
import { useThemePreference } from '@/src/theme/theme-provider';

export default function SettingsScreen() {
  const palette = useAppPalette();
  const { accentTheme, setAccentTheme, setThemePreference, themePreference } = useThemePreference();
  const {
    adjustPrayerOffset,
    isRefreshingLocation,
    locationError,
    prayerPreferences,
    refreshLocation,
    saveManualLocation,
    savedLocation,
    setAutoRefreshLocation,
    setCalculationMethod,
    setCalculationMode,
    setMadhab,
    setTimeFormat,
  } = usePrayerData();
  const {
    isHydrated: notificationsHydrated,
    isSyncing: isSyncingNotifications,
    permissionState,
    preferences: notificationPreferences,
    requestPermission,
    setPrayerEnabled,
    setPreReminderMinutes,
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

  const allPrayerNotificationsEnabled = notifiablePrayerNames.every(
    (name) => notificationPreferences.enabledPrayers[name],
  );
  const autoCalculationEnabled = prayerPreferences.calculationMode === 'auto';
  const use12HourTime = prayerPreferences.timeFormat === '12h';
  const autoCalculationMethodId = resolveCalculationMethodForTimeZone(savedLocation?.timeZone);
  const autoCalculationMethodLabel =
    calculationMethodOptions.find((option) => option.id === autoCalculationMethodId)?.label ??
    'Muslim World League';

  async function setAllPrayerNotifications(enabled: boolean) {
    await Promise.all(notifiablePrayerNames.map((prayerName) => setPrayerEnabled(prayerName, enabled)));
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: palette.hero, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>Settings</Text>
        <Text style={[styles.copy, { color: palette.subtleText }]}>
          Personalize your prayer experience.
        </Text>
        <View style={styles.syncStatusRow}>
          <Text style={[styles.syncStatusText, { color: palette.subtleText }]}>
            Device | <Text>{savedLocation ? savedLocation.label : 'No location'}</Text>
          </Text>
          {hasLoadedSession ? (
            <Text style={[styles.syncStatusText, { color: palette.subtleText }]}>
              Drive |{' '}
              <Text style={{ color: lastSyncedAt ? palette.success : palette.subtleText }}>
                {lastSyncedAt ? lastSyncedAt : account ? 'not yet synced' : 'not linked'}
              </Text>
            </Text>
          ) : null}
        </View>
      </View>

      <CollapsibleSection
        title="Day, Night or Auto"
        subtitle="Please select from auto, day mode or night mode."
        defaultExpanded
        collapsible={false}
      >
        <ThemeModeSelector value={themePreference} onChange={setThemePreference} />
        <Text style={[styles.sectionLabel, { color: palette.subtleText }]}>App color</Text>
        <ThemeAccentSelector value={accentTheme} onChange={setAccentTheme} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Prayer Times"
        subtitle="How your prayer times should be calculated"
        defaultExpanded
        collapsible={false}
      >
        <View style={[styles.toggleRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.toggleCopy}>
            <Text style={[styles.toggleTitle, { color: palette.text }]}>12-Hour Time</Text>
            <Text style={[styles.toggleBody, { color: palette.subtleText }]}>
              Display prayer times in 12-hour format.
            </Text>
          </View>
          <Pressable
            data-testid="settings-time-format-toggle"
            testID="settings-time-format-toggle"
            accessibilityLabel="Toggle 12-hour time"
            accessibilityRole="switch"
            accessibilityState={{ checked: use12HourTime }}
            onPress={() => void setTimeFormat(use12HourTime ? '24h' : '12h')}
            style={[
              styles.togglePill,
              { backgroundColor: use12HourTime ? palette.accentSoft : palette.border },
            ]}
          >
            <View
              style={[
                styles.toggleThumb,
                {
                  alignSelf: use12HourTime ? 'flex-end' : 'flex-start',
                  backgroundColor: palette.accent,
                },
              ]}
            />
          </Pressable>
        </View>

        <View style={[styles.toggleRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.toggleCopy}>
            <Text style={[styles.toggleTitle, { color: palette.text }]}>Automatic Calculation Method</Text>
            <Text style={[styles.toggleBody, { color: palette.subtleText }]}>
              Choose the prayer calculation method from your saved timezone.
            </Text>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: autoCalculationEnabled }}
            onPress={() => void setCalculationMode(autoCalculationEnabled ? 'manual' : 'auto')}
            style={[
              styles.togglePill,
              { backgroundColor: autoCalculationEnabled ? palette.accentSoft : palette.border },
            ]}
          >
            <View
              style={[
                styles.toggleThumb,
                {
                  alignSelf: autoCalculationEnabled ? 'flex-end' : 'flex-start',
                  backgroundColor: palette.accent,
                },
              ]}
            />
          </Pressable>
        </View>

        <View style={[styles.toggleRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.toggleCopy}>
            <Text style={[styles.toggleTitle, { color: palette.text }]}>Use Browser Location Automatically</Text>
            <Text style={[styles.toggleBody, { color: palette.subtleText }]}>
              Auto-refresh your saved location when the browser allows it.
            </Text>
          </View>
          <Pressable
            data-testid="settings-auto-location-toggle"
            testID="settings-auto-location-toggle"
            accessibilityLabel="Toggle browser auto location"
            accessibilityRole="switch"
            accessibilityState={{ checked: prayerPreferences.autoRefreshLocation }}
            onPress={() => void setAutoRefreshLocation(!prayerPreferences.autoRefreshLocation)}
            style={[
              styles.togglePill,
              {
                backgroundColor: prayerPreferences.autoRefreshLocation
                  ? palette.accentSoft
                  : palette.border,
              },
            ]}
          >
            <View
              style={[
                styles.toggleThumb,
                {
                  alignSelf: prayerPreferences.autoRefreshLocation ? 'flex-end' : 'flex-start',
                  backgroundColor: palette.accent,
                },
              ]}
            />
          </Pressable>
        </View>

        <Text style={[styles.supportText, { color: palette.subtleText }]}>
          Prayer times are based on your selected method and madhab, with optional per-prayer minute adjustments.
        </Text>
        {autoCalculationEnabled ? (
          <Text style={[styles.supportText, { color: palette.subtleText }]}>
            Automatic mode is currently using {autoCalculationMethodLabel} for your saved timezone.
          </Text>
        ) : null}

        <Text style={[styles.sectionLabel, { color: palette.subtleText }]}>Calculation method</Text>
        <View style={styles.optionGrid}>
          {calculationMethodOptions.map((option) => {
            const isActive = option.id === prayerPreferences.calculationMethod && !autoCalculationEnabled;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ disabled: autoCalculationEnabled }}
                onPress={() => {
                  if (!autoCalculationEnabled) {
                    void setCalculationMethod(option.id);
                  }
                }}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: isActive ? palette.accentSoft : palette.surface,
                    borderColor: isActive ? palette.accent : palette.border,
                    opacity: autoCalculationEnabled ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={[styles.optionTitle, { color: isActive ? palette.accent : palette.text }]}>
                  {option.label}
                </Text>
                <Text
                  style={[
                    styles.optionDescription,
                    { color: isActive ? palette.accent : palette.subtleText },
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
                <Text style={[styles.optionTitle, { color: isActive ? palette.accent : palette.text }]}>
                  {option.label}
                </Text>
                <Text
                  style={[
                    styles.optionDescription,
                    { color: isActive ? palette.accent : palette.subtleText },
                  ]}
                >
                  {option.description}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </CollapsibleSection>

      <CollapsibleSection
        title="Fine-Tune Times"
        subtitle="Adjust individual prayers by minutes"
        defaultExpanded
        collapsible={false}
      >
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
      </CollapsibleSection>

      <CollapsibleSection
        title="Your Location"
        subtitle="Prayer times follow the saved location"
        defaultExpanded
        collapsible={false}
      >
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
            {isRefreshingLocation ? 'Refreshing...' : 'Use current location'}
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
            Using your device timezone as a fallback - coordinate lookup was unavailable.
          </Text>
        ) : null}
        {locationError ? (
          <Text style={[styles.supportText, { color: palette.danger }]}>{locationError}</Text>
        ) : null}
      </CollapsibleSection>

      <CollapsibleSection
        title="Notifications"
        subtitle="Please select which types of notifications you would like to receive."
        defaultExpanded
        collapsible={false}
      >
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
              Notifications are enabled.
            </Text>
          </View>
        ) : null}

        <View style={styles.reminderGrid}>
          <View
            style={[
              styles.reminderColumn,
              styles.reminderColumnFull,
              { backgroundColor: palette.hero, borderColor: palette.border },
            ]}
          >
            <View style={[styles.toggleRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View style={styles.toggleCopy}>
                <Text style={[styles.toggleTitle, { color: palette.text }]}>Prayer Times</Text>
                <Text style={[styles.toggleBody, { color: palette.subtleText }]}>
                  Enable alerts for all prayers at once.
                </Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: allPrayerNotificationsEnabled }}
                onPress={() => void setAllPrayerNotifications(!allPrayerNotificationsEnabled)}
                style={[
                  styles.togglePill,
                  {
                    backgroundColor: allPrayerNotificationsEnabled ? palette.accentSoft : palette.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    {
                      alignSelf: allPrayerNotificationsEnabled ? 'flex-end' : 'flex-start',
                      backgroundColor: palette.accent,
                    },
                  ]}
                />
              </Pressable>
            </View>
          </View>
          <View
            style={[
              styles.reminderColumn,
              styles.reminderColumnFull,
              { backgroundColor: palette.hero, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.supportText, { color: palette.subtleText }]}>
              Individual prayer alerts are controlled on the Home prayer list using the alert button next to each prayer.
            </Text>
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
                    <Text
                      style={[
                        styles.optionDescription,
                        { color: isActive ? palette.accent : palette.subtleText },
                      ]}
                    >
                      {option.value ? 'Reminder before prayer' : 'Alert at prayer time only'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => void syncNow()}
          style={[styles.secondaryButton, { borderColor: palette.border, backgroundColor: palette.surface }]}
        >
          <Text style={[styles.secondaryButtonLabel, { color: palette.text }]}>
            {isSyncingNotifications ? 'Refreshing...' : 'Refresh schedules'}
          </Text>
        </Pressable>
        {syncError ? (
          <Text style={[styles.supportText, { color: palette.danger }]}>{syncError}</Text>
        ) : null}
      </CollapsibleSection>

      <CollapsibleSection
        title="Backup &amp; Sync"
        subtitle="Google Drive backup and restore"
        defaultExpanded
        collapsible={false}
      >
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
              ? isSyncingDrive ? 'Syncing...' : 'Sync now'
              : isConnecting ? 'Connecting...' : 'Connect Google Drive'}
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
  toggleRow: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 0.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
    paddingRight: 8,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  toggleBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  togglePill: {
    borderRadius: 999,
    height: 24,
    justifyContent: 'center',
    paddingHorizontal: 3,
    width: 42,
  },
  toggleThumb: {
    borderRadius: 999,
    height: 18,
    width: 18,
    alignSelf: 'flex-end',
  },
  reminderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reminderColumn: {
    flex: 1,
    minWidth: 300,
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 10,
  },
  reminderColumnFull: {
    minWidth: '100%',
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
