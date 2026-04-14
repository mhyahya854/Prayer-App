import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { appConfig } from '@/src/config/app-config';
import { usePrayerData } from '@/src/prayer/prayer-provider';
import { useAppPalette } from '@/src/theme/palette';

interface MosqueResult {
  address: string;
  distanceKm: number;
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  source: 'google' | 'openstreetmap';
}

const radiusOptions = [3, 7, 12, 20];

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

async function fetchFromGooglePlaces(
  latitude: number,
  longitude: number,
  radiusKm: number,
): Promise<MosqueResult[]> {
  if (!appConfig.googleMapsApiKey) {
    return [];
  }

  const radiusMeters = Math.min(radiusKm * 1000, 50000);
  const url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${latitude},${longitude}` +
    `&radius=${radiusMeters}` +
    `&keyword=mosque` +
    `&key=${encodeURIComponent(appConfig.googleMapsApiKey)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Google Maps search failed. Check API key and Places API access.');
  }

  const payload = (await response.json()) as {
    results?: Array<{
      geometry?: { location?: { lat?: number; lng?: number } };
      name?: string;
      place_id?: string;
      vicinity?: string;
    }>;
    status?: string;
  };

  if (payload.status && payload.status !== 'OK' && payload.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Maps returned ${payload.status}.`);
  }

  return (payload.results ?? [])
    .filter((item) => item.geometry?.location?.lat && item.geometry?.location?.lng && item.name)
    .map((item) => {
      const lat = item.geometry!.location!.lat!;
      const lng = item.geometry!.location!.lng!;
      return {
        address: item.vicinity ?? 'Address unavailable',
        distanceKm: getDistanceKm(latitude, longitude, lat, lng),
        id: item.place_id ?? `google-${item.name}-${lat}-${lng}`,
        latitude: lat,
        longitude: lng,
        name: item.name!,
        source: 'google' as const,
      };
    });
}

async function fetchFromOpenStreetMap(
  latitude: number,
  longitude: number,
  radiusKm: number,
): Promise<MosqueResult[]> {
  const radiusMeters = Math.min(radiusKm * 1000, 25000);
  const query = `[out:json][timeout:25];
(
  node["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${latitude},${longitude});
  way["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${latitude},${longitude});
  relation["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${latitude},${longitude});
);
out center tags;`;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    body: query,
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('OpenStreetMap mosque search failed.');
  }

  const payload = (await response.json()) as {
    elements?: Array<{
      center?: { lat?: number; lon?: number };
      id: number;
      lat?: number;
      lon?: number;
      tags?: Record<string, string>;
      type: string;
    }>;
  };

  const mapped = (payload.elements ?? []).map((element) => {
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      const name = element.tags?.name || element.tags?.['name:en'] || 'Masjid';

      if (!lat || !lon) {
        return null;
      }

      return {
        address: element.tags?.['addr:full'] || element.tags?.['addr:street'] || 'Address unavailable',
        distanceKm: getDistanceKm(latitude, longitude, lat, lon),
        id: `osm-${element.type}-${element.id}`,
        latitude: lat,
        longitude: lon,
        name,
        source: 'openstreetmap' as const,
      };
    });

  return mapped.filter((item): item is NonNullable<typeof item> => item !== null);
}

function dedupeAndSort(results: MosqueResult[]) {
  const map = new Map<string, MosqueResult>();

  for (const result of results) {
    const key = `${result.name.toLowerCase()}-${result.latitude.toFixed(4)}-${result.longitude.toFixed(4)}`;
    const current = map.get(key);
    if (!current || result.distanceKm < current.distanceKm) {
      map.set(key, result);
    }
  }

  return [...map.values()].sort((a, b) => a.distanceKm - b.distanceKm);
}

export default function MosquesScreen() {
  const palette = useAppPalette();
  const { refreshLocation, savedLocation } = usePrayerData();
  const [radiusKm, setRadiusKm] = useState<number>(7);
  const [results, setResults] = useState<MosqueResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationLabel = useMemo(() => savedLocation?.label ?? 'No location selected', [savedLocation]);

  async function searchMosques() {
    if (!savedLocation) {
      setError('Set your location first in Settings so nearby masjids can be found.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { latitude, longitude } = savedLocation.coordinates;
      const [google, osm] = await Promise.all([
        fetchFromGooglePlaces(latitude, longitude, radiusKm).catch(() => []),
        fetchFromOpenStreetMap(latitude, longitude, radiusKm),
      ]);

      const merged = dedupeAndSort([...google, ...osm]).slice(0, 30);
      setResults(merged);

      if (merged.length === 0) {
        setError('No nearby masjids found in this radius. Try a larger range.');
      }
    } catch (nextError) {
      setResults([]);
      setError(nextError instanceof Error ? nextError.message : 'Unable to load mosque results right now.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: palette.hero, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>Mosque Finder</Text>
        <Text style={[styles.copy, { color: palette.subtleText }]}>
          Discover nearby masjids from Google Maps and OpenStreetMap Muslim place data.
        </Text>
        <Text style={[styles.location, { color: palette.subtleText }]}>Location: {locationLabel}</Text>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => void refreshLocation()}
          style={[styles.actionButton, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <Text style={[styles.actionButtonLabel, { color: palette.text }]}>Refresh location</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => void searchMosques()}
          style={[styles.actionButton, { backgroundColor: palette.accent }]}
        >
          <Text style={[styles.actionButtonLabel, { color: palette.background }]}>Find mosques</Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionLabel, { color: palette.subtleText }]}>Search radius</Text>
      <View style={styles.radiusRow}>
        {radiusOptions.map((option) => {
          const isActive = option === radiusKm;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              onPress={() => setRadiusKm(option)}
              style={[
                styles.radiusChip,
                {
                  backgroundColor: isActive ? palette.accentSoft : palette.surface,
                  borderColor: isActive ? palette.accent : palette.border,
                },
              ]}
            >
              <Text style={[styles.radiusChipLabel, { color: isActive ? palette.accent : palette.text }]}>
                {option} km
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={[styles.loadingCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <ActivityIndicator color={palette.accent} />
          <Text style={[styles.loadingLabel, { color: palette.subtleText }]}>Searching nearby masjids…</Text>
        </View>
      ) : null}

      {error ? <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text> : null}

      <View style={styles.resultsList}>
        {results.map((result) => (
          <View
            key={result.id}
            style={[styles.resultCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
          >
            <View style={styles.resultTopRow}>
              <Text style={[styles.resultTitle, { color: palette.text }]} numberOfLines={2}>
                {result.name}
              </Text>
              <Text style={[styles.resultDistance, { color: palette.accent }]}>
                {result.distanceKm.toFixed(1)} km
              </Text>
            </View>
            <Text style={[styles.resultMeta, { color: palette.subtleText }]}>
              {result.address} · {result.source === 'google' ? 'Google Maps' : 'OpenStreetMap'}
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() =>
                void Linking.openURL(
                  `https://www.google.com/maps/search/?api=1&query=${result.latitude},${result.longitude}`,
                )
              }
              style={[styles.mapButton, { borderColor: palette.border, backgroundColor: palette.card }]}
            >
              <Text style={[styles.mapButtonLabel, { color: palette.text }]}>Open in Google Maps</Text>
            </Pressable>
          </View>
        ))}
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
    paddingBottom: 110,
  },
  hero: {
    borderRadius: 18,
    borderWidth: 0.5,
    gap: 6,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  copy: {
    fontSize: 13,
    lineHeight: 19,
  },
  location: {
    fontSize: 12,
    fontWeight: '500',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  actionsRow: {
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
  actionButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  radiusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radiusChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  radiusChipLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingCard: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 0.5,
    gap: 8,
    padding: 14,
  },
  loadingLabel: {
    fontSize: 13,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
  },
  resultsList: {
    gap: 10,
  },
  resultCard: {
    borderRadius: 14,
    borderWidth: 0.5,
    gap: 7,
    padding: 12,
  },
  resultTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  resultTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  resultDistance: {
    fontSize: 13,
    fontWeight: '700',
  },
  resultMeta: {
    fontSize: 12,
    lineHeight: 18,
  },
  mapButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 0.5,
    paddingVertical: 9,
  },
  mapButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
