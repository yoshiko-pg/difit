import { join } from 'path';

import { subscribe } from '@parcel/watcher';
import { type Response } from 'express';

import { DiffMode } from '../types/watch.js';

interface FileWatcherConfig {
  watchPath: string;
  diffMode: DiffMode;
  debounceMs: number;
  onCacheInvalidate?: () => void;
}

interface ModeWatchConfig {
  watchPaths: string[];
  ignore: string[];
}

const MODE_WATCH_CONFIGS: Record<DiffMode, ModeWatchConfig> = {
  [DiffMode.DEFAULT]: {
    watchPaths: ['.git'],
    ignore: ['.git/objects/**', '.git/refs/**', 'node_modules/**'],
  },
  [DiffMode.WORKING]: {
    watchPaths: ['.', '.git'],
    ignore: ['.git/objects/**', '.git/refs/**', 'node_modules/**'],
  },
  [DiffMode.STAGED]: {
    watchPaths: ['.git'],
    ignore: ['.git/objects/**', '.git/refs/**'],
  },
  [DiffMode.DOT]: {
    watchPaths: ['.', '.git'],
    ignore: ['.git/objects/**', '.git/refs/**', 'node_modules/**'],
  },
  [DiffMode.SPECIFIC]: {
    watchPaths: [], // No watching for specific commits
    ignore: [],
  },
};

export class FileWatcherService {
  private subscriptions: Array<{ unsubscribe: () => Promise<void> }> = [];
  private clients: Response[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private config: FileWatcherConfig | null = null;

  constructor() {}

  async start(
    diffMode: DiffMode,
    watchPath: string,
    debounceMs = 300,
    onCacheInvalidate?: () => void
  ): Promise<void> {
    this.config = { watchPath, diffMode, debounceMs, onCacheInvalidate };

    // Stop existing watchers
    await this.stop();

    // No watching for specific commit comparisons
    if (diffMode === DiffMode.SPECIFIC) {
      console.log('🔍 File watching disabled (specific commit comparison)');
      return;
    }

    const modeConfig = MODE_WATCH_CONFIGS[diffMode];

    try {
      await this.setupWatchers(modeConfig, watchPath);
    } catch (error) {
      console.error('❌ Failed to start file watcher:', error);
      throw error;
    }
  }

  private async setupWatchers(modeConfig: ModeWatchConfig, basePath: string): Promise<void> {
    for (const watchPath of modeConfig.watchPaths) {
      const fullPath = join(basePath, watchPath);

      try {
        const subscription = (await subscribe(
          fullPath,
          (err, events) => {
            if (err) {
              console.error(`Watch error for ${watchPath}:`, err);
              return;
            }

            // Filter out ignored files and check for relevant changes
            const relevantEvents = events.filter((event) => {
              if (this.shouldIgnoreEvent(event.path, modeConfig.ignore)) {
                return false;
              }

              // For git directory watching, only care about specific files
              if (watchPath === '.git') {
                const fileName = event.path.replace(/.*[/\\]/, '');
                const isRelevantGitFile = this.isRelevantGitFile(fileName, this.config?.diffMode);
                return isRelevantGitFile;
              }

              return true;
            });

            if (relevantEvents.length > 0) {
              this.debouncedBroadcast();
            }
          },
          {
            ignore: modeConfig.ignore,
          }
        )) as { unsubscribe: () => Promise<void> };

        this.subscriptions.push(subscription);
      } catch (error) {
        console.warn(`⚠️  Could not watch ${fullPath}:`, error);
        // Continue with other watchers even if one fails
      }
    }
  }

  private shouldIgnoreEvent(filePath: string, ignorePatterns: string[]): boolean {
    return ignorePatterns.some((pattern) => {
      // Handle negation patterns (e.g., "!.git/index")
      if (pattern.startsWith('!')) {
        const positivePattern = pattern.slice(1);
        return !this.matchesPattern(filePath, positivePattern);
      }
      return this.matchesPattern(filePath, pattern);
    });
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simple glob pattern matching
    const regex = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
    return new RegExp(regex).test(filePath);
  }

  private isRelevantGitFile(fileName: string, diffMode?: DiffMode): boolean {
    if (!diffMode) return false;

    switch (diffMode) {
      case DiffMode.DEFAULT:
      case DiffMode.DOT:
        return fileName === 'HEAD';
      case DiffMode.WORKING:
      case DiffMode.STAGED:
        return fileName === 'index' || fileName === 'HEAD';
      default:
        return false;
    }
  }

  private debouncedBroadcast(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    const debounceMs = this.config?.debounceMs || 300;
    this.debounceTimer = setTimeout(() => {
      // Invalidate cache before broadcasting change
      if (this.config?.onCacheInvalidate) {
        this.config.onCacheInvalidate();
      }
      this.broadcastChange();
    }, debounceMs);
  }

  async stop(): Promise<void> {
    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Unsubscribe from all watchers
    await Promise.all(
      this.subscriptions.map(async (subscription) => {
        try {
          await subscription.unsubscribe();
        } catch (error) {
          console.warn('Error unsubscribing from file watcher:', error);
        }
      })
    );
    this.subscriptions = [];

    // Clear clients
    this.clients = [];
  }

  addClient(res: Response): void {
    this.clients.push(res);

    // Send initial connection event
    this.sendToClient(res, {
      type: 'connected',
      diffMode: this.config?.diffMode || DiffMode.DEFAULT,
      changeType: 'file',
      timestamp: new Date().toISOString(),
      message: `Connected to file watcher (${this.config?.diffMode} mode)`,
    });
  }

  removeClient(res: Response): void {
    const index = this.clients.indexOf(res);
    if (index > -1) {
      this.clients.splice(index, 1);
    }
  }

  private broadcastChange(): void {
    if (this.clients.length === 0 || !this.config) {
      return;
    }

    const changeType = this.determineChangeType();
    const event = {
      type: 'reload' as const,
      diffMode: this.config.diffMode,
      changeType,
      timestamp: new Date().toISOString(),
      message: `Changes detected in ${this.config.diffMode} mode`,
    };

    this.clients.forEach((client) => {
      this.sendToClient(client, event);
    });
  }

  private sendToClient(client: Response, event: unknown): void {
    try {
      client.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (error) {
      console.error('Failed to send event to client:', error);
      this.removeClient(client);
    }
  }

  private determineChangeType(): 'file' | 'commit' | 'staging' {
    if (!this.config) return 'file';

    switch (this.config.diffMode) {
      case DiffMode.DEFAULT:
      case DiffMode.DOT:
        return 'commit'; // .git/HEAD changes indicate new commits
      case DiffMode.STAGED:
        return 'staging'; // .git/index changes
      case DiffMode.WORKING:
        return 'file'; // Both file and staging changes, default to file
      default:
        return 'file';
    }
  }
}
