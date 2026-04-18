import type {
  MosqueSearchResponse,
  MosqueSearchResult,
  MosqueSource,
} from '@prayer-app/core';

export interface MosqueSearchParams {
  latitude: number;
  longitude: number;
  radiusKm: number;
}

export interface MosqueSearchService {
  searchNearby(params: MosqueSearchParams): Promise<MosqueSearchResponse>;
}

interface MosqueSearchProviderResult {
  error?: string;
  results: MosqueSearchResult[];
  status: MosqueSearchResponse['providerStatus'][MosqueSource];
}

interface GooglePlacesPayload {
  results?: Array<{
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
    name?: string;
    place_id?: string;
    vicinity?: string;
  }>;
  status?: string;
}

interface OverpassPayload {
  elements?: Array<{
    center?: {
      lat?: number;
      lon?: number;
    };
    id: number;
    lat?: number;
    lon?: number;
    tags?: Record<string, string>;
    type: string;
  }>;
}

interface CachedMosqueResponse {
  expiresAt: number;
  response: MosqueSearchResponse;
}

export class MosqueSearchUnavailableError extends Error {
  constructor(
    message: string,
    readonly details: MosqueSearchResponse,
  ) {
    super(message);
    this.name = 'MosqueSearchUnavailableError';
  }
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function normalizeErrorMessage(sourceLabel: string, error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return `${sourceLabel} search is unavailable right now.`;
}

export class ApiMosqueSearchService implements MosqueSearchService {
  private readonly cache = new Map<string, CachedMosqueResponse>();
  private readonly cacheTtlMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly googlePlacesApiKey: string;
  private readonly googlePlacesUrl: string;
  private readonly now: () => number;
  private readonly overpassUrl: string;
  private readonly timeoutMs: number;

  constructor(options?: {
    cacheTtlMs?: number;
    fetchImpl?: typeof fetch;
    googlePlacesApiKey?: string;
    googlePlacesUrl?: string;
    now?: () => number;
    overpassUrl?: string;
    timeoutMs?: number;
  }) {
    this.cacheTtlMs = options?.cacheTtlMs ?? 5 * 60_000;
    this.fetchImpl = options?.fetchImpl ?? fetch;
    this.googlePlacesApiKey = options?.googlePlacesApiKey?.trim() ?? '';
    this.googlePlacesUrl =
      options?.googlePlacesUrl ?? 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
    this.now = options?.now ?? Date.now;
    this.overpassUrl = options?.overpassUrl ?? 'https://overpass-api.de/api/interpreter';
    this.timeoutMs = options?.timeoutMs ?? 10_000;
  }

  async searchNearby(params: MosqueSearchParams): Promise<MosqueSearchResponse> {
    const cacheKey = this.createCacheKey(params);
    const cached = this.cache.get(cacheKey);
    const currentTime = this.now();

    if (cached && cached.expiresAt > currentTime) {
      return cached.response;
    }

    if (cached) {
      this.cache.delete(cacheKey);
    }

    const [google, openstreetmap] = await Promise.all([
      this.fetchGooglePlaces(params),
      this.fetchOpenStreetMap(params),
    ]);
    const response: MosqueSearchResponse = {
      providerErrors: {
        ...(google.error ? { google: google.error } : {}),
        ...(openstreetmap.error ? { openstreetmap: openstreetmap.error } : {}),
      },
      providerStatus: {
        google: google.status,
        openstreetmap: openstreetmap.status,
      },
      results: this.dedupeAndSort([...google.results, ...openstreetmap.results]),
    };
    const hasSuccessfulProvider =
      response.providerStatus.google === 'ok' || response.providerStatus.openstreetmap === 'ok';

    if (!hasSuccessfulProvider) {
      throw new MosqueSearchUnavailableError(
        'Mosque search is temporarily unavailable. Please try again shortly.',
        response,
      );
    }

    this.cache.set(cacheKey, {
      expiresAt: currentTime + this.cacheTtlMs,
      response,
    });

    return response;
  }

  private createCacheKey({ latitude, longitude, radiusKm }: MosqueSearchParams) {
    return `${latitude.toFixed(3)}:${longitude.toFixed(3)}:${radiusKm}`;
  }

  private async fetchGooglePlaces({
    latitude,
    longitude,
    radiusKm,
  }: MosqueSearchParams): Promise<MosqueSearchProviderResult> {
    if (!this.googlePlacesApiKey) {
      return {
        results: [],
        status: 'disabled',
      };
    }

    const radiusMeters = Math.min(radiusKm * 1000, 50_000);
    const searchParams = new URLSearchParams({
      key: this.googlePlacesApiKey,
      keyword: 'mosque',
      location: `${latitude},${longitude}`,
      radius: radiusMeters.toString(),
    });

    try {
      const payload = await this.fetchJsonWithRetry<GooglePlacesPayload>(
        `${this.googlePlacesUrl}?${searchParams.toString()}`,
        undefined,
        'Google Places',
      );

      if (payload.status && payload.status !== 'OK' && payload.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places returned ${payload.status}.`);
      }

      const results: MosqueSearchResult[] = [];

      for (const item of payload.results ?? []) {
        const nextLatitude = item.geometry?.location?.lat;
        const nextLongitude = item.geometry?.location?.lng;

        if (
          typeof nextLatitude !== 'number' ||
          typeof nextLongitude !== 'number' ||
          !item.name
        ) {
          continue;
        }

        results.push({
          address: item.vicinity ?? 'Address unavailable',
          distanceKm: getDistanceKm(latitude, longitude, nextLatitude, nextLongitude),
          id: item.place_id ?? `google-${item.name}-${nextLatitude}-${nextLongitude}`,
          latitude: nextLatitude,
          longitude: nextLongitude,
          name: item.name,
          source: 'google',
        });
      }

      return {
        results,
        status: 'ok',
      };
    } catch (error) {
      return {
        error: normalizeErrorMessage('Google Places', error),
        results: [],
        status: 'error',
      };
    }
  }

  private async fetchOpenStreetMap({
    latitude,
    longitude,
    radiusKm,
  }: MosqueSearchParams): Promise<MosqueSearchProviderResult> {
    const radiusMeters = Math.min(radiusKm * 1000, 25_000);
    const query = `[out:json][timeout:25];
(
  node["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${latitude},${longitude});
  way["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${latitude},${longitude});
  relation["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${latitude},${longitude});
);
out center tags;`;

    try {
      const payload = await this.fetchJsonWithRetry<OverpassPayload>(
        this.overpassUrl,
        {
          body: query,
          method: 'POST',
        },
        'OpenStreetMap',
      );

      const results: MosqueSearchResult[] = [];

      for (const element of payload.elements ?? []) {
        const nextLatitude = element.lat ?? element.center?.lat;
        const nextLongitude = element.lon ?? element.center?.lon;

        if (typeof nextLatitude !== 'number' || typeof nextLongitude !== 'number') {
          continue;
        }

        const name = element.tags?.name || element.tags?.['name:en'] || 'Masjid';
        results.push({
          address:
            element.tags?.['addr:full'] ||
            element.tags?.['addr:street'] ||
            'Address unavailable',
          distanceKm: getDistanceKm(latitude, longitude, nextLatitude, nextLongitude),
          id: `osm-${element.type}-${element.id}`,
          latitude: nextLatitude,
          longitude: nextLongitude,
          name,
          source: 'openstreetmap',
        });
      }

      return {
        results,
        status: 'ok',
      };
    } catch (error) {
      return {
        error: normalizeErrorMessage('OpenStreetMap', error),
        results: [],
        status: 'error',
      };
    }
  }

  private async fetchJsonWithRetry<T>(url: string, init: RequestInit | undefined, sourceLabel: string) {
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.fetchWithTimeout(url, init);

        if (!response.ok) {
          const error = new Error(`${sourceLabel} request failed with status ${response.status}.`);

          if (attempt === 0 && shouldRetryStatus(response.status)) {
            lastError = error;
            continue;
          }

          throw error;
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error;

        if (attempt === 0 && (isAbortError(error) || error instanceof TypeError)) {
          continue;
        }

        if (attempt === 0 && error instanceof Error && error.message.includes('status')) {
          continue;
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`${sourceLabel} search is unavailable right now.`);
  }

  private async fetchWithTimeout(url: string, init?: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await this.fetchImpl(url, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private dedupeAndSort(results: MosqueSearchResult[]) {
    const dedupedResults = new Map<string, MosqueSearchResult>();

    for (const result of results) {
      const key = `${result.name.trim().toLowerCase()}-${result.latitude.toFixed(4)}-${result.longitude.toFixed(4)}`;
      const current = dedupedResults.get(key);

      if (!current || result.distanceKm < current.distanceKm) {
        dedupedResults.set(key, result);
      }
    }

    return [...dedupedResults.values()].sort((left, right) => left.distanceKm - right.distanceKm);
  }
}
