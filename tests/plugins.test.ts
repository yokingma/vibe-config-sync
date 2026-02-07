import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';

const mockExecFileSync = vi.fn();
vi.mock('node:child_process', () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}));

describe('reinstallPlugins', () => {
  let tmpDir: string;
  let marketplacesFile: string;
  let pluginsFile: string;
  let settingsFile: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = path.join(os.tmpdir(), `vibe-sync-test-plugins-${Date.now()}`);
    fs.ensureDirSync(tmpDir);
    marketplacesFile = path.join(tmpDir, 'known_marketplaces.json');
    pluginsFile = path.join(tmpDir, 'installed_plugins.json');
    settingsFile = path.join(tmpDir, 'settings.json');
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('should pass timeout option to execFileSync', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from(''));
    fs.writeJsonSync(marketplacesFile, {});
    fs.writeJsonSync(pluginsFile, { plugins: {} });
    fs.writeJsonSync(settingsFile, {});

    const { reinstallPlugins } = await import('../src/core/plugins.js');
    reinstallPlugins(marketplacesFile, pluginsFile, settingsFile);

    // First call is isClaudeAvailable with 5s timeout
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'claude',
      ['--version'],
      expect.objectContaining({ timeout: 5_000 }),
    );
  });

  it('should not crash when execFileSync times out', async () => {
    // First call (isClaudeAvailable) succeeds
    mockExecFileSync.mockReturnValueOnce(Buffer.from('1.0.0'));
    // Marketplace add times out
    const timeoutErr = new Error('ETIMEDOUT');
    Object.assign(timeoutErr, { killed: true });
    mockExecFileSync.mockImplementationOnce(() => { throw timeoutErr; });

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

    // Only the --version check should have been called
    expect(mockExecFileSync).toHaveBeenCalledTimes(1);
  });

  it('should call plugin install with 30s timeout', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from(''));
    fs.writeJsonSync(marketplacesFile, {});
    fs.writeJsonSync(pluginsFile, {
      plugins: { 'test@official': [{ scope: 'user' }] },
    });
    fs.writeJsonSync(settingsFile, {});

    const { reinstallPlugins } = await import('../src/core/plugins.js');
    reinstallPlugins(marketplacesFile, pluginsFile, settingsFile);

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'claude',
      ['plugin', 'install', 'test@official'],
      expect.objectContaining({ timeout: 30_000 }),
    );
  });
});
