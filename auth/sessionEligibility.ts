type AuthSession = {
  expires_at?: number;
  user: { id: string; is_anonymous?: boolean };
};
/** Supabase decides whether email verification is required; the app requires a live, non-anonymous session. */
export function canUseAccountSession(session: AuthSession | null, now = Date.now()): boolean {
  return !!session && !!session.user.id && session.user.is_anonymous !== true &&
    typeof session.expires_at === 'number' && Number.isFinite(session.expires_at) && session.expires_at * 1000 > now;
}
