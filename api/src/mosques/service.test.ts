import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiMosqueSearchService, MosqueSearchUnavailableError } from './service';

function createJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
    },
    status,
  });
}

test('google disabled plus OpenStreetMap success returns results', async () => {
  let overpassCalls = 0;
  const service = new ApiMosqueSearchService({
    fetchImpl: async (url) => {
      const requestUrl = String(url);

      if (!requestUrl.includes('overpass.test')) {
        throw new Error(`Unexpected URL: ${requestUrl}`);
      }

      overpassCalls += 1;
      return createJsonResponse({
        elements: [
          {
            id: 1,
            lat: 3.139,
            lon: 101.6869,
            tags: {
              name: 'Masjid Jamek',
            },
            type: 'node',
          },
        ],
      });
    },
    overpassUrl: 'https://overpass.test/api',
  });

  const response = await service.searchNearby({
    latitude: 3.139,
    longitude: 101.6869,
    radiusKm: 7,
  });

  assert.equal(overpassCalls, 1);
  assert.equal(response.providerStatus.google, 'disabled');
  assert.equal(response.providerStatus.openstreetmap, 'ok');
  assert.equal(response.results.length, 1);
  assert.equal(response.results[0]?.name, 'Masjid Jamek');
});

test('google failure plus OpenStreetMap success returns partial results', async () => {
  let googleCalls = 0;
  const service = new ApiMosqueSearchService({
    fetchImpl: async (url) => {
      const requestUrl = String(url);

      if (requestUrl.includes('google.test')) {
        googleCalls += 1;
        return createJsonResponse({ status: 'UNKNOWN_ERROR' }, 503);
      }

      return createJsonResponse({
        elements: [
          {
            id: 2,
            lat: 3.14,
            lon: 101.687,
            tags: {
              name: 'Masjid Negara',
            },
            type: 'node',
          },
        ],
      });
    },
    googlePlacesApiKey: 'test-google-key',
    googlePlacesUrl: 'https://google.test/nearbysearch/json',
    overpassUrl: 'https://overpass.test/api',
  });

  const response = await service.searchNearby({
    latitude: 3.139,
    longitude: 101.6869,
    radiusKm: 7,
  });

  assert.equal(googleCalls, 2);
  assert.equal(response.providerStatus.google, 'error');
  assert.equal(response.providerStatus.openstreetmap, 'ok');
  assert.equal(response.results.length, 1);
  assert.equal(typeof response.providerErrors.google, 'string');
});

test('both providers failing raises a user-safe unavailable error', async () => {
  const service = new ApiMosqueSearchService({
    fetchImpl: async () => createJsonResponse({ error: 'upstream unavailable' }, 503),
    googlePlacesApiKey: 'test-google-key',
    googlePlacesUrl: 'https://google.test/nearbysearch/json',
    overpassUrl: 'https://overpass.test/api',
  });

  await assert.rejects(
    () =>
      service.searchNearby({
        latitude: 3.139,
        longitude: 101.6869,
        radiusKm: 7,
      }),
    (error: unknown) => {
      assert.equal(error instanceof MosqueSearchUnavailableError, true);
      if (!(error instanceof MosqueSearchUnavailableError)) {
        return false;
      }

      assert.equal(error.details.providerStatus.google, 'error');
      assert.equal(error.details.providerStatus.openstreetmap, 'error');
      return true;
    },
  );
});

test('results are deduped and sorted by distance', async () => {
  const service = new ApiMosqueSearchService({
    fetchImpl: async (url) => {
      const requestUrl = String(url);

      if (requestUrl.includes('google.test')) {
        return createJsonResponse({
          results: [
            {
              geometry: {
                location: {
                  lat: 3.139,
                  lng: 101.6869,
                },
              },
              name: 'Masjid Jamek',
              place_id: 'google-1',
              vicinity: 'Kuala Lumpur',
            },
          ],
          status: 'OK',
        });
      }

      return createJsonResponse({
        elements: [
          {
            id: 4,
            lat: 3.139,
            lon: 101.6869,
            tags: {
              name: 'Masjid Jamek',
            },
            type: 'node',
          },
          {
            id: 5,
            lat: 3.2,
            lon: 101.8,
            tags: {
              name: 'Masjid Wilayah',
            },
            type: 'node',
          },
        ],
      });
    },
    googlePlacesApiKey: 'test-google-key',
    googlePlacesUrl: 'https://google.test/nearbysearch/json',
    overpassUrl: 'https://overpass.test/api',
  });

  const response = await service.searchNearby({
    latitude: 3.139,
    longitude: 101.6869,
    radiusKm: 20,
  });

  assert.equal(response.results.length, 2);
  assert.equal(response.results[0]?.name, 'Masjid Jamek');
  assert.equal(response.results[0]?.source, 'google');
  assert.equal(response.results[1]?.name, 'Masjid Wilayah');
  assert.equal(response.results[0]!.distanceKm <= response.results[1]!.distanceKm, true);
});

test('cache hits avoid repeated upstream requests', async () => {
  let now = 1000;
  let overpassCalls = 0;
  const service = new ApiMosqueSearchService({
    fetchImpl: async () => {
      overpassCalls += 1;
      return createJsonResponse({
        elements: [
          {
            id: 6,
            lat: 3.139,
            lon: 101.6869,
            tags: {
              name: 'Masjid Cache',
            },
            type: 'node',
          },
        ],
      });
    },
    now: () => now,
    overpassUrl: 'https://overpass.test/api',
  });

  const params = {
    latitude: 3.139,
    longitude: 101.6869,
    radiusKm: 7,
  } as const;

  await service.searchNearby(params);
  await service.searchNearby(params);
  now += 6 * 60_000;
  await service.searchNearby(params);

  assert.equal(overpassCalls, 2);
});
