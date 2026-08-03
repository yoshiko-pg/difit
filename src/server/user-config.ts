import { readFileSync } from 'fs';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';

export interface ServerConfig {
  port?: number;
  host?: string;
  open?: boolean;
  comment?: string[];
  clean?: boolean;
  includeUntracked?: boolean;
  keepAlive?: boolean;
  background?: boolean;
  context?: number;
  mergeBase?: boolean;
}

export interface UserConfig {
  version: 1;
  client: Record<string, unknown>;
  server: Partial<ServerConfig>;
}

const CONFIG_VERSION = 1 as const;

const SERVER_CONFIG_KEYS = new Set<string>([
  'port',
  'host',
  'open',
  'comment',
  'clean',
  'includeUntracked',
  'keepAlive',
  'background',
  'context',
  'mergeBase',
]);

// Generous ceiling for UI preferences; anything larger is a bug or abuse.
export const MAX_USER_CONFIG_BYTES = 64 * 1024;

export function getUserConfigPath(): string {
  const configDir = process.env.DIFIT_CONFIG_DIR?.trim();
  if (configDir) {
    return join(configDir, 'config.json');
  }
  return join(homedir(), '.difit', 'config.json');
}

function createDefaultUserConfig(): UserConfig {
  return { version: CONFIG_VERSION, client: {}, server: {} };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateServerConfigValue(key: string, value: unknown): unknown {
  switch (key) {
    case 'port':
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw new Error(`"${key}" must be a non-negative integer`);
      }
      return value;
    case 'host':
      if (typeof value !== 'string') {
        throw new Error(`"${key}" must be a string`);
      }
      return value;
    case 'open':
    case 'clean':
    case 'includeUntracked':
    case 'keepAlive':
    case 'background':
    case 'mergeBase':
      if (typeof value !== 'boolean') {
        throw new Error(`"${key}" must be a boolean`);
      }
      return value;
    case 'context':
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw new Error(`"${key}" must be a non-negative integer`);
      }
      return value;
    case 'comment':
      if (typeof value === 'string') {
        return [value];
      }
      if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
        return value;
      }
      throw new Error(`"${key}" must be a string or array of strings`);
  }
}

function parseServerSettings(
  source: Record<string, unknown>,
  configPath?: string,
): Partial<ServerConfig> {
  const config: Partial<ServerConfig> = {};
  const location = configPath ? ` in ${configPath}` : '';

  for (const [key, value] of Object.entries(source)) {
    if (!SERVER_CONFIG_KEYS.has(key)) {
      console.warn(`Warning: Ignoring unknown config key "${key}"${location}`);
      continue;
    }
    const validated = validateServerConfigValue(key, value);
    Object.assign(config, { [key]: validated });
  }

  return config;
}

function parseStoredUserConfig(parsed: unknown, path?: string): UserConfig {
  if (!isPlainObject(parsed) || !isPlainObject(parsed.client)) {
    return createDefaultUserConfig();
  }

  const server = isPlainObject(parsed.server) ? parseServerSettings(parsed.server, path) : {};

  return {
    version: CONFIG_VERSION,
    client: parsed.client,
    server,
  };
}

export function readServerConfigFile(path: string): Partial<ServerConfig> {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return {};
    }
    throw new Error(
      `Failed to read config file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  if (Buffer.byteLength(raw, 'utf-8') > MAX_USER_CONFIG_BYTES) {
    throw new Error(`Config file ${path} exceeds the maximum allowed size`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in config file ${path}`);
  }

  if (!isPlainObject(parsed)) {
    throw new Error(`Config file ${path} must contain a JSON object`);
  }

  if (!isPlainObject(parsed.server)) {
    return {};
  }

  return parseServerSettings(parsed.server, path);
}

export function parseUserSettingsPatch(body: unknown): Record<string, unknown> | null {
  if (!isPlainObject(body) || !isPlainObject(body.client)) {
    return null;
  }
  if (Buffer.byteLength(JSON.stringify(body.client), 'utf-8') > MAX_USER_CONFIG_BYTES) {
    return null;
  }
  return body.client;
}

export async function readUserConfig(path: string = getUserConfigPath()): Promise<UserConfig> {
  try {
    const raw = await fs.readFile(path, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    return parseStoredUserConfig(parsed, path);
  } catch {
    // Missing or unreadable config falls back to defaults.
  }
  return createDefaultUserConfig();
}

// Shallow-merges the patch into the stored client settings. Concurrent difit
// servers may write the same file; settings changes are rare enough that
// last-write-wins per top-level key is acceptable.
export async function updateUserClientSettings(
  patch: Record<string, unknown>,
  path: string = getUserConfigPath(),
): Promise<UserConfig> {
  const current = await readUserConfig(path);
  const next: UserConfig = {
    version: CONFIG_VERSION,
    client: { ...current.client, ...patch },
    server: current.server,
  };

  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  if (Buffer.byteLength(serialized, 'utf-8') > MAX_USER_CONFIG_BYTES) {
    throw new Error('User settings exceed the maximum allowed size');
  }

  await fs.mkdir(dirname(path), { recursive: true });
  // Write via a temp file + rename so a crash mid-write can't corrupt the config.
  const tmpPath = `${path}.${process.pid}.tmp`;
  await fs.writeFile(tmpPath, serialized, 'utf-8');
  await fs.rename(tmpPath, path);
  return next;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}
