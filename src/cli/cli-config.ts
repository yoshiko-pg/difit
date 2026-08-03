import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';

import {
  getUserConfigPath,
  readServerConfigFile,
  type ServerConfig,
} from '../server/user-config.js';

export type CliConfig = ServerConfig;

export const LOCAL_CLI_CONFIG_FILENAME = '.difitrc';

export function findLocalCliConfigPath(startDir: string): string | undefined {
  let current = resolve(startDir);
  const { root } = parsePathRoot(current);

  while (true) {
    const candidate = join(current, LOCAL_CLI_CONFIG_FILENAME);
    if (existsSync(candidate)) {
      return candidate;
    }

    if (current === root) {
      break;
    }

    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return undefined;
}

function parsePathRoot(current: string): { root: string } {
  if (current === '/') {
    return { root: '/' };
  }
  const parent = dirname(current);
  if (parent === current) {
    return { root: current };
  }
  return { root: resolve(current, '/') };
}

export function loadCliConfig(cwd = process.cwd()): Partial<CliConfig> {
  const globalPath = getUserConfigPath();
  const globalConfig = existsSync(globalPath) ? readServerConfigFile(globalPath) : {};

  const localPath = findLocalCliConfigPath(cwd);
  const localConfig = localPath ? readServerConfigFile(localPath) : {};

  const merged: Partial<CliConfig> = { ...globalConfig, ...localConfig };

  if (process.env.DIFIT_DEV === '1') {
    delete merged.background;
  }

  return merged;
}
