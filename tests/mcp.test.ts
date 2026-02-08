import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';

const { mockClaudeHome, mockClaudeJson, mockBackupBase, mockSyncDir, tmpBase } = vi.hoisted(() => {
  const _path = require('node:path');
  const _os = require('node:os');
  const _tmpBase = _path.join(_os.tmpdir(), `vibe-sync-test-mcp-${Date.now()}`);
  return {
    tmpBase: _tmpBase,
    mockClaudeHome: _path.join(_tmpBase, '.claude'),
    mockClaudeJson: _path.join(_tmpBase, '.claude.json'),
    mockBackupBase: _path.join(_tmpBase, '.vibe-sync', 'backups', 'claude'),
    mockSyncDir: _path.join(_tmpBase, '.vibe-sync'),
  };
});

vi.mock('../src/core/config.js', () => ({
  CLAUDE_HOME: mockClaudeHome,
  CLAUDE_JSON: mockClaudeJson,
  BACKUP_BASE: mockBackupBase,
  SYNC_DIR: mockSyncDir,
  getConfigDir: () => require('node:path').join(mockSyncDir, 'data'),
  isInitialized: () => true,
  SYNC_FILES: ['settings.json', 'CLAUDE.md'],
  SYNC_DIRS: ['commands', 'agents'],
  PLUGIN_FILES: ['installed_plugins.json', 'known_marketplaces.json'],
  MCP_SYNC_FILE: 'mcp-servers.json',
}));

import { cmdImport } from '../src/commands/import.js';
import { backupExisting } from '../src/core/backup.js';

const configDir = path.join(mockSyncDir, 'data');

describe('MCP server sync', () => {
  beforeEach(() => {
    fs.ensureDirSync(mockClaudeHome);
    fs.ensureDirSync(mockBackupBase);
    fs.ensureDirSync(configDir);
  });

  afterEach(() => {
    fs.removeSync(tmpBase);
  });

  describe('import - skip existing servers', () => {
    it('should add new servers without overwriting existing ones', () => {
      fs.writeJsonSync(mockClaudeJson, {
        mcpServers: {
          'server-a': { command: 'local-cmd-a', args: ['--local'] },
        },
      });
      fs.writeJsonSync(path.join(configDir, 'mcp-servers.json'), {
        'server-a': { command: 'synced-cmd-a', args: ['--synced'] },
        'server-b': { command: 'cmd-b' },
      });

      cmdImport({ reinstallPlugins: false });

      const result = fs.readJsonSync(mockClaudeJson);
      expect(result.mcpServers['server-a'].command).toBe('local-cmd-a');
      expect(result.mcpServers['server-b'].command).toBe('cmd-b');
    });

    it('should not modify file when all servers exist locally', () => {
      fs.writeJsonSync(mockClaudeJson, {
        mcpServers: { 'server-a': { command: 'original' } },
      });
      fs.writeJsonSync(path.join(configDir, 'mcp-servers.json'), {
        'server-a': { command: 'different' },
      });

      cmdImport({ reinstallPlugins: false });

      const result = fs.readJsonSync(mockClaudeJson);
      expect(result.mcpServers['server-a'].command).toBe('original');
    });

    it('should import all servers when none exist locally', () => {
      fs.writeJsonSync(path.join(configDir, 'mcp-servers.json'), {
        'server-x': { command: 'cmd-x' },
        'server-y': { command: 'cmd-y' },
      });

      cmdImport({ reinstallPlugins: false });

      const result = fs.readJsonSync(mockClaudeJson);
      expect(Object.keys(result.mcpServers)).toHaveLength(2);
      expect(result.mcpServers['server-x'].command).toBe('cmd-x');
      expect(result.mcpServers['server-y'].command).toBe('cmd-y');
    });

    it('should skip import when mcp-servers.json does not exist', () => {
      cmdImport({ reinstallPlugins: false });
      expect(fs.existsSync(mockClaudeJson)).toBe(false);
    });
  });

  describe('backup of .claude.json', () => {
    it('should backup .claude.json during backupExisting', () => {
      fs.writeJsonSync(mockClaudeJson, {
        mcpServers: { 'test-server': { command: 'test' } },
      });

      backupExisting();

      const backups = fs.readdirSync(mockBackupBase);
      expect(backups).toHaveLength(1);
      const backupDir = path.join(mockBackupBase, backups[0]);
      const backed = fs.readJsonSync(path.join(backupDir, '.claude.json'));
      expect(backed.mcpServers['test-server'].command).toBe('test');
    });

    it('should not fail when .claude.json does not exist', () => {
      expect(() => backupExisting()).not.toThrow();
    });
  });
});
