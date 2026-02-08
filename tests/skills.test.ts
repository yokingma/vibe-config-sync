import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import { exportSkills, importSkills } from '../src/core/skills.js';

const TEST_DIR = path.join(os.tmpdir(), 'vibe-sync-test-skills');
const SRC_DIR = path.join(TEST_DIR, 'src-skills');
const DEST_DIR = path.join(TEST_DIR, 'dest-skills');
const IMPORT_DIR = path.join(TEST_DIR, 'import-skills');

beforeEach(() => {
  fs.ensureDirSync(TEST_DIR);
  fs.ensureDirSync(SRC_DIR);
  fs.ensureDirSync(DEST_DIR);
  fs.ensureDirSync(IMPORT_DIR);
});

afterEach(() => {
  fs.removeSync(TEST_DIR);
});

describe('exportSkills', () => {
  it('should copy real directories', () => {
    const skillDir = path.join(SRC_DIR, 'my-skill');
    fs.ensureDirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# My Skill');

    exportSkills(SRC_DIR, DEST_DIR);

    expect(fs.existsSync(path.join(DEST_DIR, 'my-skill', 'SKILL.md'))).toBe(true);
  });

  it('should resolve symlinks and copy actual files', () => {
    const targetDir = path.join(TEST_DIR, 'external-target');
    fs.ensureDirSync(targetDir);
    fs.writeFileSync(path.join(targetDir, 'SKILL.md'), '# External');

    fs.symlinkSync(targetDir, path.join(SRC_DIR, 'linked-skill'));

    exportSkills(SRC_DIR, DEST_DIR);

    // Should be a real directory, not a symlink
    const exported = path.join(DEST_DIR, 'linked-skill');
    expect(fs.existsSync(path.join(exported, 'SKILL.md'))).toBe(true);
    expect(fs.lstatSync(exported).isSymbolicLink()).toBe(false);
    expect(fs.readFileSync(path.join(exported, 'SKILL.md'), 'utf-8')).toBe('# External');
  });

  it('should handle missing source directory', () => {
    exportSkills('/nonexistent/path', DEST_DIR);
    // Should not throw
  });

  it('should remove .DS_Store files from copied dirs', () => {
    const skillDir = path.join(SRC_DIR, 'my-skill');
    fs.ensureDirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, '.DS_Store'), '');
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Skill');

    exportSkills(SRC_DIR, DEST_DIR);

    expect(fs.existsSync(path.join(DEST_DIR, 'my-skill', '.DS_Store'))).toBe(false);
    expect(fs.existsSync(path.join(DEST_DIR, 'my-skill', 'SKILL.md'))).toBe(true);
  });
});

describe('importSkills', () => {
  it('should copy skill directories to destination', () => {
    const skillDir = path.join(DEST_DIR, 'my-skill');
    fs.ensureDirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# My Skill');

    importSkills(DEST_DIR, IMPORT_DIR);

    expect(fs.existsSync(path.join(IMPORT_DIR, 'my-skill', 'SKILL.md'))).toBe(true);
  });

  it('should handle missing source directory', () => {
    importSkills('/nonexistent/path', IMPORT_DIR);
    // Should not throw
  });

  it('should remove .DS_Store files from imported skill dirs', () => {
    const skillDir = path.join(DEST_DIR, 'my-skill');
    fs.ensureDirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, '.DS_Store'), '');
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Skill');

    importSkills(DEST_DIR, IMPORT_DIR);

    expect(fs.existsSync(path.join(IMPORT_DIR, 'my-skill', '.DS_Store'))).toBe(false);
    expect(fs.existsSync(path.join(IMPORT_DIR, 'my-skill', 'SKILL.md'))).toBe(true);
  });
});
