import { listBackups, restoreFromBackup } from '../core/backup.js';
import { logInfo } from '../core/logger.js';

export function cmdRestore(timestamp?: string): void {
  const backups = listBackups();

  if (backups.length === 0) {
    throw new Error('No backups found. Run "vibe-sync import" first to create a backup.');
  }

  if (!timestamp) {
    logInfo(`Available backups (${backups.length}):`);
    for (const b of backups.slice(0, 10)) {
      logInfo(`  ${b}`);
    }
    if (backups.length > 10) {
      logInfo(`  ... and ${backups.length - 10} more`);
    }
    logInfo('\nTo restore, run: vibe-sync restore <timestamp>');
    return;
  }

  if (!backups.includes(timestamp)) {
    throw new Error(`Backup not found: ${timestamp}`);
  }

  restoreFromBackup(timestamp);
}
