import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';

export const CLAUDE_HOME = process.env.CLAUDE_HOME
  ?? path.join(os.homedir(), '.claude');

export const BACKUP_BASE = path.join(os.homedir(), '.claude-backup');

export const SYNC_DIR = path.join(os.homedir(), '.vibe-sync');

export function getConfigDir(): string {
  return path.join(SYNC_DIR, 'data');
}

export function getExternalSkillsFile(): string {
  return path.join(SYNC_DIR, 'data', 'external-skills.json');
}

export function isInitialized(): boolean {
  return fs.existsSync(path.join(SYNC_DIR, '.git'));
}

export const SYNC_FILES = ['settings.json', 'CLAUDE.md'] as const;
export const SYNC_DIRS = ['commands', 'agents'] as const;
