# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**vibe-config-sync** (command: `vibe-sync`) is a CLI tool that synchronizes Claude Code (`~/.claude/`) configurations across machines via Git. It exports, imports, and diffs settings, skills, commands, agents, plugin registries, and MCP server configs between `~/.claude/` (and `~/.claude.json`) and a `~/.vibe-sync/` Git repository.

## Commands

```bash
npm run build          # Build with tsup → dist/index.js (ESM, Node 18+)
npm run dev            # Build in watch mode
npm run test           # Run all tests (vitest)
npm run test:watch     # Run tests in watch mode
npx vitest run tests/sanitize.test.ts   # Run a single test file
npm run lint           # Type-check only (tsc --noEmit), no ESLint
```

## Architecture

```
CLI (src/index.ts - Commander)
  → Commands (src/commands/*.ts)
    → Core modules (src/core/*.ts)
      → External: fs-extra, simple-git, child_process
```

**Data flow:**
- Export: `~/.claude/` → sanitize → `~/.vibe-sync/data/` → git push
- Export (MCP): `~/.claude.json` → extract `mcpServers` → `~/.vibe-sync/data/mcp-servers.json`
- Import: git pull → `~/.vibe-sync/data/` → backup → restore → `~/.claude/` (plugin JSON used as manifest only, not copied)
- Import (MCP): `~/.vibe-sync/data/mcp-servers.json` → merge new servers into `~/.claude.json` (existing servers kept)

### Key Paths (defined in `src/core/config.ts`)

| Constant | Default | Purpose |
|----------|---------|---------|
| `CLAUDE_HOME` | `~/.claude` | Source config dir (overridable via `CLAUDE_HOME` env var) |
| `CLAUDE_JSON` | `~/.claude.json` | Claude global config file containing MCP servers (overridable via `CLAUDE_JSON` env var) |
| `SYNC_DIR` | `~/.vibe-sync` | Git-backed sync repository |
| `BACKUP_BASE` | `~/.vibe-sync/backups/claude` | Timestamped backups before import |

### Core Modules

- **config.ts** — Path constants, `CLAUDE_JSON` (`~/.claude.json`), `SYNC_FILES` (`settings.json`, `CLAUDE.md`), `SYNC_DIRS` (`commands`, `agents`), `PLUGIN_FILES` (`installed_plugins.json`, `known_marketplaces.json`), `MCP_SYNC_FILE` (`mcp-servers.json`), `isInitialized()`
- **fs-utils.ts** — `copyDirClean`, `removeDsStore`, `readJsonSafe`, `writeJsonSafe`
- **git.ts** — `createGit`, `ensureGitRepo`, `commitAndPush`, `pullFromRemote` (wraps simple-git)
- **plugins.ts** — Reinstalls plugins via `claude` CLI subprocess (`spawnSync` with `stdio: 'inherit'` for progress output, 120s timeout). Reads sync'd plugin JSON as manifest (never copies sanitized files to `~/.claude/`). Skips already-installed marketplaces, plugins (by `installPath`), and enabled plugins via `ExistingPluginState`.
- **skills.ts** — Export/import skills directories; resolves symlinks to real files on export
- **sanitize.ts** — Strips machine-specific paths (`installPath`, `installLocation`) from plugin/marketplace JSON; `mcpServersHaveEnv` checks for env vars in MCP configs
- **diff.ts** — Shells out to `diff` command for status display
- **backup.ts** — Creates timestamped backup of `~/.claude/` and `~/.claude.json` before import; list/restore backups
- **validate.ts** — JSON structure validation for settings, plugins, and marketplace files before import

### Commands

- **init** — Create `~/.vibe-sync`, init git, optionally add remote
- **export** — Copy + sanitize from `~/.claude/` to sync dir; extract MCP servers from `~/.claude.json` (warns if env vars detected)
- **import** — Backup then restore from sync dir to `~/.claude/`, merge new MCP servers into `~/.claude.json`, plugins synced by default (skip with `--no-plugins`), `--dry-run` for preview
- **status** — Show diff between local and synced configs (including MCP servers)
- **push** — export + git commit + push
- **pull** — git pull + import, plugins synced by default (skip with `--no-plugins`), `--dry-run` for preview
- **restore** — List available backups or restore `~/.claude/` from a specific backup

## Tech Stack

- TypeScript strict mode, ES Modules (`"type": "module"`)
- Build: tsup (ESM, target node18, shebang injected)
- Test: Vitest with globals enabled
- CLI: Commander.js
- Git: simple-git
- FS: fs-extra

## Testing

Tests live in `tests/*.test.ts`. Vitest globals are enabled (no need to import `describe`/`it`/`expect`). Tests use temp directories with `beforeEach`/`afterEach` cleanup. Core modules `config`, `fs-utils`, `sanitize`, `skills`, `backup`, `plugins`, `validate`, `mcp` are tested; commands, `git`, `diff` are not.

## Known Issues

- `process.exit()` used in library code, making it harder to test
