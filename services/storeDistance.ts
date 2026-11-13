import type { Coordinates } from '../stores/types';

export function validCoordinates(value: unknown): value is Coordinates {
  if (!value || typeof value !== 'object') return false;
  const c = value as Coordinates;
  return typeof c.latitude === 'number' && Number.isFinite(c.latitude) && Math.abs(c.latitude) <= 90
    && typeof c.longitude === 'number' && Number.isFinite(c.longitude) && Math.abs(c.longitude) <= 180;
}
/** Straight-line great-circle distance, never a road route or travel estimate. */
export function distanceMiles(from: unknown, to: unknown): number | null {
  if (!validCoordinates(from) || !validCoordinates(to)) return null;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const a = Math.sin(radians(to.latitude - from.latitude) / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude))
    * Math.sin(radians(to.longitude - from.longitude) / 2) ** 2;
  return 3958.7613 * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, a))));
}
export function sortStoresByDistance<T extends { id: string; name: string; latitude: number | null; longitude: number | null }>(stores: T[], origin: unknown) {
  return stores.map(store => ({ ...store, distanceMiles: distanceMiles(origin, store) }))
    .sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity)
      || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
