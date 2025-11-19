# Jomarchy Agent Tools

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tools](https://img.shields.io/badge/Tools-28-blue)](#4-28-generic-bash-tools)
[![Commands](https://img.shields.io/badge/Commands-10-purple)](#3-agent-swarm-coordination-commands)
[![Agent Mail](https://img.shields.io/badge/Agent%20Mail-Bash%2BSQLite-green)](#1-agent-mail)
[![Beads](https://img.shields.io/badge/Beads-CLI-orange)](https://github.com/steveyegge/beads)

**Manage multiple agents across several projects in a complete AI-assisted development environment in one command.**

Agent Mail (multi-agent coordination) + Beads (task planning) + 28 bash tools + 10 coordination commands = Full swarm orchestration that transcends context windows and project boundaries.

```bash
curl -fsSL https://raw.githubusercontent.com/joewinke/jomarchy-agent-tools/main/install.sh | bash
```

---

## ⚡ Quick Start

```bash
# 1. Install (one command)
curl -fsSL https://raw.githubusercontent.com/joewinke/jomarchy-agent-tools/main/install.sh | bash

# 2. Register your agent
/register

# 3. Start working
/start
```

**First task in 60 seconds!** The installer sets up Agent Mail, Beads CLI, 28 tools, and 10 coordination commands. Your AI assistant gains swarm orchestration capabilities instantly.

---

## What Is This?

Jomarchy Agent Tools is a **self-contained AI development environment** that gives your coding assistants (Claude Code, Cursor, Aider, OpenCode, etc.) the ability to:

- **Command** agent swarms with high-level coordination primitives (/start, /complete, /handoff)
- **Coordinate** across multiple agents without conflicts (Agent Mail messaging + file locks)
- **Transcend** project folders and context window bounds with persistent state
- **Plan** work with dependency-aware task management (Beads)
- **Execute** with 28 composable bash tools (no HTTP servers, no running daemons)
- **Scale** infinitely - add agents without coordination overhead

### 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       AI Assistants                             │
│  (Claude Code, Cursor, Aider, Windsurf, Copilot, OpenCode)     │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │  Coordination Layer    │
         │  10 Slash Commands     │  /register, /start, /complete,
         │  ~/.claude/commands/   │  /handoff, /pause, /block,
         └────────┬───────────────┘  /stop, /status, /verify, /plan
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌─────────┐  ┌─────────┐  ┌──────────┐
│ Agent   │  │  Beads  │  │ 28 Tools │
│  Mail   │◄─┤   CLI   │  │  (bash)  │
└─────────┘  └─────────┘  └──────────┘
    │             │             │
    │             │             │
    ▼             ▼             ▼
Messages +    Task Queue +  Operations
File Locks    Dependencies  (db, browser, etc)
```

**How it works:**
1. **AI Assistants** use coordination commands (`/start`, `/complete`, etc.)
2. **Commands** orchestrate the three layers below
3. **Agent Mail** handles messaging and file reservation conflicts
4. **Beads** manages task queue with dependency resolution
5. **Tools** perform operations (database, browser, monitoring, etc.)

---

## Why Use This?

### The Problem

Modern AI coding assistants face three major challenges:

1. **Coordination chaos**: Multiple agents editing the same files simultaneously, no way to communicate across context windows
2. **Project isolation**: Agents trapped in single folders, can't coordinate across repositories
3. **Context amnesia**: Agents lose task state between sessions, repeat work unnecessarily

### The Solution

**Jomarchy Agent Tools breaks these boundaries:**

| Challenge | Solution | Benefit |
|-----------|----------|---------|
| Coordination chaos | Agent Mail (messaging + file reservations) | Swarm coordination without conflicts |
| Project isolation | Cross-project communication threads | Agents coordinate across repositories |
| Context amnesia | Beads (git-backed task database) | Persistent state transcends sessions |

**Real-world impact:**
- **Control agent swarms** that span multiple projects and coding assistants
- **No running services**: Just bash scripts + SQLite (32k+ token savings vs MCP servers)
- **Universal compatibility**: Works with Claude Code, Cursor, Aider, OpenCode, etc.
- **Bash composability**: Pipe, filter, and chain tools with jq, xargs, grep

---

## 🎯 Real-World Workflows

### Scenario 1: Parallel Error Remediation

**The Challenge:** 100 TypeScript errors across 20 files

**The Swarm:**
```bash
# Agent 1
/register
/start  # Auto-picks: "Fix type errors in auth/"
# ... fixes 15 errors in 8 minutes ...
/complete  # ✅ Auto-starts next: "Fix type errors in ui/"

# Agent 2 (parallel session)
/register
/start  # Gets: "Fix type errors in api/"
# ... fixes 12 errors in 6 minutes ...
/complete  # ✅ Continues to next chunk

# Agent 3 (parallel session)
/start  # Gets: "Fix type errors in lib/"
```

**Result:** All 100 errors fixed in 18 minutes across 3 agents with **zero conflicts** (file reservations prevent collisions).

### Scenario 2: Multi-Agent Feature Development

**The Challenge:** Implement Stripe payments (backend + frontend + tests)

**The Coordination:**
```bash
# Backend Agent
/start stripe-webhooks  # Implements webhook handling
# ... builds /api/webhooks/stripe endpoint ...
/complete  # ✅ Marks complete, unblocks frontend

# Frontend Agent (waits for dependency)
/start stripe-ui  # Shows as "blocked" until stripe-webhooks done
# Once unblocked, starts automatically
# ... builds PaymentForm component ...
/complete

# QA Agent
/start stripe-tests  # Depends on both tasks
# Runs integration tests across full flow
```

**Result:** Coordinated feature development with **automatic dependency resolution** and **zero rework**.

### Scenario 3: Cross-Project Coordination

**The Challenge:** Auth system spans 3 repos (backend, frontend, mobile)

**The Architecture:**
```bash
# Backend Agent (in backend repo)
am-register --project backend
/start auth-api
# ... implements JWT endpoints ...
am-send Frontend "Auth API ready: /api/auth/login"

# Frontend Agent (in frontend repo)
am-inbox Frontend  # Sees message from Backend
/start auth-ui
# ... builds login form, connects to API ...

# Mobile Agent (in mobile repo)
am-inbox Mobile  # Gets notified
/start auth-mobile
# ... implements OAuth flow ...
```

**Result:** Three agents across three repositories **coordinate via Agent Mail** with shared context and **zero miscommunication**.

---

## Installation

### One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/joewinke/jomarchy-agent-tools/main/install.sh | bash
```

This installs:
- ✅ Agent Mail (11 bash/SQLite tools: am-register, am-send, am-inbox, etc.)
- ✅ Beads CLI (`bd` command)
- ✅ 28 generic bash tools (am-*, browser-*, db-*, etc.)
- ✅ 10 coordination commands (/register, /start, /complete, /handoff, etc.)
- ✅ Optional tech stack tools (e.g., SvelteKit + Supabase with 11 additional tools)
- ✅ Global ~/.claude/CLAUDE.md configuration
- ✅ Per-repo setup (bd init, CLAUDE.md templates)

**Time:** ~2 minutes | **Requires:** Linux/macOS, curl, sqlite3, jq

---

## What Gets Installed

**System Requirements:**
- ✅ `sqlite3` (database - usually pre-installed)
- ✅ `jq` (JSON processing - `apt install jq` or `brew install jq`)
- ✅ `git` (version control)
- ✅ `bash` 4.0+ (shell scripting)

**Auto-Installed Components:**
- ✅ Agent Mail (11 bash tools + SQLite schema)
- ✅ Beads CLI (task management)
- ✅ 28 generic bash tools
- ✅ 10 coordination commands

**What You DON'T Need:**
- ❌ No HTTP servers to run
- ❌ No background daemons
- ❌ No systemd services
- ❌ No Node.js/Python runtimes
- ❌ No ports to manage
- ❌ No API keys or authentication

---

### 1. Agent Mail

**Multi-agent coordination system (bash + SQLite)**

**Database:** `~/.agent-mail.db`

**Features:**
- Agent identity management (register, whoami)
- Inbox/outbox messaging with threads
- File reservation system (prevent conflicts)
- Searchable message archives
- Human-auditable Git artifacts

**Usage:**
```bash
am-register --program claude-code --model sonnet-4.5
am-inbox AgentName --unread
am-send "Subject" "Body" --from Agent1 --to Agent2 --thread task-123
am-reserve "src/**" --agent AgentName --ttl 3600 --reason "task-123"
```

### 2. Beads CLI

**Dependency-aware task planning**

```bash
# Verify installation
bd --version
```

**Features:**
- Per-project task databases (`.beads/` directory)
- Dependency tracking (blocks/blocked-by relationships)
- Priority-based work queues
- Git-backed storage (committable tasks)
- Multi-project aggregation

**Core Commands:**
```bash
bd ready                    # Show tasks ready to work
bd create "Task title" \
  --type bug \
  --labels security,auth \
  --priority 1 \
  --description "Detailed description"
bd update task-id --status in_progress --assignee AgentName
bd close task-id --reason "Completed"
```

**Workflow Patterns:**

Create well-documented tasks with full context:
```bash
bd create "Fix OAuth authentication timeout" \
  --type bug \
  --labels security,auth,urgent \
  --priority 1 \
  --description "Users experience timeout when logging in via OAuth. Need to investigate token refresh logic and increase timeout threshold." \
  --assignee "AgentName"
```

Set up task dependencies:
```bash
# Create task with dependency
bd create "Add logout button" \
  --type feature \
  --labels ui \
  --priority 2 \
  --deps task-123  # Blocks on auth implementation

# Task won't show in `bd ready` until task-123 is closed
```

Integrate with Agent Mail (use task IDs as thread IDs):
```bash
# Reserve files for task
am-reserve "src/auth/**" --agent AgentName --ttl 3600 --reason "task-123"

# Send progress updates
am-send "[task-123] Progress Update" "Implemented token refresh logic." \
  --from AgentName --thread task-123

# Close task and release
bd close task-123 --reason "Completed"
am-release "src/auth/**" --agent AgentName
```


### 3. Agent Swarm Coordination Commands

**10 slash commands** installed to `~/.claude/commands/agent/` that enable sophisticated multi-agent orchestration:

```
~/.claude/commands/agent/
├── register.md    - Bootstrap agent identity
├── start.md       - Smart task start (context-aware, conflict-free)
├── complete.md    - Finish + verify + auto-continue
├── status.md      - Sync state without starting work
├── handoff.md     - Transfer work with full context
├── pause.md       - Temporarily stop, release resources
├── block.md       - Mark blocked, coordinate with team
├── stop.md        - Smart routing (pause/block/handoff)
├── verify.md      - Quality checks before completion
└── plan.md        - Convert planning docs to Beads tasks
```

#### Command Categories

**Core Workflow (3 commands):**
- `/register` - Bootstrap session (agent identity + task review)
- `/start` - Begin work (context-aware, conflict detection, auto-select)
- `/complete` - Finish work (verify, commit, auto-continue to next)

**Coordination (5 commands):**
- `/status` - Check state, sync with team, update presence
- `/handoff` - Transfer ownership with full context package
- `/pause` - Temporarily stop without completing
- `/block` - Mark blocked, notify team, release resources
- `/stop` - Smart routing based on reason analysis

**Quality & Planning (2 commands):**
- `/verify` - Pre-completion checks (tests, lint, browser, security)
- `/plan` - Convert planning documents to structured Beads tasks

#### How Commands Work

Commands are **markdown files with instructions** that Claude Code executes:
- Located in `~/.claude/commands/agent/`
- Invoked with `/command-name` in Claude Code
- Expand to full prompts with step-by-step coordination logic
- Leverage bash tools (am-*, bd, browser-*) under the hood
- Provide structured output with visual progress indicators

#### Example: Continuous Agent Workflow

**Single agent, continuous flow:**

```bash
# Start session
/register
# → Registers with Agent Mail
# → Reviews available tasks from Beads
# → Shows inbox messages

# Start highest priority task
/start
# → Context-aware: Creates task from conversation if discussed
# → Conflict checks: File locks, git, inbox, task status
# → Reserves files, announces start
# → BEGINS WORKING IMMEDIATELY

# ... work happens (write code, test, document) ...

# Complete and auto-continue
/complete
# → Runs /verify (tests, lint, security)
# → Commits changes, updates docs
# → Releases file reservations
# → Marks task complete in Beads
# → AUTO-STARTS NEXT TASK (continuous flow)

# ... next task starts automatically ...

# Complete and stop for the day
/complete stop
# → Completes current task
# → Shows available tasks but DOESN'T auto-start
# → Agent session ends cleanly
```

**Key insight:** `/complete` creates a **continuous flow** by automatically starting the next highest-priority task. Agents never sit idle!

#### Example: Multi-Agent Coordination

**3 agents working in parallel on a feature:**

```bash
# Agent 1: BlueLake (Backend API)
/register
/start
# → Picks "Build user profile API endpoints" (highest priority)
# → Reserves src/routes/api/profile/**
# → Announces in Agent Mail thread
# ... implements API routes ...
/complete
# → Auto-starts "Add profile validation logic"

# Agent 2: GreenCastle (Frontend UI)
/register
/start
# → Picks "Build profile edit form" (P1, no blockers)
# → Reserves src/routes/account/profile/**
# → Checks: No conflicts with BlueLake's API files
# ... builds Svelte components ...
/block "waiting for API completion"
# → Releases reservations
# → Notifies BlueLake via Agent Mail

# Agent 3: RedMountain (Testing)
/register
/start profile-tests
# → Starts specific task (parallel track)
# → Reserves tests/profile/**
# ... writes integration tests ...
/handoff RedMountain "need E2E expertise"
# → Packages work state (what's done, what remains)
# → Sends comprehensive handoff message
# → Releases reservations

# All agents coordinate via Agent Mail:
# - Thread ID = task ID (e.g., "profile-feature-123")
# - File reservations prevent conflicts
# - Messages enable async collaboration
# - Beads tracks dependencies and completion
```

#### Architecture: How Commands Orchestrate the Swarm

```
┌─────────────────────────────────────────────┐
│  User Input                                 │
│  /register /start /complete /handoff        │
└────────────┬────────────────────────────────┘
             │
             │ Expands to step-by-step prompts
             │
┌────────────▼────────────────────────────────┐
│  Coordination Commands (10 .md files)       │
│  • Context-aware task selection             │
│  • Conflict detection logic                 │
│  • State synchronization                    │
│  • Handoff packaging                        │
└────────┬───────────────────┬────────────────┘
         │                   │
         │ Executes via...   │
         │                   │
┌────────▼────────┐  ┌───────▼────────────────┐
│  Bash Tools     │  │  Agent Mail + Beads    │
│  (28 tools)     │  │  State & Coordination  │
│  am-*, bd,      │  │  • File locks          │
│  browser-*      │  │  • Message threads     │
│                 │  │  • Task queue          │
│                 │  │  • Dependency tracking │
└─────────────────┘  └────────────────────────┘
```

**Key Benefits:**

1. **🌊 Continuous Flow** - `/complete` auto-starts next task → agents never idle
2. **🤝 Seamless Handoffs** - Full context transfer between agents
3. **🛡️ Conflict-Free** - File reservations + checks prevent collisions
4. **📈 Infinite Scale** - Add agents without coordination overhead
5. **🔄 Persistent State** - Work survives context window resets
6. **🎯 Smart Selection** - Context-aware task matching from conversation
7. **⚡ Bulk Parallelization** - Deploy 60+ agents for massive remediation tasks


### 4. 28 Generic Bash Agent Tools

**Location:** `~/.local/bin/` (globally available)

**Philosophy:** Following [What if you don't need MCP?](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/) by Mario Zechner - lightweight bash tools provide instant capability without MCP overhead. Clear, fast, composable.

#### Agent Mail Tools (11)
- `am-register` - Register agent identity
- `am-inbox` - Check inbox (--unread, --json)
- `am-send` - Send messages with threads
- `am-reply` - Reply to thread
- `am-ack` - Acknowledge messages
- `am-reserve` - Reserve files (prevent conflicts)
- `am-release` - Release file reservations
- `am-reservations` - List active reservations
- `am-search` - Search message archives
- `am-agents` - List all agents
- `am-whoami` - Show current agent identity

#### Browser Automation Tools (11)
Based on [badlogic/browser-tools](https://github.com/badlogic/browser-tools)

**Core Tools (7):**
- `browser-start.js` - Start Chrome with remote debugging
- `browser-nav.js` - Navigate to URL
- `browser-eval.js` - Execute JavaScript
- `browser-screenshot.js` - Capture screenshots
- `browser-pick.js` - Interactive element picker
- `browser-cookies.js` - Manage cookies
- `browser-hn-scraper.js` - Example scraper

**Advanced Tools (4):**
- `browser-wait.js` - Smart waiting with CDP polling (eliminates race conditions)
- `browser-snapshot.js` - Structured page tree (1000x token savings: 5KB vs 5MB)
- `browser-console.js` - Structured console access (debug JS errors with stack traces)
- `browser-network.js` - Network request monitoring (API testing with timing metrics)

#### Database & Utility Tools (6)

**Database (4):**
- `db-query` - Execute SQL with automatic safety limits
- `db-connection-test` - Test database connectivity
- `db-schema` - View database schema
- `db-sessions` - Check active database sessions

**Utilities (2):**
- `edge-logs` - View Supabase edge function logs
- `lint-staged` - Lint only staged git files

**All tools have `--help` flags:**
```bash
am-inbox --help
browser-eval.js --help
db-query --help
```

### 5. Optional Tech Stack Tools

During installation, you can select additional **tech-stack-specific tools** via an interactive menu (requires [gum](https://github.com/charmbracelet/gum)):

#### SvelteKit + Supabase Stack (11 tools)

**Database Schema Tools (3):**
- `error-log` - Query error logs (assumes `error_logs` table)
- `quota-check` - Check AI usage quotas (assumes `ai_usage_logs` table)
- `job-monitor` - Monitor background jobs

**SvelteKit-Specific (2):**
- `component-deps` - Analyze Svelte component dependencies
- `route-list` - List all SvelteKit routes

**Project Development (6):**
- `migration-status` - Check Supabase migration status
- `type-check-fast` - Fast TypeScript type checking
- `build-size` - Analyze bundle sizes
- `cache-clear` - Clear application caches
- `env-check` - Validate environment variables
- `perf-check` - Performance analysis

**When to use stacks:**
- You're using SvelteKit + Supabase + TypeScript
- You want project-specific tooling (schema-aware queries, component analysis)
- You want to avoid duplicating tools across multiple projects with the same stack

**Manual installation:**
```bash
# If you skip during install, you can add stacks later:
bash ~/code/jomarchy-agent-tools/stacks/sveltekit-supabase/install.sh
```

**Documentation:**
See `stacks/sveltekit-supabase/README.md` for detailed stack documentation.

### 6. Global Configuration

**File:** `~/.claude/CLAUDE.md`

The installer **appends** comprehensive instructions to your global `~/.claude/CLAUDE.md` file. This "prompt injection" is fully transparent and auditable.

**What gets appended:**
- 🤖 Agent Swarm Coordination Commands (10 slash commands)
- 📬 Agent Mail (coordination patterns, macros, pitfalls)
- 📋 Beads Integration (workflow conventions, task mapping)
- 🛠️ Agent Tools (28 bash tools with examples)

**View the exact content:** [`scripts/setup-global-claude-md.sh`](scripts/setup-global-claude-md.sh#L53-L383) (lines 53-383)

**Automatically loaded by AI assistants in all projects.** This gives every agent access to coordination primitives without consuming your context window.

### 7. Per-Repository Setup

For each git repository in `~/code/*`:

1. **Initializes Beads:**
   - Creates `.beads/` directory
   - Installs git hooks (pre-commit, merge driver)
   - Sets up project-specific issue prefix

2. **Creates/Updates CLAUDE.md:**
   - Project-specific documentation template
   - Agent tools configuration section
   - Quick start guide for AI assistants

**Example scenario: 60 agents fixing 1,231 TypeScript errors in 18 minutes** (via `/start` detecting bulk remediation pattern and deploying agent swarm automatically)

---

## How It Works

### Multi-Project Architecture

Each project gets its own `.beads/` database, while Chimaro's development dashboard aggregates all projects:

```
~/code/
├── project-a/
│   ├── .beads/              # Project A tasks
│   └── CLAUDE.md            # Project A docs
├── project-b/
│   ├── .beads/              # Project B tasks
│   └── CLAUDE.md            # Project B docs
└── chimaro/
    └── /account/development/beads
        # 👆 Unified dashboard showing ALL tasks
```

**Benefits:**
- ✅ Clean separation (each project's tasks committable to its repo)
- ✅ Single dashboard view (filter by project, status, priority)
- ✅ Context-aware (`bd` commands work in current project)
- ✅ Visual distinction (color-coded ID badges show project)

### Workflow Example

```bash
# 1. Pick work (Beads)
cd ~/code/myproject
bd ready --json          # Shows tasks ready to work

# 2. Register with Agent Mail
am-register --program claude-code --model sonnet-4.5

# 3. Reserve files (prevent conflicts)
am-reserve "src/**/*.ts" \
  --agent AgentName \
  --ttl 3600 \
  --exclusive \
  --reason "task-123: Implementing auth"

# 4. Update task status
bd update task-123 --status in_progress --assignee AgentName

# 5. Announce start (optional - for team coordination)
am-send "[task-123] Starting: Auth implementation" \
  "Working on OAuth flow..." \
  --from AgentName \
  --thread task-123

# 6. Work on code...

# 7. Complete and release
bd close task-123 --reason "Completed: OAuth flow implemented"
am-release "src/**/*.ts" --agent AgentName
```

---

## Usage Examples

### Bash Composability

One of the major advantages of bash tools - pipe, filter, and chain:

```bash
# Chain tools with pipes
am-inbox AgentName --unread --json | jq '.[] | select(.importance=="urgent")'

# Bulk operations
am-inbox AgentName --unread --json | jq -r '.[].id' | \
  xargs -I {} am-ack {} --agent AgentName

# Conditional logic
if am-reservations --agent AgentName | grep -q "src/auth"; then
  echo "Already working on auth"
else
  am-reserve "src/auth/**" --agent AgentName --ttl 3600
fi
```

### Browser Automation

```bash
# Start browser and test UI
browser-start.js --remote-debugging-port 9222
browser-nav.js "http://localhost:3000"
browser-eval.js 'document.querySelector("button").click()'

# Capture screenshot for verification
screenshot=$(browser-screenshot.js)
echo "Screenshot saved: $screenshot"

# Smart waiting (eliminates race conditions)
browser-wait.js --selector ".success-message" --timeout 5000

# Get structured page snapshot (1000x token savings vs screenshots!)
browser-snapshot.js > page-state.json
```

### Git Integration

```bash
# Include task IDs in commits (for traceability)
git commit -m "feat: implement OAuth login (task-123)"

# Pre-commit hook checks reservations automatically (installed by bd init)
```

---

## AI Assistant Integration

### With Claude Code

Claude Code automatically reads `~/.claude/CLAUDE.md` and project `CLAUDE.md` files.

**No additional configuration needed!**

```bash
# Just start Claude in your project
cd ~/code/myproject
claude-code
```

Claude will:
- See available agent tools
- Know about Beads task management
- Understand Agent Mail coordination
- Follow project-specific patterns

### With Cursor

Add to Cursor's settings (`.cursorrules`):

```markdown
# Agent Tools Available

See ~/.claude/CLAUDE.md for full documentation.

Quick reference:
- Task management: bd ready, bd create, bd update
- Agent coordination: am-register, am-reserve, am-inbox
- Browser testing: browser-*.js tools
```

### With Aider

Aider can use bash tools directly:

```bash
aider --message "Check beads for ready tasks" --yes-always
# Aider will run: bd ready --json
```

### With OpenCode

OpenCode reads the same CLAUDE.md files as Claude Code:

```bash
cd ~/code/myproject
opencode
```


---

## Requirements

- **OS:** Linux or macOS
- **Shell:** Bash
- **Tools:** curl, git
- **Optional:** Node.js (for browser automation tools)
- **Optional:** Chrome/Chromium (for browser testing)

---

## Architecture

### Components

```
┌─────────────────────────────────────────────┐
│  AI Assistants                              │
│  (Claude Code, Cursor, Aider, OpenCode)     │
└────────────┬────────────────────────────────┘
             │
             │ Read ~/.claude/CLAUDE.md
             │ Read project CLAUDE.md
             │
┌────────────▼────────────────────────────────┐
│  Bash Tools (28+ scripts in ~/.local/bin)   │
│  • 28 generic tools (am-*, browser-*, db-*) │
│  • Optional stack tools (11+ per stack)     │
└────────┬───────────────────┬────────────────┘
         │                   │
         ▼                   ▼
┌────────────────┐  ┌────────────────────────┐
│  Agent Mail    │  │  Beads CLI (bd)        │
│  Server        │  │  • Local .beads/ DB    │
│  :3141         │  │  • Git-backed          │
│  • Messaging   │  │  • Per-project         │
│  • File locks  │  └────────────────────────┘
└────────────────┘
```

### Directory Layout

```
~/.claude/
└── CLAUDE.md                    # Global agent instructions

~/.local/bin/
├── am-register                  # Agent Mail tools (12)
├── am-inbox
├── browser-start.js            # Browser tools (7)
├── browser-eval.js
└── ...                         # Additional tools (24)

~/code/myproject/
├── .beads/                     # Per-project task database
│   ├── beads.db               # SQLite database
│   └── beads.base.jsonl       # Git-committable backup
├── CLAUDE.md                   # Project-specific docs
└── ...                         # Your code
```

---

## Unified Dashboard (Chimaro)

If you have Chimaro installed, you get a web-based dashboard that aggregates tasks from all projects:

**URL:** `http://localhost:5173/account/development/beads` (when Chimaro is running)

**Features:**
- View tasks across all ~/code/* projects
- Filter by project, status, priority, assignee, type, labels
- Color-coded ID badges show project at a glance
- Inline editing (update status, priority, assignee)
- Create new tasks via web UI
- Return completed tasks to queue

---

## Troubleshooting

### Agent Mail Not Running

```bash
# Check status
systemctl --user status agent-mail

# Start manually
systemctl --user start agent-mail

# Enable at boot
systemctl --user enable agent-mail

# Check logs
journalctl --user -u agent-mail -f
```

### Beads Command Not Found

```bash
# Check if bd is in PATH
which bd

# If not found, restart shell
source ~/.bashrc

# Or add to PATH manually
export PATH="$HOME/.local/bin:$PATH"
```

### Tools Not Found

```bash
# Check if tools are symlinked
ls -la ~/.local/bin/am-*

# Re-run symlink setup
bash ~/code/jomarchy-agent-tools/scripts/symlink-tools.sh
```

### Per-Repo Setup Didn't Run

```bash
# Manually run per-repo setup
bash ~/code/jomarchy-agent-tools/scripts/setup-repos.sh
```

---

## Uninstallation

```bash
# Stop Agent Mail
systemctl --user stop agent-mail
systemctl --user disable agent-mail

# Remove Beads CLI
# (Method depends on how it was installed - see Beads docs)

# Remove symlinked tools
rm ~/.local/bin/am-*
rm ~/.local/bin/browser-*.js

# Remove global config (optional)
rm ~/.claude/CLAUDE.md

# Remove per-repo configs (optional)
# Manually delete .beads/ directories and CLAUDE.md from projects
```

---

## Contributing

This project combines:
- **Agent Mail Server:** [Dicklesworthstone/mcp_agent_mail](https://github.com/Dicklesworthstone/mcp_agent_mail)
- **Beads CLI:** [steveyegge/beads](https://github.com/steveyegge/beads)
- **Browser Tools:** [badlogic/browser-tools](https://github.com/badlogic/browser-tools)

Contributions welcome! Please open issues or PRs.

---

## ❓ FAQ

### How is this different from MCP servers?

**Key differences:**

| Feature | JAT (Bash Tools) | MCP Servers |
|---------|------------------|-------------|
| **Token cost** | ~400 tokens | 32,000+ tokens |
| **Startup time** | Instant | 2-5 seconds |
| **Composability** | Full bash (pipes, jq, xargs) | Limited |
| **Compatibility** | All CLIs (Claude, Cursor, Aider, etc.) | MCP-specific |
| **Maintenance** | Simple shell scripts | Complex server processes |

**JAT = 80x token reduction with universal compatibility.**

### Can I use this with Cursor/Aider/Windsurf/Copilot?

**Yes!** JAT works with **any** AI coding assistant:

- ✅ **Claude Code** - Native integration (10 slash commands + MCP)
- ✅ **Cursor** - Bash tools work directly
- ✅ **Aider** - Bash tools work directly
- ✅ **Windsurf** - Bash tools + MCP config provided
- ✅ **GitHub Copilot** - Bash tools + MCP config provided
- ✅ **OpenCode** - Native integration (bash + MCP)
- ✅ **Codex CLI** - Full integration

**The bash tools work everywhere.** MCP integration is optional for advanced features.

### Can I use tools without swarm mode?

**Absolutely!** JAT tools work standalone:

```bash
# Use tools directly without any coordination
db-query "SELECT * FROM users LIMIT 10"
am-inbox AgentName --unread
browser-screenshot.js > /tmp/page.png

# Or with simple bash composition
am-inbox AgentName --json | jq '.[] | select(.importance=="urgent")'
```

**You don't need Agent Mail, Beads, or coordination commands to use the 28 tools.**

### How do I coordinate across multiple repositories?

**Agent Mail supports cross-repo coordination:**

**Option A: Shared project key** (same team, different repos)
```bash
# In backend repo
am-register --project "acme-platform"
/start api-authentication

# In frontend repo
am-register --project "acme-platform"  # Same key!
am-inbox Frontend  # Sees messages from backend
```

**Option B: Separate projects** (different teams)
```bash
# Contact handshake between projects
am-contact BackendTeam --from FrontendTeam
# Now they can message each other
```

### What happens if two agents edit the same file?

**File reservations prevent conflicts:**

1. **Agent 1** runs `/start auth-refactor`
   - Reserves `src/auth/**` for 1 hour
   - Works safely

2. **Agent 2** runs `/start auth-tests`
   - Tries to reserve `src/auth/**`
   - Gets `FILE_RESERVATION_CONFLICT`
   - Either waits or picks different work

**Advisory locks = zero collisions.**

### How do I add custom tools?

**Just add bash scripts to the tools directory:**

```bash
cd ~/code/jomarchy-agent-tools/tools
cat > my-custom-tool <<'EOF'
#!/bin/bash
# Your tool logic here
echo "Hello from custom tool"
EOF
chmod +x my-custom-tool

# Now available everywhere
my-custom-tool
```

**JAT auto-discovers any executable in `tools/`.**

### Does this work offline?

**Partially:**

- ✅ **Tools work offline** (db-query, browser-*, local operations)
- ✅ **Beads works offline** (git-backed, no network needed)
- ❌ **Agent Mail requires server** (but can self-host locally)

**Most functionality works without internet.**

### How do I update to the latest version?

```bash
cd ~/code/jomarchy-agent-tools
git pull origin main

# Re-run setup if commands/tools changed
bash scripts/setup-global-claude-md.sh

# Restart Agent Mail if needed
systemctl --user restart agent-mail
```

**Updates are git-pull simple.**

---

## 🔧 Troubleshooting

### Agent Mail Server Not Responding

**Symptoms:** Commands timeout, tools fail with connection errors

**Solution:**
```bash
# Check if server is running
systemctl --user status agent-mail

# If not running, start it
systemctl --user start agent-mail

# View logs
journalctl --user -u agent-mail -f

# If still failing, restart
systemctl --user restart agent-mail
```

### FILE_RESERVATION_CONFLICT Error

**Symptoms:** `/start` or `am-reserve` fails with conflict error

**Cause:** Another agent has locked the files you need

**Solutions:**

1. **Check who has the lock:**
   ```bash
   am-reservations --all
   # Shows: Agent "BackendDev" has src/api/** until 14:30
   ```

2. **Options:**
   - **Wait:** Files auto-release after TTL expires
   - **Work elsewhere:** `/start` picks different task
   - **Coordinate:** `am-send BackendDev "Need src/api/auth.ts"`
   - **Override (last resort):** `am-release src/api/** --force` (if agent is stale)

3. **Prevent conflicts:**
   - Reserve narrower patterns (not `**/*`)
   - Use shorter TTLs (not 24 hours)
   - Coordinate via Agent Mail before starting

### Tools Not in PATH

**Symptoms:** `bash: am-inbox: command not found`

**Solution:**
```bash
# Add to ~/.bashrc
echo 'export PATH="$HOME/code/jomarchy-agent-tools/tools:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Verify
which am-inbox
# Should show: /home/user/code/jomarchy-agent-tools/tools/am-inbox
```

### Beads Not Initialized

**Symptoms:** `Error: no beads database found`

**Solution:**
```bash
# Initialize in your project
cd ~/code/your-project
bd init

# Answer prompts:
# - Install git hooks? Y
# - Configure merge driver? Y
```

### Commands Not Working (/start, /register, etc.)

**Symptoms:** `/start` not recognized or does nothing

**Cause:** Commands not installed in `~/.claude/commands/agent/`

**Solution:**
```bash
# Re-run global setup
cd ~/code/jomarchy-agent-tools
bash scripts/setup-global-claude-md.sh

# Verify installation
ls ~/.claude/commands/agent/
# Should show: register.md, start.md, complete.md, etc.
```

### Browser Tools Fail (Chrome Not Found)

**Symptoms:** `browser-start.js` fails with "Chrome not found"

**Solution:**
```bash
# Linux: Install Chrome/Chromium
sudo apt install chromium-browser  # Debian/Ubuntu
sudo pacman -S chromium             # Arch

# macOS: Install Chrome
brew install --cask google-chrome

# Set custom Chrome path
export CHROME_PATH="/path/to/chrome"
```

### Database Connection Errors (db-query fails)

**Symptoms:** `db-query` fails with connection timeout

**Cause:** Missing or invalid DATABASE_URL environment variable

**Solution:**
```bash
# Check current value
echo $DATABASE_URL

# Set in ~/.bashrc or project .env
export DATABASE_URL="postgresql://user:pass@host:5432/db"

# Test connection
db-connection-test
```

---

## License

MIT License - See individual component licenses:
- Agent Mail: [License](https://github.com/Dicklesworthstone/mcp_agent_mail/blob/main/LICENSE)
- Beads: [License](https://github.com/steveyegge/beads/blob/main/LICENSE)
- Browser Tools: [License](https://github.com/badlogic/browser-tools/blob/main/LICENSE)

---

## Credits

- **Agent Mail:** Created by [@Dicklesworthstone](https://github.com/Dicklesworthstone)
- **Beads:** Created by [@steveyegge](https://github.com/steveyegge)
- **Browser Tools:** Created by [@badlogic](https://github.com/badlogic)
- **Tools > MCP:** Inspired by [Mario Zechner's "What if you don't need MCP?"](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/)
- **Integration:** Assembled by [@joewinke](https://github.com/joewinke) for [Jomarchy](https://github.com/joewinke/jomarchy)

---

## Related Projects

- **Jomarchy:** [github.com/joewinke/jomarchy](https://github.com/joewinke/jomarchy) - Omarchy Linux configuration system
- **Chimaro:** AI-powered application platform with unified Beads dashboard
- **Agent Mail:** [github.com/Dicklesworthstone/mcp_agent_mail](https://github.com/Dicklesworthstone/mcp_agent_mail)
- **Beads:** [github.com/steveyegge/beads](https://github.com/steveyegge/beads)
- **Browser Tools:** [github.com/badlogic/browser-tools](https://github.com/badlogic/browser-tools)

---

**Built for AI-assisted development. Works with every AI coding assistant.**

**[Install Now](#quick-start)** | **[Report Issue](https://github.com/joewinke/jomarchy-agent-tools/issues)** | **[Contribute](https://github.com/joewinke/jomarchy-agent-tools/pulls)**
