import fs from 'fs-extra';
import path from 'node:path';
import readline from 'node:readline/promises';
import { SYNC_DIR, isInitialized } from '../core/config.js';
import { createGit } from '../core/git.js';
import { logInfo, logOk, logWarn, logError } from '../core/logger.js';

function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

export async function cmdInit(): Promise<void> {
  if (isInitialized()) {
    const git = createGit(SYNC_DIR);
    const remotes = await git.getRemotes(true);
    const origin = remotes.find((r) => r.name === 'origin');

    if (origin) {
      logInfo(`Current remote: ${origin.refs.fetch}`);
    } else {
      logWarn('No remote configured');
    }

    const rl = createReadline();
    try {
      const url = await rl.question('? New Git remote URL (leave empty to keep current): ');
      const trimmedUrl = url.trim();
      if (!trimmedUrl) {
        logInfo('Remote unchanged');
        return;
      }

      const gitUrlPattern = /^(https?:\/\/|git@|ssh:\/\/|git:\/\/).+/;
      if (!gitUrlPattern.test(trimmedUrl)) {
        logError('Invalid Git URL format. Expected https://, git@, ssh://, or git:// URL');
        return;
      }

      if (origin) {
        await git.remote(['set-url', 'origin', trimmedUrl]);
      } else {
        await git.addRemote('origin', trimmedUrl);
      }
      logOk(`Remote updated: ${trimmedUrl}`);
    } finally {
      rl.close();
    }
    return;
  }

  console.log('');
  console.log('Welcome to vibe-sync! Let\'s set up config synchronization.');
  console.log('');

  const rl = createReadline();

  try {
    const url = await rl.question('? Git remote URL: ');

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      logError('URL cannot be empty');
      return;
    }

    const gitUrlPattern = /^(https?:\/\/|git@|ssh:\/\/|git:\/\/).+/;
    if (!gitUrlPattern.test(trimmedUrl)) {
      logError('Invalid Git URL format. Expected https://, git@, ssh://, or git:// URL');
      return;
    }

    fs.ensureDirSync(SYNC_DIR);

    const git = createGit(SYNC_DIR);
    await git.init();
    logOk('Initialized git repository');

    await git.addRemote('origin', trimmedUrl);
    logOk(`Remote added: ${trimmedUrl}`);

    // Try to pull existing data and set up branch tracking
    try {
      await git.pull('origin', 'main');
      await git.branch(['--set-upstream-to=origin/main', 'main']);
      logOk('Pulled existing data from remote');
    } catch {
      try {
        await git.pull('origin', 'master');
        await git.branch(['--set-upstream-to=origin/master', 'master']);
        logOk('Pulled existing data from remote');
      } catch {
        logInfo('No existing data on remote (new repository)');
      }
    }

    // Create .gitignore only if not pulled from remote
    const gitignorePath = path.join(SYNC_DIR, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, '.DS_Store\nThumbs.db\n');
    }

    console.log('');
    logOk('Setup complete!');
    console.log('');
    console.log('  vibe-sync push   Export configs and push to remote');
    console.log('  vibe-sync pull   Pull from remote and import configs');
    console.log('  vibe-sync status Show diff between local and synced');
    console.log('');
  } finally {
    rl.close();
  }
}
