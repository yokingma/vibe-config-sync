import { describe, it, expect } from 'vitest';
import { sanitizePlugins, sanitizeMarketplaces, mcpServersHaveEnv } from '../src/core/sanitize.js';
import type { PluginsData, MarketplacesData } from '../src/core/sanitize.js';

describe('sanitizePlugins', () => {
  it('should remove installPath from all plugin entries', () => {
    const input: PluginsData = {
      version: 2,
      plugins: {
        'playwright@official': [
          {
            scope: 'user',
            version: '1.0.0',
            installPath: '/home/user/.claude/plugins/cache/playwright',
          },
        ],
        'code-review@official': [
          {
            scope: 'user',
            version: '2.0.0',
            installPath: '/home/user/.claude/plugins/cache/code-review',
          },
        ],
      },
    };

    const result = sanitizePlugins(input);

    for (const entries of Object.values(result.plugins!)) {
      for (const entry of entries) {
        expect(entry).not.toHaveProperty('installPath');
      }
    }
  });

  it('should preserve other fields', () => {
    const input: PluginsData = {
      version: 2,
      plugins: {
        'test-plugin': [
          {
            scope: 'user',
            version: '1.0.0',
            installedAt: '2026-01-01T00:00:00Z',
            installPath: '/some/path',
          },
        ],
      },
    };

    const result = sanitizePlugins(input);
    const entry = result.plugins!['test-plugin'][0];

    expect(entry.scope).toBe('user');
    expect(entry.version).toBe('1.0.0');
    expect(entry.installedAt).toBe('2026-01-01T00:00:00Z');
    expect(result.version).toBe(2);
  });

  it('should not mutate the original data', () => {
    const input: PluginsData = {
      plugins: {
        'test': [{ installPath: '/path' }],
      },
    };

    sanitizePlugins(input);

    expect(input.plugins!['test'][0].installPath).toBe('/path');
  });

  it('should handle empty plugins', () => {
    const result = sanitizePlugins({});
    expect(result).toEqual({});
  });

  it('should handle plugins with no installPath', () => {
    const input: PluginsData = {
      plugins: {
        'clean-plugin': [{ scope: 'user', version: '1.0.0' }],
      },
    };

    const result = sanitizePlugins(input);
    expect(result.plugins!['clean-plugin'][0].scope).toBe('user');
  });
});

describe('sanitizeMarketplaces', () => {
  it('should remove installLocation from all entries', () => {
    const input: MarketplacesData = {
      'official': {
        source: { source: 'github', repo: 'anthropics/plugins' },
        installLocation: '/home/user/.claude/plugins/marketplaces/official',
        lastUpdated: '2026-01-01T00:00:00Z',
      },
      'community': {
        source: { source: 'git', url: 'https://example.com/plugins.git' },
        installLocation: '/home/user/.claude/plugins/marketplaces/community',
      },
    };

    const result = sanitizeMarketplaces(input);

    for (const entry of Object.values(result)) {
      expect(entry).not.toHaveProperty('installLocation');
    }
  });

  it('should preserve other fields', () => {
    const input: MarketplacesData = {
      'official': {
        source: { source: 'github', repo: 'anthropics/plugins' },
        installLocation: '/some/path',
        lastUpdated: '2026-01-01T00:00:00Z',
      },
    };

    const result = sanitizeMarketplaces(input);

    expect(result['official'].source).toEqual({
      source: 'github',
      repo: 'anthropics/plugins',
    });
    expect(result['official'].lastUpdated).toBe('2026-01-01T00:00:00Z');
  });

  it('should not mutate the original data', () => {
    const input: MarketplacesData = {
      'test': {
        installLocation: '/path',
      },
    };

    sanitizeMarketplaces(input);

    expect(input['test'].installLocation).toBe('/path');
  });

  it('should handle empty object', () => {
    const result = sanitizeMarketplaces({});
    expect(result).toEqual({});
  });
});

describe('mcpServersHaveEnv', () => {
  it('should return true when any server has env field', () => {
    expect(mcpServersHaveEnv({
      'a': { command: 'cmd', env: { KEY: 'val' } },
      'b': { command: 'cmd' },
    })).toBe(true);
  });

  it('should return false when no server has env field', () => {
    expect(mcpServersHaveEnv({
      'a': { command: 'cmd', args: [] },
    })).toBe(false);
  });

  it('should return false for empty object', () => {
    expect(mcpServersHaveEnv({})).toBe(false);
  });

  it('should handle non-object server values', () => {
    expect(mcpServersHaveEnv({
      'a': 'not-an-object' as unknown,
      'b': null as unknown,
    })).toBe(false);
  });
});
