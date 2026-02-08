import fs from 'fs-extra';
import path from 'node:path';
import { CLAUDE_HOME, getConfigDir, SYNC_FILES, SYNC_DIRS, PLUGIN_FILES } from '../core/config.js';
import { logInfo, logOk, logWarn } from '../core/logger.js';
import { backupExisting } from '../core/backup.js';
import { importSkills } from '../core/skills.js';
import { reinstallPlugins, type ExistingPluginState } from '../core/plugins.js';
import { readJsonSafe } from '../core/fs-utils.js';
import type { PluginsData, MarketplacesData } from '../core/sanitize.js';
import {
  type ValidationResult,
  validateJsonFile,
  validateSettingsJson,
  validatePluginsJson,
} from '../core/validate.js';

interface ImportOptions {
  reinstallPlugins?: boolean;
  dryRun?: boolean;
}

function validateSyncFile(file: string, src: string): ValidationResult {
  if (file === 'settings.json') return validateSettingsJson(src);
  return validateJsonFile(src);
}

function validatePluginFile(file: string, src: string): ValidationResult {
  if (file === 'known_marketplaces.json') return validateJsonFile(src);
  return validatePluginsJson(src);
}

function captureExistingPluginState(): ExistingPluginState {
  const pluginsDest = path.join(CLAUDE_HOME, 'plugins');
  return {
    marketplaces: readJsonSafe<MarketplacesData>(
      path.join(pluginsDest, 'known_marketplaces.json'),
    ),
    plugins: readJsonSafe<PluginsData>(
      path.join(pluginsDest, 'installed_plugins.json'),
    ),
    settings: readJsonSafe<NonNullable<ExistingPluginState['settings']>>(
      path.join(CLAUDE_HOME, 'settings.json'),
    ),
  };
}

function importFile(file: string, src: string, stripPluginSettings: boolean, dryRun: boolean): void {
  const dest = path.join(CLAUDE_HOME, file);
  const exists = fs.existsSync(dest);

  if (dryRun) {
    const suffix = stripPluginSettings ? ' (without enabledPlugins)' : '';
    logInfo(`Would import: ${file}${exists ? ' (overwrite)' : ' (new)'}${suffix}`);
    return;
  }

  fs.ensureDirSync(path.dirname(dest));

  if (stripPluginSettings) {
    const data = readJsonSafe<Record<string, unknown>>(src);
    if (!data) {
      logWarn(`Skipping ${file}: invalid JSON, cannot strip enabledPlugins`);
      return;
    }
    delete data.enabledPlugins;
    fs.writeJsonSync(dest, data, { spaces: 2 });
  } else {
    fs.copySync(src, dest);
  }

  const suffix = stripPluginSettings ? ' (stripped enabledPlugins)' : '';
  logInfo(`Imported: ${file}${suffix}`);
}

function importSyncFiles(configDir: string, options: ImportOptions): void {
  const dryRun = !!options.dryRun;
  for (const file of SYNC_FILES) {
    const src = path.join(configDir, file);
    if (!fs.existsSync(src)) continue;

    if (file.endsWith('.json')) {
      const result = validateSyncFile(file, src);
      if (!result.valid) {
        logWarn(dryRun ? `  INVALID: ${result.errors.join(', ')}` : `Skipping ${file}: ${result.errors.join(', ')}`);
        continue;
      }
      if (dryRun) logOk(`  Validated: ${file}`);
    }

    const stripPluginSettings = file === 'settings.json' && !options.reinstallPlugins;
    importFile(file, src, stripPluginSettings, dryRun);
  }
}

function importSyncDirs(configDir: string, dryRun: boolean): void {
  for (const dir of SYNC_DIRS) {
    const src = path.join(configDir, dir);
    if (!fs.existsSync(src)) continue;

    if (dryRun) {
      const exists = fs.existsSync(path.join(CLAUDE_HOME, dir));
      logInfo(`Would import: ${dir}/${exists ? ' (merge)' : ' (new)'}`);
    } else {
      fs.copySync(src, path.join(CLAUDE_HOME, dir), { overwrite: true });
      logInfo(`Imported: ${dir}/`);
    }
  }
}

function importSyncSkills(configDir: string, dryRun: boolean): void {
  const skillsSrc = path.join(configDir, 'skills');
  if (dryRun && fs.existsSync(skillsSrc)) {
    const entries = fs.readdirSync(skillsSrc, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) logInfo(`Would import skill: ${entry.name}`);
    }
  } else if (!dryRun) {
    importSkills(skillsSrc, path.join(CLAUDE_HOME, 'skills'));
  }
}

function syncPlugins(
  configDir: string,
  existingState: ExistingPluginState,
  dryRun: boolean,
): void {
  const pluginsSrc = path.join(configDir, 'plugins');
  const hasManifest = PLUGIN_FILES.some((f) =>
    fs.existsSync(path.join(pluginsSrc, f)),
  );

  if (!hasManifest) {
    logInfo('No plugin manifest files found in sync directory');
    return;
  }

  let validationPassed = true;
  for (const file of PLUGIN_FILES) {
    const src = path.join(pluginsSrc, file);
    if (!fs.existsSync(src)) continue;
    const result = validatePluginFile(file, src);
    if (!result.valid) {
      logWarn(dryRun ? `  INVALID: ${result.errors.join(', ')}` : `Invalid plugins/${file}: ${result.errors.join(', ')}`);
      validationPassed = false;
    } else if (dryRun) {
      logOk(`  Validated: plugins/${file}`);
    }
  }

  if (!validationPassed) {
    logWarn('Skipping plugin reinstallation due to validation errors');
    return;
  }

  if (dryRun) {
    logInfo('Would reinstall plugins via claude CLI');
    return;
  }

  reinstallPlugins(
    path.join(pluginsSrc, 'known_marketplaces.json'),
    path.join(pluginsSrc, 'installed_plugins.json'),
    path.join(CLAUDE_HOME, 'settings.json'),
    existingState,
  );
}

export function cmdImport(options: ImportOptions = {}): void {
  const configDir = getConfigDir();

  if (!fs.existsSync(configDir)) {
    throw new Error(
      `Config directory not found: ${configDir}\nRun "vibe-sync export" first or "vibe-sync pull"`,
    );
  }

  const dryRun = !!options.dryRun;
  if (dryRun) logInfo('Dry run - no changes will be made\n');
  if (!dryRun) backupExisting();

  // Capture existing plugin state BEFORE files are overwritten,
  // so skip-already-installed checks compare against the pre-import state.
  const existingState = captureExistingPluginState();

  importSyncFiles(configDir, options);
  importSyncDirs(configDir, dryRun);
  importSyncSkills(configDir, dryRun);

  if (options.reinstallPlugins) {
    syncPlugins(configDir, existingState, dryRun);
  } else {
    logInfo('Skipping plugin sync (remove --no-plugins flag to enable)');
  }

  if (!dryRun) logOk('Import complete');
}
