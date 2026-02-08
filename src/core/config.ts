import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';

export const CLAUDE_HOME = process.env.CLAUDE_HOME
  ?? path.join(os.homedir(), '.claude');

export const CLAUDE_JSON = process.env.CLAUDE_JSON
  ?? path.join(os.homedir(), '.claude.json');

export const SYNC_DIR = path.join(os.homedir(), '.vibe-sync');

export const BACKUP_BASE = path.join(SYNC_DIR, 'backups', 'claude');

export function getConfigDir(): string {
  return path.join(SYNC_DIR, 'data');
}

export function isInitialized(): boolean {
  return fs.existsSync(path.join(SYNC_DIR, '.git'));
}

export const SYNC_FILES = ['settings.json', 'CLAUDE.md'] as const;
export const SYNC_DIRS = ['commands', 'agents'] as const;
export const PLUGIN_FILES = ['installed_plugins.json', 'known_marketplaces.json'] as const;
export const MCP_SYNC_FILE = 'mcp-servers.json';
