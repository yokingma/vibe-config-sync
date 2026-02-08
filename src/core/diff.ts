import fs from 'fs-extra';
import path from 'node:path';
import { createTwoFilesPatch } from 'diff';
import pc from 'picocolors';

function readNormalized(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
}

function dirsEqual(a: string, b: string): boolean {
  const aEntries = fs.readdirSync(a).sort();
  const bEntries = fs.readdirSync(b).sort();
  if (aEntries.length !== bEntries.length) return false;

  for (let i = 0; i < aEntries.length; i++) {
    if (aEntries[i] !== bEntries[i]) return false;
    const aPath = path.join(a, aEntries[i]);
    const bPath = path.join(b, bEntries[i]);
    try {
      const aStat = fs.statSync(aPath);
      const bStat = fs.statSync(bPath);
      if (aStat.isDirectory() !== bStat.isDirectory()) return false;
      const equal = aStat.isDirectory()
        ? dirsEqual(aPath, bPath)
        : readNormalized(aPath) === readNormalized(bPath);
      if (!equal) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function colorDiffLine(line: string): string {
  if (line.startsWith('@@')) return pc.cyan(line);
  if (line.startsWith('+')) return pc.green(line);
  if (line.startsWith('-')) return pc.red(line);
  return line;
}

export function showDiff(localPath: string, repoPath: string, label: string): boolean {
  const localExists = fs.existsSync(localPath);
  const repoExists = fs.existsSync(repoPath);

  if (!localExists && !repoExists) return false;

  if (!localExists) {
    console.log(pc.yellow(`  ${label}: exists in repo but not locally`));
    return true;
  }

  if (!repoExists) {
    console.log(pc.yellow(`  ${label}: exists locally but not in repo`));
    return true;
  }

  if (fs.statSync(localPath).isDirectory()) {
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
  console.log(patch.split('\n').map(colorDiffLine).join('\n'));
  return true;
}
