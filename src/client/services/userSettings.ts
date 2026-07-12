// Client access to the server-persisted user settings (~/.difit/config.json).
// localStorage stays as the synchronous cache and as the only store when no
// API server is available (e.g. the static demo site).

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

let cachedSettings: Promise<Record<string, unknown> | null> | null = null;

export function fetchClientSettings(): Promise<Record<string, unknown> | null> {
  cachedSettings ??= (async () => {
    try {
      const response = await fetch('/api/user-settings');
      if (!response?.ok) {
        return null;
      }
      const data: unknown = await response.json();
      if (isPlainObject(data) && isPlainObject(data.client)) {
        return data.client;
      }
    } catch {
      // No API server (static demo site) or the request failed.
    }
    return null;
  })();
  return cachedSettings;
}

const FLUSH_DELAY_MS = 300;

let pendingPatch: Record<string, unknown> = {};
let flushTimer: ReturnType<typeof setTimeout> | null = null;

// Fire-and-forget: batches rapid changes (e.g. sidebar drag) into one PUT.
export function saveClientSettings(patch: Record<string, unknown>): void {
  Object.assign(pendingPatch, patch);
  if (flushTimer) {
    clearTimeout(flushTimer);
  }
  flushTimer = setTimeout(() => {
    const client = pendingPatch;
    pendingPatch = {};
    flushTimer = null;
    void (async () => {
      try {
        await fetch('/api/user-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client }),
        });
      } catch {
        // Persisting settings is best-effort; localStorage still has them.
      }
    })();
  }, FLUSH_DELAY_MS);
}

export function resetClientSettingsForTests(): void {
  cachedSettings = null;
  pendingPatch = {};
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}
