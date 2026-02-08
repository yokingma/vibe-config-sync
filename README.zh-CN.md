# vibe-config-sync

[English](README.md) | **中文文档**

> **命令：** `vibe-sync`

通过 Git 跨机器同步 AI 编程工具配置。目前支持 Claude Code（`~/.claude/`）。

## 问题

在多台机器上使用 AI 编程工具时，技能、命令、代理、插件和用户偏好等配置需要在每台机器上手动复制。

## 同步内容

| 内容 | 说明 |
|------|------|
| `settings.json` | 插件启用/禁用标志 |
| `CLAUDE.md` | 用户偏好和工作流指南 |
| `skills/` | 技能定义（SKILL.md + 引用 + 模板） |
| `commands/` | 自定义斜杠命令 |
| `agents/` | 代理定义 |
| `plugins/installed_plugins.json` | 插件注册表（已剥离机器路径） |
| `plugins/known_marketplaces.json` | 插件市场来源（已剥离机器路径） |

**不同步**（机器特定 / 临时 / 大文件）：`plugins/cache/`、`projects/`、`telemetry/`、`session-env/`、`plans/`、`todos/`、`debug/`、`history.jsonl` 等。

## 前置条件

- Node.js 18+
- `git`
- `claude` CLI（用于插件同步；随 Claude Code 自动安装）

## 安装

```bash
npm install -g vibe-config-sync
```

## 快速开始

### 机器 A（首次设置）

```bash
vibe-sync init          # 初始化并连接 Git 远程仓库
vibe-sync push          # 导出配置并推送到远程仓库
```

### 机器 B（导入）

```bash
vibe-sync init                      # 初始化并从远程仓库拉取
vibe-sync pull                      # 拉取、导入配置并同步插件
vibe-sync pull --no-plugins         # 仅拉取和导入配置（跳过插件）
```

## 命令

| 命令 | 说明 |
|------|------|
| `vibe-sync init` | 初始化同步仓库并连接 Git 远程仓库 |
| `vibe-sync export` | 从 `~/.claude/` 收集配置到同步仓库 |
| `vibe-sync import` | 从同步仓库恢复配置到 `~/.claude/`（包含插件同步） |
| `vibe-sync import --no-plugins` | 仅恢复配置，跳过插件同步 |
| `vibe-sync import --dry-run` | 预览将要导入的内容，不实际执行 |
| `vibe-sync status` | 显示本地与同步配置之间的差异 |
| `vibe-sync push` | export + git commit + git push |
| `vibe-sync pull` | git pull + import（包含插件同步） |
| `vibe-sync pull --no-plugins` | git pull + import，跳过插件同步 |
| `vibe-sync pull --dry-run` | 预览将要导入的内容（跳过 git pull） |
| `vibe-sync restore` | 列出可用备份 |
| `vibe-sync restore <timestamp>` | 从指定备份恢复 `~/.claude/` |

## 日常工作流

```bash
# 在机器 A 上修改配置后
vibe-sync push

# 在机器 B 上拉取最新配置
vibe-sync pull
```

## 工作原理

- **导出**：将配置文件复制到 `~/.vibe-sync/data/`，同时从插件 JSON 文件中剥离机器特定路径。符号链接的技能会被解析并复制其实际内容。

- **导入**：从 `~/.vibe-sync/data/` 恢复文件到 `~/.claude/`，在覆盖前验证 JSON 结构。插件 JSON 文件仅作为清单使用（不会直接复制）—— `claude` CLI 负责安装插件并写入包含本地路径的正确注册文件。已安装的插件会被检测并跳过。

- **备份**：每次导入前自动在 `~/.vibe-sync/backups/claude/<timestamp>/` 创建备份。使用 `vibe-sync restore` 列出或恢复备份。

## 同步策略

整体策略为**最后写入优先，无冲突检测**。没有字段级合并——最近一次导入会覆盖目标。

### 文件（`settings.json`、`CLAUDE.md`）

整文件覆盖。同步仓库版本完全替换本地版本。

### 目录（`skills/`、`commands/`、`agents/`）

目录级合并 + 文件级覆盖：

| 场景 | 行为 |
|------|------|
| 仓库有 `skills/foo/`，本地没有 | `foo/` 被添加 |
| 双方都有 `skills/foo/SKILL.md` | 仓库版本覆盖本地 |
| 本地有 `skills/bar/`，仓库没有 | `bar/` 被**保留**（不删除） |
| 仓库的 `skills/foo/` 缺少本地有的文件 | 本地文件被**保留** |

简而言之：新内容会被添加，已有内容会被覆盖，但本地内容不会被删除。

### 符号链接技能

- **导出**：通过 `realpathSync` 解析符号链接并复制实际文件内容——符号链接本身不会被保留
- **导入**：作为普通目录复制，无需重建符号链接。这确保了技能在不同机器上都能正常工作，不受原始符号链接目标路径的影响

### 插件 JSON

插件 JSON 文件（`installed_plugins.json`、`known_marketplaces.json`）在导出时会剥离机器特定路径。导入时**不会**复制到 `~/.claude/plugins/`——而是作为清单使用。`claude` CLI 被调用来安装每个插件，并在安装过程中写入包含本地路径的正确注册文件。已安装的插件（通过 `installPath` 检测）会被跳过，以避免冗余的网络操作。

### 实际影响

- 如果两台机器修改了不同的配置然后同步，最后执行 `import` 的机器会丢失其本地更改（可在 `~/.vibe-sync/backups/claude/` 找到带时间戳的备份进行手动恢复）
- 在一台机器上删除的文件/技能**不会**在另一台机器上被删除——只有添加和修改会传播
- 符号链接的技能会被解析并作为普通目录复制，因此同步版本是独立于原始符号链接目标的独立快照

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CLAUDE_HOME` | 覆盖 Claude 配置目录 | `~/.claude` |

## 许可证

MIT
