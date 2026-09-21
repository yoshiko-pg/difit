// Installs lightweight wrappers around fetch and EventSource so that every
// request to the local `/api/*` endpoints carries the active repository id when
// difit is hosting multiple repositories. This keeps the many individual API
// call sites untouched — single-repo mode (empty active id) is a no-op.

import { appendRepoParam } from './repoContext';

let installed = false;

function isApiUrl(url: string): boolean {
  if (url.startsWith('/api/')) {
    return true;
  }
  // Absolute same-origin URL (e.g. http://host:port/api/...).
  if (typeof window !== 'undefined') {
    const prefix = `${window.location.origin}/api/`;
    if (url.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

function rewrite(url: string): string {
  return isApiUrl(url) ? appendRepoParam(url) : url;
}

export function installRepoScopedApi(): void {
  if (installed || typeof window === 'undefined') {
    return;
  }
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') {
      return originalFetch(rewrite(input), init);
    }
    if (input instanceof URL) {
      return originalFetch(rewrite(input.toString()), init);
    }
    // Request object: rewrite its URL while preserving the rest of the config.
    if (input instanceof Request) {
      const nextUrl = rewrite(input.url);
      if (nextUrl === input.url) {
        return originalFetch(input, init);
      }
      return originalFetch(new Request(nextUrl, input), init);
    }
    return originalFetch(input as RequestInfo, init);
  }) as typeof window.fetch;

  const OriginalEventSource = window.EventSource;
  if (OriginalEventSource) {
    const PatchedEventSource = function (
      this: EventSource,
      url: string | URL,
      init?: EventSourceInit,
    ) {
      const rewritten = rewrite(typeof url === 'string' ? url : url.toString());
      return new OriginalEventSource(rewritten, init);
    } as unknown as typeof EventSource;
    PatchedEventSource.prototype = OriginalEventSource.prototype;
    (PatchedEventSource as { CONNECTING: number }).CONNECTING = OriginalEventSource.CONNECTING;
    (PatchedEventSource as { OPEN: number }).OPEN = OriginalEventSource.OPEN;
    (PatchedEventSource as { CLOSED: number }).CLOSED = OriginalEventSource.CLOSED;
    window.EventSource = PatchedEventSource;
  }
}
