/** Each new action invalidates older completions, including errors and loading updates. */
export function createLatestRequest() {
  let generation = 0;
  return {
    start: () => ++generation,
    invalidate: () => { generation++; },
    isCurrent: (token: number) => generation === token,
  };
}
