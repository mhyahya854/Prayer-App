import type { MosqueSearchResponse, MosqueSearchResult, MosqueSource } from '@prayer-app/core';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchNearbyMosques } from '@/src/lib/api/client';
import { usePrayerData } from '@/src/prayer/prayer-provider';
import { useAppPalette } from '@/src/theme/palette';

const radiusOptions = [3, 7, 12, 20] as const;

function buildProviderMessage(response: MosqueSearchResponse) {
  const degradedProviders = (Object.entries(response.providerStatus) as Array<
    [MosqueSource, MosqueSearchResponse['providerStatus'][MosqueSource]]
  >)
    .filter(([, status]) => status === 'error')
    .map(([source]) => (source === 'google' ? 'Google Places' : 'OpenStreetMap'));

  if (degradedProviders.length === 0) {
    return null;
  }

  return `${degradedProviders.join(' and ')} are temporarily unavailable. Showing partial results.`;
}

export default function MosquesScreen() {
  const palette = useAppPalette();
  const { refreshLocation, savedLocation } = usePrayerData();
  const [radiusKm, setRadiusKm] = useState<number>(7);
  const [results, setResults] = useState<MosqueSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerMessage, setProviderMessage] = useState<string | null>(null);

  const locationLabel = useMemo(() => savedLocation?.label ?? 'No location selected', [savedLocation]);

  async function searchMosques() {
    if (!savedLocation) {
      setError('Set your location first in Settings so nearby masjids can be found.');
      setProviderMessage(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setProviderMessage(null);

    try {
      const { latitude, longitude } = savedLocation.coordinates;
      const response = await fetchNearbyMosques(latitude, longitude, radiusKm);
      const nextResults = response.results.slice(0, 30);

      setResults(nextResults);
      setProviderMessage(buildProviderMessage(response));

      if (nextResults.length === 0) {
        setError('No nearby masjids found in this radius. Try a larger range.');
      }
    } catch (nextError) {
      setResults([]);
      setProviderMessage(null);
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to load mosque results right now.',
      );
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
          Discover nearby masjids through the Prayer App search service.
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
          data-testid="find-mosques-button"
          testID="find-mosques-button"
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
          <Text style={[styles.loadingLabel, { color: palette.subtleText }]}>Searching nearby masjids...</Text>
        </View>
      ) : null}

      {providerMessage ? (
        <Text style={[styles.infoText, { color: palette.subtleText }]}>{providerMessage}</Text>
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
              {result.address} | {result.source === 'google' ? 'Google Places' : 'OpenStreetMap'}
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
  infoText: {
    fontSize: 13,
    lineHeight: 19,
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
