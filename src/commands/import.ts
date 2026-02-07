import fs from 'fs-extra';
import path from 'node:path';
import { CLAUDE_HOME, getConfigDir, SYNC_FILES, SYNC_DIRS } from '../core/config.js';
import { logInfo, logOk, logWarn } from '../core/logger.js';
import { backupExisting } from '../core/backup.js';
import { importSkills } from '../core/skills.js';
import { reinstallPlugins } from '../core/plugins.js';

interface ImportOptions {
  reinstallPlugins?: boolean;
}

export function cmdImport(options: ImportOptions = {}): void {
  const configDir = getConfigDir();

  if (!fs.existsSync(configDir)) {
    throw new Error(
      `Config directory not found: ${configDir}\nRun "vibe-sync export" first or "vibe-sync pull"`,
    );
  }

  // Create backup
  backupExisting();

  // Restore simple files
  for (const file of SYNC_FILES) {
    const src = path.join(configDir, file);
    if (fs.existsSync(src)) {
      fs.ensureDirSync(path.dirname(path.join(CLAUDE_HOME, file)));
      fs.copySync(src, path.join(CLAUDE_HOME, file));
      logInfo(`Imported: ${file}`);
    }
  }

  // Restore directories
  for (const dir of SYNC_DIRS) {
    const src = path.join(configDir, dir);
    if (fs.existsSync(src)) {
      fs.copySync(src, path.join(CLAUDE_HOME, dir), { overwrite: true });
      logInfo(`Imported: ${dir}/`);
    }
  }

  // Import skills
  importSkills(
    path.join(configDir, 'skills'),
    path.join(CLAUDE_HOME, 'skills'),
  );

  // Restore plugin registries
  const pluginsSrc = path.join(configDir, 'plugins');
  const pluginsDest = path.join(CLAUDE_HOME, 'plugins');
  for (const file of ['installed_plugins.json', 'known_marketplaces.json']) {
    const src = path.join(pluginsSrc, file);
    if (fs.existsSync(src)) {
      fs.ensureDirSync(pluginsDest);
      fs.copySync(src, path.join(pluginsDest, file));
      logInfo(`Imported: plugins/${file}`);
    }
  }

  // Optionally reinstall plugins
  if (options.reinstallPlugins) {
    reinstallPlugins(
      path.join(pluginsDest, 'known_marketplaces.json'),
      path.join(pluginsDest, 'installed_plugins.json'),
      path.join(CLAUDE_HOME, 'settings.json'),
    );
  }

  logOk('Import complete');
}
