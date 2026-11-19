import points from '../stores/zip/us-zcta-2025.json';
import type { Coordinates } from '../stores/types';
import { validCoordinates } from './storeDistance';

const reference: Readonly<Record<string, readonly number[]>> = points;
export type ZipLocationResult = { ok: true; zip: string; position: Coordinates; label: string }
  | { ok: false; message: string };
/** Offline Census area reference only. Never geocodes an address or invents a fallback. */
export function lookupZip(input: string): ZipLocationResult {
  const zip = input.trim();
  if (!/^\d{5}$/.test(zip)) return { ok: false, message: 'Enter a five-digit US ZIP code.' };
  const point = Object.prototype.hasOwnProperty.call(reference, zip) ? reference[zip] : undefined;
  const position = point ? { latitude: point[0], longitude: point[1] } : null;
  if (!validCoordinates(position)) return { ok: false, message: 'This ZIP has no coordinates in the bundled Census reference. Try another ZIP or use your location.' };
  return { ok: true, zip, position, label: `ZIP ${zip} — approximate area location` };
}
