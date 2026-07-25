import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  getUserConfigPath,
  readUserConfig,
  parseUserSettingsPatch,
  updateUserClientSettings,
  MAX_USER_CONFIG_BYTES,
} from './user-config.js';

describe('user-config', () => {
  let configDir: string;
  let configPath: string;

  beforeEach(async () => {
    configDir = await fs.mkdtemp(join(tmpdir(), 'difit-user-config-'));
    configPath = join(configDir, 'config.json');
  });

  afterEach(async () => {
    await fs.rm(configDir, { recursive: true, force: true });
  });

  describe('getUserConfigPath', () => {
    const originalConfigDir = process.env.DIFIT_CONFIG_DIR;

    afterEach(() => {
      if (originalConfigDir === undefined) {
        delete process.env.DIFIT_CONFIG_DIR;
      } else {
        process.env.DIFIT_CONFIG_DIR = originalConfigDir;
      }
    });

    it('defaults to ~/.difit/config.json', () => {
      delete process.env.DIFIT_CONFIG_DIR;
      expect(getUserConfigPath()).toMatch(/\.difit[/\\]config\.json$/);
    });

    it('respects DIFIT_CONFIG_DIR', () => {
      process.env.DIFIT_CONFIG_DIR = configDir;
      expect(getUserConfigPath()).toBe(join(configDir, 'config.json'));
    });
  });

  describe('readUserConfig', () => {
    it('returns defaults when the file does not exist', async () => {
      const config = await readUserConfig(configPath);
      expect(config).toEqual({ version: 1, client: {} });
    });

    it('returns defaults when the file is corrupt', async () => {
      await fs.writeFile(configPath, 'not json', 'utf-8');
      const config = await readUserConfig(configPath);
      expect(config).toEqual({ version: 1, client: {} });
    });

    it('returns defaults when client is not an object', async () => {
      await fs.writeFile(configPath, JSON.stringify({ version: 1, client: [1, 2] }), 'utf-8');
      const config = await readUserConfig(configPath);
      expect(config).toEqual({ version: 1, client: {} });
    });

    it('reads stored client settings', async () => {
      await fs.writeFile(
        configPath,
        JSON.stringify({ version: 1, client: { diffViewMode: 'split' } }),
        'utf-8',
      );
      const config = await readUserConfig(configPath);
      expect(config.client).toEqual({ diffViewMode: 'split' });
    });
  });

  describe('updateUserClientSettings', () => {
    it('creates the config directory and file on first write', async () => {
      const nestedPath = join(configDir, 'nested', 'config.json');
      const config = await updateUserClientSettings({ sidebarOpen: false }, nestedPath);

      expect(config).toEqual({ version: 1, client: { sidebarOpen: false } });
      const stored = JSON.parse(await fs.readFile(nestedPath, 'utf-8'));
      expect(stored).toEqual({ version: 1, client: { sidebarOpen: false } });
    });

    it('shallow-merges the patch into existing settings', async () => {
      await updateUserClientSettings({ diffViewMode: 'split', sidebarWidth: 300 }, configPath);
      const config = await updateUserClientSettings({ sidebarWidth: 400 }, configPath);

      expect(config.client).toEqual({
        diffViewMode: 'split',
        sidebarWidth: 400,
      });
    });

    it('rejects settings exceeding the size limit', async () => {
      const huge = { blob: 'x'.repeat(MAX_USER_CONFIG_BYTES) };
      await expect(updateUserClientSettings(huge, configPath)).rejects.toThrow(
        'maximum allowed size',
      );
    });

    it('leaves no temp file behind', async () => {
      await updateUserClientSettings({ sidebarOpen: true }, configPath);
      const entries = await fs.readdir(configDir);
      expect(entries).toEqual(['config.json']);
    });
  });

  describe('parseUserSettingsPatch', () => {
    it('accepts a body with a client object', () => {
      expect(parseUserSettingsPatch({ client: { diffViewMode: 'split' } })).toEqual({
        diffViewMode: 'split',
      });
    });

    it('rejects missing or non-object client', () => {
      expect(parseUserSettingsPatch(undefined)).toBeNull();
      expect(parseUserSettingsPatch({})).toBeNull();
      expect(parseUserSettingsPatch({ client: 'dark' })).toBeNull();
      expect(parseUserSettingsPatch({ client: [1] })).toBeNull();
    });

    it('rejects oversized patches', () => {
      expect(
        parseUserSettingsPatch({
          client: { blob: 'x'.repeat(MAX_USER_CONFIG_BYTES) },
        }),
      ).toBeNull();
    });
  });
});
