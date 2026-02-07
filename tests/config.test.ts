import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';

describe('config', () => {
  it('CLAUDE_HOME defaults to ~/.claude', async () => {
    const { CLAUDE_HOME } = await import('../src/core/config.js');
    expect(CLAUDE_HOME).toBe(path.join(os.homedir(), '.claude'));
  });

  it('SYNC_DIR is ~/.vibe-sync', async () => {
    const { SYNC_DIR } = await import('../src/core/config.js');
    expect(SYNC_DIR).toBe(path.join(os.homedir(), '.vibe-sync'));
  });

  it('getConfigDir returns SYNC_DIR/data', async () => {
    const { getConfigDir, SYNC_DIR } = await import('../src/core/config.js');
    expect(getConfigDir()).toBe(path.join(SYNC_DIR, 'data'));
  });

  it('BACKUP_BASE is under SYNC_DIR/backups/claude', async () => {
    const { BACKUP_BASE, SYNC_DIR } = await import('../src/core/config.js');
    expect(BACKUP_BASE).toBe(path.join(SYNC_DIR, 'backups', 'claude'));
  });

  it('SYNC_FILES contains expected files', async () => {
    const { SYNC_FILES } = await import('../src/core/config.js');
    expect(SYNC_FILES).toContain('settings.json');
    expect(SYNC_FILES).toContain('CLAUDE.md');
  });

  it('SYNC_DIRS contains expected directories', async () => {
    const { SYNC_DIRS } = await import('../src/core/config.js');
    expect(SYNC_DIRS).toContain('commands');
    expect(SYNC_DIRS).toContain('agents');
  });
});
