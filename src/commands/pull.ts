import { cmdImport } from './import.js';
import { SYNC_DIR } from '../core/config.js';
import { createGit, pullFromRemote, hasRemote } from '../core/git.js';
import { logInfo, logWarn } from '../core/logger.js';

interface PullOptions {
  reinstallPlugins?: boolean;
  dryRun?: boolean;
}

export async function cmdPull(options: PullOptions = {}): Promise<void> {
  const git = createGit(SYNC_DIR);
  if (options.dryRun) {
    if (await hasRemote(git)) {
      await git.fetch();
      const localHead = await git.revparse(['HEAD']);
      const remoteHead = await git.revparse(['FETCH_HEAD']).catch(() => null);
      if (remoteHead && localHead !== remoteHead) {
        const summary = await git.diffSummary(['HEAD', 'FETCH_HEAD']);
        logInfo(`Remote has ${summary.changed} changed file(s) ahead of local:`);
        for (const file of summary.files) {
          const ins = 'insertions' in file ? file.insertions : 0;
          const del = 'deletions' in file ? file.deletions : 0;
          logInfo(`  ${file.file} (+${ins} -${del})`);
        }
      } else {
        logInfo('Remote is up to date with local');
      }
    } else {
      logWarn('No remote configured, cannot fetch for preview');
    }
  } else {
    await pullFromRemote(git);
  }

  cmdImport({ reinstallPlugins: options.reinstallPlugins, dryRun: options.dryRun });
}
