import type { DiffResponse } from '../../types/diff';
import { DiffMode } from '../../types/watch';
import type { StaticDiffDataset } from '../types/staticDiff';

const STATIC_DIFF_DATA_URL = '/landing-data/diffs.json';

export interface StaticApiBridge {
  restore: () => void;
  dataset: StaticDiffDataset;
}

interface StaticDiffRequest {
  base?: string;
  target?: string;
}

const jsonResponse = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });

const extractUrl = (input: RequestInfo | URL): URL => {
  if (input instanceof URL) {
    return input;
  }
  if (input instanceof Request) {
    return new URL(input.url, window.location.origin);
  }
  return new URL(String(input), window.location.origin);
};

const normalizeRef = (value?: string) => (value ?? '').trim();

const buildDiffIndex = (dataset: StaticDiffDataset) => {
  const index = new Map<string, DiffResponse>();

  dataset.revisions.forEach((revision) => {
    const diff = dataset.diffs[revision.id];
    if (!diff) return;

    const pairs = [
      `${revision.baseShortHash}...${revision.targetShortHash}`,
      `${revision.baseHash}...${revision.targetHash}`,
      `${revision.baseShortHash}...${revision.targetHash}`,
      `${revision.baseHash}...${revision.targetShortHash}`,
    ];

    pairs.forEach((pair) => {
      index.set(pair, diff);
    });
  });

  return index;
};

const resolveInitialRevisionId = (dataset: StaticDiffDataset): string | null => {
  if (dataset.initialRevisionId && dataset.diffs[dataset.initialRevisionId]) {
    return dataset.initialRevisionId;
  }
  return dataset.revisions.find((revision) => dataset.diffs[revision.id])?.id ?? null;
};

const resolveRequestedSnapshotId = (dataset: StaticDiffDataset): string | null => {
  const query = new URLSearchParams(window.location.search);
  const requestedId = query.get('snapshot');
  if (!requestedId) {
    return resolveInitialRevisionId(dataset);
  }
  if (dataset.diffs[requestedId]) {
    return requestedId;
  }
  return resolveInitialRevisionId(dataset);
};

const buildDiffPayload = (diff: DiffResponse): DiffResponse => ({
  ...diff,
  clearComments: false,
});

export const installStaticApiBridge = (dataset: StaticDiffDataset): StaticApiBridge => {
  const originalFetch = window.fetch.bind(window);
  const OriginalEventSource = window.EventSource;
  const originalSendBeacon = navigator.sendBeacon?.bind(navigator);

  const diffIndex = buildDiffIndex(dataset);
  let currentRevisionId = resolveRequestedSnapshotId(dataset);

  const resolveDiff = ({ base, target }: StaticDiffRequest): DiffResponse | null => {
    if (!base && !target) {
      if (!currentRevisionId) return null;
      return dataset.diffs[currentRevisionId] ?? null;
    }

    const normalizedBase = normalizeRef(base);
    const normalizedTarget = normalizeRef(target);
    if (!normalizedBase || !normalizedTarget) {
      return null;
    }

    const key = `${normalizedBase}...${normalizedTarget}`;
    const diff = diffIndex.get(key) ?? null;
    if (diff) {
      const matchedRevision = dataset.revisions.find(
        (revision) => dataset.diffs[revision.id] === diff,
      );
      if (matchedRevision) {
        currentRevisionId = matchedRevision.id;
      }
    }
    return diff;
  };

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const requestUrl = extractUrl(input);

    if (requestUrl.pathname === '/api/diff') {
      const diff = resolveDiff({
        base: requestUrl.searchParams.get('base') ?? undefined,
        target: requestUrl.searchParams.get('target') ?? undefined,
      });

      if (!diff) {
        return jsonResponse({ error: 'Snapshot not available for requested revision pair' }, 404);
      }

      return jsonResponse(buildDiffPayload(diff));
    }

    if (requestUrl.pathname === '/api/revisions') {
      return jsonResponse({ error: 'Revision API is disabled in static mode' }, 404);
    }

    if (requestUrl.pathname.startsWith('/api/line-count/')) {
      return jsonResponse({ oldLineCount: 0, newLineCount: 0 });
    }

    if (requestUrl.pathname.startsWith('/api/blob/')) {
      return jsonResponse({ error: 'Blob API is disabled in static mode' }, 404);
    }

    if (requestUrl.pathname === '/api/comments') {
      return jsonResponse({ success: true });
    }

    if (requestUrl.pathname === '/api/comments-output') {
      return new Response('', { status: 200 });
    }

    if (requestUrl.pathname === '/api/open-in-editor') {
      return jsonResponse({ error: 'Open in editor is disabled in static mode' }, 400);
    }

    return originalFetch(input, init);
  }) as typeof window.fetch;

  class StaticEventSource {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;

    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSED = 2;

    readonly url: string;
    readonly withCredentials = false;
    readyState = StaticEventSource.CONNECTING;
    onopen: ((this: EventSource, ev: Event) => unknown) | null = null;
    onmessage: ((this: EventSource, ev: MessageEvent) => unknown) | null = null;
    onerror: ((this: EventSource, ev: Event) => unknown) | null = null;

    constructor(url: string | URL) {
      this.url = String(url);
      queueMicrotask(() => {
        if (this.readyState === StaticEventSource.CLOSED) return;
        this.readyState = StaticEventSource.OPEN;
        this.onopen?.call(this as unknown as EventSource, new Event('open'));

        if (this.url.endsWith('/api/watch')) {
          const payload = JSON.stringify({
            type: 'connected',
            diffMode: DiffMode.SPECIFIC,
            changeType: 'commit',
            timestamp: new Date().toISOString(),
            message: 'Static snapshot mode',
          });
          this.onmessage?.call(
            this as unknown as EventSource,
            new MessageEvent('message', { data: payload }),
          );
        }
      });
    }

    addEventListener(): void {}
    removeEventListener(): void {}
    dispatchEvent(): boolean {
      return true;
    }

    close() {
      this.readyState = StaticEventSource.CLOSED;
    }
  }

  window.EventSource = StaticEventSource as unknown as typeof EventSource;

  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    writable: true,
    value: ((url: string | URL, data?: BodyInit | null) => {
      const target = typeof url === 'string' ? url : url.toString();
      if (target.startsWith('/api/comments')) {
        return true;
      }
      if (originalSendBeacon) {
        return originalSendBeacon(url, data);
      }
      return true;
    }) as Navigator['sendBeacon'],
  });

  return {
    dataset,
    restore: () => {
      window.fetch = originalFetch;
      window.EventSource = OriginalEventSource;
      Object.defineProperty(navigator, 'sendBeacon', {
        configurable: true,
        writable: true,
        value: originalSendBeacon,
      });
    },
  };
};

export const loadStaticDataset = async (): Promise<StaticDiffDataset> => {
  const response = await fetch(STATIC_DIFF_DATA_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to load static diff dataset (${response.status} ${response.statusText})`,
    );
  }
  return (await response.json()) as StaticDiffDataset;
};
