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

export async function commitAndPush(
  git: SimpleGit,
): Promise<boolean> {
  await ensureGitRepo(git);
  await git.add('-A');

  const status = await git.status();
  if (status.isClean()) {
    logInfo('No changes to commit');
  } else {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_');
    const msg = `sync: update claude configs ${timestamp}`;
    await git.commit(msg);
    logOk(`Committed: ${msg}`);
  }

  if (await hasRemote(git)) {
    const branch = (await git.branchLocal()).current || 'main';
    await git.push(['-u', 'origin', branch]);
    logOk('Pushed to remote');
  } else {
    logWarn('No remote configured. Run: git remote add origin <url>');
  }

  return !status.isClean();
}

export async function pullFromRemote(git: SimpleGit): Promise<void> {
  if (!(await hasRemote(git))) {
    throw new Error('No remote configured. Run: git remote add origin <url>');
  }

  const branch = (await git.branchLocal()).current || 'main';

  try {
    await git.pull();
  } catch {
    try {
      // Fallback: branch may not have upstream tracking set
      await git.pull('origin', branch);
      await git.branch(['--set-upstream-to=origin/' + branch, branch]);
    } catch {
      // Fallback: untracked files or merge conflicts — fetch and reset to remote
      logWarn('Merge conflict detected, resetting to remote version');
      await git.fetch('origin', branch);
      await git.reset(['--hard', `origin/${branch}`]);
      await git.branch(['--set-upstream-to=origin/' + branch, branch]);
    }
  }
  logOk('Pulled from remote');
}
