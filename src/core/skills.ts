import fs from 'fs-extra';
import path from 'node:path';
import { logInfo, logOk, logWarn } from './logger.js';
import { copyDirClean, readJsonSafe, writeJsonSafe } from './fs-utils.js';

export interface SymlinkEntry {
  name: string;
  target: string;
}

export interface ExternalSkillsData {
  symlinks: SymlinkEntry[];
}

export function exportSkills(
  srcDir: string,
  destDir: string,
  externalSkillsFile: string,
): void {
  if (!fs.existsSync(srcDir)) {
    logWarn('Skills directory not found:', srcDir);
    return;
  }

  fs.ensureDirSync(destDir);
  const symlinks: SymlinkEntry[] = [];
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const name = entry.name;
    const fullPath = path.join(srcDir, name);
    const stat = fs.lstatSync(fullPath);

    if (stat.isSymbolicLink()) {
      const target = fs.readlinkSync(fullPath);
      symlinks.push({ name, target });
      logInfo(`Recorded symlink: ${name} -> ${target}`);
    } else if (stat.isDirectory()) {
      copyDirClean(fullPath, path.join(destDir, name));
      logInfo(`Exported skill: ${name}`);
    }
  }

  writeJsonSafe(externalSkillsFile, { symlinks });
  logOk(`Recorded ${symlinks.length} external skill symlinks`);
}

export function importSkills(
  srcDir: string,
  destDir: string,
  externalSkillsFile: string,
): void {
  if (fs.existsSync(srcDir)) {
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

  const data = readJsonSafe<ExternalSkillsData>(externalSkillsFile);
  if (!data?.symlinks?.length) return;

  logInfo(`Recreating ${data.symlinks.length} skill symlinks...`);
  for (const { name, target } of data.symlinks) {
    const linkPath = path.join(destDir, name);
    const absTarget = path.resolve(destDir, target);

    if (!fs.existsSync(absTarget)) {
      logWarn(`Symlink target missing: ${target} (${name})`);
      continue;
    }

    fs.removeSync(linkPath);
    const symlinkType = process.platform === 'win32'
      ? 'junction'
      : 'dir';
    fs.symlinkSync(target, linkPath, symlinkType);
    logOk(`Recreated symlink: ${name} -> ${target}`);
  }
}
