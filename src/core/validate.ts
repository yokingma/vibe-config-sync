import { readJsonSafe } from './fs-utils.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  data?: Record<string, unknown>;
}

function ok(data?: Record<string, unknown>): ValidationResult {
  return { valid: true, errors: [], data };
}

function fail(error: string): ValidationResult {
  return { valid: false, errors: [error] };
}

export function validateJsonFile(filePath: string): ValidationResult {
  const data = readJsonSafe(filePath);
  if (data === null) return fail(`Cannot parse JSON: ${filePath}`);
  if (typeof data !== 'object' || Array.isArray(data)) {
    return fail(`Expected object, got ${Array.isArray(data) ? 'array' : typeof data}: ${filePath}`);
  }
  return ok(data as Record<string, unknown>);
}

export function validateSettingsJson(filePath: string): ValidationResult {
  const base = validateJsonFile(filePath);
  if (!base.valid) return base;

  const data = base.data!;
  if ('enabledPlugins' in data) {
    const ep = data.enabledPlugins;
    if (typeof ep !== 'object' || ep === null || Array.isArray(ep)) {
      return fail('settings.json: enabledPlugins must be an object');
    }
  }
  return ok(data);
}

export function validatePluginsJson(filePath: string): ValidationResult {
  const base = validateJsonFile(filePath);
  if (!base.valid) return base;

  const data = base.data!;
  if ('plugins' in data) {
    const p = data.plugins;
    if (typeof p !== 'object' || p === null || Array.isArray(p)) {
      return fail('installed_plugins.json: plugins must be an object');
    }
  }
  return ok(data);
}

export function validateMarketplacesJson(filePath: string): ValidationResult {
  return validateJsonFile(filePath);
}
