# Jomarchy Agent Tools

Lightweight bash tools for agent orchestration, database operations, monitoring, development, and browser automation.

## Project Structure

```
jat/
├── mail/                # Agent Mail coordination system (11 tools)
├── commands/agent/      # Agent workflow commands (7 commands)
├── browser-tools/       # Browser automation tools (11 tools)
├── tools/               # Database & monitoring tools (6 tools)
├── dashboard/           # Beads Task Dashboard (SvelteKit app)
├── scripts/             # Installation and setup scripts
└── install.sh           # Installation script
```

## Quick Start

```bash
# Install tools (symlinks to ~/bin/)
./install.sh

# Verify installation
am-whoami
db-schema
browser-start.js --help

# Start working (registers agent + picks task)
/agent:start
```

## Session-Aware Statusline

**The statusline automatically displays your agent identity and status for each Claude Code session.**

### How It Works

Each Claude Code session has a unique `session_id`. The statusline uses this to track agent identity independently per session:

```
Session 1: FreeMarsh  | [P1] task-abc - Building dashboard [🔒2 📬1 ⏱45m]
Session 2: PaleStar   | idle [📬3]
Session 3: StrongShore | [P0] task-xyz - Critical bug fix [🔒1]
```

### Registration

When you run `/agent:start` or `/agent:register`, it automatically:
1. Registers your agent in Agent Mail
2. Writes agent name to `.claude/agent-{session_id}.txt`
3. Statusline reads from that file and displays your identity

**No manual setup needed** - just run a command and the statusline updates!

### What the Statusline Shows

**Format:** `AgentName | [Priority] Task ID - Task Title [Indicators]`

**Indicators:**
- 🔒N - Active file reservations
- 📬N - Unread messages in inbox
- ⏱Xm/Xh - Time until lock expires
- N% - Task progress (if tracked)

**Examples:**
```
FreeMarsh | [P1] jat-m95 - Update /start... [🔒2 📬1 ⏱45m]
FreeMarsh | idle [📬3]
jat | no agent registered
```

### Multi-Agent Sessions

**Run as many agents as you want simultaneously!** Each session maintains its own identity:

```bash
# Terminal 1
/agent:start  # Choose FreeMarsh
# Statusline shows: FreeMarsh | ...

# Terminal 2
/agent:start  # Choose PaleStar
# Statusline shows: PaleStar | ...

# Terminal 3
/agent:start  # Choose StrongShore
# Statusline shows: StrongShore | ...
```

All three sessions work independently with their own agent identities.

### Files Created

- `.claude/agent-{session_id}.txt` - Your agent name for this session
- `/tmp/claude-session-${PPID}.txt` - PPID-based session ID (process-isolated)
- `.claude/statusline.sh` - The statusline script

**These files are session-specific** - don't commit `agent-*.txt` files to git (they're per-developer session).

### Why PPID-Based Session Tracking?

**The Problem: Race Conditions with Shared Files**

Initially, we used a shared file `.claude/current-session-id.txt` that all Claude Code instances would read/write. This caused race conditions:

```bash
# Terminal 1 (FreeMarsh) writes session ID
echo "session-abc" > .claude/current-session-id.txt

# Terminal 2 (PaleStar) writes IMMEDIATELY after
echo "session-xyz" > .claude/current-session-id.txt  # Overwrites!

# Terminal 1 tries to read its session ID
cat .claude/current-session-id.txt  # Gets "session-xyz" - WRONG!
```

**The Solution: PPID-Based Process Isolation**

Each Claude Code session runs in a unique process with its own Parent Process ID (PPID). We use this for isolation:

```bash
# Terminal 1: PPID = 12345
/tmp/claude-session-12345.txt → "session-abc"

# Terminal 2: PPID = 67890
/tmp/claude-session-67890.txt → "session-xyz"

# No conflicts! Each process has its own file.
```

**File Lifecycle:**
- **Creation**: Statusline creates `/tmp/claude-session-${PPID}.txt` on first render
- **Updates**: Statusline updates the file on every render (writes current session ID)
- **Cleanup**: OS automatically deletes `/tmp` files when process exits
- **Location**: `/tmp` (not `.claude/`) because it's process-specific, not project-specific

**Multiple Terminals Example:**

```bash
# Terminal 1 (PPID: 12345)
/tmp/claude-session-12345.txt → "a019c84c..."
.claude/agent-a019c84c....txt → "FreeMarsh"

# Terminal 2 (PPID: 67890)
/tmp/claude-session-67890.txt → "9b2a2fac..."
.claude/agent-9b2a2fac....txt → "PaleStar"

# Each terminal has independent session tracking - no race conditions!
```

### Troubleshooting Statusline Issues

**Problem: Statusline shows wrong agent name or different session's agent**

This happens when multiple Claude Code sessions are running and you need to update your current session's identity.

**❌ This does NOT work:**
```bash
# Environment variables don't persist to statusline
export AGENT_NAME=ShortTundra
am-register --name ShortTundra ...
```

**✅ This DOES work - write to your session file:**
```bash
# Get your session ID (PPID-based)
session_id=$(cat /tmp/claude-session-${PPID}.txt 2>/dev/null | tr -d '\n')

# Write your agent name to YOUR session's file
echo "ShortTundra" > ".claude/agent-${session_id}.txt"
```

**One-liner fix:**
```bash
session_id=$(cat /tmp/claude-session-${PPID}.txt | tr -d '\n') && echo "ShortTundra" > ".claude/agent-${session_id}.txt"
```

Your statusline updates immediately - no restart needed!

**Why this works:**
- Each Claude Code session has a unique `session_id` (e.g., `abc123`)
- The statusline reads from `.claude/agent-{your-session-id}.txt`
- Other sessions have their own files (`.claude/agent-{other-id}.txt`)
- `export AGENT_NAME=` only affects bash subprocesses, not the statusline process
- Writing to the session file is the only way to update the statusline

**Checking which session you're in:**
```bash
# See your session ID (PPID-based)
cat /tmp/claude-session-${PPID}.txt

# See your PPID (parent process ID)
echo $PPID

# See all session files for this project
ls -la .claude/agent-*.txt

# See your session's agent name
session_id=$(cat /tmp/claude-session-${PPID}.txt | tr -d '\n') && cat ".claude/agent-${session_id}.txt"
```

## Agent Workflow Commands

**All agent commands are in `./commands/agent/` and available via `/agent:*` namespace.**

### Command Overview

| Command | Purpose | Size |
|---------|---------|------|
| `/agent:start` | **Main command** - register + task start | 16K |
| `/agent:register` | Explicit registration with full review | 11K |
| `/agent:pause` | **Unified stop** - pause/block/handoff/abandon | 12K |
| `/agent:complete` | Finish task, release files, close | 27K |
| `/agent:status` | Check current work status | 21K |
| `/agent:plan` | Plan work strategy | 27K |
| `/agent:verify` | Verify task completion | 29K |

### `/agent:start` - Get to Work Command

**The main command** - handles registration, task selection, conflict detection, and actually starts work.

**Usage:**
```bash
/agent:start                    # Auto-detect/create agent, show tasks
/agent:start AgentName          # Register as specific agent
/agent:start task-abc           # Start specific task (full flow)
/agent:start task-abc quick     # Skip conflict checks (fast)
```

**What it does:**
1. **Smart Registration:** Auto-detects recent agents (last 60 min) or creates new
2. **Session Persistence:** Updates `.claude/agent-{session_id}.txt` for statusline
3. **Task Selection:** From parameter, conversation context, or priority
4. **Conflict Detection:** File locks, git changes, dependencies
5. **Actually Starts Work:** Reserves files, sends Agent Mail, updates Beads

**How it works:**

**1. Auto-Detection (Default):**
- Checks if you're already registered (session file exists)
- If not: looks for agents active in last **60 minutes**
- Recent agents found → shows menu to resume
- No recent agents → auto-creates new agent with random name
- Sets statusline automatically

**2. Explicit Agent:**
```bash
/agent:start MyAgent
```
- Register as specific agent
- Show task recommendations
- Useful when you know which agent you want

**3. Start Specific Task:**
```bash
/agent:start jat-abc
```
- Auto-registers if needed (using 60-min detection)
- Runs full conflict checks
- Reserves files
- Sends Agent Mail notification
- Updates Beads status
- **Actually starts work** (not just recommendations)

**4. Quick Mode:**
```bash
/agent:start task-abc quick
```
- Skips conflict detection
- Skips dependency checks
- For when you're solo or need speed

**Examples:**
```bash
# Scenario 1: Fresh session, you worked 30 min ago
/agent:start
# → Shows menu: "Resume FreeMarsh (last active 30 min ago)"

# Scenario 2: Fresh session, no recent work
/agent:start
# → Auto-creates: "✨ Created new agent: BrightCove"

# Scenario 3: Already registered, start specific task
/agent:start jat-zdl
# → Checks conflicts, reserves files, starts task

# Scenario 4: Fast mode
/agent:start jat-zdl quick
# → Skips checks, starts immediately
```

### `/agent:register` - Explicit Registration

**Show all agents and choose** - for when you want full visibility.

**Usage:**
```bash
/agent:register     # Interactive menu with all agents
```

**Purpose:**
- See **ALL** registered agents (no time filter)
- Full review: inbox, tasks, categorization
- Explicit choice (no auto-creation without confirmation)

**When to use:**
- Want to see all agents (not just recent)
- Need full registration review
- Setting up multi-agent coordination

**vs `/agent:start`:**

| Feature | `/agent:start` | `/agent:register` |
|---------|----------------|-------------------|
| Registration | Auto-detect (60 min) | Show all agents |
| Task start | Yes (if task ID provided) | No (review only) |
| Auto-create | Yes (if no recent agents) | Yes (with confirmation) |
| Review depth | Quick summary | Full analysis |
| Use case | "Get me working" | "Show me everything" |

### `/agent:pause` - Stop Work (Unified)

**Stop working on a task** - one command for all stop scenarios.

**Usage:**
```bash
# Simple pause (keep file locks)
/agent:pause task-abc --reason "Taking break"

# Mark as blocked (release locks)
/agent:pause task-abc --blocked --reason "API is down"

# Hand off to another agent (release locks)
/agent:pause task-abc --handoff Alice --reason "Need frontend expertise"

# Abandon work (release locks, unassign)
/agent:pause task-abc --abandon --reason "Requirements changed"
```

**Modes:**

| Mode | File Locks | Task Status | Assignee | Use When |
|------|------------|-------------|----------|----------|
| Default (pause) | Kept | Unchanged | Unchanged | Taking break, will resume |
| `--blocked` | Released | → blocked | Unchanged | External blocker, can't proceed |
| `--handoff` | Released | Unchanged | → New agent | Need different expertise |
| `--abandon` | Released | → open | Cleared | Task obsolete or rethinking needed |

**What it does:**
1. Releases file reservations (based on mode)
2. Updates task status in Beads
3. Sends Agent Mail notification
4. Updates session state

**Examples:**
```bash
# End of day
/agent:pause task-abc --reason "End of day, will resume tomorrow"

# Blocked by dependency
/agent:pause task-abc --blocked --reason "Waiting for API documentation from backend team"

# Need help
/agent:pause task-abc --handoff SeniorDev --reason "Complex algorithm, need expert review"

# Task no longer needed
/agent:pause task-abc --abandon --reason "Product decided to go different direction"
```

### `/agent:complete` - Finish Task

**Complete task** - closes in Beads, releases files, sends notifications.

**Usage:**
```bash
/agent:complete task-abc        # Normal completion
```

**What it does:**
1. Releases all file reservations
2. Marks task as completed in Beads
3. Sends completion notification in Agent Mail
4. Updates agent status

### Other Agent Commands

**`/agent:status`** - Check what you're working on
```bash
/agent:status    # Shows current task, locks, messages
```

**`/agent:plan`** - Plan work strategy
```bash
/agent:plan     # Strategic planning for complex work
```

**`/agent:verify`** - Verify task completion
```bash
/agent:verify task-abc    # Verify all acceptance criteria met
```

### Command Workflow Recommendations

**Most Common Workflow:**
```bash
# 1. Start your session
/agent:start

# 2. Work on tasks
# (statusline shows your agent identity)

# 3. Switch tasks
/agent:start task-xyz

# 4. Pause if needed
/agent:pause task-xyz --reason "Switching to urgent work"

# 5. Complete task
/agent:complete task-xyz
```

**Multi-Agent Coordination:**
```bash
# Terminal 1 (Frontend work)
/agent:start              # Resume FreeMarsh
/agent:start task-ui-123  # Start UI task

# Terminal 2 (Backend work)
/agent:start PaleStar     # Use specific agent
/agent:start task-api-456 # Start API task

# Terminal 3 (Testing)
/agent:register           # See all agents, choose one
/agent:start task-test-789
```

**Troubleshooting:**
```bash
# Statusline shows "no agent registered"?
/agent:start              # Quick fix

# Want to see all agents (not just recent)?
/agent:register           # Full agent list

# Need to hand off work?
/agent:pause task-abc --handoff OtherAgent --reason "Need expert"

# Task blocked by dependency?
/agent:pause task-abc --blocked --reason "Waiting for X"
```

## Dashboard Development

**The Beads Task Dashboard is a SvelteKit 5 application in the `dashboard/` directory.**

### Important: Dashboard-Specific Documentation

When working on the dashboard, refer to:
```
dashboard/CLAUDE.md
```

This contains critical information about:
- **Tailwind CSS v4 syntax** (completely different from v3!)
- DaisyUI theme configuration
- Theme switching implementation
- Svelte 5 runes syntax
- Common pitfalls and troubleshooting

### Quick Dashboard Commands

**Launcher Script (Recommended):**
```bash
# Launch dashboard from anywhere
bd-dashboard        # Checks dependencies, starts server, opens browser
jat-dashboard       # Alias for bd-dashboard

# What it does:
# - Checks for node_modules, runs npm install if needed
# - Starts dev server on http://127.0.0.1:5174
# - Opens browser automatically after 3 seconds
```

**Manual Commands:**
```bash
cd dashboard

# Install dependencies
npm install

# Start dev server (usually http://127.0.0.1:5174)
npm run dev

# Clean build cache if themes aren't loading
rm -rf .svelte-kit node_modules/.vite
npm run dev
```

### ⚠️ Critical Dashboard Issue: Tailwind v4

The dashboard uses **Tailwind CSS v4**, which has completely different syntax:

**❌ This does NOT work (v3 syntax):**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**✅ You MUST use this (v4 syntax):**
```css
@import "tailwindcss";

@plugin "daisyui" {
  themes: light, dark, nord --default, ...;
}
```

See `dashboard/CLAUDE.md` for full details.

## Agent Mail Tools

For multi-agent coordination. See `~/.claude/CLAUDE.md` for full Agent Mail documentation.

**Quick Reference:**
```bash
# Register agent
# RECOMMENDED: Use /agent:start or /agent:register (automatically updates statusline!)
# Or manually: am-register --name AgentName --program claude-code --model sonnet-4.5

# Reserve files
am-reserve "src/**/*.ts" --agent AgentName --ttl 3600 --exclusive --reason "task-abc"

# Send message
am-send "Subject" "Body" --from Agent1 --to Agent2 --thread task-abc

# Check inbox
am-inbox AgentName --unread
```

## Database Tools

```bash
# Query database
db-query "SELECT * FROM users WHERE role='admin'"

# View schema
db-schema users

# Check active connections
db-sessions --active
```

## Browser Automation Tools

```bash
# Start browser
browser-start.js

# Navigate
browser-nav.js https://example.com

# Execute JavaScript
browser-eval.js "document.title"

# Take screenshot
browser-screenshot.js --fullpage

# Pick element selector
browser-pick.js

# Manage cookies
browser-cookies.js --set "auth=token123"

# Wait for elements
browser-wait.js --selector ".login-button" --timeout 10000
```

## Development Tools

```bash
# Type check
type-check-fast src/lib/components

# Lint staged files
lint-staged

# Check migrations
migration-status

# View component dependencies
component-deps src/lib/components/MediaSelector.svelte

# List routes
route-list --api

# Check build size
build-size

# Validate environment
env-check production
```

## Monitoring Tools

```bash
# View edge function logs
edge-logs video-generator --follow --errors

# Check API quota
quota-check --model openai-gpt4

# View error logs
error-log --level error --since 1h

# Monitor jobs
job-monitor --type video-generation

# Check performance
perf-check /api/chat
```

## Tool Documentation

Every tool has a `--help` flag:
```bash
am-send --help
db-query --help
browser-eval.js --help
type-check-fast --help
```

## Integration with Beads

Use Beads issue IDs (e.g., `task-abc`) as:
- Agent Mail `thread_id`
- File reservation `reason`
- Commit message references

```bash
# Example workflow
bd ready --json                                         # Pick work
/agent:start task-abc                                   # Registers + starts task
# ... do work ...
/agent:complete task-abc                                # Closes task
```

## Common Issues

### Dashboard themes not working
1. Check `dashboard/src/app.css` uses Tailwind v4 syntax
2. See `dashboard/CLAUDE.md` for detailed troubleshooting

### Agent Mail "not registered"
```bash
/agent:start              # Quick fix (auto-registers)
# Or manually:
am-register --name YourAgentName --program claude-code --model sonnet-4.5
```

### Browser tools not found
```bash
cd /home/jw/code/jat
./install.sh
```

### Fresh dashboard build needed
```bash
cd dashboard
rm -rf .svelte-kit node_modules/.vite
npm run dev
```

### Statusline not updating
```bash
# Write to your session file (PPID-based)
session_id=$(cat /tmp/claude-session-${PPID}.txt | tr -d '\n') && echo "YourAgentName" > ".claude/agent-${session_id}.txt"
```

## References

- **Dashboard docs**: `dashboard/CLAUDE.md`
- **Global Agent Mail docs**: `~/.claude/CLAUDE.md`
- **Agent commands**: `./commands/agent/*.md`
- **Tool source**: Each tool directory contains implementation
- **Installation**: `install.sh` for symlink setup
