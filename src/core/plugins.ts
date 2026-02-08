import { spawnSync } from 'node:child_process';
import { logInfo, logOk, logWarn } from './logger.js';
import { readJsonSafe } from './fs-utils.js';
import type { PluginsData, MarketplacesData } from './sanitize.js';

interface SettingsData {
  enabledPlugins?: Record<string, boolean>;
  [key: string]: unknown;
}

export interface ExistingPluginState {
  marketplaces?: MarketplacesData | null;
  plugins?: PluginsData | null;
  settings?: SettingsData | null;
}

function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const EXEC_TIMEOUT_MS = 120_000;

function execClaude(args: string[]): boolean {
  const result = spawnSync('claude', args, {
    stdio: 'inherit',
    timeout: EXEC_TIMEOUT_MS,
    shell: true,
  });
  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
      logWarn(`Command timed out (${EXEC_TIMEOUT_MS / 1000}s): claude ${args.join(' ')}`);
    }
    return false;
  }
  return result.status === 0;
}

function isClaudeAvailable(): boolean {
  const result = spawnSync('claude', ['--version'], { stdio: 'pipe', timeout: 5_000, shell: true });
  return result.status === 0;
}

export function reinstallPlugins(
  marketplacesFile: string,
  pluginsFile: string,
  settingsFile: string,
  existingState?: ExistingPluginState,
): void {
  if (!isClaudeAvailable()) {
    throw new Error('claude CLI not found. Cannot reinstall plugins.');
  }

  // Phase 1: Add marketplaces
  logInfo('Phase 1: Adding plugin marketplaces...');
  const marketplaces = readJsonSafe<MarketplacesData>(marketplacesFile);
  const existingMktKeys = new Set(
    Object.keys(existingState?.marketplaces ?? {}),
  );
  if (isNonNullObject(marketplaces)) {
    for (const [name, entry] of Object.entries(marketplaces)) {
      if (existingMktKeys.has(name)) {
        logInfo(`Marketplace already registered: ${name}`);
        continue;
      }
      if (!isNonNullObject(entry)) continue;
      const source = entry.source;
      if (!isNonNullObject(source)) continue;

      let arg: string;
      if (source.source === 'github' && typeof source.repo === 'string') {
        // claude CLI accepts bare owner/repo format for GitHub sources
        arg = source.repo;
      } else if (typeof source.url === 'string') {
        arg = source.url;
      } else {
        logWarn(`Unknown marketplace source for ${name}`);
        continue;
      }

      if (execClaude(['plugin', 'marketplace', 'add', '--', arg])) {
        logOk(`Added marketplace: ${name}`);
      } else {
        logWarn(`Failed to add marketplace: ${name}`);
      }
    }
  }

  // Phase 2: Install plugins
  logInfo('Phase 2: Installing plugins...');
  const plugins = readJsonSafe<PluginsData>(pluginsFile);
  const existingPluginEntries = existingState?.plugins?.plugins ?? {};
  if (isNonNullObject(plugins) && isNonNullObject(plugins.plugins)) {
    for (const key of Object.keys(plugins.plugins)) {
      const entries = existingPluginEntries[key];
      if (entries?.some(e => e.installPath)) {
        logInfo(`Plugin already installed: ${key}`);
        continue;
      }
      if (execClaude(['plugin', 'install', '--', key])) {
        logOk(`Installed plugin: ${key}`);
      } else {
        logWarn(`Failed to install plugin: ${key}`);
      }
    }
  }

  // Phase 3: Enable plugins
  logInfo('Phase 3: Enabling plugins...');
  const settings = readJsonSafe<SettingsData>(settingsFile);
  const existingEnabled = existingState?.settings?.enabledPlugins ?? {};
  if (isNonNullObject(settings) && isNonNullObject(settings.enabledPlugins)) {
    for (const [key, enabled] of Object.entries(settings.enabledPlugins)) {
      if (!enabled) continue;
      if (existingEnabled[key]) {
        logInfo(`Plugin already enabled: ${key}`);
        continue;
      }
      if (execClaude(['plugin', 'enable', '--', key])) {
        logOk(`Enabled plugin: ${key}`);
      } else {
        logWarn(`Failed to enable plugin: ${key}`);
      }
    }
  }

  logOk('Plugin reinstallation complete');
}
