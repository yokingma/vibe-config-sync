import { execSync } from 'node:child_process';
import { logInfo, logOk, logWarn, logError } from './logger.js';
import { readJsonSafe } from './fs-utils.js';
import type { PluginsData, MarketplacesData } from './sanitize.js';

interface SettingsData {
  enabledPlugins?: Record<string, boolean>;
  [key: string]: unknown;
}

function execClaude(args: string): boolean {
  try {
    execSync(`claude ${args}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function isClaudeAvailable(): boolean {
  try {
    execSync('claude --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function reinstallPlugins(
  marketplacesFile: string,
  pluginsFile: string,
  settingsFile: string,
): void {
  if (!isClaudeAvailable()) {
    logError('claude CLI not found. Cannot reinstall plugins.');
    return;
  }

  // Phase 1: Add marketplaces
  logInfo('Phase 1: Adding plugin marketplaces...');
  const marketplaces = readJsonSafe<MarketplacesData>(marketplacesFile);
  if (marketplaces) {
    for (const [name, entry] of Object.entries(marketplaces)) {
      const source = entry.source;
      if (!source) continue;

      let arg: string;
      if (source.source === 'github' && source.repo) {
        arg = `github:${source.repo}`;
      } else if (source.url) {
        arg = source.url;
      } else {
        logWarn(`Unknown marketplace source for ${name}`);
        continue;
      }

      if (execClaude(`plugin marketplace add "${arg}"`)) {
        logOk(`Added marketplace: ${name}`);
      } else {
        logWarn(`Failed to add marketplace: ${name}`);
      }
    }
  }

  // Phase 2: Install plugins
  logInfo('Phase 2: Installing plugins...');
  const plugins = readJsonSafe<PluginsData>(pluginsFile);
  if (plugins?.plugins) {
    for (const key of Object.keys(plugins.plugins)) {
      if (execClaude(`plugin install "${key}"`)) {
        logOk(`Installed plugin: ${key}`);
      } else {
        logWarn(`Failed to install plugin: ${key}`);
      }
    }
  }

  // Phase 3: Enable plugins
  logInfo('Phase 3: Enabling plugins...');
  const settings = readJsonSafe<SettingsData>(settingsFile);
  if (settings?.enabledPlugins) {
    for (const [key, enabled] of Object.entries(settings.enabledPlugins)) {
      if (!enabled) continue;
      if (execClaude(`plugin enable "${key}"`)) {
        logOk(`Enabled plugin: ${key}`);
      } else {
        logWarn(`Failed to enable plugin: ${key}`);
      }
    }
  }

  logOk('Plugin reinstallation complete');
}
