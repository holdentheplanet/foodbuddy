import type { LocalStore } from './localStoreService';
import { sortStoresByDistance, validCoordinates } from './storeDistance';

export const STORE_PAGE_SIZE = 10;
export const STORE_RADII = [5, 10, 25, 50, 100] as const;
export type StoreBrowseOptions = { origin: unknown; browseAll: boolean; query: string; chain: string | null; radiusMiles: number; sort?: 'distance' | 'name' };
/** Filters and pagination run after distance sorting so every page is globally ordered. */
export function browseStores(stores: LocalStore[], options: StoreBrowseOptions, page = 1) {
  const hasOrigin = validCoordinates(options.origin);
  const query = options.query.trim().toLocaleLowerCase();
  const radius = Number.isFinite(options.radiusMiles) && options.radiusMiles > 0 ? options.radiusMiles : 25;
  const ordered = sortStoresByDistance(stores, options.origin);
  const nearby = ordered.filter(store => store.distanceMiles !== null && store.distanceMiles <= radius);
  const matches = (options.browseAll ? ordered : hasOrigin ? nearby : []).filter(store =>
    (!options.chain || store.chain.toLocaleLowerCase() === options.chain.toLocaleLowerCase()) && (!query ||
      [store.name, store.chain, store.streetAddress, store.city, store.state, store.zipCode].join(' ').toLocaleLowerCase().includes(query)));
  if (options.sort === 'name') matches.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const visible = matches.slice(0, (Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1) * STORE_PAGE_SIZE);
  const emptyReason = matches.length ? null : !options.browseAll && !hasOrigin ? 'location_required'
    : !options.browseAll && nearby.length === 0 ? 'outside_coverage' : 'no_matches';
  return { visible, total: matches.length, hasMore: visible.length < matches.length, emptyReason, nearbyCount: nearby.length };
}
