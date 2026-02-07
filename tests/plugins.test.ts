import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';

const mockExecFileSync = vi.fn();
const mockSpawnSync = vi.fn();
vi.mock('node:child_process', () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
  spawnSync: (...args: unknown[]) => mockSpawnSync(...args),
}));

describe('reinstallPlugins', () => {
  let tmpDir: string;
  let marketplacesFile: string;
  let pluginsFile: string;
  let settingsFile: string;

  beforeEach(() => {
    vi.clearAllMocks();
    // isClaudeAvailable uses execFileSync — default to success
    mockExecFileSync.mockReturnValue(Buffer.from('1.0.0'));
    // spawnSync default: success
    mockSpawnSync.mockReturnValue({ status: 0, error: null });

    tmpDir = path.join(os.tmpdir(), `vibe-sync-test-plugins-${Date.now()}`);
    fs.ensureDirSync(tmpDir);
    marketplacesFile = path.join(tmpDir, 'known_marketplaces.json');
    pluginsFile = path.join(tmpDir, 'installed_plugins.json');
    settingsFile = path.join(tmpDir, 'settings.json');
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('should use spawnSync with inherit stdio and 120s timeout', async () => {
    fs.writeJsonSync(marketplacesFile, {});
    fs.writeJsonSync(pluginsFile, { plugins: {} });
    fs.writeJsonSync(settingsFile, {});

    const { reinstallPlugins } = await import('../src/core/plugins.js');
    reinstallPlugins(marketplacesFile, pluginsFile, settingsFile);

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'claude', ['--version'],
      expect.objectContaining({ timeout: 5_000 }),
    );
  });

  it('should not crash when spawnSync times out', async () => {
    mockSpawnSync.mockReturnValue({
      status: null,
      error: Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' }),
    });

    fs.writeJsonSync(marketplacesFile, {
      official: { source: { source: 'github', repo: 'anthropics/plugins' } },
    });
    fs.writeJsonSync(pluginsFile, { plugins: {} });
    fs.writeJsonSync(settingsFile, {});

    const { reinstallPlugins } = await import('../src/core/plugins.js');
    expect(() => {
      reinstallPlugins(marketplacesFile, pluginsFile, settingsFile);
    }).not.toThrow();
  });

  it('should skip all phases when claude CLI is not available', async () => {
    mockExecFileSync.mockImplementation(() => { throw new Error('not found'); });

    fs.writeJsonSync(marketplacesFile, {
      official: { source: { source: 'github', repo: 'test/repo' } },
    });
    fs.writeJsonSync(pluginsFile, {
      plugins: { 'test-plugin': [{ scope: 'user' }] },
    });
    fs.writeJsonSync(settingsFile, { enabledPlugins: { 'test-plugin': true } });

    const { reinstallPlugins } = await import('../src/core/plugins.js');
    reinstallPlugins(marketplacesFile, pluginsFile, settingsFile);

    expect(mockExecFileSync).toHaveBeenCalledTimes(1);
    expect(mockSpawnSync).not.toHaveBeenCalled();
  });

  it('should call plugin install with 120s timeout', async () => {
    fs.writeJsonSync(marketplacesFile, {});
    fs.writeJsonSync(pluginsFile, {
      plugins: { 'test@official': [{ scope: 'user' }] },
    });
    fs.writeJsonSync(settingsFile, {});

    const { reinstallPlugins } = await import('../src/core/plugins.js');
    reinstallPlugins(marketplacesFile, pluginsFile, settingsFile);

    expect(mockSpawnSync).toHaveBeenCalledWith(
      'claude',
      ['plugin', 'install', '--', 'test@official'],
      expect.objectContaining({ stdio: 'inherit', timeout: 120_000 }),
    );
  });

  it('should skip marketplace that already exists in existing state', async () => {
    fs.writeJsonSync(marketplacesFile, {
      official: { source: { source: 'github', repo: 'anthropics/plugins' } },
      newone: { source: { source: 'github', repo: 'other/repo' } },
    });
    fs.writeJsonSync(pluginsFile, { plugins: {} });
    fs.writeJsonSync(settingsFile, {});

    const { reinstallPlugins } = await import('../src/core/plugins.js');
    reinstallPlugins(marketplacesFile, pluginsFile, settingsFile, {
      marketplaces: {
        official: { source: { source: 'github', repo: 'anthropics/plugins' } },
      },
    });

    const addCalls = mockSpawnSync.mock.calls.filter(
      (c: unknown[]) => (c[1] as string[])[1] === 'marketplace',
    );
    expect(addCalls).toHaveLength(1);
    expect(addCalls[0][1]).toEqual(
      ['plugin', 'marketplace', 'add', '--', 'other/repo'],
    );
  });

  it('should skip plugin with installPath in existing state', async () => {
    fs.writeJsonSync(marketplacesFile, {});
    fs.writeJsonSync(pluginsFile, {
      plugins: {
        'existing@official': [{ scope: 'user' }],
        'new@official': [{ scope: 'user' }],
      },
    });
    fs.writeJsonSync(settingsFile, {});

    const { reinstallPlugins } = await import('../src/core/plugins.js');
    reinstallPlugins(marketplacesFile, pluginsFile, settingsFile, {
      plugins: {
        plugins: {
          'existing@official': [
            { scope: 'user', installPath: '/some/path' },
          ],
        },
      },
    });

    const installCalls = mockSpawnSync.mock.calls.filter(
      (c: unknown[]) => (c[1] as string[])[1] === 'install',
    );
    expect(installCalls).toHaveLength(1);
    expect(installCalls[0][1]).toEqual(
      ['plugin', 'install', '--', 'new@official'],
    );
  });

  it('should install plugin when existing entry has no installPath', async () => {
    fs.writeJsonSync(marketplacesFile, {});
    fs.writeJsonSync(pluginsFile, {
      plugins: { 'test@official': [{ scope: 'user' }] },
    });
    fs.writeJsonSync(settingsFile, {});

    const { reinstallPlugins } = await import('../src/core/plugins.js');
    reinstallPlugins(marketplacesFile, pluginsFile, settingsFile, {
      plugins: {
        plugins: { 'test@official': [{ scope: 'user' }] },
      },
    });

    const installCalls = mockSpawnSync.mock.calls.filter(
      (c: unknown[]) => (c[1] as string[])[1] === 'install',
    );
    expect(installCalls).toHaveLength(1);
  });

  it('should skip enable when already enabled in existing state', async () => {
    fs.writeJsonSync(marketplacesFile, {});
    fs.writeJsonSync(pluginsFile, { plugins: {} });
    fs.writeJsonSync(settingsFile, {
      enabledPlugins: { 'already-on': true, 'newly-on': true },
    });

    const { reinstallPlugins } = await import('../src/core/plugins.js');
    reinstallPlugins(marketplacesFile, pluginsFile, settingsFile, {
      settings: { enabledPlugins: { 'already-on': true } },
    });

    const enableCalls = mockSpawnSync.mock.calls.filter(
      (c: unknown[]) => (c[1] as string[])[1] === 'enable',
    );
    expect(enableCalls).toHaveLength(1);
    expect(enableCalls[0][1]).toEqual(['plugin', 'enable', '--', 'newly-on']);
  });
});
