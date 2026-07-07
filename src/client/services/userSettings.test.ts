import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  fetchClientSettings,
  saveClientSettings,
  resetClientSettingsForTests,
} from './userSettings';

describe('userSettings service', () => {
  let mockFetch: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    resetClientSettingsForTests();
    mockFetch = vi.fn<typeof fetch>();
    global.fetch = mockFetch as any;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('fetchClientSettings', () => {
    it('returns the client settings object from the server', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ version: 1, client: { diffViewMode: 'split' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(fetchClientSettings()).resolves.toEqual({
        diffViewMode: 'split',
      });
      expect(mockFetch).toHaveBeenCalledWith('/api/user-settings');
    });

    it('caches the result so concurrent callers share one request', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ version: 1, client: {} }), {
          status: 200,
        }),
      );

      await Promise.all([fetchClientSettings(), fetchClientSettings()]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('returns null when the server responds with an error', async () => {
      mockFetch.mockResolvedValue(new Response('nope', { status: 404 }));
      await expect(fetchClientSettings()).resolves.toBeNull();
    });

    it('returns null when the response is not a settings payload', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ files: [] }), { status: 200 }));
      await expect(fetchClientSettings()).resolves.toBeNull();
    });

    it('returns null when fetch fails (static demo site)', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));
      await expect(fetchClientSettings()).resolves.toBeNull();
    });
  });

  describe('saveClientSettings', () => {
    it('debounces rapid changes into a single merged PUT', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

      saveClientSettings({ sidebarWidth: 300 });
      saveClientSettings({ sidebarWidth: 320 });
      saveClientSettings({ sidebarOpen: false });

      expect(mockFetch).not.toHaveBeenCalled();
      await vi.runAllTimersAsync();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/api/user-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { sidebarWidth: 320, sidebarOpen: false },
        }),
      });
    });

    it('ignores network failures', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      saveClientSettings({ sidebarOpen: true });
      await expect(vi.runAllTimersAsync()).resolves.not.toThrow();
    });
  });
});
