import * as Location from 'expo-location';
import {
  calculatePrayerMetrics,
  computePrayerDay,
  createSavedLocation,
  formatDateKey,
  getDefaultPrayerPreferences,
  setPrayerCompletion,
  type CalculationMethodId,
  type PrayerCalculationMode,
  type MadhabId,
  type PrayerAdjustmentMap,
  type PrayerDay,
  type PrayerLogStore,
  type PrayerPreferences,
  type PrayerProgressSummary,
  type PrayerTimeFormat,
  type SavedLocation,
  type TrackablePrayerName,
} from '@prayer-app/core';
import { createContext, type PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import {
  loadPrayerStorageSnapshot,
  savePrayerLogs,
  savePrayerPreferences,
  saveSavedLocation,
  type PrayerStorageSnapshot,
} from '@/src/lib/storage/prayer-storage';
import {
  getDeviceTimeZone,
  isValidTimeZone,
  resolveTimeZoneFromCoordinates,
} from '@/src/prayer/location-time-zone';

type LocationPermissionState = 'denied' | 'granted' | 'unknown';

export interface ManualLocationInput {
  label: string;
  latitude: number;
  longitude: number;
  timeZoneOverride?: string;
}

interface PrayerDataContextValue {
  adjustPrayerOffset: (prayerKey: keyof PrayerAdjustmentMap, delta: number) => Promise<void>;
  isHydrated: boolean;
  isRefreshingLocation: boolean;
  locationError: string | null;
  locationPermission: LocationPermissionState;
  prayerDay: PrayerDay | null;
  prayerLogs: PrayerLogStore;
  prayerLogsUpdatedAt: string;
  prayerMetrics: PrayerProgressSummary;
  prayerPreferences: PrayerPreferences;
  prayerPreferencesUpdatedAt: string;
  refreshLocation: () => Promise<void>;
  replacePrayerDataSnapshot: (snapshot: PrayerStorageSnapshot) => Promise<void>;
  saveManualLocation: (input: ManualLocationInput) => Promise<void>;
  savedLocation: SavedLocation | null;
  savedLocationUpdatedAt: string;
  setAutoRefreshLocation: (enabled: boolean) => Promise<void>;
  setCalculationMethod: (nextMethod: CalculationMethodId) => Promise<void>;
  setCalculationMode: (nextMode: PrayerCalculationMode) => Promise<void>;
  setMadhab: (nextMadhab: MadhabId) => Promise<void>;
  setTimeFormat: (nextFormat: PrayerTimeFormat) => Promise<void>;
  togglePrayerCompletion: (prayerName: TrackablePrayerName) => Promise<void>;
  todayKey: string;
}

const PrayerDataContext = createContext<PrayerDataContextValue | null>(null);

function buildLocationLabel(
  geocode: Location.LocationGeocodedAddress | undefined,
  latitude: number,
  longitude: number,
) {
  const parts = [geocode?.city, geocode?.district, geocode?.region].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(', ');
  }

  return `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
}

function mapPermissionStatus(status: Location.PermissionStatus | undefined): LocationPermissionState {
  if (status === Location.PermissionStatus.GRANTED) {
    return 'granted';
  }

  if (status === Location.PermissionStatus.DENIED) {
    return 'denied';
  }

  return 'unknown';
}

export function PrayerDataProvider({ children }: PropsWithChildren) {
  const autoRefreshAttemptedRef = useRef(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationPermission, setLocationPermission] = useState<LocationPermissionState>('unknown');
  const [now, setNow] = useState(() => new Date());
  const [prayerLogs, setPrayerLogs] = useState<PrayerLogStore>({});
  const [prayerLogsUpdatedAt, setPrayerLogsUpdatedAt] = useState('');
  const [prayerPreferences, setPrayerPreferencesState] = useState<PrayerPreferences>(
    getDefaultPrayerPreferences(),
  );
  const [prayerPreferencesUpdatedAt, setPrayerPreferencesUpdatedAt] = useState('');
  const [savedLocation, setSavedLocationState] = useState<SavedLocation | null>(null);
  const [savedLocationUpdatedAt, setSavedLocationUpdatedAt] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      const snapshot = await loadPrayerStorageSnapshot();

      if (!isMounted) {
        return;
      }

      setPrayerPreferencesState(snapshot.prayerPreferences.value);
      setPrayerPreferencesUpdatedAt(snapshot.prayerPreferences.updatedAt);
      setPrayerLogs(snapshot.prayerLogs.value);
      setPrayerLogsUpdatedAt(snapshot.prayerLogs.updatedAt);
      setSavedLocationState(snapshot.savedLocation.value);
      setSavedLocationUpdatedAt(snapshot.savedLocation.updatedAt);
      setLocationPermission(snapshot.savedLocation.value ? 'granted' : 'unknown');
      setIsHydrated(true);
    }

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let minuteInterval: ReturnType<typeof setInterval> | null = null;
    const minuteBoundaryDelayMs = 60_000 - (Date.now() % 60_000);

    const minuteBoundaryTimeout = setTimeout(() => {
      setNow(new Date());
      minuteInterval = setInterval(() => {
        setNow(new Date());
      }, 60_000);
    }, minuteBoundaryDelayMs);

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setNow(new Date());
      }
    });

    return () => {
      clearTimeout(minuteBoundaryTimeout);
      if (minuteInterval) {
        clearInterval(minuteInterval);
      }
      appStateSubscription.remove();
    };
  }, []);

  const timeZone = savedLocation?.timeZone ?? getDeviceTimeZone();
  const todayKey = formatDateKey(now, timeZone);
  const prayerDay = savedLocation
    ? computePrayerDay({
        coordinates: savedLocation.coordinates,
        dateKey: todayKey,
        locationLabel: savedLocation.label,
        now,
        preferences: prayerPreferences,
        timeZone,
      })
    : null;
  const prayerMetrics = calculatePrayerMetrics(prayerLogs, todayKey);

  async function persistPreferences(nextPreferences: PrayerPreferences, updatedAt = new Date().toISOString()) {
    setPrayerPreferencesState(nextPreferences);
    setPrayerPreferencesUpdatedAt(updatedAt);
    await savePrayerPreferences(nextPreferences, updatedAt);
  }

  async function setCalculationMethod(nextMethod: CalculationMethodId) {
    await persistPreferences({
      ...prayerPreferences,
      calculationMethod: nextMethod,
    });
  }

  async function setCalculationMode(nextMode: PrayerCalculationMode) {
    await persistPreferences({
      ...prayerPreferences,
      calculationMode: nextMode,
    });
  }

  async function setMadhab(nextMadhab: MadhabId) {
    await persistPreferences({
      ...prayerPreferences,
      madhab: nextMadhab,
    });
  }

  async function setTimeFormat(nextFormat: PrayerTimeFormat) {
    await persistPreferences({
      ...prayerPreferences,
      timeFormat: nextFormat,
    });
  }

  async function setAutoRefreshLocation(enabled: boolean) {
    if (enabled && !prayerPreferences.autoRefreshLocation) {
      autoRefreshAttemptedRef.current = false;
    }

    await persistPreferences({
      ...prayerPreferences,
      autoRefreshLocation: enabled,
    });
  }

  async function adjustPrayerOffset(prayerKey: keyof PrayerAdjustmentMap, delta: number) {
    const nextValue = Math.max(-30, Math.min(30, prayerPreferences.adjustments[prayerKey] + delta));

    await persistPreferences({
      ...prayerPreferences,
      adjustments: {
        ...prayerPreferences.adjustments,
        [prayerKey]: nextValue,
      },
    });
  }

  async function refreshLocation() {
    setIsRefreshingLocation(true);
    setLocationError(null);

    try {
      const permissionResponse = await Location.requestForegroundPermissionsAsync();

      if (permissionResponse.status !== Location.PermissionStatus.GRANTED) {
        setLocationPermission(mapPermissionStatus(permissionResponse.status));
        setLocationError('Location permission is required before accurate local prayer times can be calculated.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      const geocodeResults = await Location.reverseGeocodeAsync(coordinates).catch(() => []);
      const geoDerivedTimeZone = resolveTimeZoneFromCoordinates(coordinates);
      const deviceTimeZone = getDeviceTimeZone();
      const effectiveTimeZone = geoDerivedTimeZone ?? deviceTimeZone;

      if (!effectiveTimeZone) {
        throw new Error('Unable to determine a timezone for the current coordinates. Enter a manual location instead.');
      }

      const nextLocation = createSavedLocation(
        coordinates,
        buildLocationLabel(geocodeResults[0], coordinates.latitude, coordinates.longitude),
        effectiveTimeZone,
        'device',
        geoDerivedTimeZone ? 'geo' : 'device-fallback',
      );

      setSavedLocationState(nextLocation);
      setSavedLocationUpdatedAt(nextLocation.updatedAt);
      setLocationPermission('granted');
      await saveSavedLocation(nextLocation, nextLocation.updatedAt);
    } catch (error) {
      setLocationError(
        error instanceof Error
          ? error.message
          : 'Unable to refresh the current location for prayer calculations.',
      );
    } finally {
      setIsRefreshingLocation(false);
    }
  }

  async function saveManualLocation(input: ManualLocationInput) {
    setIsRefreshingLocation(true);
    setLocationError(null);

    try {
      const manualTimeZone = input.timeZoneOverride?.trim() ?? '';
      if (manualTimeZone && !isValidTimeZone(manualTimeZone)) {
        setLocationError('Enter a valid IANA timezone such as Asia/Kuala_Lumpur or America/New_York.');
        return;
      }

      const coordinates = {
        latitude: input.latitude,
        longitude: input.longitude,
      };
      const geoDerivedTimeZone = manualTimeZone ? null : resolveTimeZoneFromCoordinates(coordinates);
      const effectiveTimeZone = manualTimeZone || geoDerivedTimeZone;

      if (!effectiveTimeZone) {
        setLocationError(
          'Timezone could not be derived from those coordinates. Add a manual timezone before saving this location.',
        );
        return;
      }

      const label = input.label.trim() || `${input.latitude.toFixed(3)}, ${input.longitude.toFixed(3)}`;
      const nextLocation = createSavedLocation(
        coordinates,
        label,
        effectiveTimeZone,
        'manual',
        manualTimeZone ? 'manual' : 'geo',
      );

      setSavedLocationState(nextLocation);
      setSavedLocationUpdatedAt(nextLocation.updatedAt);
      await saveSavedLocation(nextLocation, nextLocation.updatedAt);
    } finally {
      setIsRefreshingLocation(false);
    }
  }

  async function togglePrayerCompletion(prayerName: TrackablePrayerName) {
    const updatedAt = new Date().toISOString();
    const nextStore = setPrayerCompletion(
      prayerLogs,
      todayKey,
      prayerName,
      !(prayerLogs[todayKey]?.prayers[prayerName] ?? false),
    );

    setPrayerLogs(nextStore);
    setPrayerLogsUpdatedAt(updatedAt);
    await savePrayerLogs(nextStore, updatedAt);
  }

  async function replacePrayerDataSnapshot(snapshot: PrayerStorageSnapshot) {
    setPrayerPreferencesState(snapshot.prayerPreferences.value);
    setPrayerPreferencesUpdatedAt(snapshot.prayerPreferences.updatedAt);
    setPrayerLogs(snapshot.prayerLogs.value);
    setPrayerLogsUpdatedAt(snapshot.prayerLogs.updatedAt);
    setSavedLocationState(snapshot.savedLocation.value);
    setSavedLocationUpdatedAt(snapshot.savedLocation.updatedAt);
    setLocationPermission(snapshot.savedLocation.value ? 'granted' : 'unknown');

    await Promise.all([
      savePrayerPreferences(snapshot.prayerPreferences.value, snapshot.prayerPreferences.updatedAt),
      savePrayerLogs(snapshot.prayerLogs.value, snapshot.prayerLogs.updatedAt),
      saveSavedLocation(snapshot.savedLocation.value, snapshot.savedLocation.updatedAt),
    ]);
  }

  useEffect(() => {
    let isMounted = true;

    async function syncLocationPermission() {
      try {
        const permissionResponse = await Location.getForegroundPermissionsAsync();

        if (isMounted) {
          setLocationPermission(mapPermissionStatus(permissionResponse.status));
        }
      } catch {
        if (isMounted) {
          setLocationPermission(savedLocation ? 'granted' : 'unknown');
        }
      }
    }

    void syncLocationPermission();

    return () => {
      isMounted = false;
    };
  }, [savedLocation]);

  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      !isHydrated ||
      savedLocation ||
      locationPermission === 'denied' ||
      !prayerPreferences.autoRefreshLocation ||
      autoRefreshAttemptedRef.current
    ) {
      return;
    }

    autoRefreshAttemptedRef.current = true;
    void refreshLocation();
  }, [
    isHydrated,
    locationPermission,
    prayerPreferences.autoRefreshLocation,
    savedLocation,
  ]);

  return (
    <PrayerDataContext.Provider
      value={{
        adjustPrayerOffset,
        isHydrated,
        isRefreshingLocation,
        locationError,
        locationPermission,
        prayerDay,
        prayerLogs,
        prayerLogsUpdatedAt,
        prayerMetrics,
        prayerPreferences,
        prayerPreferencesUpdatedAt,
        refreshLocation,
        replacePrayerDataSnapshot,
        saveManualLocation,
        savedLocation,
        savedLocationUpdatedAt,
        setAutoRefreshLocation,
        setCalculationMethod,
        setCalculationMode,
        setMadhab,
        setTimeFormat,
        togglePrayerCompletion,
        todayKey,
      }}
    >
      {children}
    </PrayerDataContext.Provider>
  );
}

export function usePrayerData() {
  const context = useContext(PrayerDataContext);

  if (!context) {
    throw new Error('usePrayerData must be used inside PrayerDataProvider.');
  }

  return context;
}
