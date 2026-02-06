import { Command } from 'commander';
import { isInitialized } from './core/config.js';
import { cmdExport } from './commands/export.js';
import { cmdImport } from './commands/import.js';
import { cmdStatus } from './commands/status.js';
import { cmdPush } from './commands/push.js';
import { cmdPull } from './commands/pull.js';
import { cmdInit } from './commands/init.js';

const program = new Command();

program
  .name('vibe-sync')
  .description('Sync AI coding tool configurations across machines via git')
  .version('1.0.0')
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
  .action(async () => {
    await cmdInit();
  });

program
  .command('export')
  .description('Export configs from ~/.claude/ to sync repo')
  .action(() => {
    cmdExport();
  });

program
  .command('import')
  .description('Import configs from sync repo to ~/.claude/')
  .option('--reinstall-plugins', 'Reinstall plugins via claude CLI')
  .action((opts) => {
    cmdImport({ reinstallPlugins: opts.reinstallPlugins });
  });

program
  .command('status')
  .description('Show diff between local and synced configs')
  .action(() => {
    cmdStatus();
  });

program
  .command('push')
  .description('Export + git commit + git push')
  .action(async () => {
    await cmdPush();
  });

program
  .command('pull')
  .description('Git pull + import')
  .option('--reinstall-plugins', 'Reinstall plugins via claude CLI')
  .action(async (opts) => {
    await cmdPull({ reinstallPlugins: opts.reinstallPlugins });
  });

program.parse();
