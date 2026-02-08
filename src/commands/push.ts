import { cmdExport } from './export.js';
import { SYNC_DIR } from '../core/config.js';
import { createGit, commitAndPush } from '../core/git.js';

export async function cmdPush(): Promise<void> {
  await cmdExport();

  const git = createGit(SYNC_DIR);
  await commitAndPush(git);
}
