import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/src/components/SectionCard';
import { StatPill } from '@/src/components/StatPill';
import { usePrayerData } from '@/src/prayer/prayer-provider';
import { useAppPalette } from '@/src/theme/palette';

export default function ProgressScreen() {
  const palette = useAppPalette();
  const { isHydrated, prayerMetrics } = usePrayerData();

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: palette.hero, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>Progress</Text>
        <Text style={[styles.copy, { color: palette.subtleText }]}>
          Your prayer journey, day by day.
        </Text>
        <View style={styles.pills}>
          <StatPill label="Today" value={`${prayerMetrics.completedToday}/${prayerMetrics.totalTrackablePrayers}`} />
          <StatPill label="7-day rate" value={`${prayerMetrics.last7DayCompletionRate}%`} />
          <StatPill label="Current streak" value={`${prayerMetrics.currentStreak} days`} />
          <StatPill label="Best streak" value={`${prayerMetrics.bestStreak} days`} />
        </View>
      </View>

      <SectionCard title="Your prayers" subtitle="Prayers completed">
        <View style={[styles.row, { borderBottomColor: palette.border }]}>
          <View style={styles.stack}>
            <Text style={[styles.rowTitle, { color: palette.text }]}>Completed today</Text>
            <Text style={[styles.rowSubtitle, { color: palette.subtleText }]}>
              Obligatory prayers marked done today.
            </Text>
          </View>
          <Text style={[styles.value, { color: palette.text }]}>
            {prayerMetrics.completedToday}/{prayerMetrics.totalTrackablePrayers}
          </Text>
        </View>
        <View style={[styles.row, { borderBottomColor: palette.border }]}>
          <View style={styles.stack}>
            <Text style={[styles.rowTitle, { color: palette.text }]}>Current full-day streak</Text>
            <Text style={[styles.rowSubtitle, { color: palette.subtleText }]}>
              Consecutive fully completed days ending today.
            </Text>
          </View>
          <Text style={[styles.value, { color: palette.text }]}>{prayerMetrics.currentStreak}</Text>
        </View>
        <View style={[styles.row, { borderBottomColor: palette.border }]}>
          <View style={styles.stack}>
            <Text style={[styles.rowTitle, { color: palette.text }]}>Best full-day streak</Text>
            <Text style={[styles.rowSubtitle, { color: palette.subtleText }]}>
              Highest historical run of fully completed days.
            </Text>
          </View>
          <Text style={[styles.value, { color: palette.text }]}>{prayerMetrics.bestStreak}</Text>
        </View>
        <View style={[styles.row, { borderBottomColor: palette.border }]}>
          <View style={styles.stack}>
            <Text style={[styles.rowTitle, { color: palette.text }]}>Last 7-day completion rate</Text>
            <Text style={[styles.rowSubtitle, { color: palette.subtleText }]}>
              Share of obligatory prayers completed this week.
            </Text>
          </View>
          <Text style={[styles.value, { color: palette.text }]}>{prayerMetrics.last7DayCompletionRate}%</Text>
        </View>
        <View style={[styles.row, { borderBottomColor: palette.border }]}>
          <View style={styles.stack}>
            <Text style={[styles.rowTitle, { color: palette.text }]}>Last 30 days total</Text>
            <Text style={[styles.rowSubtitle, { color: palette.subtleText }]}>
              Obligatory prayers completed in the last 30 days.
            </Text>
          </View>
          <Text style={[styles.value, { color: palette.text }]}>{prayerMetrics.completedPrayersLast30Days}</Text>
        </View>
      </SectionCard>

      <SectionCard title="Recent history" subtitle="Day-by-day log">
        {isHydrated ? (
          prayerMetrics.recentDays.map((day) => (
            <View key={day.dateKey} style={[styles.row, { borderBottomColor: palette.border }]}>
              <View style={styles.stack}>
                <Text style={[styles.rowTitle, { color: palette.text }]}>{day.label}</Text>
                <Text style={[styles.rowSubtitle, { color: palette.subtleText }]}>
                  {day.isComplete ? 'All obligatory prayers completed.' : 'One or more prayers still missing.'}
                </Text>
              </View>
              <Text style={[styles.value, { color: palette.text }]}>
                {day.completedCount}/{day.totalCount}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[styles.rowSubtitle, { color: palette.subtleText }]}>Loading your history…</Text>
        )}
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
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  copy: {
    fontSize: 14,
    lineHeight: 21,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  row: {
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  stack: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
  },
  scopeCopy: {
    fontSize: 14,
    lineHeight: 21,
  },
});
