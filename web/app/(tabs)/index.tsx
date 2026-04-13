import { useEffect, useState } from 'react';
import { isTrackablePrayerName } from '@prayer-app/core';
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, Modal } from 'react-native';
import { ActivityIndicator } from 'react-native';

import { usePrayerData } from '@/src/prayer/prayer-provider';
import { useAppPalette } from '@/src/theme/palette';
import type { Palette } from '@/src/theme/palette';

// ─── Time utilities ──────────────────────────────────────────────

function parseTimeToMinutes(timeStr: string): number {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let h = parseInt(match[1]!, 10);
  const m = parseInt(match[2]!, 10);
  const period = match[3]!.toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

function getCurrentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

interface CountdownParts {
  h: number;
  m: number;
  s: number;
}

function getCountdownParts(nextTimeStr: string, now: Date): CountdownParts {
  const targetMin = parseTimeToMinutes(nextTimeStr);
  let targetSecs = targetMin * 60;
  let nowSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  
  let diff = targetSecs - nowSecs;
  if (diff <= 0) diff += 24 * 3600;

  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;

  return { h, m, s };
}

// ─── Prayer Arc — web-only SVG component ─────────────────────────

interface PrayerDot {
  name: string;
  time: string;
  isNext: boolean;
  done: boolean;
}

interface PrayerArcProps {
  dots: PrayerDot[];
  palette: Palette;
  width: number;
}

function PrayerArc({ dots, palette, width }: PrayerArcProps) {
  const W = width;
  const H = 130;
  const pad = W * 0.1;

  // Quadratic bezier: bottom-left → apex → bottom-right
  const p0 = { x: pad, y: H };
  const p1 = { x: W / 2, y: -20 }; // apex above visible area
  const p2 = { x: W - pad, y: H };

  function bezier(t: number) {
    return {
      x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x,
      y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y,
    };
  }

  const arcPath = `M ${p0.x} ${p0.y} Q ${p1.x} ${p1.y} ${p2.x} ${p2.y}`;

  const times = dots.map((d) => parseTimeToMinutes(d.time));
  const validTimes = times.filter((t) => t > 0);
  if (validTimes.length < 2) return null;

  const minT = Math.min(...validTimes);
  const maxT = Math.max(...validTimes);
  const span = maxT - minT || 1;

  const nowMins = getCurrentMinutes();
  const nowT = Math.max(0, Math.min(1, (nowMins - minT) / span));
  const nowPt = bezier(nowT);

  return (
    // @ts-expect-error — SVG JSX is valid on web Platform
    <svg
      width={W}
      height={H + 40}
      viewBox={`0 0 ${W} ${H + 40}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* Arc path */}
      {/* @ts-expect-error */}
      <path
        d={arcPath}
        stroke={palette.border}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />

      {/* Prayer dots + labels */}
      {dots.map((dot, i) => {
        const t = (times[i]! - minT) / span;
        const pt = bezier(t);
        const isPast = times[i]! < nowMins;
        const labelAbove = i % 2 === 0;

        return (
          // @ts-expect-error
          <g key={dot.name}>
            {/* @ts-expect-error */}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={dot.isNext ? 7 : 5}
              fill={dot.done ? palette.accent : isPast ? palette.accentSoft : 'transparent'}
              stroke={dot.isNext ? palette.accent : palette.subtleText}
              strokeWidth={dot.isNext ? 2 : 1.2}
            />
            {/* @ts-expect-error */}
            <text
              x={pt.x}
              y={labelAbove ? pt.y - 14 : pt.y + 20}
              textAnchor="middle"
              fontSize={9}
              fill={dot.isNext ? palette.accent : palette.subtleText}
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight={dot.isNext ? '700' : '400'}
            >
              {dot.name}
            </text>
          </g>
        );
      })}

      {/* Sun / current-time indicator */}
      {nowT >= 0 && nowT <= 1 && (
        // @ts-expect-error
        <circle cx={nowPt.x} cy={nowPt.y} r={10} fill={palette.gold} opacity={0.9} />
      )}
    </svg>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────

export default function HomeScreen() {
  const palette = useAppPalette();
  const { width } = useWindowDimensions();
  const [earlyCompletionPrayer, setEarlyCompletionPrayer] = useState<string | null>(null);
  
  const [fastNow, setFastNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setFastNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const {
    isHydrated,
    prayerDay,
    prayerLogs,
    prayerMetrics,
    todayKey,
    togglePrayerCompletion,
  } = usePrayerData();

  // ── Loading ────────────────────────────────────────────────────
  if (!isHydrated) {
    return (
      <View style={[styles.screen, { backgroundColor: palette.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingIcon, { color: palette.accent }]}>{'☽'}</Text>
          <ActivityIndicator color={palette.accent} size="large" style={{ marginTop: 16 }} />
          <Text style={[styles.loadingLabel, { color: palette.subtleText }]}>
            Preparing your prayers
          </Text>
        </View>
      </View>
    );
  }

  // ── No location — direct to Settings ──────────────────────────
  if (!prayerDay) {
    return (
      <View style={[styles.screen, { backgroundColor: palette.background }]}>
        <View style={styles.noLocationContainer}>
          <Text style={[styles.noLocIcon, { color: palette.accent }]}>{'🕌'}</Text>
          <Text style={[styles.noLocTitle, { color: palette.text }]}>
            Set your location
          </Text>
          <Text style={[styles.noLocBody, { color: palette.subtleText }]}>
            Visit Settings → Your Location to calculate today's prayer schedule.
          </Text>
          <Pressable
            accessibilityRole="button"
            data-testid="open-settings-btn"
            onPress={() => router.push('/(tabs)/settings' as any)}
            style={[styles.noLocButton, { backgroundColor: palette.accent }]}
          >
            <Text style={[styles.noLocButtonLabel, { color: palette.background }]}>
              Open Settings
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Derive current + next prayer ───────────────────────────────
  const nextIdx = prayerDay.prayers.findIndex((p) => p.isNext);
  const currentPrayer = nextIdx > 0 ? prayerDay.prayers[nextIdx - 1] : null;
  const nextPrayer =
    prayerDay.nextPrayer && prayerDay.nextPrayerTime
      ? { name: prayerDay.nextPrayer, time: prayerDay.nextPrayerTime }
      : null;
  const countdown = nextPrayer ? getCountdownParts(nextPrayer.time, fastNow) : null;

  // Build arc dots from all prayers
  const arcDots: PrayerDot[] = prayerDay.prayers.map((p) => ({
    name: p.name,
    time: p.time,
    isNext: p.isNext,
    done: isTrackablePrayerName(p.name)
      ? (prayerLogs[todayKey]?.prayers[p.name] ?? false)
      : false,
  }));

  // Greeting and current time
  const hour = fastNow.getHours();
  const greeting = hour < 5 ? 'Late night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const displayHour = hour % 12 || 12;
  const displayMin = fastNow.getMinutes().toString().padStart(2, '0');
  const displaySec = fastNow.getSeconds().toString().padStart(2, '0');
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const currentTimeStr = `${displayHour}:${displayMin}:${displaySec} ${ampm}`;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ═══ HERO — Arc + Current Prayer ═══════════════════════════ */}
      <View style={[styles.heroArea, { backgroundColor: palette.hero }]}>
        {/* Top row: current prayer name + subtle greeting */}
        <View style={styles.heroTopRow}>
          <View style={styles.heroTextBlock}>
            <Text style={[styles.heroGreeting, { color: palette.subtleText }]}>
              {greeting} <Text style={{ color: palette.gold }}>· {currentTimeStr}</Text>
            </Text>
            <Text style={[styles.heroCurrentPrayer, { color: palette.text }]} data-testid="current-prayer-name">
              {currentPrayer?.name ?? (nextPrayer ? nextPrayer.name : 'All done')}
            </Text>
            {countdown && nextPrayer ? (
              <View style={styles.countdownBlockRow}>
                <View style={[styles.countdownBlock, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={[styles.countdownBlockValue, { color: palette.gold }]}>
                    {countdown.h.toString().padStart(2, '0')}
                  </Text>
                  <Text style={[styles.countdownBlockLabel, { color: palette.subtleText }]}>HR</Text>
                </View>
                <Text style={[styles.countdownBlockColon, { color: palette.subtleText }]}>:</Text>
                <View style={[styles.countdownBlock, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={[styles.countdownBlockValue, { color: palette.gold }]}>
                    {countdown.m.toString().padStart(2, '0')}
                  </Text>
                  <Text style={[styles.countdownBlockLabel, { color: palette.subtleText }]}>MIN</Text>
                </View>
                <Text style={[styles.countdownBlockColon, { color: palette.subtleText }]}>:</Text>
                <View style={[styles.countdownBlock, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={[styles.countdownBlockValue, { color: palette.gold }]}>
                    {countdown.s.toString().padStart(2, '0')}
                  </Text>
                  <Text style={[styles.countdownBlockLabel, { color: palette.subtleText }]}>SEC</Text>
                </View>
                <Text style={[styles.countdownUntil, { color: palette.subtleText }]}>
                  to <Text style={{ color: palette.accent, fontWeight: '700' }}>{nextPrayer.name}</Text>
                </Text>
              </View>
            ) : (
              <Text style={[styles.heroCountdown, { color: palette.accent }]}>
                Alhamdulillah — all prayers done
              </Text>
            )}
          </View>

          {/* Stats strip — top right */}
          <View style={[styles.heroStatBadge, { backgroundColor: palette.accentSoft, borderColor: palette.border }]}>
            <Text style={[styles.heroStatValue, { color: palette.accent }]}>
              {prayerMetrics.completedToday}/{prayerMetrics.totalTrackablePrayers}
            </Text>
            <Text style={[styles.heroStatLabel, { color: palette.subtleText }]}>today</Text>
          </View>
        </View>

        {/* Arc visualization — web only, View fallback for native */}
        <View style={styles.arcContainer}>
          {Platform.OS === 'web' ? (
            <PrayerArc dots={arcDots} palette={palette} width={width} />
          ) : (
            // Minimal fallback: progress dots row for native
            <View style={styles.arcFallbackDots}>
              {arcDots
                .filter((d) => isTrackablePrayerName(d.name))
                .map((d) => (
                  <View
                    key={d.name}
                    style={[
                      styles.arcFallbackDot,
                      {
                        backgroundColor: d.done ? palette.accent : 'transparent',
                        borderColor: d.isNext ? palette.accent : palette.border,
                        borderWidth: d.isNext ? 2 : 1,
                      },
                    ]}
                  />
                ))}
            </View>
          )}
        </View>
      </View>

      {/* ═══ DATE BAR ═══════════════════════════════════════════════ */}
      <View style={[styles.dateBar, { borderBottomColor: palette.border }]}>
        <View style={[styles.todayPill, { backgroundColor: palette.accentSoft, borderColor: palette.border }]}>
          <Text style={[styles.todayPillText, { color: palette.accent }]}>TODAY</Text>
        </View>
        <View style={styles.dateTextBlock}>
          <Text style={[styles.dateGregorian, { color: palette.text }]} data-testid="gregorian-date">
            {prayerDay.gregorianDate}
          </Text>
          {prayerDay.hijriDate ? (
            <Text style={[styles.dateHijri, { color: palette.gold }]} data-testid="hijri-date">
              {prayerDay.hijriDate}
            </Text>
          ) : null}
        </View>
        {/* Method label — quiet right */}
        <Text style={[styles.dateMethod, { color: palette.subtleText }]} numberOfLines={1}>
          {prayerDay.methodLabel}
        </Text>
      </View>

      {/* ═══ PRAYER LIST ════════════════════════════════════════════ */}
      <View style={[styles.prayerList, { backgroundColor: palette.card, borderColor: palette.border }]}>
        {prayerDay.prayers.map((prayer, idx) => {
          const isNext = prayer.isNext;
          const isCurrent = prayer === currentPrayer;
          const canTrack = isTrackablePrayerName(prayer.name);
          const done = canTrack
            ? (prayerLogs[todayKey]?.prayers[prayer.name] ?? false)
            : false;
          const isLast = idx === prayerDay.prayers.length - 1;

          const prayerMins = parseTimeToMinutes(prayer.time);
          const nowMins = getCurrentMinutes();
          const isFuture = prayerMins > nowMins;

          const handleToggle = () => {
            if (isFuture && !done) {
              setEarlyCompletionPrayer(prayer.name);
            } else {
              void togglePrayerCompletion(prayer.name);
            }
          };

          return (
            <View
              key={prayer.name}
              data-testid={`prayer-row-${prayer.name.toLowerCase()}`}
              style={[
                styles.prayerRow,
                {
                  backgroundColor:
                    isNext
                      ? palette.highlight
                      : isCurrent
                      ? palette.surface
                      : 'transparent',
                  borderBottomColor: palette.border,
                  borderBottomWidth: isLast ? 0 : 0.5,
                },
              ]}
            >
              {/* Left accent bar for current prayer */}
              {(isNext || isCurrent) && (
                <View
                  style={[
                    styles.rowAccentBar,
                    { backgroundColor: isNext ? palette.accent : palette.gold },
                  ]}
                />
              )}

              {/* Completion circle — red border = not done, green fill = done */}
              {canTrack ? (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Mark ${prayer.name} ${done ? 'incomplete' : 'complete'}`}
                  data-testid={`mark-done-${prayer.name.toLowerCase()}`}
                  onPress={handleToggle}
                  style={[
                    styles.completionCircle,
                    {
                      backgroundColor: done ? palette.success : 'transparent',
                      borderColor: done ? palette.success : palette.danger,
                    },
                  ]}
                >
                  {done ? (
                    <Text style={[styles.completionCheck, { color: '#fff' }]}>
                      {'✓'}
                    </Text>
                  ) : null}
                </Pressable>
              ) : (
                <View style={styles.completionPlaceholder} />
              )}

              {/* Prayer name */}
              <Text
                style={[
                  styles.prayerName,
                  {
                    color: isNext ? palette.accent : palette.text,
                    fontWeight: isNext || isCurrent ? '700' : '400',
                  },
                ]}
              >
                {prayer.name}
              </Text>

              {/* Prayer time */}
              <Text
                style={[
                  styles.prayerTime,
                  {
                    color: isNext ? palette.gold : isCurrent ? palette.accent : palette.subtleText,
                    fontWeight: isNext ? '700' : '500',
                  },
                ]}
              >
                {prayer.time}
              </Text>
            </View>
          );
        })}
      </View>

      {/* ═══ EARLY COMPLETION MODAL ═══════════════════════════════ */}
      <Modal visible={!!earlyCompletionPrayer} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>Praying early?</Text>
            <Text style={[styles.modalBody, { color: palette.subtleText }]}>
              {earlyCompletionPrayer} hasn't started yet. Are you completing it early due to a valid reason?
            </Text>
            
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: palette.accent }]}
                onPress={() => {
                  if (earlyCompletionPrayer) {
                    void togglePrayerCompletion(earlyCompletionPrayer);
                    setEarlyCompletionPrayer(null);
                  }
                }}
              >
                <Text style={[styles.modalButtonText, { color: palette.background }]}>Traveling (Jam')</Text>
              </Pressable>

              <Pressable
                style={[styles.modalButton, { backgroundColor: palette.accent }]}
                onPress={() => {
                  if (earlyCompletionPrayer) {
                    void togglePrayerCompletion(earlyCompletionPrayer);
                    setEarlyCompletionPrayer(null);
                  }
                }}
              >
                <Text style={[styles.modalButtonText, { color: palette.background }]}>Sick (Rukhsah)</Text>
              </Pressable>

              <Pressable
                style={[styles.modalCancelButton, { borderColor: palette.border }]}
                onPress={() => setEarlyCompletionPrayer(null)}
              >
                <Text style={[styles.modalCancelText, { color: palette.text }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}


const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  /* Early Completion Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  modalActions: {
    gap: 12,
  },
  modalButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalCancelButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 4,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },

  /* Loading */
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 60,
  },
  loadingIcon: {
    fontSize: 48,
  },
  loadingLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 8,
  },

  /* No location */
  noLocationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
    paddingBottom: 80,
  },
  noLocIcon: {
    fontSize: 52,
    marginBottom: 4,
  },
  noLocTitle: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  noLocBody: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 300,
  },
  noLocButton: {
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 8,
  },
  noLocButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  /* Main layout */
  scrollContent: {
    paddingBottom: 120,
  },

  /* ── Hero ───────────────────────────────────────────────────────── */
  heroArea: {
    paddingTop: Platform.select({ web: 24, default: 52 }),
    paddingBottom: 0,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 12,
  },
  heroTextBlock: {
    flex: 1,
    gap: 5,
    paddingRight: 12,
  },
  heroGreeting: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  heroCurrentPrayer: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 44,
  },
  heroCountdown: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    marginTop: 6,
  },
  countdownBlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  countdownBlock: {
    borderRadius: 8,
    borderWidth: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 42,
  },
  countdownBlockValue: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  countdownBlockLabel: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  countdownBlockColon: {
    fontSize: 14,
    fontWeight: '700',
    marginHorizontal: 1,
    opacity: 0.5,
    paddingBottom: 8, // align with values above labels
  },
  countdownUntil: {
    fontSize: 13,
    marginLeft: 6,
  },
  heroStatBadge: {
    borderRadius: 14,
    borderWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
    marginTop: 6,
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  heroStatLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  arcContainer: {
    alignItems: 'center',
    width: '100%',
    overflow: 'hidden',
  },
  arcFallbackDots: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arcFallbackDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  /* ── Date bar ──────────────────────────────────────────────────── */
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  todayPill: {
    borderRadius: 8,
    borderWidth: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  todayPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  dateTextBlock: {
    flex: 1,
    gap: 1,
  },
  dateGregorian: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  dateHijri: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  dateMethod: {
    fontSize: 10,
    fontWeight: '500',
    maxWidth: 100,
    textAlign: 'right',
  },

  /* ── Prayer list ────────────────────────────────────────────────── */
  prayerList: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 20,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  prayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingRight: 18,
    paddingLeft: 8,
    gap: 12,
    position: 'relative',
  },
  rowAccentBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
  },
  completionCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  completionCheck: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 17,
  },
  completionPlaceholder: {
    width: 26,
    marginLeft: 8,
  },
  prayerName: {
    flex: 1,
    fontSize: 16,
    letterSpacing: 0.1,
  },
  prayerTime: {
    fontSize: 15,
    letterSpacing: 0.4,
  },

  /* ── Stats row ───────────────────────────────────────────────────── */
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    gap: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 0.5,
    paddingVertical: 14,
    gap: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  /* ── 7-day trend ─────────────────────────────────────────────────── */
  trendCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 20,
    borderWidth: 0.5,
    padding: 18,
    gap: 14,
  },
  trendLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  trendDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trendDayCol: {
    alignItems: 'center',
    gap: 8,
  },
  trendDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendDotCheck: {
    fontSize: 14,
    fontWeight: '700',
  },
  trendDayLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
