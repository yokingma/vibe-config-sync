export interface PluginsData {
  version?: number;
  plugins?: Record<string, PluginEntry[]>;
}

export interface PluginEntry {
  scope?: string;
  version?: string;
  installedAt?: string;
  lastUpdated?: string;
  installPath?: string;
  [key: string]: unknown;
}

export interface MarketplaceEntry {
  source?: {
    source: string;
    repo?: string;
    url?: string;
  };
  installLocation?: string;
  lastUpdated?: string;
  [key: string]: unknown;
}

export type MarketplacesData = Record<string, MarketplaceEntry>;

export function sanitizePlugins(data: PluginsData): PluginsData {
  const result = structuredClone(data);
  for (const entries of Object.values(result.plugins ?? {})) {
    for (const entry of entries) {
      delete entry.installPath;
    }
  }
  return result;
}

export function sanitizeMarketplaces(
  data: MarketplacesData,
): MarketplacesData {
  const result = structuredClone(data);
  for (const entry of Object.values(result)) {
    delete entry.installLocation;
  }
  return result;
}
