import { Command } from 'commander';
import { isInitialized } from './core/config.js';
import { cmdExport } from './commands/export.js';
import { cmdImport } from './commands/import.js';
import { cmdStatus } from './commands/status.js';
import { cmdPush } from './commands/push.js';
import { cmdPull } from './commands/pull.js';
import { cmdInit } from './commands/init.js';
import { cmdRestore } from './commands/restore.js';
import { logError } from './core/logger.js';

const program = new Command();

program
  .name('vibe-sync')
  .description('Sync AI coding tool configurations across machines via git')
  .version('0.2.4')
  .action(async () => {
    if (!isInitialized()) {
      await cmdInit();
    } else {
      cmdStatus();
    }
  });

program
  .command('init')
  .description('Initialize sync repository')
  .action(cmdInit);

program
  .command('export')
  .description('Export configs from ~/.claude/ to sync repo')
  .action(cmdExport);

program
  .command('import')
  .description('Import configs from sync repo to ~/.claude/')
  .option('--no-plugins', 'Skip plugin sync')
  .option('--dry-run', 'Preview what would be imported without making changes')
  .action((opts) => {
    cmdImport({ reinstallPlugins: opts.plugins, dryRun: opts.dryRun });
  });

program
  .command('status')
  .description('Show diff between local and synced configs')
  .action(cmdStatus);

program
  .command('push')
  .description('Export + git commit + git push')
  .action(cmdPush);

program
  .command('pull')
  .description('Git pull + import')
  .option('--no-plugins', 'Skip plugin sync')
  .option('--dry-run', 'Pull and preview what would be imported')
  .action(async (opts) => {
    await cmdPull({ reinstallPlugins: opts.plugins, dryRun: opts.dryRun });
  });

program
  .command('restore [timestamp]')
  .description('List backups or restore ~/.claude/ from a specific backup')
  .action((timestamp) => {
    cmdRestore(timestamp);
  });

async function run() {
  try {
    await program.parseAsync();
  } catch (err: unknown) {
    logError(err instanceof Error ? err.message : 'An unexpected error occurred');
    process.exit(1);
  }
}

run();
