import { simpleGit, type SimpleGit } from 'simple-git';
import { logInfo, logWarn, logOk } from './logger.js';

export function createGit(baseDir: string): SimpleGit {
  return simpleGit({ baseDir });
}

export async function ensureGitRepo(git: SimpleGit): Promise<void> {
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    await git.init();
    logInfo('Initialized git repository');
  }
}

export async function hasRemote(git: SimpleGit): Promise<boolean> {
  try {
    const remotes = await git.getRemotes();
    return remotes.length > 0;
  } catch {
    return false;
  }
}

function setUpstreamArgs(remoteBranch: string, localBranch: string): string[] {
  return ['--set-upstream-to=origin/' + remoteBranch, localBranch];
}

export async function commitAndPush(git: SimpleGit): Promise<boolean> {
  await ensureGitRepo(git);
  await git.add('-A');

  const status = await git.status();
  const hasChanges = !status.isClean();

  if (hasChanges) {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_');
    const msg = `sync: update claude configs ${timestamp}`;
    await git.commit(msg);
    logOk(`Committed: ${msg}`);
  } else {
    logInfo('No changes to commit');
  }

  if (!(await hasRemote(git))) {
    logWarn('No remote configured. Run: git remote add origin <url>');
    return hasChanges;
  }

  const branch = (await git.branchLocal()).current || 'main';
  try {
    await git.push(['-u', 'origin', branch]);
  } catch {
    logInfo('Push rejected, pulling remote changes first');
    await pullFromRemote(git);
    await git.push(['-u', 'origin', branch]);
  }
  logOk('Pushed to remote');

  return hasChanges;
}

async function detectRemoteBranch(git: SimpleGit): Promise<string> {
  try {
    const remote = await git.remote(['show', 'origin']);
    if (remote) {
      const match = remote.match(/HEAD branch:\s*(\S+)/);
      if (match) return match[1];
    }
  } catch {
    // Fallback: check which common branch names exist on remote
  }

  try {
    const refs = await git.listRemote(['--heads', 'origin']);
    if (refs.includes('refs/heads/main')) return 'main';
    if (refs.includes('refs/heads/master')) return 'master';
  } catch {
    // Remote unreachable, default to main
  }

  return 'main';
}

export async function pullFromRemote(git: SimpleGit): Promise<void> {
  if (!(await hasRemote(git))) {
    throw new Error('No remote configured. Run: git remote add origin <url>');
  }

  const localBranch = (await git.branchLocal()).current;
  const remoteBranch = await detectRemoteBranch(git);
  const branch = localBranch || remoteBranch;

  try {
    await git.pull();
  } catch {
    try {
      await git.pull('origin', remoteBranch);
      await git.branch(setUpstreamArgs(remoteBranch, branch));
    } catch {
      logWarn('Merge conflict detected. Stashing local changes before resetting to remote version.');
      await git.fetch('origin', remoteBranch);
      try {
        await git.stash(['push', '-m', `vibe-sync: pre-reset backup ${new Date().toISOString()}`]);
        logInfo('Local changes stashed. Use "git stash pop" in ~/.vibe-sync to recover if needed.');
      } catch {
        // Nothing to stash (clean working tree), safe to proceed
      }
      await git.reset(['--hard', `origin/${remoteBranch}`]);
      await git.clean('f', ['-d']);
      await git.branch(setUpstreamArgs(remoteBranch, branch));
    }
  }

  if (localBranch && localBranch !== remoteBranch) {
    try {
      await git.branch(['-m', localBranch, remoteBranch]);
      await git.branch(setUpstreamArgs(remoteBranch, remoteBranch));
    } catch {
      // Branch may already be correct after reset
    }
  }

  logOk('Pulled from remote');
}
