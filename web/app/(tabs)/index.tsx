import { isTrackablePrayerName } from '@prayer-app/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/src/components/SectionCard';
import { StatPill } from '@/src/components/StatPill';
import { ManualLocationForm } from '@/src/prayer/ManualLocationForm';
import { usePrayerData } from '@/src/prayer/prayer-provider';
import { useAppPalette } from '@/src/theme/palette';

const PRAYER_ICONS: Record<string, string> = {
  Fajr: '\u{263E}',
  Sunrise: '\u{2600}',
  Dhuhr: '\u{2600}',
  Asr: '\u{1F324}',
  Maghrib: '\u{1F305}',
  Isha: '\u{1F319}',
};

function getPrayerIconColor(name: string): string {
  switch (name) {
    case 'Fajr': return '#2E8B8B';
    case 'Sunrise': return '#E8A317';
    case 'Dhuhr': return '#E8A317';
    case 'Asr': return '#D4842A';
    case 'Maghrib': return '#E07030';
    case 'Isha': return '#1A3A5C';
    default: return '#47685A';
  }
}

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

  const [showAllPrayers, setShowAllPrayers] = useState(false);

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
            data-testid="use-current-location-btn"
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
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* === WAVE HEADER === */}
      <View style={[styles.waveHeader, { backgroundColor: palette.accent }]}>
        <View style={styles.wavePattern} />
        <View style={styles.waveHeaderIcons}>
          <Pressable
            data-testid="settings-icon-btn"
            accessibilityRole="button"
            onPress={() => router.push('/(tabs)/settings' as any)}
            style={[styles.headerIcon, { backgroundColor: palette.accentSoft }]}
          >
            <Text style={[styles.headerIconText, { color: palette.text }]}>&#9881;</Text>
          </Pressable>
          <Pressable
            data-testid="progress-icon-btn"
            accessibilityRole="button"
            onPress={() => router.push('/(tabs)/progress' as any)}
            style={[styles.headerIcon, { backgroundColor: palette.accentSoft }]}
          >
            <Text style={[styles.headerIconText, { color: palette.text }]}>&#9776;</Text>
          </Pressable>
        </View>
        <View style={styles.waveCurve}>
          <View style={[styles.waveCurveInner, { backgroundColor: palette.background }]} />
        </View>
      </View>

      {/* === GREETING SECTION === */}
      <View style={styles.greetingSection}>
        <Text style={[styles.greetingMain, { color: palette.text }]} data-testid="greeting-text">
          Assalamu alaikum
        </Text>
        <Text style={[styles.greetingWelcome, { color: palette.text }]} data-testid="welcome-text">
          Welcome back
        </Text>
        <View style={styles.dateRow}>
          <Text style={[styles.dateText, { color: palette.subtleText }]} data-testid="hijri-date">
            {prayerDay.hijriDate ?? 'Hijri date'}
          </Text>
          <Text style={[styles.dateSeparator, { color: palette.subtleText }]}> &bull; </Text>
          <Text style={[styles.dateText, { color: palette.subtleText }]} data-testid="gregorian-date">
            {prayerDay.gregorianDate}
          </Text>
        </View>
        <Text style={[styles.cityLabel, { color: palette.subtleText }]}>
          {prayerDay.city} &middot; {prayerDay.methodLabel}
        </Text>
        {savedLocation?.timeZoneSource === 'device-fallback' ? (
          <Text style={[styles.warningCopy, { color: palette.subtleText }]}>
            Timezone is using the device setting as coordinate lookup was unavailable.
          </Text>
        ) : null}
      </View>

      {/* === PRAYER TIME CARDS === */}
      <View style={styles.prayerCardsContainer}>
        <View style={styles.prayerCardsRow}>
          {prayerDay.prayers.map((prayer) => {
            const isNext = prayer.isNext;
            return (
              <View
                key={prayer.name}
                data-testid={`prayer-card-${prayer.name.toLowerCase()}`}
                style={[
                  styles.prayerCard,
                  {
                    backgroundColor: isNext ? palette.accentSoft : palette.card,
                    borderColor: isNext ? palette.accent : palette.border,
                  },
                ]}
              >
                <Text style={[styles.prayerIcon, { color: getPrayerIconColor(prayer.name) }]}>
                  {PRAYER_ICONS[prayer.name] || '\u{2B50}'}
                </Text>
                <Text
                  style={[
                    styles.prayerCardName,
                    { color: isNext ? palette.accent : palette.text },
                  ]}
                >
                  {prayer.name}
                </Text>
                <Text
                  style={[
                    styles.prayerCardTime,
                    { color: isNext ? palette.accent : palette.subtleText },
                  ]}
                >
                  {prayer.time}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* === VIEW ALL TOGGLE === */}
      <Pressable
        data-testid="view-all-toggle"
        accessibilityRole="button"
        onPress={() => setShowAllPrayers(!showAllPrayers)}
        style={styles.viewAllToggle}
      >
        <Text style={[styles.viewAllText, { color: palette.accent }]}>
          {showAllPrayers ? 'Hide schedule' : 'View All'} {showAllPrayers ? '\u25B2' : '\u25BC'}
        </Text>
      </Pressable>

      {/* === EXPANDED PRAYER SCHEDULE === */}
      {showAllPrayers ? (
        <View style={styles.expandedSection}>
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
                  data-testid={`prayer-row-${prayer.name.toLowerCase()}`}
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
                          data-testid={`mark-done-${prayer.name.toLowerCase()}`}
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

          <View style={styles.statsRow}>
            <StatPill label="Hijri" value={prayerDay.hijriDate ?? 'Unavailable'} />
            <StatPill label="Today" value={`${prayerMetrics.completedToday}/${prayerMetrics.totalTrackablePrayers}`} />
            <StatPill label="Current streak" value={`${prayerMetrics.currentStreak} days`} />
            <StatPill label="Best streak" value={`${prayerMetrics.bestStreak} days`} />
          </View>

          <SectionCard title="Controls" subtitle="Updates this device immediately">
            <Text style={[styles.helperCopy, { color: palette.text }]}>
              Calculation method, madhab, and minute offsets update these times right away.
            </Text>
            <Text style={[styles.helperCopy, { color: palette.text }]}>
              Google Drive can merge prayer logs and preferences from other signed-in devices automatically.
            </Text>
            <Pressable
              accessibilityRole="button"
              data-testid="refresh-location-btn"
              onPress={() => void refreshLocation()}
              style={[styles.secondaryButton, { borderColor: palette.border, backgroundColor: palette.surface }]}
            >
              <Text style={[styles.secondaryButtonLabel, { color: palette.text }]}>
                {isRefreshingLocation ? 'Refreshing location...' : 'Refresh location'}
              </Text>
            </Pressable>
          </SectionCard>
        </View>
      ) : null}

      {/* === FEATURE QUICK-ACCESS CARDS === */}
      <View style={styles.featureGrid} data-testid="feature-grid">
        <Pressable
          data-testid="feature-quran"
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/quran' as any)}
          style={[styles.featureCard, { backgroundColor: palette.card, borderColor: palette.border }]}
        >
          <Text style={[styles.featureIcon, { color: palette.accent }]}>{'\u{1F4D6}'}</Text>
          <Text style={[styles.featureLabel, { color: palette.text }]}>Quran</Text>
        </Pressable>

        <Pressable
          data-testid="feature-duas"
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/duas' as any)}
          style={[styles.featureCard, { backgroundColor: palette.card, borderColor: palette.border }]}
        >
          <Text style={[styles.featureIcon, { color: palette.accent }]}>{'\u{1F64F}'}</Text>
          <Text style={[styles.featureLabel, { color: palette.text }]}>Dua Collection</Text>
        </Pressable>

        <Pressable
          data-testid="feature-progress"
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/progress' as any)}
          style={[styles.featureCard, { backgroundColor: palette.card, borderColor: palette.border }]}
        >
          <Text style={[styles.featureIcon, { color: palette.accent }]}>{'\u{1F9ED}'}</Text>
          <Text style={[styles.featureLabel, { color: palette.text }]}>Progress</Text>
        </Pressable>

        <Pressable
          data-testid="feature-settings"
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/settings' as any)}
          style={[styles.featureCard, { backgroundColor: palette.card, borderColor: palette.border }]}
        >
          <Text style={[styles.featureIcon, { color: palette.accent }]}>{'\u{2699}'}</Text>
          <Text style={[styles.featureLabel, { color: palette.text }]}>Settings</Text>
        </Pressable>
      </View>

      {/* === STATS SUMMARY ROW === */}
      <View style={styles.quickStatsRow}>
        <View style={[styles.quickStat, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.quickStatValue, { color: palette.accent }]}>
            {prayerMetrics.completedToday}/{prayerMetrics.totalTrackablePrayers}
          </Text>
          <Text style={[styles.quickStatLabel, { color: palette.subtleText }]}>Today</Text>
        </View>
        <View style={[styles.quickStat, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.quickStatValue, { color: palette.accent }]}>
            {prayerMetrics.currentStreak}
          </Text>
          <Text style={[styles.quickStatLabel, { color: palette.subtleText }]}>Streak (days)</Text>
        </View>
        <View style={[styles.quickStat, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.quickStatValue, { color: palette.accent }]}>
            {prayerMetrics.last7DayCompletionRate}%
          </Text>
          <Text style={[styles.quickStatLabel, { color: palette.subtleText }]}>7-day rate</Text>
        </View>
      </View>

      {/* === NEXT PRAYER HIGHLIGHT === */}
      {prayerDay.nextPrayer ? (
        <View style={styles.nextPrayerWrapper}>
          <View style={[styles.nextPrayerBanner, { backgroundColor: palette.accent }]} data-testid="next-prayer-banner">
            <Text style={[styles.nextPrayerLabel, { color: palette.surface }]}>
              Next: {prayerDay.nextPrayer} at {prayerDay.nextPrayerTime}
            </Text>
          </View>
        </View>
      ) : null}
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
  scrollContent: {
    paddingBottom: 112,
    alignItems: 'stretch',
  },

  /* Wave Header */
  waveHeader: {
    paddingTop: Platform.select({ web: 24, default: 52 }),
    paddingHorizontal: 24,
    paddingBottom: 0,
    position: 'relative',
    minHeight: 120,
  },
  wavePattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.08,
  },
  waveHeaderIcons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginBottom: 16,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 20,
  },
  waveCurve: {
    height: 50,
    overflow: 'hidden',
    marginHorizontal: -24,
  },
  waveCurveInner: {
    flex: 1,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: 10,
  },

  /* Greeting */
  greetingSection: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  greetingMain: {
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  greetingWelcome: {
    fontSize: 20,
    fontWeight: '500',
    textAlign: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '500',
  },
  dateSeparator: {
    fontSize: 13,
  },
  cityLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  /* Prayer Cards */
  prayerCardsContainer: {
    marginTop: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  prayerCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  prayerCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    flex: 1,
    minWidth: 90,
    maxWidth: 140,
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  prayerIcon: {
    fontSize: 30,
  },
  prayerCardName: {
    fontSize: 14,
    fontWeight: '600',
  },
  prayerCardTime: {
    fontSize: 13,
    fontWeight: '500',
  },

  /* View All */
  viewAllToggle: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  /* Expanded schedule */
  expandedSection: {
    paddingHorizontal: 18,
    gap: 14,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  /* Feature Grid */
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 18,
    gap: 14,
    justifyContent: 'center',
  },
  featureCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 22,
    width: '46%',
    maxWidth: 200,
  },
  featureIcon: {
    fontSize: 40,
  },
  featureLabel: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },

  /* Quick Stats */
  quickStatsRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 10,
    marginTop: 10,
  },
  quickStat: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    gap: 4,
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  quickStatLabel: {
    fontSize: 11,
    fontWeight: '500',
  },

  /* Next Prayer Banner */
  nextPrayerWrapper: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  nextPrayerBanner: {
    alignItems: 'center',
    borderRadius: 28,
    paddingHorizontal: 36,
    paddingVertical: 16,
  },
  nextPrayerLabel: {
    fontSize: 16,
    fontWeight: '600',
  },

  /* Shared from original */
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
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
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
