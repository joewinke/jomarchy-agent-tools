#!/bin/bash

# Update/Create Global ~/.claude/CLAUDE.md
# Adds multi-project beads + agent mail instructions for all AI assistants

set -e

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Setting up global ~/.claude/CLAUDE.md and commands...${NC}"
echo ""

# Ensure ~/.claude directory exists
mkdir -p ~/.claude
mkdir -p ~/.claude/commands/agent

CLAUDE_MD="$HOME/.claude/CLAUDE.md"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
COMMANDS_SOURCE="$SCRIPT_DIR/../commands/agent"

# Install agent coordination commands
if [ -d "$COMMANDS_SOURCE" ]; then
    echo "  → Installing agent coordination commands..."
    COMMAND_COUNT=$(find "$COMMANDS_SOURCE" -name "*.md" -type f | wc -l)
    cp -r "$COMMANDS_SOURCE"/*.md ~/.claude/commands/agent/ 2>/dev/null || true
    echo -e "${GREEN}  ✓ Installed $COMMAND_COUNT coordination commands${NC}"
    echo "    Location: ~/.claude/commands/agent/"
    echo ""
fi

# Check if file exists
if [ -f "$CLAUDE_MD" ]; then
    # Check if it already has our marker
    if grep -q "## Agent Mail: coordination for multi-agent workflows" "$CLAUDE_MD"; then
        echo -e "${YELLOW}  ⊘ ~/.claude/CLAUDE.md already configured${NC}"
        echo "  File: $CLAUDE_MD"
        exit 0
    fi

    echo "  → Backing up existing CLAUDE.md..."
    cp "$CLAUDE_MD" "$CLAUDE_MD.backup.$(date +%s)"
    echo -e "${GREEN}  ✓ Backup created${NC}"
    echo ""
fi

# Create or append to CLAUDE.md
echo "  → Writing agent tools configuration..."

cat >> "$CLAUDE_MD" << 'EOF'

## Agent Swarm Coordination Commands

**Command your agent swarm with 10 high-level coordination primitives.**

These slash commands (located in `~/.claude/commands/agent/`) provide sophisticated multi-agent workflow orchestration:

### Core Workflow Commands

**1. `/register`** - Bootstrap agent identity
- Registers with Agent Mail server
- Gets unique agent name for coordination
- Reviews available Beads tasks
- Use at start of every session

**2. `/start [task-id | quick]`** - Smart task start
- Context-aware: Creates tasks from conversation
- Conflict detection: Checks file locks, git, inbox
- Auto-selects: Picks highest priority if no task specified
- Quick mode: Skip safety checks for speed

**3. `/complete [continue | stop]`** - Finish and auto-continue
- Verifies work quality (tests, lint, security)
- Commits changes and updates documentation
- Releases file reservations
- **Auto-starts next task** (continuous flow)
- Use `/complete stop` to pause workflow

### Coordination Commands

**4. `/status`** - Sync state without starting work
- Shows current task, reservations, inbox
- Acknowledges all messages
- Updates last_active timestamp
- Quick orientation check

**5. `/handoff <agent> [reason]`** - Transfer work with full context
- Packages work state (progress, blockers, files)
- Sends comprehensive handoff message
- Releases your resources
- Target agent can resume immediately

**6. `/pause [reason]`** - Temporarily stop work
- Releases file reservations
- Keeps task open for resume later
- Notifies team via Agent Mail
- Use when taking a break

**7. `/block <reason>**` - Mark task blocked
- Documents blocker clearly
- Notifies relevant agents
- Releases resources for others
- Task stays in queue until unblocked

**8. `/stop [reason]`** - Smart routing
- Analyzes your reason automatically
- Routes to `/pause`, `/block`, or `/handoff`
- Use when unsure which to use

### Quality & Planning

**9. `/verify [quick | full]`** - Comprehensive verification
- Type checking, linting, security scan
- Full mode: Browser testing, console errors
- Called automatically by `/complete`
- Use standalone to check before committing

**10. `/plan [planning-doc]`** - Convert plans to Beads tasks
- Parses planning documents
- Creates structured tasks with dependencies
- Sets priorities based on requirements
- Accelerates feature kickoff

### Example Workflow

```bash
# Start your session
/register

# Start working (auto-selects highest priority)
/start

# ... work happens ...

# Complete and auto-continue to next task
/complete

# ... more work ...

# Need help? Handoff to specialist
/handoff Frontend-Agent "needs UI expertise"

# Check in without starting work
/status

# End session
/complete stop
```

### Benefits

- **🌊 Continuous Flow**: `/complete` chains tasks → agents never idle
- **🤝 Seamless Handoffs**: Full context transfer between agents
- **🛡️ Conflict-Free**: File reservations + checks prevent collisions
- **📈 Scale Up**: Add agents without coordination overhead
- **🔄 Persistent State**: Work survives context window resets
- **🎯 Smart Selection**: Context-aware task matching from conversation

### Architecture

```
User Commands → Coordination Commands → Bash Tools → Agent Mail + Beads
/start, /complete    10 .md files        28 tools    State & Coordination
```

Commands leverage Agent Mail (messaging, file locks) and Beads (task queue, dependencies) for full swarm orchestration across projects.

---

## Agent Mail: coordination for multi-agent workflows

What it is
- A mail-like layer that lets coding agents coordinate asynchronously via MCP tools and resources.
- Provides identities, inbox/outbox, searchable threads, and advisory file reservations, with human-auditable artifacts in Git.

Why it's useful
- Prevents agents from stepping on each other with explicit file reservations (leases) for files/globs.
- Keeps communication out of your token budget by storing messages in a per-project archive.
- Offers quick reads (`resource://inbox/...`, `resource://thread/...`) and macros that bundle common flows.

How to use effectively
1) Same repository
   - Register an identity: call `ensure_project`, then `register_agent` using this repo's absolute path as `project_key`.
   - Reserve files before you edit: `file_reservation_paths(project_key, agent_name, ["src/**"], ttl_seconds=3600, exclusive=true)` to signal intent and avoid conflict.
   - Communicate with threads: use `send_message(..., thread_id="FEAT-123")`; check inbox with `fetch_inbox` and acknowledge with `acknowledge_message`.
   - Read fast: `resource://inbox/{Agent}?project=<abs-path>&limit=20` or `resource://thread/{id}?project=<abs-path>&include_bodies=true`.
   - Tip: set `AGENT_NAME` in your environment so the pre-commit guard can block commits that conflict with others' active exclusive file reservations.

2) Across different repos in one project (e.g., Next.js frontend + FastAPI backend)
   - Option A (single project bus): register both sides under the same `project_key` (shared key/path). Keep reservation patterns specific (e.g., `frontend/**` vs `backend/**`).
   - Option B (separate projects): each repo has its own `project_key`; use `macro_contact_handshake` or `request_contact`/`respond_contact` to link agents, then message directly. Keep a shared `thread_id` (e.g., ticket key) across repos for clean summaries/audits.

Macros vs granular tools
- Prefer macros when you want speed or are on a smaller model: `macro_start_session`, `macro_prepare_thread`, `macro_file_reservation_cycle`, `macro_contact_handshake`.
- Use granular tools when you need control: `register_agent`, `file_reservation_paths`, `send_message`, `fetch_inbox`, `acknowledge_message`.

Common pitfalls
- "from_agent not registered": always `register_agent` in the correct `project_key` first.
- "FILE_RESERVATION_CONFLICT": adjust patterns, wait for expiry, or use a non-exclusive reservation when appropriate.
- Auth errors: if JWT+JWKS is enabled, include a bearer token with a `kid` that matches server JWKS; static bearer is used only when JWT is disabled.


## Integrating with Beads (dependency-aware task planning)

Beads provides a lightweight, dependency-aware issue database and a CLI (`bd`) for selecting "ready work," setting priorities, and tracking status. It complements Agent Mail's messaging, audit trail, and file-reservation signals. Project: [steveyegge/beads](https://github.com/steveyegge/beads)

### Multi-Project Architecture

**Per-project databases with unified dashboard:**
- Each project has its own `.beads/` directory (e.g., `~/code/chimaro/.beads`, `~/code/jomarchy/.beads`)
- Task IDs are prefixed with project name (e.g., `chimaro-abc`, `jomarchy-36j`)
- `bd` commands work in your current project directory automatically
- **Unified view**: Chimaro's development dashboard aggregates all projects from `~/code/*`
- Access at: `http://localhost:5173/account/development/beads` (when running Chimaro)

**Benefits:**
- Clean separation: Each project's tasks are committable to its own git repo
- Single dashboard: View and filter tasks across all projects
- Context-aware: `bd` commands always operate on current project
- Visual distinction: Color-coded ID badges show project at a glance

**Working with multiple projects:**
```bash
# Work in chimaro project
cd ~/code/chimaro
bd ready                           # Shows only chimaro tasks
bd create "Fix OAuth authentication timeout" \
  --type bug \
  --labels security,auth,urgent \
  --priority 1 \
  --description "Users experience timeout when logging in via OAuth. Need to investigate token refresh logic and increase timeout threshold." \
  --assignee "AgentName"
# Creates chimaro-xxx

# Work in jomarchy project
cd ~/code/jomarchy
bd ready                           # Shows only jomarchy tasks
bd create "Build browser-wait.js - Smart waiting capability" \
  --type task \
  --labels browser,tools,cdp \
  --priority 1 \
  --description "Implement browser-wait.js tool to eliminate race conditions. Supports waiting for: text content, selectors, URL changes, and custom eval conditions. Uses CDP polling with configurable timeouts."
# Creates jomarchy-yyy

# View all projects together
# Open Chimaro dashboard in browser to see aggregated view with filtering
```

### Beads Commands

**Create and manage tasks:**
```bash
# Create a new task with type and labels
bd create "Fix login authentication bug" --type bug --labels security,auth --priority 1 --description "Users can't log in with OAuth"

# Create a feature with dependencies
bd create "Add dark mode toggle" --type feature --labels ui,settings --deps bd-42

# List and find tasks
bd list                    # All tasks
bd ready                   # Tasks ready to work (no blockers)
bd ready --json            # JSON output for programmatic use
bd status bd-123           # Check specific task

# Update and complete
bd add bd-123 "Made progress on authentication flow"
bd close bd-123 --reason "Fixed OAuth redirect issue"

# All bd commands have --help for detailed usage
bd create --help
bd --help                  # Full command list
```

**Common types:** `bug`, `feature`, `task`, `epic`, `chore`
**Common labels:** Project-specific (e.g., `security`, `ui`, `backend`, `frontend`, `urgent`)

Recommended conventions
- **Single source of truth**: Use **Beads** for task status/priority/dependencies; use **Agent Mail** for conversation, decisions, and attachments (audit).
- **Shared identifiers**: Use the Beads issue id (e.g., `bd-123`) as the Mail `thread_id` and prefix message subjects with `[bd-123]`.
- **Reservations**: When starting a `bd-###` task, call `file_reservation_paths(...)` for the affected paths; include the issue id in the `reason` and release on completion.

Typical flow (agents)
1) **Pick ready work** (Beads)
   - `bd ready --json` → choose one item (highest priority, no blockers)
2) **Reserve edit surface** (Mail)
   - `file_reservation_paths(project_key, agent_name, ["src/**"], ttl_seconds=3600, exclusive=true, reason="bd-123")`
3) **Announce start** (Mail)
   - `send_message(..., thread_id="bd-123", subject="[bd-123] Start: <short title>", ack_required=true)`
4) **Work and update**
   - Reply in-thread with progress and attach artifacts/images; keep the discussion in one thread per issue id
5) **Complete and release**
   - `bd close bd-123 --reason "Completed"` (Beads is status authority)
   - `release_file_reservations(project_key, agent_name, paths=["src/**"])`
   - Final Mail reply: `[bd-123] Completed` with summary and links

Mapping cheat-sheet
- **Mail `thread_id`** ↔ `bd-###`
- **Mail subject**: `[bd-###] …`
- **File reservation `reason`**: `bd-###`
- **Commit messages (optional)**: include `bd-###` for traceability

Event mirroring (optional automation)
- On `bd update --status blocked`, send a high-importance Mail message in thread `bd-###` describing the blocker.
- On Mail "ACK overdue" for a critical decision, add a Beads label (e.g., `needs-ack`) or bump priority to surface it in `bd ready`.

Pitfalls to avoid
- Don't create or manage tasks in Mail; treat Beads as the single task queue.
- Always include `bd-###` in message `thread_id` to avoid ID drift across tools.


## Agent Tools: Lightweight bash tools for common operations

**43 lightweight bash tools** available system-wide with massive token savings (32,425 tokens vs MCP servers).

Philosophy: Following [What if you don't need MCP?](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/) by Mario Zechner - simple bash tools achieve 80x token reduction.

**Location:** `~/code/jat/`

### Tool Categories

- **Agent Mail (12):** am-register, am-inbox, am-send, am-reply, am-ack, am-reserve, am-release, am-reservations, am-search, am-agents, am-whoami
- **Browser (7):** browser-start.js, browser-nav.js, browser-eval.js, browser-screenshot.js, browser-pick.js, browser-cookies.js, browser-hn-scraper.js
- **Additional (24):** Database utilities, monitoring, media management, deployment helpers

### Quick Usage

**All tools have `--help` flags:**
```bash
am-inbox --help
browser-eval.js --help
```

**Common examples:**
```bash
# Agent Mail (lightweight HTTP wrappers)
am-inbox AgentName --unread
am-send "Subject" "Body" --from Agent1 --to Agent2 --thread bd-123
am-reserve src/**/*.svelte --agent AgentName --ttl 3600 --reason "bd-123"

# Browser automation
browser-screenshot.js  # Returns temp file path
browser-eval.js 'document.title'

# Check Agent Mail server status
systemctl --user status agent-mail
```

### Integration with Agent Mail & Beads

Use together for maximum efficiency:
```bash
# 1. Pick work
bd ready --json

# 2. Reserve files (bash tool instead of MCP)
am-reserve src/**/*.ts --agent $AGENT_NAME --ttl 3600 --reason "bd-123"

# 3. Complete and release
bd close bd-123 --reason "Completed"
am-release src/**/*.ts --agent $AGENT_NAME
```

### Why Bash Tools (Not MCP)

These tools **replace MCP servers** entirely, providing:
- **Massive token savings**: 32,425 tokens saved (80x reduction)
- **Bash composability**: Use pipes, jq, redirects, xargs
- **Cross-CLI compatibility**: Works with Claude Code, OpenCode, Cursor, Aider
- **Zero overhead**: Just executables, no server startup

Example of bash composability:
```bash
# Chain tools together
am-inbox AgentName --unread --json | jq '.[] | select(.importance=="urgent")'

# Save to file and process
am-inbox AgentName --unread > inbox.json && cat inbox.json | jq length
```

EOF

echo -e "${GREEN}  ✓ Configuration written to ~/.claude/CLAUDE.md${NC}"
echo ""
echo "  Added sections:"
echo "    • Agent Mail (coordination)"
echo "    • Beads (multi-project task planning)"
echo "    • Agent Tools (28 generic bash tools)"
echo ""
echo "  AI assistants will now see these instructions in all projects!"
echo ""
