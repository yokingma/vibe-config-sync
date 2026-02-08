import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { CLAUDE_HOME, CLAUDE_JSON, MCP_SYNC_FILE, getConfigDir, SYNC_FILES, SYNC_DIRS, PLUGIN_FILES } from '../core/config.js';
import { logOk } from '../core/logger.js';
import { showDiff } from '../core/diff.js';
import { readJsonSafe } from '../core/fs-utils.js';

export function cmdStatus(): void {
  const configDir = getConfigDir();
  let hasDiff = false;

  // Compare simple files
  for (const file of SYNC_FILES) {
    const local = path.join(CLAUDE_HOME, file);
    const repo = path.join(configDir, file);
    if (showDiff(local, repo, file)) {
      hasDiff = true;
    }
  }

  // Compare directories
  for (const dir of SYNC_DIRS) {
    const local = path.join(CLAUDE_HOME, dir);
    const repo = path.join(configDir, dir);
    if (showDiff(local, repo, `${dir}/`)) {
      hasDiff = true;
    }
  }

  // Compare skills
  const localSkills = path.join(CLAUDE_HOME, 'skills');
  const repoSkills = path.join(configDir, 'skills');
  if (showDiff(localSkills, repoSkills, 'skills/')) {
    hasDiff = true;
  }

  // Compare plugin registries
  for (const file of PLUGIN_FILES) {
    const local = path.join(CLAUDE_HOME, 'plugins', file);
    const repo = path.join(configDir, 'plugins', file);
    if (showDiff(local, repo, `plugins/${file}`)) {
      hasDiff = true;
    }
  }

  // Compare MCP servers (extracted from ~/.claude.json vs synced mcp-servers.json)
  const repoMcp = path.join(configDir, MCP_SYNC_FILE);
  const claudeJson = readJsonSafe<Record<string, unknown>>(CLAUDE_JSON);
  const localMcp = (typeof claudeJson?.mcpServers === 'object' && claudeJson.mcpServers !== null)
    ? claudeJson.mcpServers
    : undefined;
  if (localMcp || fs.existsSync(repoMcp)) {
    const tmpFile = path.join(os.tmpdir(), `vibe-sync-mcp-${Date.now()}.json`);
    try {
      if (localMcp) {
        fs.writeJsonSync(tmpFile, localMcp, { spaces: 2 });
      }
      const localPath = localMcp ? tmpFile : '';
      if (showDiff(localPath, repoMcp, MCP_SYNC_FILE)) {
        hasDiff = true;
      }
    } finally {
      fs.removeSync(tmpFile);
    }
  }

  if (!hasDiff) {
    logOk('No differences found');
  }
}
