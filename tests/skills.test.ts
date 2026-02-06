import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import { exportSkills, importSkills } from '../src/core/skills.js';

const TEST_DIR = path.join(os.tmpdir(), 'vibe-sync-test-skills');
const SRC_DIR = path.join(TEST_DIR, 'src-skills');
const DEST_DIR = path.join(TEST_DIR, 'dest-skills');
const IMPORT_DIR = path.join(TEST_DIR, 'import-skills');
const EXT_FILE = path.join(TEST_DIR, 'external-skills.json');

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

    exportSkills(SRC_DIR, DEST_DIR, EXT_FILE);

    expect(fs.existsSync(path.join(DEST_DIR, 'my-skill', 'SKILL.md'))).toBe(true);
  });

  it('should record symlinks in external-skills.json', () => {
    // Create a real target directory
    const targetDir = path.join(TEST_DIR, 'external-target');
    fs.ensureDirSync(targetDir);
    fs.writeFileSync(path.join(targetDir, 'SKILL.md'), '# External');

    // Create symlink in source
    fs.symlinkSync(targetDir, path.join(SRC_DIR, 'linked-skill'));

    exportSkills(SRC_DIR, DEST_DIR, EXT_FILE);

    const data = fs.readJsonSync(EXT_FILE);
    expect(data.symlinks).toHaveLength(1);
    expect(data.symlinks[0].name).toBe('linked-skill');
    expect(data.symlinks[0].target).toBe(targetDir);
  });

  it('should handle missing source directory', () => {
    exportSkills('/nonexistent/path', DEST_DIR, EXT_FILE);
    // Should not throw
  });

  it('should remove .DS_Store files from copied dirs', () => {
    const skillDir = path.join(SRC_DIR, 'my-skill');
    fs.ensureDirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, '.DS_Store'), '');
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Skill');

    exportSkills(SRC_DIR, DEST_DIR, EXT_FILE);

    expect(fs.existsSync(path.join(DEST_DIR, 'my-skill', '.DS_Store'))).toBe(false);
    expect(fs.existsSync(path.join(DEST_DIR, 'my-skill', 'SKILL.md'))).toBe(true);
  });
});

describe('importSkills', () => {
  it('should copy skill directories to destination', () => {
    const skillDir = path.join(DEST_DIR, 'my-skill');
    fs.ensureDirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# My Skill');

    // No external skills file
    importSkills(DEST_DIR, IMPORT_DIR, EXT_FILE);

    expect(fs.existsSync(path.join(IMPORT_DIR, 'my-skill', 'SKILL.md'))).toBe(true);
  });

  it('should recreate symlinks from external-skills.json', () => {
    // Create target directory
    const targetDir = path.join(TEST_DIR, 'external-target');
    fs.ensureDirSync(targetDir);
    fs.writeFileSync(path.join(targetDir, 'SKILL.md'), '# External');

    // Write external skills file
    fs.writeJsonSync(EXT_FILE, {
      symlinks: [{ name: 'linked-skill', target: targetDir }],
    });

    fs.ensureDirSync(IMPORT_DIR);
    importSkills(DEST_DIR, IMPORT_DIR, EXT_FILE);

    const linkPath = path.join(IMPORT_DIR, 'linked-skill');
    expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
  });

  it('should warn and skip when symlink target is missing', () => {
    fs.writeJsonSync(EXT_FILE, {
      symlinks: [{ name: 'missing-skill', target: '/nonexistent/path' }],
    });

    fs.ensureDirSync(IMPORT_DIR);
    importSkills(DEST_DIR, IMPORT_DIR, EXT_FILE);

    expect(fs.existsSync(path.join(IMPORT_DIR, 'missing-skill'))).toBe(false);
  });
});
