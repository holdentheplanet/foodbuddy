import { validCoordinates } from '../services/storeDistance';
import type { StoreCatalog } from './types';

const hosts = new Set(['www.target.com', 'www.publix.com', 'stores.foodlion.com', 'www.walmart.com',
  'www.harristeeter.com', 'mapcarta.com', 'www.whereorg.com']);
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Invalid store catalog: ${message}`);
}
function nonblank(value: unknown): value is string { return typeof value === 'string' && !!value.trim(); }
export function validateStoreCatalog(input: unknown, today = new Date().toISOString().slice(0, 10)): StoreCatalog {
  const catalog = input as StoreCatalog;
  check(catalog && catalog.formatVersion === 1 && nonblank(catalog.catalogId) && Array.isArray(catalog.stores), 'invalid manifest');
  const ids = new Set(); const addresses = new Set();
  for (const store of catalog.stores) {
    check(store && typeof store === 'object', 'invalid store');
    for (const key of ['id', 'name', 'chain', 'streetAddress', 'city', 'state', 'zipCode', 'notes'] as const) check(nonblank(store[key]), `missing ${key}`);
    check(/^[a-z0-9][a-z0-9-]+$/.test(store.id) && !ids.has(store.id), 'invalid/duplicate ID'); ids.add(store.id);
    const address = `${store.chain}|${store.streetAddress}|${store.city}|${store.state}`.toLowerCase().replace(/\s+/g, ' ');
    check(!addresses.has(address), 'duplicate store address'); addresses.add(address);
    check(/^[A-Z]{2}$/.test(store.state) && /^\d{5}(-\d{4})?$/.test(store.zipCode), 'invalid US address');
    check(['verified', 'unverified', 'unknown'].includes(store.verificationStatus), 'invalid verification status');
    check((store.latitude === null && store.longitude === null) || validCoordinates(store), 'invalid coordinates');
    check(typeof store.checkedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(store.checkedAt)
      && Number.isFinite(Date.parse(store.checkedAt)) && new Date(store.checkedAt).toISOString().slice(0, 10) === store.checkedAt
      && store.checkedAt <= today, 'invalid review date');
    check(Array.isArray(store.sources) && store.sources.length > 0, 'sources required');
    for (const source of store.sources) {
      check(source && nonblank(source.url) && nonblank(source.evidence), 'source evidence required');
      const url = new URL(source.url);
      check(url.protocol === 'https:' && !url.username && !url.password && hosts.has(url.hostname), 'unreviewed source host');
      check(['official_directory', 'openstreetmap', 'business_directory'].includes(source.kind), 'invalid source kind');
      if (source.kind === 'openstreetmap') check(nonblank(store.attribution), 'OpenStreetMap attribution required');
    }
    if (store.latitude !== null) check(store.sources.some(source => source.evidence.includes(String(store.latitude))
      && source.evidence.includes(String(store.longitude)) && source.evidence.includes(store.streetAddress)), 'coordinates lack source evidence');
    if (store.verificationStatus === 'verified') {
      check(validCoordinates(store) && store.sources.some(source => source.kind === 'official_directory'), 'verified location needs coordinates and official identity');
      check(store.sources.some(source => source.kind !== 'business_directory' && source.evidence.includes(String(store.latitude))
        && source.evidence.includes(String(store.longitude))), 'verified coordinates need reviewed authoritative metadata');
    }
  }
  return JSON.parse(JSON.stringify(catalog)) as StoreCatalog;
}
