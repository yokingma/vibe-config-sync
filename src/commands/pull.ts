import { cmdImport } from './import.js';
import { SYNC_DIR } from '../core/config.js';
import { createGit, pullFromRemote } from '../core/git.js';

interface PullOptions {
  reinstallPlugins?: boolean;
}

export async function cmdPull(options: PullOptions = {}): Promise<void> {
  const git = createGit(SYNC_DIR);
  await pullFromRemote(git);

  cmdImport({ reinstallPlugins: options.reinstallPlugins });
}
