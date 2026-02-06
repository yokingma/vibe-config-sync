import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import {
  copyDirClean,
  removeDsStore,
  readJsonSafe,
  writeJsonSafe,
} from '../src/core/fs-utils.js';

const TEST_DIR = path.join(os.tmpdir(), 'vibe-sync-test-fs-utils');

beforeEach(() => {
  fs.ensureDirSync(TEST_DIR);
});

afterEach(() => {
  fs.removeSync(TEST_DIR);
});

describe('removeDsStore', () => {
  it('should remove .DS_Store files recursively', () => {
    const subDir = path.join(TEST_DIR, 'sub');
    fs.ensureDirSync(subDir);
    fs.writeFileSync(path.join(TEST_DIR, '.DS_Store'), '');
    fs.writeFileSync(path.join(subDir, '.DS_Store'), '');
    fs.writeFileSync(path.join(subDir, 'keep.txt'), 'keep');

    removeDsStore(TEST_DIR);

    expect(fs.existsSync(path.join(TEST_DIR, '.DS_Store'))).toBe(false);
    expect(fs.existsSync(path.join(subDir, '.DS_Store'))).toBe(false);
    expect(fs.existsSync(path.join(subDir, 'keep.txt'))).toBe(true);
  });

  it('should handle nonexistent directory', () => {
    removeDsStore('/nonexistent/path');
    // Should not throw
  });
});

describe('copyDirClean', () => {
  it('should copy directory and remove .DS_Store', () => {
    const src = path.join(TEST_DIR, 'src');
    const dest = path.join(TEST_DIR, 'dest');
    fs.ensureDirSync(src);
    fs.writeFileSync(path.join(src, '.DS_Store'), '');
    fs.writeFileSync(path.join(src, 'file.txt'), 'content');

    copyDirClean(src, dest);

    expect(fs.existsSync(path.join(dest, 'file.txt'))).toBe(true);
    expect(fs.existsSync(path.join(dest, '.DS_Store'))).toBe(false);
  });
});

describe('readJsonSafe', () => {
  it('should read valid JSON file', () => {
    const file = path.join(TEST_DIR, 'test.json');
    fs.writeJsonSync(file, { key: 'value' });

    const result = readJsonSafe<{ key: string }>(file);
    expect(result).toEqual({ key: 'value' });
  });

  it('should return null for nonexistent file', () => {
    const result = readJsonSafe('/nonexistent/file.json');
    expect(result).toBeNull();
  });

  it('should return null for invalid JSON', () => {
    const file = path.join(TEST_DIR, 'bad.json');
    fs.writeFileSync(file, 'not json');

    const result = readJsonSafe(file);
    expect(result).toBeNull();
  });
});

describe('writeJsonSafe', () => {
  it('should write JSON with indentation', () => {
    const file = path.join(TEST_DIR, 'out.json');
    writeJsonSafe(file, { a: 1 });

    const content = fs.readFileSync(file, 'utf-8');
    expect(JSON.parse(content)).toEqual({ a: 1 });
    expect(content).toContain('  '); // indented
  });

  it('should create parent directories', () => {
    const file = path.join(TEST_DIR, 'deep', 'nested', 'out.json');
    writeJsonSafe(file, { b: 2 });

    expect(fs.existsSync(file)).toBe(true);
  });
});
