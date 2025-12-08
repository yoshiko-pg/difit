import { useCallback, useEffect, useRef, useState } from 'react';

import { DiffMode, type ClientWatchState } from '../../types/watch.js';

interface FileWatchHook {
  shouldReload: boolean;
  isConnected: boolean;
  error: string | null;
  reload: () => void;
  watchState: ClientWatchState;
}

interface WatchEvent {
  type: 'reload' | 'error' | 'connected';
  diffMode: DiffMode;
  changeType: 'file' | 'commit' | 'staging';
  timestamp: string;
  message?: string;
}

export function useFileWatch(onReload?: () => Promise<void>): FileWatchHook {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  const [watchState, setWatchState] = useState<ClientWatchState>({
    isWatchEnabled: false,
    diffMode: DiffMode.DEFAULT,
    shouldReload: false,
    isReloading: false,
    lastChangeTime: null,
    lastChangeType: null,
    connectionStatus: 'disconnected',
  });

  const [error, setError] = useState<string | null>(null);

  const connectToWatch = useCallback(() => {
    if (eventSourceRef.current) {
      return; // Already connected
    }

    try {
      const eventSource = new EventSource('/api/watch');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('Connected to file watch service');
        setWatchState((prev) => ({
          ...prev,
          connectionStatus: 'connected',
        }));
        reconnectAttemptsRef.current = 0;
        setError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const data: WatchEvent = JSON.parse(event.data as string);

          switch (data.type) {
            case 'connected':
              setWatchState((prev) => ({
                ...prev,
                isWatchEnabled: true,
                diffMode: data.diffMode,
                connectionStatus: 'connected',
              }));
              break;

            case 'reload':
              console.log('File changes detected, showing reload button:', data.changeType);
              setWatchState((prev) => ({
                ...prev,
                shouldReload: true,
                lastChangeTime: new Date(),
                lastChangeType: data.changeType,
              }));
              break;

            case 'error':
              console.error('File watch error:', data.message);
              setError(data.message || 'File watch error occurred');
              break;
          }
        } catch (parseError) {
          console.error('Error parsing watch event:', parseError);
        }
      };

      eventSource.onerror = () => {
        console.log('File watch connection lost');
        setWatchState((prev) => ({
          ...prev,
          connectionStatus: 'disconnected',
        }));

        // Close the current connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          setWatchState((prev) => ({
            ...prev,
            connectionStatus: 'reconnecting',
          }));

          reconnectAttemptsRef.current += 1;

          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(
              `Attempting to reconnect to file watch service (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`
            );
            // eslint-disable-next-line react-hooks/immutability -- connectToWatch is defined when setTimeout callback runs
            connectToWatch();
          }, reconnectDelay);
        } else {
          console.error('Max reconnection attempts reached');
          setError('Lost connection to file watch service');
        }
      };
    } catch (connectionError) {
      console.error('Failed to connect to file watch service:', connectionError);
      setError('Failed to connect to file watch service');
    }
  }, [maxReconnectAttempts, reconnectDelay]);

  const handleReload = useCallback(async () => {
    if (watchState.isReloading) {
      return; // Already reloading
    }

    setWatchState((prev) => ({
      ...prev,
      isReloading: true,
    }));

    try {
      if (onReload) {
        await onReload();
      }

      // Reset reload state after successful reload
      setWatchState((prev) => ({
        ...prev,
        shouldReload: false,
        isReloading: false,
        lastChangeTime: null,
        lastChangeType: null,
      }));
    } catch (reloadError) {
      console.error('Reload failed:', reloadError);
      setError('Failed to reload diff data');

      setWatchState((prev) => ({
        ...prev,
        isReloading: false,
      }));
    }
  }, [onReload, watchState.isReloading]);

  const cleanup = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  // Initialize connection
  useEffect(() => {
    connectToWatch();

    return cleanup;
  }, [connectToWatch]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, []);

  return {
    shouldReload: watchState.shouldReload,
    isConnected: watchState.connectionStatus === 'connected',
    error,
    reload: handleReload,
    watchState,
  };
}
