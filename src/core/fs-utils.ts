import fs from 'fs-extra';
import path from 'node:path';
import { logWarn } from './logger.js';

export function copyDirClean(src: string, dest: string): void {
  fs.copySync(src, dest, { overwrite: true });
  removeOsArtifacts(dest);
}

const OS_ARTIFACTS = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

export function removeOsArtifacts(dir: string): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (OS_ARTIFACTS.has(entry.name)) {
      fs.removeSync(fullPath);
    } else if (entry.isDirectory() && !entry.isSymbolicLink()) {
      removeOsArtifacts(fullPath);
    }
  }
}

export function readJsonSafe<T = unknown>(filePath: string): T | null {
  try {
    return fs.readJsonSync(filePath) as T;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return null;
    if (err instanceof SyntaxError) {
      logWarn(`Failed to parse JSON ${filePath}: ${err.message}`);
    } else {
      logWarn(`Failed to read ${filePath}: ${(err as Error).message}`);
    }
    return null;
  }
}

export function writeJsonSafe(filePath: string, data: unknown): void {
  fs.ensureDirSync(path.dirname(filePath));
  fs.writeJsonSync(filePath, data, { spaces: 2 });
}
