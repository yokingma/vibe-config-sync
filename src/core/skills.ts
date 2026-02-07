import fs from 'fs-extra';
import path from 'node:path';
import { logInfo, logOk, logWarn } from './logger.js';
import { copyDirClean } from './fs-utils.js';

export function exportSkills(srcDir: string, destDir: string): void {
  if (!fs.existsSync(srcDir)) {
    logWarn('Skills directory not found:', srcDir);
    return;
  }

  fs.ensureDirSync(destDir);
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const name = entry.name;
    const fullPath = path.join(srcDir, name);
    if (entry.isSymbolicLink()) {
      // Resolve symlink and copy actual files
      const realPath = fs.realpathSync(fullPath);
      copyDirClean(realPath, path.join(destDir, name));
      logInfo(`Exported skill (resolved symlink): ${name}`);
    } else if (entry.isDirectory()) {
      copyDirClean(fullPath, path.join(destDir, name));
      logInfo(`Exported skill: ${name}`);
    }
  }

  logOk('Skills exported');
}

export function importSkills(srcDir: string, destDir: string): void {
  if (!fs.existsSync(srcDir)) return;

  fs.ensureDirSync(destDir);

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const src = path.join(srcDir, entry.name);
      const dest = path.join(destDir, entry.name);
      fs.copySync(src, dest, { overwrite: true });
      logInfo(`Imported skill: ${entry.name}`);
    }
  }
}
