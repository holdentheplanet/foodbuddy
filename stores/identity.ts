import type { StoreRecord } from './types';
import { distanceMiles } from '../services/storeDistance';

type Identity = Pick<StoreRecord, 'id' | 'name' | 'chain' | 'streetAddress' | 'city' | 'state' | 'latitude' | 'longitude' | 'sources'>;
export function normalizedStoreAddress(store: Pick<Identity, 'streetAddress' | 'city' | 'state'>) {
  const aliases: Record<string, string> = { street: 'st', avenue: 'ave', road: 'rd', boulevard: 'blvd', drive: 'dr', lane: 'ln', highway: 'hwy', north: 'n', south: 's', east: 'e', west: 'w' };
  return [store.streetAddress, store.city, store.state].map(value => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean).map(word => aliases[word] ?? word).join(' ')).join('|');
}
export function osmSourceIdentities(store: Pick<Identity, 'sources'>) {
  return store.sources.flatMap(source => {
    try { const url = new URL(source.url); const match = /^(?:\/)(node|way|relation)\/(\d+)\/?$/.exec(url.pathname);
      return ['www.openstreetmap.org', 'openstreetmap.org'].includes(url.hostname) && match ? [`${match[1]}/${match[2]}`] : [];
    } catch { return []; }
  });
}
/** Conflicts are quarantined, never merged, including separate OSM node/way representations. */
export function findStoreConflict(incoming: Identity, existing: Identity[]) {
  const sources = osmSourceIdentities(incoming);
  const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  for (const other of existing) {
    if (other.id === incoming.id) continue;
    if (osmSourceIdentities(other).some(id => sources.includes(id))) return { existingId: other.id, reason: 'source_identity' };
    if (normalizedStoreAddress(incoming) === normalizedStoreAddress(other)) return { existingId: other.id, reason: 'normalized_address' };
    const miles = distanceMiles(incoming, other);
    if (miles !== null && (miles < 25 / 1609.344 || (miles < 150 / 1609.344 &&
      (normalize(incoming.name) === normalize(other.name) || (!['Independent', 'Unknown chain'].includes(incoming.chain) && normalize(incoming.chain) === normalize(other.chain)))))) {
      return { existingId: other.id, reason: 'proximity_review_required' };
    }
  }
  return null;
}
