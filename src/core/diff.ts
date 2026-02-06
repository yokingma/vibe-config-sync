import fs from 'fs-extra';
import path from 'node:path';
import { execSync } from 'node:child_process';
import pc from 'picocolors';
import { logInfo, logOk } from './logger.js';

export function showDiff(localPath: string, repoPath: string, label: string): boolean {
  if (!fs.existsSync(localPath) && !fs.existsSync(repoPath)) {
    return false;
  }

  if (!fs.existsSync(localPath)) {
    console.log(pc.yellow(`  ${label}: exists in repo but not locally`));
    return true;
  }

  if (!fs.existsSync(repoPath)) {
    console.log(pc.yellow(`  ${label}: exists locally but not in repo`));
    return true;
  }

  const isDir = fs.statSync(localPath).isDirectory();

  try {
    const args = isDir ? '-rq' : '-q';
    execSync(`diff ${args} "${localPath}" "${repoPath}"`, { stdio: 'pipe' });
    return false;
  } catch {
    console.log(pc.yellow(`  ${label}: differs`));
    if (!isDir) {
      try {
        const output = execSync(
          `diff --color=auto "${localPath}" "${repoPath}"`,
          { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
        );
        if (output) console.log(output);
      } catch (e: unknown) {
        const err = e as { stdout?: string };
        if (err.stdout) console.log(err.stdout);
      }
    }
    return true;
  }
}
