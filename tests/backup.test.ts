import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';

const { mockClaudeHome, mockClaudeJson, mockBackupBase, tmpBase } = vi.hoisted(() => {
  const _path = require('node:path');
  const _os = require('node:os');
  const _tmpBase = _path.join(_os.tmpdir(), `vibe-sync-test-backup-${Date.now()}`);
  return {
    tmpBase: _tmpBase,
    mockClaudeHome: _path.join(_tmpBase, '.claude'),
    mockClaudeJson: _path.join(_tmpBase, '.claude.json'),
    mockBackupBase: _path.join(_tmpBase, '.vibe-sync', 'backups', 'claude'),
  };
});

vi.mock('../src/core/config.js', () => ({
  CLAUDE_HOME: mockClaudeHome,
  CLAUDE_JSON: mockClaudeJson,
  BACKUP_BASE: mockBackupBase,
  SYNC_FILES: ['settings.json', 'CLAUDE.md'],
  SYNC_DIRS: ['commands', 'agents'],
  PLUGIN_FILES: ['installed_plugins.json', 'known_marketplaces.json'],
}));

import { listBackups, restoreFromBackup } from '../src/core/backup.js';

describe('backup', () => {
  beforeEach(() => {
    fs.ensureDirSync(mockClaudeHome);
    fs.ensureDirSync(mockBackupBase);
  });

  afterEach(() => {
    fs.removeSync(tmpBase);
  });

  describe('listBackups', () => {
    it('should return empty array when no backups exist', () => {
      expect(listBackups()).toEqual([]);
    });

    it('should return empty array when backup base does not exist', () => {
      fs.removeSync(mockBackupBase);
      expect(listBackups()).toEqual([]);
    });

    it('should return backup names sorted newest first', () => {
      fs.ensureDirSync(path.join(mockBackupBase, '20260101T120000'));
      fs.ensureDirSync(path.join(mockBackupBase, '20260103T120000'));
      fs.ensureDirSync(path.join(mockBackupBase, '20260102T120000'));

      const result = listBackups();
      expect(result).toEqual([
        '20260103T120000',
        '20260102T120000',
        '20260101T120000',
      ]);
    });
  });

  describe('restoreFromBackup', () => {
    it('should throw when backup does not exist', () => {
      expect(() => restoreFromBackup('nonexistent')).toThrow('Backup not found');
    });

    it('should reject path traversal attempts', () => {
      expect(() => restoreFromBackup('../etc')).toThrow('Invalid backup name');
      expect(() => restoreFromBackup('foo/bar')).toThrow('Invalid backup name');
      expect(() => restoreFromBackup('foo\\bar')).toThrow('Invalid backup name');
      expect(() => restoreFromBackup('')).toThrow('Invalid backup name');
    });

    it('should restore files to CLAUDE_HOME', () => {
      const backupName = '20260101T120000';
      const backupDir = path.join(mockBackupBase, backupName);
      fs.ensureDirSync(backupDir);
      fs.writeJsonSync(path.join(backupDir, 'settings.json'), { test: true });
      fs.writeFileSync(path.join(backupDir, 'CLAUDE.md'), '# Test');

      restoreFromBackup(backupName);

      expect(fs.readJsonSync(path.join(mockClaudeHome, 'settings.json')))
        .toEqual({ test: true });
      expect(fs.readFileSync(path.join(mockClaudeHome, 'CLAUDE.md'), 'utf-8'))
        .toBe('# Test');
    });

    it('should restore plugin JSON files', () => {
      const backupName = '20260101T120000';
      const backupDir = path.join(mockBackupBase, backupName);
      fs.ensureDirSync(path.join(backupDir, 'plugins'));
      fs.writeJsonSync(
        path.join(backupDir, 'plugins', 'installed_plugins.json'),
        { version: 2 },
      );

      restoreFromBackup(backupName);

      const restored = fs.readJsonSync(
        path.join(mockClaudeHome, 'plugins', 'installed_plugins.json'),
      );
      expect(restored).toEqual({ version: 2 });
    });

    it('should handle partial backups gracefully', () => {
      const backupName = '20260101T120000';
      const backupDir = path.join(mockBackupBase, backupName);
      fs.ensureDirSync(backupDir);
      fs.writeJsonSync(path.join(backupDir, 'settings.json'), { partial: true });

      expect(() => restoreFromBackup(backupName)).not.toThrow();
      expect(fs.readJsonSync(path.join(mockClaudeHome, 'settings.json')))
        .toEqual({ partial: true });
    });

    it('should restore .claude.json from backup', () => {
      const backupName = '20260101T120000';
      const backupDir = path.join(mockBackupBase, backupName);
      fs.ensureDirSync(backupDir);
      fs.writeJsonSync(path.join(backupDir, '.claude.json'), {
        mcpServers: { 'test-server': { command: 'test' } },
      });

      restoreFromBackup(backupName);

      const restored = fs.readJsonSync(mockClaudeJson);
      expect(restored.mcpServers['test-server'].command).toBe('test');
    });
  });
});
