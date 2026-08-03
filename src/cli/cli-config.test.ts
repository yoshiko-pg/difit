import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_CLI_CONFIG_FILENAME, findLocalCliConfigPath, loadCliConfig } from './cli-config.js';

describe('cli-config', () => {
  let tempDir: string;
  let configDir: string;
  let originalConfigDir: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'difit-cli-config-'));
    configDir = join(tempDir, 'difit-config');
    mkdirSync(configDir, { recursive: true });
    originalConfigDir = process.env.DIFIT_CONFIG_DIR;
    process.env.DIFIT_CONFIG_DIR = configDir;
  });

  afterEach(() => {
    if (originalConfigDir === undefined) {
      delete process.env.DIFIT_CONFIG_DIR;
    } else {
      process.env.DIFIT_CONFIG_DIR = originalConfigDir;
    }
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('findLocalCliConfigPath', () => {
    it('returns undefined when no local config exists', () => {
      expect(findLocalCliConfigPath(tempDir)).toBeUndefined();
    });

    it('finds .difitrc in the start directory', () => {
      const configPath = join(tempDir, LOCAL_CLI_CONFIG_FILENAME);
      writeFileSync(configPath, '{}');

      expect(findLocalCliConfigPath(tempDir)).toBe(configPath);
    });

    it('walks up to the nearest ancestor .difitrc', () => {
      const rootConfig = join(tempDir, LOCAL_CLI_CONFIG_FILENAME);
      const nestedDir = join(tempDir, 'packages', 'app');
      mkdirSync(nestedDir, { recursive: true });
      writeFileSync(rootConfig, '{"server":{"port":4966}}');
      writeFileSync(join(nestedDir, LOCAL_CLI_CONFIG_FILENAME), '{"server":{"port":4999}}');

      expect(findLocalCliConfigPath(nestedDir)).toBe(join(nestedDir, LOCAL_CLI_CONFIG_FILENAME));
    });
  });

  describe('loadCliConfig', () => {
    it('returns an empty object when no config files exist', () => {
      expect(loadCliConfig(tempDir)).toEqual({});
    });

    it('merges global and local config with local precedence', () => {
      writeFileSync(
        join(configDir, 'config.json'),
        JSON.stringify({
          version: 1,
          client: {},
          server: { port: 4966, open: false },
        }),
      );
      writeFileSync(
        join(tempDir, LOCAL_CLI_CONFIG_FILENAME),
        JSON.stringify({ server: { port: 4999, keepAlive: true } }),
      );

      expect(loadCliConfig(tempDir)).toEqual({
        port: 4999,
        open: false,
        keepAlive: true,
      });
    });

    it('ignores background when DIFIT_DEV is set', () => {
      writeFileSync(
        join(configDir, 'config.json'),
        JSON.stringify({
          version: 1,
          client: {},
          server: { background: true, keepAlive: true, port: 4966 },
        }),
      );

      const originalDifitDev = process.env.DIFIT_DEV;
      process.env.DIFIT_DEV = '1';

      try {
        expect(loadCliConfig(tempDir)).toEqual({
          keepAlive: true,
          port: 4966,
        });
      } finally {
        if (originalDifitDev === undefined) {
          delete process.env.DIFIT_DEV;
        } else {
          process.env.DIFIT_DEV = originalDifitDev;
        }
      }
    });
  });
});
