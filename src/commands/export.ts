import fs from 'fs-extra';
import path from 'node:path';
import readline from 'node:readline/promises';
import { CLAUDE_HOME, CLAUDE_JSON, MCP_SYNC_FILE, getConfigDir, SYNC_FILES, SYNC_DIRS } from '../core/config.js';
import { logInfo, logOk, logWarn } from '../core/logger.js';
import { copyDirClean, readJsonSafe, writeJsonSafe } from '../core/fs-utils.js';
import { sanitizePlugins, sanitizeMarketplaces, mcpServersHaveEnv } from '../core/sanitize.js';
import { exportSkills } from '../core/skills.js';
import type { PluginsData, MarketplacesData } from '../core/sanitize.js';

async function confirmMcpExport(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await rl.question(
      '[WARN] MCP server configs contain "env" fields that may include secrets (API keys, tokens).\n'
      + '       Export anyway? (y/N): ',
    );
    return answer.trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

export async function cmdExport(): Promise<void> {
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

  // Export global MCP servers from ~/.claude.json
  const claudeJson = readJsonSafe<Record<string, unknown>>(CLAUDE_JSON);
  const mcpServers = claudeJson?.mcpServers;
  if (typeof mcpServers === 'object' && mcpServers !== null) {
    const servers = mcpServers as Record<string, unknown>;
    let shouldExport = true;
    if (mcpServersHaveEnv(servers)) {
      shouldExport = await confirmMcpExport();
    }
    if (shouldExport) {
      writeJsonSafe(path.join(configDir, MCP_SYNC_FILE), servers);
      logInfo(`Exported: ${MCP_SYNC_FILE} (from ~/.claude.json)`);
    } else {
      logWarn(`Skipped: ${MCP_SYNC_FILE} (user declined due to env secrets)`);
    }
  }

  logOk('Export complete');
}
