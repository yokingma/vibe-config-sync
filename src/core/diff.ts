import fs from 'fs-extra';
import path from 'node:path';
import { createTwoFilesPatch } from 'diff';
import pc from 'picocolors';

function readNormalized(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
}

function filesEqual(a: string, b: string): boolean {
  return readNormalized(a) === readNormalized(b);
}

function dirsEqual(a: string, b: string): boolean {
  const aEntries = fs.readdirSync(a).sort();
  const bEntries = fs.readdirSync(b).sort();
  if (aEntries.length !== bEntries.length) return false;
  for (let i = 0; i < aEntries.length; i++) {
    if (aEntries[i] !== bEntries[i]) return false;
    const aPath = path.join(a, aEntries[i]);
    const bPath = path.join(b, bEntries[i]);
    const aStat = fs.statSync(aPath);
    const bStat = fs.statSync(bPath);
    if (aStat.isDirectory() !== bStat.isDirectory()) return false;
    const equal = aStat.isDirectory()
      ? dirsEqual(aPath, bPath)
      : filesEqual(aPath, bPath);
    if (!equal) return false;
  }
  return true;
}

function colorDiff(patch: string): string {
  return patch
    .split('\n')
    .map((line) => {
      if (line.startsWith('+')) return pc.green(line);
      if (line.startsWith('-')) return pc.red(line);
      if (line.startsWith('@@')) return pc.cyan(line);
      return line;
    })
    .join('\n');
}

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

  if (isDir) {
    if (dirsEqual(localPath, repoPath)) return false;
    console.log(pc.yellow(`  ${label}: differs`));
    return true;
  }

  const localContent = readNormalized(localPath);
  const repoContent = readNormalized(repoPath);
  if (localContent === repoContent) return false;

  console.log(pc.yellow(`  ${label}: differs`));
  const patch = createTwoFilesPatch(
    `local/${label}`, `repo/${label}`,
    localContent, repoContent,
  );
  console.log(colorDiff(patch));
  return true;
}
