import { lookupZip } from './zipLocation';
import type { ForegroundLocationResult } from './foregroundLocation';
import type { Coordinates } from '../stores/types';

export const CHARLESTON_DEFAULT = { zip: '29401', latitude: 32.77718, longitude: -79.932 } as const;
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
export function storeLocationKey(userId: number) {
  if (!Number.isSafeInteger(userId) || userId < 1) throw new Error('A local account ID is required.');
  // Keep the existing per-account key; never clear other preferences to migrate.
  return `foodbuddy:store-location:v1:${userId}`;
}
export type SavedStoreLocation = { manualZip: string | null; notice: string | null };
/** v1 was written only by the ZIP action. Preserve it; never guess that NYC means GPS. */
export function readStoreLocationPreference(raw: string | null): SavedStoreLocation {
  const empty = { manualZip: null, notice: null };
  if (!raw) return empty;
  try {
    const data = JSON.parse(raw);
    if (['gps', 'automatic', 'cached_gps'].includes(data.source)) return empty;
    if ((data.version === 2 && data.source === 'manual_zip') || (data.version === 1 && (data.source === undefined || data.source === 'manual_zip'))) {
      if (typeof data.zip === 'string' && lookupZip(data.zip).ok) return { manualZip: data.zip,
        notice: data.version === 1 ? `Using saved ZIP ${data.zip}. Older records have no explicit provenance; confirm it or choose Charleston default.` : null };
    }
    return { ...empty, notice: 'Older location preference could not be identified. Showing Charleston; the original preference is preserved.' };
  } catch { return { ...empty, notice: 'Saved location could not be read. Showing Charleston without changing the original preference.' }; }
}
export function selectedZipLocation(zip: string | null): ForegroundLocationResult {
  const result = lookupZip(zip ?? CHARLESTON_DEFAULT.zip);
  if (!result.ok) throw new Error(result.message);
  const charleston = !zip || zip === CHARLESTON_DEFAULT.zip;
  return { status: 'available', position: charleston ? { latitude: CHARLESTON_DEFAULT.latitude, longitude: CHARLESTON_DEFAULT.longitude } : result.position,
    accuracy: null, timestamp: null, mocked: false,
    message: charleston ? (zip ? 'Charleston, SC 29401 — approximate area location' : 'Charleston, SC 29401 · Default (approximate)') : result.label };
}
export function storeLocationAfterGPS(result: ForegroundLocationResult, manualZip: string | null) {
  if (result.position) return { location: result, source: 'gps' as const, notice: null };
  return { location: selectedZipLocation(manualZip), source: manualZip ? 'zip' as const : 'default' as const,
    notice: `${result.message} Using ${manualZip ? `saved ZIP ${manualZip}` : 'Charleston default'}.` };
}
export function storeOriginRegion(position: Coordinates, radius: number) {
  return { ...position, latitudeDelta: radius / 30, longitudeDelta: radius / 25 };
}
/** Only explicit manual choices persist. GPS and map gestures have no write path. */
export function createStoreLocationPreferences(storage: Storage) {
  let writes = Promise.resolve();
  async function loadPreference(userId: number) {
    await writes;
    return readStoreLocationPreference(await storage.getItem(storeLocationKey(userId)));
  }
  return {
    loadPreference,
    async load(userId: number) { return (await loadPreference(userId)).manualZip; },
    save(userId: number, zip: string) {
      const result = lookupZip(zip);
      if (!result.ok) return Promise.reject(new Error(result.message));
      const key = storeLocationKey(userId);
      const task = writes.then(() => storage.setItem(key, JSON.stringify({ version: 2, source: 'manual_zip', zip: result.zip })));
      writes = task.catch(() => undefined);
      return task;
    },
  };
}
