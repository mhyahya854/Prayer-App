import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPrayerTime, isTrackablePrayerName, type PrayerName } from '@prayer-app/core';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { usePrayerNotifications } from '@/src/notifications/notification-provider';
import {
  getHomeHeroClockParts,
  getPrayerIsoMinutesInTimeZone,
  getTimeOfDayPhase,
  getTimeZoneMinutes,
} from '@/src/prayer/home-hero-time';
import { usePrayerData } from '@/src/prayer/prayer-provider';
import { useAppPalette } from '@/src/theme/palette';
import type { Palette } from '@/src/theme/palette';

interface CountdownParts {
  h: number;
  m: number;
  s: number;
}

interface PrayerDot {
  done: boolean;
  isNext: boolean;
  name: string;
  timeMinutes: number;
}

interface PrayerArcProps {
  currentTimeMinutes: number;
  dots: PrayerDot[];
  palette: Palette;
  width: number;
}

function getCountdownParts(nextIsoTime: string, now: Date): CountdownParts {
  const diffSeconds = Math.max(0, Math.floor((new Date(nextIsoTime).getTime() - now.getTime()) / 1000));

  return {
    h: Math.floor(diffSeconds / 3600),
    m: Math.floor((diffSeconds % 3600) / 60),
    s: diffSeconds % 60,
  };
}

function PrayerArc({ currentTimeMinutes, dots, palette, width }: PrayerArcProps) {
  const W = width;
  const H = 130;
  const pad = W * 0.1;
  const p0 = { x: pad, y: H };
  const p1 = { x: W / 2, y: -20 };
  const p2 = { x: W - pad, y: H };
  const arcPath = `M ${p0.x} ${p0.y} Q ${p1.x} ${p1.y} ${p2.x} ${p2.y}`;
  const times = dots.map((dot) => dot.timeMinutes);
  const validTimes = times.filter((time) => time > 0);

  if (validTimes.length < 2) {
    return null;
  }

  const minT = Math.min(...validTimes);
  const maxT = Math.max(...validTimes);
  const span = maxT - minT || 1;

  function bezier(t: number) {
    return {
      x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x,
      y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y,
    };
  }

  const nowT = Math.max(0, Math.min(1, (currentTimeMinutes - minT) / span));
  const nowPoint = bezier(nowT);

  return (
    <svg
      width={W}
      height={H + 40}
      viewBox={`0 0 ${W} ${H + 40}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <path
        d={arcPath}
        stroke={palette.border}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />
      {dots.map((dot, index) => {
        const t = (times[index]! - minT) / span;
        const point = bezier(t);
        const isPast = times[index]! < currentTimeMinutes;
        const labelAbove = index % 2 === 0;

        return (
          <g key={dot.name}>
            <circle
              cx={point.x}
              cy={point.y}
              r={dot.isNext ? 7 : 5}
              fill={dot.done ? palette.accent : isPast ? palette.accentSoft : 'transparent'}
              stroke={dot.isNext ? palette.accent : palette.subtleText}
              strokeWidth={dot.isNext ? 2 : 1.2}
            />
            <text
              x={point.x}
              y={labelAbove ? point.y - 14 : point.y + 20}
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
      {nowT >= 0 && nowT <= 1 ? (
        <circle cx={nowPoint.x} cy={nowPoint.y} r={10} fill={palette.gold} opacity={0.9} />
      ) : null}
    </svg>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const palette = useAppPalette();
  const { width } = useWindowDimensions();
  const [earlyCompletionPrayer, setEarlyCompletionPrayer] = useState<PrayerName | null>(null);
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
    prayerPreferences,
    todayKey,
    togglePrayerCompletion,
  } = usePrayerData();
  const { permissionState, preferences: notificationPreferences, requestPermission, setPrayerEnabled } =
    usePrayerNotifications();

  if (!isHydrated) {
    return (
      <View style={[styles.screen, { backgroundColor: palette.background }]}>
        <View style={styles.loadingContainer}>
          <SymbolView
            name={{
              android: 'nights_stay',
              ios: 'moon.stars.fill',
              web: 'nights_stay',
            }}
            size={48}
            tintColor={palette.accent}
          />
          <ActivityIndicator color={palette.accent} size="large" style={{ marginTop: 16 }} />
          <Text style={[styles.loadingLabel, { color: palette.subtleText }]}>{t('dashboard.preparing')}</Text>
        </View>
      </View>
    );
  }

  if (!prayerDay) {
    return (
      <View style={[styles.screen, { backgroundColor: palette.background }]}>
        <View style={styles.noLocationContainer}>
          <SymbolView
            name={{
              android: 'location_off',
              ios: 'location.slash.fill',
              web: 'location_off',
            }}
            size={52}
            tintColor={palette.accent}
          />
          <Text style={[styles.noLocTitle, { color: palette.text }]}>{t('dashboard.set_location_title')}</Text>
          <Text style={[styles.noLocBody, { color: palette.subtleText }]}>
            {t('dashboard.set_location_body')}
          </Text>
          <Pressable
            accessibilityRole="button"
            data-testid="open-settings-btn"
            onPress={() => router.push('/(tabs)/settings' as any)}
            style={[styles.noLocButton, { backgroundColor: palette.accent }]}
          >
            <Text style={[styles.noLocButtonLabel, { color: palette.background }]}>{t('dashboard.open_settings')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const nextIdx = prayerDay.prayers.findIndex((prayer) => prayer.isNext);
  const currentPrayer = nextIdx > 0 ? prayerDay.prayers[nextIdx - 1] : null;
  const nextPrayer =
    prayerDay.nextPrayer && prayerDay.nextPrayerIsoTime
      ? {
          isoTime: prayerDay.nextPrayerIsoTime,
          name: prayerDay.nextPrayer,
          time: prayerDay.nextPrayerTime ?? formatPrayerTime(new Date(prayerDay.nextPrayerIsoTime), prayerDay.timeZone, prayerPreferences.timeFormat),
        }
      : null;
  const countdown = nextPrayer ? getCountdownParts(nextPrayer.isoTime, fastNow) : null;
  const arcDots: PrayerDot[] = prayerDay.prayers.map((prayer) => ({
    done: isTrackablePrayerName(prayer.name) ? (prayerLogs[todayKey]?.prayers[prayer.name] ?? false) : false,
    isNext: Boolean(prayer.isNext),
    name: prayer.name,
    timeMinutes: getPrayerIsoMinutesInTimeZone(prayer.isoTime, prayerDay.timeZone),
  }));
  const currentClock = getHomeHeroClockParts(fastNow, prayerDay.timeZone, prayerPreferences.timeFormat);
  const currentTimeMinutes = getTimeZoneMinutes(fastNow, prayerDay.timeZone);
  const timeOfDayPhase = getTimeOfDayPhase(fastNow, prayerDay.timeZone);
  const reviewModeLabel = nextPrayer
    ? t('dashboard.reviewing_upcoming', { date: prayerDay.gregorianDate })
    : t('dashboard.reviewing_past', { date: prayerDay.gregorianDate });
  const timeOfDaySymbol =
    timeOfDayPhase === 'day'
      ? {
          android: 'light_mode',
          ios: 'sun.max.fill',
          web: 'light_mode',
        } as const
      : {
          android: 'dark_mode',
          ios: 'moon.stars.fill',
          web: 'dark_mode',
        } as const;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.heroArea, { backgroundColor: palette.hero }]}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroTextBlock}>
            <Text style={[styles.heroGreeting, { color: palette.subtleText }]}>{t('dashboard.greeting')}</Text>
            <Text style={[styles.heroCurrentPrayer, { color: palette.text }]} data-testid="current-prayer-name">
              {currentPrayer?.name ?? (nextPrayer ? nextPrayer.name : t('dashboard.all_done'))}
            </Text>
            <View style={styles.countdownBlockRow}>
                <View style={[styles.countdownBlock, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={[styles.countdownBlockValue, { color: palette.gold }]}>{currentClock.hour}</Text>
                  <Text style={[styles.countdownBlockLabel, { color: palette.subtleText }]}>{t('common.hr')}</Text>
                </View>
                <Text style={[styles.countdownBlockColon, { color: palette.subtleText }]}>:</Text>
                <View style={[styles.countdownBlock, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={[styles.countdownBlockValue, { color: palette.gold }]}>{currentClock.minuteLabel}</Text>
                  <Text style={[styles.countdownBlockLabel, { color: palette.subtleText }]}>{t('common.min')}</Text>
                </View>
                <Text style={[styles.countdownBlockColon, { color: palette.subtleText }]}>:</Text>
                <View style={[styles.countdownBlock, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={[styles.countdownBlockValue, { color: palette.gold }]}>{currentClock.secondLabel}</Text>
                  <Text style={[styles.countdownBlockLabel, { color: palette.subtleText }]}>{t('common.sec')}</Text>
                </View>
              <Text style={[styles.countdownUntil, { color: palette.subtleText }]}>
                {currentClock.meridiem ? (
                  <>
                    <Text style={{ color: palette.accent, fontWeight: '700' }}>{currentClock.meridiem}</Text> {t('dashboard.now')}
                  </>
                ) : (
                  t('dashboard.local_time')
                )}
              </Text>
            </View>
            {countdown && nextPrayer ? (
              <View style={styles.countdownBlockRow}>
                <View style={[styles.countdownBlock, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={[styles.countdownBlockValue, { color: palette.gold }]}>
                    {countdown.h.toString().padStart(2, '0')}
                  </Text>
                  <Text style={[styles.countdownBlockLabel, { color: palette.subtleText }]}>{t('common.hr')}</Text>
                </View>
                <Text style={[styles.countdownBlockColon, { color: palette.subtleText }]}>:</Text>
                <View style={[styles.countdownBlock, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={[styles.countdownBlockValue, { color: palette.gold }]}>
                    {countdown.m.toString().padStart(2, '0')}
                  </Text>
                  <Text style={[styles.countdownBlockLabel, { color: palette.subtleText }]}>{t('common.min')}</Text>
                </View>
                <Text style={[styles.countdownBlockColon, { color: palette.subtleText }]}>:</Text>
                <View style={[styles.countdownBlock, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={[styles.countdownBlockValue, { color: palette.gold }]}>
                    {countdown.s.toString().padStart(2, '0')}
                  </Text>
                  <Text style={[styles.countdownBlockLabel, { color: palette.subtleText }]}>{t('common.sec')}</Text>
                </View>
                <Text style={[styles.countdownUntil, { color: palette.subtleText }]}>
                  {t('dashboard.to')} <Text style={{ color: palette.accent, fontWeight: '700' }}>{nextPrayer.name}</Text>
                </Text>
              </View>
            ) : (
              <Text style={[styles.heroCountdown, { color: palette.accent }]}>{t('dashboard.alhamdulillah_done')}</Text>
            )}
          </View>

          <View
            data-testid={`home-time-of-day-${timeOfDayPhase}`}
            testID={`home-time-of-day-${timeOfDayPhase}`}
            style={[styles.heroStatBadge, { backgroundColor: palette.accentSoft, borderColor: palette.border }]}
          >
            <SymbolView name={timeOfDaySymbol} size={16} tintColor={palette.accent} />
            <Text style={[styles.heroStatValue, { color: palette.accent }]}>
              {prayerMetrics.completedToday}/{prayerMetrics.totalTrackablePrayers}
            </Text>
            <Text style={[styles.heroStatLabel, { color: palette.subtleText }]}>{t('common.today')}</Text>
          </View>
        </View>

        <View style={styles.arcContainer}>
          {Platform.OS === 'web' ? (
            <PrayerArc currentTimeMinutes={currentTimeMinutes} dots={arcDots} palette={palette} width={width} />
          ) : (
            <View style={styles.arcFallbackDots}>
              {arcDots
                .filter((dot) => isTrackablePrayerName(dot.name))
                .map((dot) => (
                  <View
                    key={dot.name}
                    style={[
                      styles.arcFallbackDot,
                      {
                        backgroundColor: dot.done ? palette.accent : 'transparent',
                        borderColor: dot.isNext ? palette.accent : palette.border,
                        borderWidth: dot.isNext ? 2 : 1,
                      },
                    ]}
                  />
                ))}
            </View>
          )}
        </View>
      </View>

      <View style={[styles.dateBar, { borderBottomColor: palette.border }]}>
        <View style={[styles.todayPill, { backgroundColor: palette.accentSoft, borderColor: palette.border }]}>
          <Text style={[styles.todayPillText, { color: palette.accent }]}>{t('common.today').toUpperCase()}</Text>
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
          <Text style={[styles.reviewLabel, { color: palette.subtleText }]}>{reviewModeLabel}</Text>
        </View>
        <Text style={[styles.dateMethod, { color: palette.subtleText }]} numberOfLines={1}>
          {prayerDay.methodLabel}
        </Text>
      </View>

      <View style={[styles.prayerList, { backgroundColor: palette.card, borderColor: palette.border }]}>
        {prayerDay.prayers.map((prayer, index) => {
          const isNext = Boolean(prayer.isNext);
          const isCurrent = prayer === currentPrayer;
          const canTrack = isTrackablePrayerName(prayer.name);
          const done = canTrack ? (prayerLogs[todayKey]?.prayers[prayer.name] ?? false) : false;
          const isLast = index === prayerDay.prayers.length - 1;
          const isFuture = new Date(prayer.isoTime).getTime() > fastNow.getTime();
          const notificationsEnabled = notificationPreferences.enabledPrayers[prayer.name];

          const handleToggle = () => {
            if (isFuture && !done) {
              setEarlyCompletionPrayer(prayer.name);
              return;
            }

            void togglePrayerCompletion(prayer.name);
          };

          return (
            <View
              key={prayer.name}
              data-testid={`prayer-row-${prayer.name.toLowerCase()}`}
              style={[
                styles.prayerRow,
                {
                  backgroundColor: isNext ? palette.highlight : isCurrent ? palette.surface : 'transparent',
                  borderBottomColor: palette.border,
                  borderBottomWidth: isLast ? 0 : 0.5,
                },
              ]}
            >
              {isNext || isCurrent ? (
                <View
                  style={[
                    styles.rowAccentBar,
                    { backgroundColor: isNext ? palette.accent : palette.gold },
                  ]}
                />
              ) : null}

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
                    <SymbolView
                      name={{
                        android: 'check',
                        ios: 'checkmark',
                        web: 'check',
                      }}
                      size={14}
                      tintColor="#ffffff"
                    />
                  ) : null}
                </Pressable>
              ) : (
                <View style={styles.completionPlaceholder} />
              )}

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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${notificationsEnabled ? 'Disable' : 'Enable'} ${prayer.name} alerts`}
                onPress={() => {
                  if (permissionState !== 'granted') {
                    void requestPermission();
                    return;
                  }

                  void setPrayerEnabled(prayer.name, !notificationsEnabled);
                }}
                style={[
                  styles.rowNotifButton,
                  {
                    backgroundColor: notificationsEnabled ? palette.accentSoft : palette.surface,
                    borderColor: notificationsEnabled ? palette.accent : palette.border,
                  },
                ]}
              >
                <SymbolView
                  name={
                    notificationsEnabled
                      ? {
                          android: 'notifications_active',
                          ios: 'bell.fill',
                          web: 'notifications_active',
                        }
                      : {
                          android: 'notifications_off',
                          ios: 'bell.slash.fill',
                          web: 'notifications_off',
                        }
                  }
                  size={14}
                  tintColor={notificationsEnabled ? palette.accent : palette.subtleText}
                />
              </Pressable>
            </View>
          );
        })}
      </View>

      <Modal visible={!!earlyCompletionPrayer} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>{t('dashboard.praying_early_title')}</Text>
            <Text style={[styles.modalBody, { color: palette.subtleText }]}>
              {t('dashboard.praying_early_body', { prayer: earlyCompletionPrayer })}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: palette.accent }]}
                onPress={() => {
                  if (!earlyCompletionPrayer) {
                    return;
                  }

                  void togglePrayerCompletion(earlyCompletionPrayer);
                  setEarlyCompletionPrayer(null);
                }}
              >
                <Text style={[styles.modalButtonText, { color: palette.background }]}>{t('dashboard.traveling_jam')}</Text>
              </Pressable>

              <Pressable
                style={[styles.modalButton, { backgroundColor: palette.accent }]}
                onPress={() => {
                  if (!earlyCompletionPrayer) {
                    return;
                  }

                  void togglePrayerCompletion(earlyCompletionPrayer);
                  setEarlyCompletionPrayer(null);
                }}
              >
                <Text style={[styles.modalButtonText, { color: palette.background }]}>{t('dashboard.sick_rukhsah')}</Text>
              </Pressable>

              <Pressable
                style={[styles.modalCancelButton, { borderColor: palette.border }]}
                onPress={() => setEarlyCompletionPrayer(null)}
              >
                <Text style={[styles.modalCancelText, { color: palette.text }]}>{t('common.cancel')}</Text>
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
    ...Platform.select({
      web: {
        boxShadow: '0px 10px 20px rgba(0,0,0,0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 60,
  },
  loadingLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 8,
  },
  noLocationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
    paddingBottom: 80,
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
  scrollContent: {
    paddingBottom: 120,
  },
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
    paddingBottom: 8,
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
    gap: 4,
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
  reviewLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  dateMethod: {
    fontSize: 10,
    fontWeight: '500',
    maxWidth: 100,
    textAlign: 'right',
  },
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
  rowNotifButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
