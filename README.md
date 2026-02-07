# vibe-config-sync

> **Command:** `vibe-sync`

Sync AI coding tool configurations across machines via Git. Currently supports Claude Code (`~/.claude/`).

## Problem

When using AI coding tools on multiple machines, configurations like skills, commands, agents, plugins, and user preferences need to be manually replicated on each machine.

## What Gets Synced

| Content | Description |
|---------|-------------|
| `settings.json` | Plugin enable/disable flags |
| `CLAUDE.md` | User preferences and workflow guidelines |
| `skills/` | Skill definitions (SKILL.md + references + templates) |
| `commands/` | Custom slash commands |
| `agents/` | Agent definitions |
| `plugins/installed_plugins.json` | Plugin registry (machine paths stripped) |
| `plugins/known_marketplaces.json` | Plugin marketplace sources (machine paths stripped) |

**Not synced** (machine-specific / ephemeral / large): `plugins/cache/`, `projects/`, `telemetry/`, `session-env/`, `plans/`, `todos/`, `debug/`, `history.jsonl`, etc.

## Prerequisites

- Node.js 18+
- `git`
- `claude` CLI (only needed for `--reinstall-plugins`)

## Installation

```bash
npm install -g vibe-config-sync
```

## Quick Start

### Machine A (first time setup)

```bash
vibe-sync init          # Initialize and connect to a Git remote
vibe-sync push          # Export configs and push to remote
```

### Machine B (import)

```bash
vibe-sync init                      # Initialize and pull from remote
vibe-sync pull                      # Pull and import configs
vibe-sync pull --reinstall-plugins  # Pull, import, and reinstall plugins
```

## Commands

| Command | Description |
|---------|-------------|
| `vibe-sync init` | Initialize sync repository and connect to Git remote |
| `vibe-sync export` | Collect configs from `~/.claude/` into sync repo |
| `vibe-sync import` | Restore configs from sync repo to `~/.claude/` |
| `vibe-sync import --reinstall-plugins` | Restore + reinstall all plugins |
| `vibe-sync status` | Show diff between local and synced configs |
| `vibe-sync push` | export + git commit + git push |
| `vibe-sync pull` | git pull + import |
| `vibe-sync pull --reinstall-plugins` | git pull + import + reinstall all plugins |

## Daily Workflow

```bash
# After changing configs on Machine A
vibe-sync push

# On Machine B, pull latest
vibe-sync pull
```

## How It Works

- **Export** copies config files into `~/.vibe-sync/data/`, stripping machine-specific paths from plugin JSON files. Skills that are symlinks are resolved and their actual contents are copied.

- **Import** restores files from `~/.vibe-sync/data/` to `~/.claude/`, and optionally reinstalls plugins via `claude plugin install`.

- **Backup** is created automatically at `~/.vibe-sync/backups/claude/<timestamp>/` before every import.

## Sync Strategy

The overall strategy is **last-write-wins with no conflict detection**. There is no field-level merge — the most recent import overwrites the target.

### Files (`settings.json`, `CLAUDE.md`)

Whole-file overwrite. The sync repo version replaces the local version entirely.

### Directories (`skills/`, `commands/`, `agents/`)

Directory-level merge + file-level overwrite:

| Scenario | Behavior |
|----------|----------|
| Repo has `skills/foo/`, local does not | `foo/` is added |
| Both have `skills/foo/SKILL.md` | Repo version overwrites local |
| Local has `skills/bar/`, repo does not | `bar/` is **kept** (not deleted) |
| Repo's `skills/foo/` is missing a file that local has | Local file is **kept** |

In short: new content is added, existing content is overwritten, but nothing is deleted from the local side.

### Symlinked Skills

- **Export**: symlinks are resolved via `realpathSync` and the actual file contents are copied — the symlink itself is not preserved
- **Import**: copied as regular directories, no symlink recreation needed. This ensures skills work across machines regardless of the original symlink target path

### Plugin JSON

Whole-file overwrite, same as `settings.json`. No key-level merge between local and repo versions.

### What This Means in Practice

- If both machines modify different configs and then sync, the machine that runs `import` last will lose its local changes (a timestamped backup exists at `~/.vibe-sync/backups/claude/` for manual recovery)
- Deleted files/skills on one machine will **not** be deleted on the other — only additions and modifications propagate
- Symlinked skills are resolved and copied as regular directories, so the synced version is a standalone snapshot independent of the original symlink target

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_HOME` | Override Claude config directory | `~/.claude` |

## License

MIT
