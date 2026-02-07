import fs from 'fs-extra';
import path from 'node:path';
import { CLAUDE_HOME, getConfigDir, SYNC_FILES, SYNC_DIRS, PLUGIN_FILES } from '../core/config.js';
import { logInfo, logOk, logWarn } from '../core/logger.js';
import { backupExisting } from '../core/backup.js';
import { importSkills } from '../core/skills.js';
import { reinstallPlugins } from '../core/plugins.js';
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
    if (dryRun) {
      logInfo(`Would import: ${file}${exists ? ' (overwrite)' : ' (new)'}`);
    } else {
      fs.ensureDirSync(path.dirname(dest));
      fs.copySync(src, dest);
      logInfo(`Imported: ${file}`);
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

  // Import plugin registries
  const pluginsSrc = path.join(configDir, 'plugins');
  const pluginsDest = path.join(CLAUDE_HOME, 'plugins');
  const pluginValidators: Record<string, (f: string) => ValidationResult> = {
    'installed_plugins.json': validatePluginsJson,
    'known_marketplaces.json': validateMarketplacesJson,
  };
  for (const file of PLUGIN_FILES) {
    const src = path.join(pluginsSrc, file);
    if (!fs.existsSync(src)) continue;
    const result = pluginValidators[file](src);
    if (!result.valid) {
      logWarn(`${dryRun ? '  INVALID' : `Skipping plugins/${file}`}: ${result.errors.join(', ')}`);
      continue;
    }
    if (dryRun) {
      logInfo(`Would import: plugins/${file}`);
      logOk(`  Validated: plugins/${file}`);
    } else {
      fs.ensureDirSync(pluginsDest);
      fs.copySync(src, path.join(pluginsDest, file));
      logInfo(`Imported: plugins/${file}`);
    }
  }

  // Optionally reinstall plugins
  if (options.reinstallPlugins) {
    if (dryRun) {
      logInfo('Would reinstall plugins via claude CLI');
    } else {
      reinstallPlugins(
        path.join(pluginsDest, 'known_marketplaces.json'),
        path.join(pluginsDest, 'installed_plugins.json'),
        path.join(CLAUDE_HOME, 'settings.json'),
      );
    }
  }

  if (!dryRun) logOk('Import complete');
}
