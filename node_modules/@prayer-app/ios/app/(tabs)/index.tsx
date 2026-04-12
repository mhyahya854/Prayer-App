import { isTrackablePrayerName } from '@prayer-app/core';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/src/components/SectionCard';
import { StatPill } from '@/src/components/StatPill';
import { ManualLocationForm } from '@/src/prayer/ManualLocationForm';
import { usePrayerData } from '@/src/prayer/prayer-provider';
import { useAppPalette } from '@/src/theme/palette';

export default function TodayScreen() {
  const palette = useAppPalette();
  const {
    isHydrated,
    isRefreshingLocation,
    locationError,
    prayerDay,
    prayerLogs,
    prayerMetrics,
    refreshLocation,
    saveManualLocation,
    savedLocation,
    todayKey,
    togglePrayerCompletion,
  } = usePrayerData();

  if (!isHydrated) {
    return (
      <ScrollView style={[styles.screen, { backgroundColor: palette.background }]} contentContainerStyle={styles.content}>
        <SectionCard title="Loading prayer data" subtitle="Saved schedule and check-ins">
          <View style={styles.loadingState}>
            <ActivityIndicator color={palette.accent} />
            <Text style={[styles.helperCopy, { color: palette.subtleText }]}>
              Loading your saved prayer preferences and recent prayer history.
            </Text>
          </View>
        </SectionCard>
      </ScrollView>
    );
  }

  if (!prayerDay) {
    return (
      <ScrollView style={[styles.screen, { backgroundColor: palette.background }]} contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: palette.hero, borderColor: palette.border }]}>
          <Text style={[styles.eyebrow, { color: palette.subtleText }]}>Prayer times</Text>
          <Text style={[styles.heroTime, { color: palette.text }]}>Set a location</Text>
          <Text style={[styles.heroCopy, { color: palette.text }]}>
            Add a location to calculate today&apos;s schedule on this device.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refreshLocation()}
            style={[styles.primaryButton, { backgroundColor: palette.accent }]}
          >
            <Text style={[styles.primaryButtonLabel, { color: palette.surface }]}>
              {isRefreshingLocation ? 'Finding location...' : 'Use current location'}
            </Text>
          </Pressable>
          {locationError ? (
            <Text style={[styles.helperCopy, { color: palette.text }]}>{locationError}</Text>
          ) : null}
        </View>

        <SectionCard title="Manual location" subtitle="Use coordinates instead">
          <ManualLocationForm
            helperText="Leave the timezone blank unless you need to force one."
            isSubmitting={isRefreshingLocation}
            onSubmit={saveManualLocation}
            submitLabel="Save manual location"
          />
        </SectionCard>

        <SectionCard title="Notes" subtitle="What already works">
          <Text style={[styles.helperCopy, { color: palette.text }]}>
            Prayer times, prayer tracking, and Google Drive restore are already running from real local data.
          </Text>
        </SectionCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: palette.hero, borderColor: palette.border }]}>
        <Text style={[styles.eyebrow, { color: palette.subtleText }]}>Today in {prayerDay.city}</Text>
        <Text style={[styles.heroTime, { color: palette.text }]}>
          {prayerDay.nextPrayer ? `${prayerDay.nextPrayer} | ${prayerDay.nextPrayerTime}` : 'No next prayer found'}
        </Text>
        <Text style={[styles.heroCopy, { color: palette.text }]}>
          {prayerDay.methodLabel} with {prayerDay.madhabLabel} Asr timing.
        </Text>
        {savedLocation?.timeZoneSource === 'device-fallback' ? (
          <Text style={[styles.warningCopy, { color: palette.text }]}>
            Timezone is temporarily using the device setting because coordinate lookup was unavailable for this location.
          </Text>
        ) : null}
        <View style={styles.pillRow}>
          <StatPill label="Hijri" value={prayerDay.hijriDate ?? 'Unavailable'} />
          <StatPill label="Today" value={`${prayerMetrics.completedToday}/${prayerMetrics.totalTrackablePrayers}`} />
          <StatPill label="Current streak" value={`${prayerMetrics.currentStreak} days`} />
          <StatPill label="Best streak" value={`${prayerMetrics.bestStreak} days`} />
        </View>
      </View>

      <SectionCard title="Prayer schedule" subtitle={prayerDay.gregorianDate}>
        {prayerDay.prayers.map((prayer) => {
          let completed = false;
          let handleToggleCompletion: (() => void) | undefined;

          if (isTrackablePrayerName(prayer.name)) {
            const trackablePrayerName = prayer.name;
            completed = prayerLogs[todayKey]?.prayers[trackablePrayerName] ?? false;
            handleToggleCompletion = () => void togglePrayerCompletion(trackablePrayerName);
          }

          return (
            <View
              key={prayer.name}
              style={[
                styles.row,
                {
                  backgroundColor: prayer.isNext ? palette.highlight : 'transparent',
                  borderBottomColor: palette.border,
                },
              ]}
            >
              <View style={styles.rowContent}>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: palette.text }]}>{prayer.name}</Text>
                  <Text style={[styles.rowSubtitle, { color: palette.subtleText }]}>{prayer.window}</Text>
                </View>
                <View style={styles.rowMeta}>
                  <Text style={[styles.rowValue, { color: palette.text }]}>{prayer.time}</Text>
                  {isTrackablePrayerName(prayer.name) ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={handleToggleCompletion}
                      style={[
                        styles.statusButton,
                        {
                          backgroundColor: completed ? palette.accentSoft : palette.card,
                          borderColor: completed ? palette.accent : palette.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusButtonLabel,
                          {
                            color: completed ? palette.accent : palette.text,
                          },
                        ]}
                      >
                        {completed ? 'Completed' : 'Mark done'}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={[styles.sunriseNote, { color: palette.subtleText }]}>Not tracked</Text>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </SectionCard>

      <SectionCard title="Controls" subtitle="Updates this device immediately">
        <Text style={[styles.helperCopy, { color: palette.text }]}>
          Calculation method, madhab, and minute offsets update these times right away.
        </Text>
        <Text style={[styles.helperCopy, { color: palette.text }]}>
          Google Drive can merge prayer logs and preferences from other signed-in devices automatically.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void refreshLocation()}
          style={[styles.secondaryButton, { borderColor: palette.border, backgroundColor: palette.surface }]}
        >
          <Text style={[styles.secondaryButtonLabel, { color: palette.text }]}>
            {isRefreshingLocation ? 'Refreshing location...' : 'Refresh location'}
          </Text>
        </Pressable>
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 14,
    padding: 18,
    paddingBottom: 112,
  },
  hero: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroTime: {
    fontFamily: 'SpaceMono',
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
  },
  heroCopy: {
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 420,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  row: {
    borderBottomWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  rowContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  rowCopy: {
    flex: 1,
    gap: 4,
  },
  rowMeta: {
    alignItems: 'flex-end',
    gap: 8,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  rowValue: {
    fontFamily: 'SpaceMono',
    fontSize: 17,
    fontWeight: '600',
  },
  statusButton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  statusButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  sunriseNote: {
    fontSize: 12,
    fontWeight: '600',
  },
  helperCopy: {
    fontSize: 14,
    lineHeight: 21,
  },
  warningCopy: {
    fontSize: 13,
    lineHeight: 20,
  },
  loadingState: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    paddingVertical: 22,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
