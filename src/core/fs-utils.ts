import fs from 'fs-extra';
import path from 'node:path';

export function copyDirClean(src: string, dest: string): void {
  fs.copySync(src, dest, { overwrite: true });
  removeDsStore(dest);
}

export function removeDsStore(dir: string): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name === '.DS_Store') {
      fs.removeSync(fullPath);
    } else if (entry.isDirectory()) {
      removeDsStore(fullPath);
    }
  }
}

export function readJsonSafe<T = unknown>(filePath: string): T | null {
  try {
    return fs.readJsonSync(filePath) as T;
  } catch {
    return null;
  }
}

export function writeJsonSafe(filePath: string, data: unknown): void {
  fs.ensureDirSync(path.dirname(filePath));
  fs.writeJsonSync(filePath, data, { spaces: 2 });
}
