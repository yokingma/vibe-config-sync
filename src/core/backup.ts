import fs from 'fs-extra';
import path from 'node:path';
import { CLAUDE_HOME, BACKUP_BASE, SYNC_FILES, SYNC_DIRS, PLUGIN_FILES } from './config.js';
import { logInfo, logOk } from './logger.js';

export function backupExisting(): void {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);
  const backupDir = path.join(BACKUP_BASE, timestamp);
  fs.ensureDirSync(backupDir);

  for (const file of SYNC_FILES) {
    const src = path.join(CLAUDE_HOME, file);
    if (fs.existsSync(src)) {
      fs.copySync(src, path.join(backupDir, file));
    }
  }

  for (const dir of SYNC_DIRS) {
    const src = path.join(CLAUDE_HOME, dir);
    if (fs.existsSync(src)) {
      fs.copySync(src, path.join(backupDir, dir));
    }
  }

  const skillsDir = path.join(CLAUDE_HOME, 'skills');
  if (fs.existsSync(skillsDir)) {
    fs.copySync(skillsDir, path.join(backupDir, 'skills'));
  }

  const pluginsDir = path.join(CLAUDE_HOME, 'plugins');
  fs.ensureDirSync(path.join(backupDir, 'plugins'));
  for (const file of PLUGIN_FILES) {
    const src = path.join(pluginsDir, file);
    if (fs.existsSync(src)) {
      fs.copySync(src, path.join(backupDir, 'plugins', file));
    }
  }

  logOk(`Backup created: ${backupDir}`);
}

export function listBackups(): string[] {
  if (!fs.existsSync(BACKUP_BASE)) return [];
  return fs.readdirSync(BACKUP_BASE, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
}

export function restoreFromBackup(backupName: string): void {
  if (!backupName || backupName.includes('/') || backupName.includes('\\')) {
    throw new Error(`Invalid backup name: ${backupName}`);
  }
  const backupDir = path.join(BACKUP_BASE, backupName);
  if (!backupDir.startsWith(BACKUP_BASE + path.sep)) {
    throw new Error(`Invalid backup name: ${backupName}`);
  }
  if (!fs.existsSync(backupDir)) {
    throw new Error(`Backup not found: ${backupDir}`);
  }

  for (const file of SYNC_FILES) {
    const src = path.join(backupDir, file);
    if (fs.existsSync(src)) {
      fs.ensureDirSync(path.dirname(path.join(CLAUDE_HOME, file)));
      fs.copySync(src, path.join(CLAUDE_HOME, file));
      logInfo(`Restored: ${file}`);
    }
  }

  for (const dir of SYNC_DIRS) {
    const src = path.join(backupDir, dir);
    if (fs.existsSync(src)) {
      fs.copySync(src, path.join(CLAUDE_HOME, dir), { overwrite: true });
      logInfo(`Restored: ${dir}/`);
    }
  }

  const skillsSrc = path.join(backupDir, 'skills');
  if (fs.existsSync(skillsSrc)) {
    fs.copySync(skillsSrc, path.join(CLAUDE_HOME, 'skills'), { overwrite: true });
    logInfo('Restored: skills/');
  }

  const pluginsSrc = path.join(backupDir, 'plugins');
  if (fs.existsSync(pluginsSrc)) {
    const pluginsDest = path.join(CLAUDE_HOME, 'plugins');
    fs.ensureDirSync(pluginsDest);
    for (const file of PLUGIN_FILES) {
      const src = path.join(pluginsSrc, file);
      if (fs.existsSync(src)) {
        fs.copySync(src, path.join(pluginsDest, file));
        logInfo(`Restored: plugins/${file}`);
      }
    }
  }

  logOk(`Restored from backup: ${backupName}`);
}
