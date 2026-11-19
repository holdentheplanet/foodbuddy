/** Opening the profile waits briefly for cloud data, then always permits local use.
 * Late completion must never remount an editor or discard an in-progress draft.
 */
export function waitForProfileSync(sync: Promise<unknown>, timeoutMs = 3000): Promise<'synced' | 'offline' | 'pending'> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (status: 'synced' | 'offline' | 'pending') => {
      if (settled) return;
      settled = true; clearTimeout(timer); resolve(status);
    };
    const timer = setTimeout(() => finish('pending'), timeoutMs);
    void sync.then(() => finish('synced'), () => finish('offline'));
  });
}
