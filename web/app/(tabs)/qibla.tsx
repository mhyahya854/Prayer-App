import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { usePrayerData } from '@/src/prayer/prayer-provider';
import { useAppPalette } from '@/src/theme/palette';

const kaabaCoordinates = {
  latitude: 21.4225,
  longitude: 39.8262,
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function getQiblaBearing(fromLat: number, fromLon: number) {
  const lat1 = toRadians(fromLat);
  const lon1 = toRadians(fromLon);
  const lat2 = toRadians(kaabaCoordinates.latitude);
  const lon2 = toRadians(kaabaCoordinates.longitude);
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  const angle = toDegrees(Math.atan2(y, x));
  return (angle + 360) % 360;
}

function normalizeHeading(heading: number) {
  return ((heading % 360) + 360) % 360;
}

export default function QiblaScreen() {
  const palette = useAppPalette();
  const { refreshLocation, savedLocation } = usePrayerData();
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [compassError, setCompassError] = useState<string | null>(null);
  const [permissionRequested, setPermissionRequested] = useState(false);

  const qiblaBearing = useMemo(() => {
    if (!savedLocation) {
      return null;
    }

    return getQiblaBearing(
      savedLocation.coordinates.latitude,
      savedLocation.coordinates.longitude,
    );
  }, [savedLocation]);

  const pointerRotation = useMemo(() => {
    if (qiblaBearing === null) {
      return 0;
    }

    if (deviceHeading === null) {
      return qiblaBearing;
    }

    return normalizeHeading(qiblaBearing - deviceHeading);
  }, [deviceHeading, qiblaBearing]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    let isMounted = true;
    const maybeOrientation = (window as any).DeviceOrientationEvent;
    if (!maybeOrientation) {
      setCompassError('Compass heading is not supported on this browser/device.');
      return;
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const alpha = typeof event.alpha === 'number' ? event.alpha : null;
      const webkitCompass = typeof (event as any).webkitCompassHeading === 'number'
        ? (event as any).webkitCompassHeading
        : null;
      const heading = webkitCompass ?? (alpha !== null ? 360 - alpha : null);

      if (!isMounted || heading === null || Number.isNaN(heading)) {
        return;
      }

      setDeviceHeading(normalizeHeading(heading));
      setCompassError(null);
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      isMounted = false;
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [permissionRequested]);

  async function requestCompassPermission() {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const OrientationEventCtor = (window as any).DeviceOrientationEvent;
    if (!OrientationEventCtor) {
      setCompassError('Compass heading is not supported on this browser/device.');
      return;
    }

    if (typeof OrientationEventCtor.requestPermission !== 'function') {
      setPermissionRequested(true);
      return;
    }

    try {
      const permission = await OrientationEventCtor.requestPermission();
      if (permission !== 'granted') {
        setCompassError('Compass permission was denied.');
      } else {
        setPermissionRequested(true);
        setCompassError(null);
      }
    } catch {
      setCompassError('Unable to request compass permission.');
    }
  }

  const bearingLabel = qiblaBearing === null ? 'Unavailable' : `${qiblaBearing.toFixed(1)} deg`;
  const headingLabel = deviceHeading === null ? 'Unavailable' : `${deviceHeading.toFixed(1)} deg`;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: palette.hero, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>Qibla Finder</Text>
        <Text style={[styles.copy, { color: palette.subtleText }]}>
          Align the arrow toward the Kaaba (Makkah). Keep your phone flat for better compass accuracy.
        </Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => void refreshLocation()}
          style={[styles.actionButton, { borderColor: palette.border, backgroundColor: palette.surface }]}
        >
          <Text style={[styles.actionLabel, { color: palette.text }]}>Refresh location</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => void requestCompassPermission()}
          style={[styles.actionButton, { backgroundColor: palette.accent }]}
        >
          <Text style={[styles.actionLabel, { color: palette.background }]}>Enable compass</Text>
        </Pressable>
      </View>

      <View style={[styles.compassCard, { borderColor: palette.border, backgroundColor: palette.surface }]}>
        <View style={[styles.compassDial, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <View
            style={[
              styles.pointer,
              {
                backgroundColor: palette.accent,
                transform: [{ rotate: `${pointerRotation}deg` }],
              },
            ]}
          />
          <View style={[styles.centerDot, { backgroundColor: palette.text }]} />
          <Text style={[styles.northLabel, { color: palette.subtleText }]}>N</Text>
        </View>
        <Text style={[styles.metaText, { color: palette.text }]}>Qibla bearing: {bearingLabel}</Text>
        <Text style={[styles.metaText, { color: palette.subtleText }]}>Device heading: {headingLabel}</Text>
        {savedLocation ? (
          <Text style={[styles.metaText, { color: palette.subtleText }]} numberOfLines={2}>
            From: {savedLocation.label}
          </Text>
        ) : (
          <Text style={[styles.metaText, { color: palette.danger }]}>
            Set your location in Settings first.
          </Text>
        )}
        {compassError ? (
          <Text style={[styles.metaText, { color: palette.danger }]}>{compassError}</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 12,
    padding: 18,
    paddingBottom: 112,
  },
  hero: {
    borderRadius: 20,
    borderWidth: 0.5,
    gap: 8,
    padding: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  copy: {
    fontSize: 13,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 0.5,
    flex: 1,
    paddingVertical: 12,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  compassCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 0.5,
    gap: 8,
    padding: 16,
  },
  compassDial: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 240,
    justifyContent: 'center',
    width: 240,
  },
  pointer: {
    borderRadius: 999,
    height: 92,
    position: 'absolute',
    top: 28,
    transformOrigin: 'bottom center',
    width: 8,
  },
  centerDot: {
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  northLabel: {
    fontSize: 13,
    fontWeight: '700',
    position: 'absolute',
    top: 14,
  },
  metaText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});

