import tzLookup from 'tz-lookup';

import type { SavedLocation } from '@prayer-app/core';

export function getDeviceTimeZone() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return typeof timeZone === 'string' && timeZone.length > 0 && isValidTimeZone(timeZone)
    ? timeZone
    : null;
}

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-US', {
      timeZone,
    }).format(new Date());

    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZoneFromCoordinates(coordinates: SavedLocation['coordinates']) {
  try {
    const timeZone = tzLookup(coordinates.latitude, coordinates.longitude);

    return isValidTimeZone(timeZone) ? timeZone : null;
  } catch {
    return null;
  }
}
