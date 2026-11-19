/** All chunks, including the manifest, live in the platform's secure storage. */
export type SecureKeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
const CHUNK_SIZE = 400; // <= 1600 UTF-8 bytes, including surrogate pairs.
const MAX_CHUNKS = 256;
type Manifest = { version: 1; generation: string; count: number };
function decode(value: string | null): Manifest | null {
  if (!value) return null;
  try {
    const m = JSON.parse(value);
    return m.version === 1 && /^[a-zA-Z0-9-]+$/.test(m.generation) &&
      Number.isInteger(m.count) && m.count > 0 && m.count <= MAX_CHUNKS ? m : null;
  } catch { return null; }
}
/** Serialized, copy-on-write commits: a failed write never publishes a partial token. */
export function createSecureSessionStorage(store: SecureKeyValueStore, generation: () => string) {
  let pending: Promise<unknown> = Promise.resolve();
  function serialized<T>(work: () => Promise<T>): Promise<T> {
    const result = pending.then(work);
    pending = result.catch(() => undefined);
    return result;
  }
  const part = (key: string, m: Manifest, i: number) => `${key}.${m.generation}.${i}`;
  async function removeChunks(key: string, m: Manifest | null) {
    if (m) await Promise.all(Array.from({ length: m.count }, (_, i) => store.removeItem(part(key, m, i))));
  }
  return {
    getItem: (key: string): Promise<string | null> => serialized(async () => {
      const m = decode(await store.getItem(key));
      if (!m) return null;
      const chunks = await Promise.all(Array.from({ length: m.count }, (_, i) => store.getItem(part(key, m, i))));
      return chunks.every(c => c !== null) ? chunks.join('') : null;
    }),
    setItem: (key: string, value: string): Promise<void> => serialized(async () => {
      const characters = Array.from(value); // Do not split a surrogate pair across native writes.
      const count = Math.max(1, Math.ceil(characters.length / CHUNK_SIZE));
      if (count > MAX_CHUNKS) throw new Error('Session exceeds secure storage capacity.');
      const old = decode(await store.getItem(key));
      const m: Manifest = { version: 1, generation: generation(), count };
      if (!/^[a-zA-Z0-9-]+$/.test(m.generation) || m.generation === old?.generation) throw new Error('Invalid storage generation.');
      try {
        for (let i = 0; i < count; i++) await store.setItem(part(key, m, i), characters.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE).join(''));
        await store.setItem(key, JSON.stringify(m));
      } catch (error) {
        await removeChunks(key, m).catch(() => undefined);
        throw error;
      }
      // Cleanup failure must not report a committed token refresh as failed.
      await removeChunks(key, old).catch(() => undefined);
    }),
    removeItem: (key: string): Promise<void> => serialized(async () => {
      const m = decode(await store.getItem(key));
      await store.removeItem(key); // Make the session inaccessible before cleanup.
      await removeChunks(key, m);
    }),
  };
}
