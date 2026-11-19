export function validateSupabaseConfig(url: string | undefined, key: string | undefined) {
  try {
    const parsed = new URL(url ?? '');
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error();
    if (!key?.startsWith('sb_publishable_') || /\s/.test(key) || key.includes('YOUR_')) throw new Error();
    return { url: parsed.origin, key };
  } catch {
    throw new Error('Configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.');
  }
}
