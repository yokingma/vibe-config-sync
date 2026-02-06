import path from 'node:path';
import { CLAUDE_HOME, getConfigDir, SYNC_FILES, SYNC_DIRS } from '../core/config.js';
import { logOk } from '../core/logger.js';
import { showDiff } from '../core/diff.js';

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
  for (const file of ['installed_plugins.json', 'known_marketplaces.json']) {
    const local = path.join(CLAUDE_HOME, 'plugins', file);
    const repo = path.join(configDir, 'plugins', file);
    if (showDiff(local, repo, `plugins/${file}`)) {
      hasDiff = true;
    }
  }

  if (!hasDiff) {
    logOk('No differences found');
  }
}
