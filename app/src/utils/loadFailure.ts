/**
 * True when a failed request means "we couldn't reach/ask the server" (offline, timeout, 5xx) as opposed to an
 * expected answer like 404 "nothing yet" for a new user. Dashboards use it to decide whether to show a
 * "couldn't load" banner instead of silently rendering an empty, new-user-looking state.
 */
export function isLoadFailure(err: unknown): boolean {
  const e = err as { isNetworkError?: boolean; status?: number } | null | undefined;
  if (!e) return true;
  if (e.isNetworkError) return true;
  return e.status === undefined || e.status >= 500;
}
