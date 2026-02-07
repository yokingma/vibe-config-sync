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
  validateMarketplacesJson,
} from '../core/validate.js';

interface ImportOptions {
  reinstallPlugins?: boolean;
  dryRun?: boolean;
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

  // Capture existing local plugin state BEFORE any files are overwritten,
  // so skip-already-installed checks compare against the true pre-import state.
  const pluginsDest = path.join(CLAUDE_HOME, 'plugins');
  const existingState: ExistingPluginState = {
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

  // Import simple files
  for (const file of SYNC_FILES) {
    const src = path.join(configDir, file);
    if (!fs.existsSync(src)) continue;
    if (file.endsWith('.json')) {
      const result = file === 'settings.json'
        ? validateSettingsJson(src) : validateJsonFile(src);
      if (!result.valid) {
        if (dryRun) logWarn(`  INVALID: ${result.errors.join(', ')}`);
        else logWarn(`Skipping ${file}: ${result.errors.join(', ')}`);
        continue;
      }
      if (dryRun) logOk(`  Validated: ${file}`);
    }
    const dest = path.join(CLAUDE_HOME, file);
    const exists = fs.existsSync(dest);
    // When plugin sync is skipped, strip enabledPlugins from settings.json
    // to avoid referencing plugins that aren't installed on this machine.
    const stripPluginSettings = file === 'settings.json' && !options.reinstallPlugins;
    if (dryRun) {
      logInfo(`Would import: ${file}${exists ? ' (overwrite)' : ' (new)'}${stripPluginSettings ? ' (without enabledPlugins)' : ''}`);
    } else {
      fs.ensureDirSync(path.dirname(dest));
      if (stripPluginSettings) {
        const data = readJsonSafe<Record<string, unknown>>(src);
        if (data) {
          delete data.enabledPlugins;
          fs.writeJsonSync(dest, data, { spaces: 2 });
        } else {
          fs.copySync(src, dest);
        }
      } else {
        fs.copySync(src, dest);
      }
      logInfo(`Imported: ${file}${stripPluginSettings ? ' (stripped enabledPlugins)' : ''}`);
    }
  }

  // Import directories
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

  // Import skills
  const skillsSrc = path.join(configDir, 'skills');
  if (dryRun && fs.existsSync(skillsSrc)) {
    const entries = fs.readdirSync(skillsSrc, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) logInfo(`Would import skill: ${entry.name}`);
    }
  } else if (!dryRun) {
    importSkills(skillsSrc, path.join(CLAUDE_HOME, 'skills'));
  }

  // Plugin sync — use sync'd JSON as manifest only (never copy to ~/.claude/plugins/)
  // Plugin JSON files contain machine-specific paths (installPath, installLocation)
  // that are stripped during export. The claude CLI writes correct registry files
  // (with local paths) as a side effect of plugin install/marketplace add.
  const pluginsSrc = path.join(configDir, 'plugins');
  if (options.reinstallPlugins) {
    // Check if any plugin manifest files exist in sync dir
    const hasManifest = PLUGIN_FILES.some(f =>
      fs.existsSync(path.join(pluginsSrc, f)),
    );
    if (!hasManifest) {
      logInfo('No plugin manifest files found in sync directory');
    } else {
      // Validate sync'd plugin files before using as manifest
      const pluginValidators: Record<string, (f: string) => ValidationResult> = {
        'installed_plugins.json': validatePluginsJson,
        'known_marketplaces.json': validateMarketplacesJson,
      };
      let validationPassed = true;
      for (const file of PLUGIN_FILES) {
        const src = path.join(pluginsSrc, file);
        if (!fs.existsSync(src)) continue;
        const result = pluginValidators[file](src);
        if (!result.valid) {
          logWarn(`${dryRun ? '  INVALID' : `Invalid plugins/${file}`}: ${result.errors.join(', ')}`);
          validationPassed = false;
        } else if (dryRun) {
          logOk(`  Validated: plugins/${file}`);
        }
      }

      if (!validationPassed) {
        logWarn('Skipping plugin reinstallation due to validation errors');
      } else if (dryRun) {
        logInfo('Would reinstall plugins via claude CLI');
      } else {
        reinstallPlugins(
          path.join(pluginsSrc, 'known_marketplaces.json'),
          path.join(pluginsSrc, 'installed_plugins.json'),
          path.join(CLAUDE_HOME, 'settings.json'),
          existingState,
        );
      }
    }
  } else {
    logInfo('Skipping plugin sync (omit --no-plugins to enable)');
  }

  if (!dryRun) logOk('Import complete');
}
