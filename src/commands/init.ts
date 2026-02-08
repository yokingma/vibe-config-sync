import fs from 'fs-extra';
import path from 'node:path';
import readline from 'node:readline/promises';
import { SYNC_DIR, isInitialized } from '../core/config.js';
import { createGit, pullFromRemote } from '../core/git.js';
import { logInfo, logOk, logWarn, logError } from '../core/logger.js';

const GIT_URL_PATTERN = /^(https?:\/\/|git@|ssh:\/\/|git:\/\/).+/;

function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function promptUrl(rl: readline.Interface, prompt: string): Promise<string | null> {
  const url = await rl.question(prompt);
  const trimmed = url.trim();

  if (!trimmed) return null;

  if (!GIT_URL_PATTERN.test(trimmed)) {
    logError('Invalid Git URL format. Expected https://, git@, ssh://, or git:// URL');
    return null;
  }

  return trimmed;
}

async function updateRemote(): Promise<void> {
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
    const url = await promptUrl(rl, '? New Git remote URL (leave empty to keep current): ');
    if (!url) {
      logInfo('Remote unchanged');
      return;
    }

    if (origin) {
      await git.remote(['set-url', 'origin', url]);
    } else {
      await git.addRemote('origin', url);
    }
    logOk(`Remote updated: ${url}`);
  } finally {
    rl.close();
  }
}

async function freshInit(): Promise<void> {
  console.log('');
  console.log('Welcome to vibe-sync! Let\'s set up config synchronization.');
  console.log('');

  const rl = createReadline();
  try {
    const url = await promptUrl(rl, '? Git remote URL: ');
    if (!url) {
      logError('URL cannot be empty');
      return;
    }

    fs.ensureDirSync(SYNC_DIR);

    const git = createGit(SYNC_DIR);
    await git.init();
    logOk('Initialized git repository');

    await git.addRemote('origin', url);
    logOk(`Remote added: ${url}`);

    try {
      await pullFromRemote(git);
    } catch {
      logInfo('No existing data on remote (new repository)');
    }

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

export async function cmdInit(): Promise<void> {
  if (isInitialized()) {
    await updateRemote();
    return;
  }
  await freshInit();
}
