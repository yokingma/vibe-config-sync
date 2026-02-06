import fs from 'fs-extra';
import path from 'node:path';
import { CLAUDE_HOME, BACKUP_BASE, SYNC_FILES, SYNC_DIRS } from './config.js';
import { logInfo, logOk } from './logger.js';

export function backupExisting(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 15);
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
  for (const file of ['installed_plugins.json', 'known_marketplaces.json']) {
    const src = path.join(pluginsDir, file);
    if (fs.existsSync(src)) {
      fs.ensureDirSync(path.join(backupDir, 'plugins'));
      fs.copySync(src, path.join(backupDir, 'plugins', file));
    }
  }

  logOk(`Backup created: ${backupDir}`);
  return backupDir;
}
