/** Invalidate results immediately on logout, token expiry, or account switching. */
export function createSessionScope() {
  let revision = 0;
  let owner: string | null = null;
  return {
    replace(userId: string | null) { owner = userId; revision++; },
    capture() {
      const capturedRevision = revision;
      const userId = owner;
      return { userId, isCurrent: () => userId !== null && owner === userId && revision === capturedRevision };
    },
  };
}
