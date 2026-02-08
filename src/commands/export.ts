import fs from 'fs-extra';
import path from 'node:path';
import { CLAUDE_HOME, getConfigDir, SYNC_FILES, SYNC_DIRS } from '../core/config.js';
import { logInfo, logOk, logWarn } from '../core/logger.js';
import { copyDirClean, readJsonSafe, writeJsonSafe } from '../core/fs-utils.js';
import { sanitizePlugins, sanitizeMarketplaces } from '../core/sanitize.js';
import { exportSkills } from '../core/skills.js';
import type { PluginsData, MarketplacesData } from '../core/sanitize.js';

export function cmdExport(): void {
  if (!fs.existsSync(CLAUDE_HOME)) {
    throw new Error(
      `Claude config directory not found: ${CLAUDE_HOME}\nMake sure Claude Code has been run at least once.`,
    );
  }

  const configDir = getConfigDir();
  const pluginsDir = path.join(configDir, 'plugins');
  fs.ensureDirSync(pluginsDir);

  // Copy simple files
  for (const file of SYNC_FILES) {
    const src = path.join(CLAUDE_HOME, file);
    if (fs.existsSync(src)) {
      fs.copySync(src, path.join(configDir, file));
      logInfo(`Exported: ${file}`);
    } else {
      logWarn(`Not found: ${file}`);
    }
  }

  // Copy directories
  for (const dir of SYNC_DIRS) {
    const src = path.join(CLAUDE_HOME, dir);
    if (fs.existsSync(src)) {
      copyDirClean(src, path.join(configDir, dir));
      logInfo(`Exported: ${dir}/`);
    } else {
      logWarn(`Not found: ${dir}/`);
    }
  }

  // Export skills
  exportSkills(
    path.join(CLAUDE_HOME, 'skills'),
    path.join(configDir, 'skills'),
  );

  // Sanitize and export plugin registries
  const installedPlugins = readJsonSafe<PluginsData>(
    path.join(CLAUDE_HOME, 'plugins', 'installed_plugins.json'),
  );
  if (installedPlugins) {
    writeJsonSafe(
      path.join(pluginsDir, 'installed_plugins.json'),
      sanitizePlugins(installedPlugins),
    );
    logInfo('Exported: plugins/installed_plugins.json (sanitized)');
  }

  const marketplaces = readJsonSafe<MarketplacesData>(
    path.join(CLAUDE_HOME, 'plugins', 'known_marketplaces.json'),
  );
  if (marketplaces) {
    writeJsonSafe(
      path.join(pluginsDir, 'known_marketplaces.json'),
      sanitizeMarketplaces(marketplaces),
    );
    logInfo('Exported: plugins/known_marketplaces.json (sanitized)');
  }

  logOk('Export complete');
}
