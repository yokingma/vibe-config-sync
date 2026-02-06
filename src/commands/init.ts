import fs from 'fs-extra';
import path from 'node:path';
import readline from 'node:readline/promises';
import { SYNC_DIR, isInitialized } from '../core/config.js';
import { createGit, hasRemote } from '../core/git.js';
import { logInfo, logOk, logWarn, logError } from '../core/logger.js';

function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

export async function cmdInit(): Promise<void> {
  if (isInitialized()) {
    logOk('Already initialized at ' + SYNC_DIR);
    const git = createGit(SYNC_DIR);
    if (await hasRemote(git)) {
      const remotes = await git.getRemotes(true);
      const origin = remotes.find((r) => r.name === 'origin');
      if (origin) {
        logInfo(`Remote: ${origin.refs.fetch}`);
      }
    } else {
      logWarn('No remote configured');
    }
    return;
  }

  console.log('');
  console.log('Welcome to vibe-sync! Let\'s set up config synchronization.');
  console.log('');

  const rl = createReadline();

  try {
    const url = await rl.question('? Git remote URL: ');

    if (!url.trim()) {
      logError('URL cannot be empty');
      return;
    }

    fs.ensureDirSync(SYNC_DIR);

    // Create .gitignore
    fs.writeFileSync(
      path.join(SYNC_DIR, '.gitignore'),
      '.DS_Store\nThumbs.db\n',
    );

    const git = createGit(SYNC_DIR);
    await git.init();
    logOk('Initialized git repository');

    await git.addRemote('origin', url.trim());
    logOk(`Remote added: ${url.trim()}`);

    // Try to pull existing data
    try {
      await git.pull('origin', 'main');
      logOk('Pulled existing data from remote');
    } catch {
      try {
        await git.pull('origin', 'master');
        logOk('Pulled existing data from remote');
      } catch {
        logInfo('No existing data on remote (new repository)');
      }
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
