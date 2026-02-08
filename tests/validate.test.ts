import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import {
  validateJsonFile,
  validateSettingsJson,
  validatePluginsJson,
} from '../src/core/validate.js';

describe('validate', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `vibe-sync-test-validate-${Date.now()}`);
    fs.ensureDirSync(tmpDir);
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  describe('validateJsonFile', () => {
    it('should accept a valid JSON object', () => {
      const f = path.join(tmpDir, 'valid.json');
      fs.writeJsonSync(f, { key: 'value' });
      expect(validateJsonFile(f)).toMatchObject({ valid: true, errors: [] });
    });

    it('should reject a non-existent file', () => {
      const f = path.join(tmpDir, 'missing.json');
      const result = validateJsonFile(f);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Cannot parse JSON');
    });

    it('should reject invalid JSON', () => {
      const f = path.join(tmpDir, 'bad.json');
      fs.writeFileSync(f, '{not valid json}');
      expect(validateJsonFile(f).valid).toBe(false);
    });

    it('should reject a root-level array', () => {
      const f = path.join(tmpDir, 'array.json');
      fs.writeJsonSync(f, [1, 2, 3]);
      const result = validateJsonFile(f);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('array');
    });

    it('should reject a primitive value', () => {
      const f = path.join(tmpDir, 'prim.json');
      fs.writeFileSync(f, '"just a string"');
      expect(validateJsonFile(f).valid).toBe(false);
    });
  });

  describe('validateSettingsJson', () => {
    it('should accept valid settings with enabledPlugins', () => {
      const f = path.join(tmpDir, 'settings.json');
      fs.writeJsonSync(f, { enabledPlugins: { 'test@official': true } });
      expect(validateSettingsJson(f)).toMatchObject({ valid: true, errors: [] });
    });

    it('should accept settings without enabledPlugins', () => {
      const f = path.join(tmpDir, 'settings.json');
      fs.writeJsonSync(f, { otherKey: 'value' });
      expect(validateSettingsJson(f).valid).toBe(true);
    });

    it('should reject enabledPlugins as array', () => {
      const f = path.join(tmpDir, 'settings.json');
      fs.writeJsonSync(f, { enabledPlugins: ['a', 'b'] });
      const result = validateSettingsJson(f);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('enabledPlugins');
    });
  });

  describe('validatePluginsJson', () => {
    it('should accept valid plugins data', () => {
      const f = path.join(tmpDir, 'plugins.json');
      fs.writeJsonSync(f, { version: 2, plugins: { 'test': [] } });
      expect(validatePluginsJson(f)).toMatchObject({ valid: true, errors: [] });
    });

    it('should reject plugins as array', () => {
      const f = path.join(tmpDir, 'plugins.json');
      fs.writeJsonSync(f, { plugins: ['bad'] });
      const result = validatePluginsJson(f);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('plugins must be an object');
    });
  });
});
