import { promises as fs } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';

export interface UserConfig {
  version: 1;
  client: Record<string, unknown>;
}

const CONFIG_VERSION = 1 as const;

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
  return { version: CONFIG_VERSION, client: {} };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    if (isPlainObject(parsed) && isPlainObject(parsed.client)) {
      return { version: CONFIG_VERSION, client: parsed.client };
    }
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
