import { cmdImport } from './import.js';
import { SYNC_DIR } from '../core/config.js';
import { createGit, pullFromRemote } from '../core/git.js';
import { logInfo } from '../core/logger.js';

interface PullOptions {
  reinstallPlugins?: boolean;
  dryRun?: boolean;
}

export async function cmdPull(options: PullOptions = {}): Promise<void> {
  const git = createGit(SYNC_DIR);
  if (options.dryRun) {
    logInfo('Dry run: skipping git pull');
  } else {
    await pullFromRemote(git);
  }

  cmdImport({ reinstallPlugins: options.reinstallPlugins, dryRun: options.dryRun });
}
