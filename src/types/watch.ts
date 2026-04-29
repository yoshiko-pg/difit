export enum DiffMode {
  DEFAULT = 'default', // HEAD^ vs HEAD
  WORKING = 'working', // staged vs working
  STAGED = 'staged', // HEAD vs staged
  DOT = 'dot', // HEAD vs working (all changes)
  SPECIFIC = 'specific', // commit vs commit (no watching)
}

export type WatchChangeType = 'file' | 'commit' | 'staging';

export interface ConnectedWatchEvent {
  type: 'connected';
  diffMode: DiffMode;
  changeType: WatchChangeType;
  timestamp: string;
  message?: string;
}

export interface ReloadWatchEvent {
  type: 'reload';
  diffMode: DiffMode;
  changeType: WatchChangeType;
  timestamp: string;
  message?: string;
}

export interface ErrorWatchEvent {
  type: 'error';
  diffMode: DiffMode;
  changeType: WatchChangeType;
  timestamp: string;
  message?: string;
}

export interface CommentsChangedWatchEvent {
  type: 'commentsChanged';
  version: number;
  timestamp: string;
}

export type WatchEvent =
  | ConnectedWatchEvent
  | ReloadWatchEvent
  | ErrorWatchEvent
  | CommentsChangedWatchEvent;

export interface ClientWatchState {
  isWatchEnabled: boolean;
  diffMode: DiffMode;
  shouldReload: boolean;
  isReloading: boolean;
  lastChangeTime: Date | null;
  lastChangeType: WatchChangeType | null;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
}
