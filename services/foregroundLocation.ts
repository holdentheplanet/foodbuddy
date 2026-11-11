import { validCoordinates } from './storeDistance';
import type { Coordinates } from '../stores/types';

type Fix = { coords: Coordinates & { accuracy: number | null }; timestamp: number; mocked?: boolean };
export type ForegroundLocationAdapter = {
  requestPermission: () => Promise<{ granted: boolean; canAskAgain: boolean }>;
  servicesEnabled: () => Promise<boolean>;
  currentPosition: () => Promise<Fix>;
};
export type ForegroundLocationResult = {
  status: 'available' | 'denied' | 'disabled' | 'unavailable';
  position: Coordinates | null; accuracy: number | null; timestamp: number | null; mocked: boolean;
  message: string;
};
/** One foreground fix. Missing GPS never blocks manual browsing or creates a fake origin. */
export async function resolveForegroundLocation(adapter: ForegroundLocationAdapter, timeoutMs = 12000): Promise<ForegroundLocationResult> {
  const empty = { position: null, accuracy: null, timestamp: null, mocked: false };
  try {
    const permission = await adapter.requestPermission();
    if (!permission.granted) return { ...empty, status: 'denied', message: permission.canAskAgain
      ? 'Location permission denied. Browse saved stores manually or try again.'
      : 'Location permission denied. Enable foreground location in device settings, or browse manually.' };
    if (!await adapter.servicesEnabled()) return { ...empty, status: 'disabled', message: 'Device location services are off. Browse saved stores manually.' };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let fix: Fix;
    try {
      fix = await Promise.race([adapter.currentPosition(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Location timed out')), timeoutMs);
      })]);
    } finally { if (timer) clearTimeout(timer); }
    if (!validCoordinates(fix.coords) || !Number.isFinite(fix.timestamp)) throw new Error('Invalid GPS fix');
    return { status: 'available', position: { latitude: fix.coords.latitude, longitude: fix.coords.longitude },
      accuracy: typeof fix.coords.accuracy === 'number' && Number.isFinite(fix.coords.accuracy) && fix.coords.accuracy >= 0 ? fix.coords.accuracy : null, timestamp: fix.timestamp, mocked: fix.mocked === true,
      message: 'Sorted by straight-line distance from your latest location fix. Distances are approximate, not driving routes.' };
  } catch {
    return { ...empty, status: 'unavailable', message: 'Location unavailable or timed out. Browse saved stores manually. On a simulator, set a simulated location and retry.' };
  }
}
