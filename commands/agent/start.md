---
argument-hint: [agent-name | task-id | quick]
---

Get to work! Unified smart command that handles registration, task selection, conflict detection, and actually starts work.

# Start Working - Unified Smart Command

**Usage:**
- `/agent:start` - **Auto-create new agent** (fast! no prompt), show task recommendations
- `/agent:start resume` - Show menu to **choose from existing agents**
- `/agent:start agent-name` - Register as specific agent, show tasks
- `/agent:start task-id` - Auto-register if needed, start that task
- `/agent:start task-id quick` - Skip conflict checks (fast mode)

**What this command does:**
1. **Smart Registration:** By default creates new agent instantly; use `resume` parameter to choose from existing agents
2. **Global Agent Lookup:** Agents are globally unique - uses simple `am-agents` lookup (no project filtering needed)
3. **Duplicate Prevention:** Always checks if agent name exists before registering (resumes instead of creating duplicates)
4. **Session Persistence:** Updates `.claude/agent-{session_id}.txt` for statusline
5. **Smart Cleanup:** Auto-releases file reservations from closed tasks (prevents stale statusline display)
6. **Task Selection:** From parameter, conversation context, or priority
7. **Conflict Detection:** File locks, git changes, dependencies
8. **Actually Starts Work:** Reserves files, sends Agent Mail, updates Beads

**IMPORTANT: Agents are globally unique across all projects.** You cannot have two agents with the same name, even in different projects. This simplifies registration - we just check `am-agents` globally without any project filtering.

**Why global uniqueness matters:**
- ✅ Simple registration: Just check if name exists with `am-agents | grep`
- ✅ No project disambiguation: No need to ask "which project's agent?"
- ✅ Cleaner logic: One agent name = one agent (period)
- ✅ Easier coordination: Agents can work across multiple projects with same identity
- ❌ No duplicates: Cannot create "AgentA" in project X and "AgentA" in project Y

**Example:**
```bash
# This is all you need - simple global check
if am-agents | grep -q "^  ${AGENT_NAME}$"; then
  echo "Agent exists globally"
else
  am-register --name "$AGENT_NAME" ...
fi

# No project filtering needed!
# No disambiguation needed!
```

**Note:** `am-agents` output may show "Agents in project" as display text, but agents are globally unique. The same agent name cannot exist in multiple projects.

---

## Bash Syntax Patterns for Claude Code

**CRITICAL:** Claude Code's Bash tool escapes command substitution syntax. You MUST use these patterns:

### ✅ CORRECT Patterns

**Pattern 1: Use Read/Write tools (RECOMMENDED)**
```bash
# Step 1: Get value
~/code/jat/scripts/get-current-session-id
# → "a019c84c-7b54-45cc-9eee-dd6a70dea1a3"

# Step 2: Use Write tool with that value
Write(.claude/agent-a019c84c-7b54-45cc-9eee-dd6a70dea1a3.txt, "AgentName")
```

**Pattern 2: Explicit variable assignment with semicolon**
```bash
# ✅ Works: Explicit assignment with semicolon
SESSION_ID="a019c84c-7b54-45cc-9eee-dd6a70dea1a3"; echo "$SESSION_ID"

# ✅ Works: Use test command with && / ||
test -f "$file" && echo "exists" || echo "not found"

# ✅ Works: Chain commands with semicolons
SESSION_ID="abc"; mkdir -p .claude && echo "value" > ".claude/agent-${SESSION_ID}.txt"
```

### ❌ WRONG Patterns (Will Cause Syntax Errors)

```bash
# ❌ BROKEN: Command substitution in assignment
SESSION_ID=$(~/code/jat/scripts/get-current-session-id)
# Error: SESSION_ID=\$ ( ... ) syntax error

# ❌ BROKEN: Using $PPID (each Bash invocation has different PPID)
SESSION_ID=$(cat /tmp/claude-session-${PPID}.txt)
# Error: subprocess PPID ≠ Claude Code process PPID

# ❌ BROKEN: if statement with &&
SESSION_ID="abc" && if [[ -f "$file" ]]; then echo "yes"; fi
# Error: syntax error near unexpected token 'if'
```

**Key Rules:**
1. **Never use `$(...)` in variable assignments** - gets escaped
2. **Never rely on `$PPID`** - each Bash call has different PPID
3. **Prefer Read/Write tools** - no escaping issues
4. **Use semicolons** for multi-statement commands
5. **Use `test` or `[[ ]]` with `&&` / `||`** instead of if statements

---

## Implementation Steps

### STEP 0: Parse Parameters

Extract parameter and detect mode:

```bash
PARAM="$1"  # Could be: empty, "resume", agent-name, task-id, or "quick"
QUICK_MODE=false
RESUME_MODE=false

# Check for resume mode
if [[ "$PARAM" == "resume" ]]; then
  RESUME_MODE=true
  PARAM_TYPE="none"  # Will show task recommendations after agent selection
fi

# Check for quick mode
if [[ "$PARAM" == "quick" ]] || [[ "$2" == "quick" ]]; then
  QUICK_MODE=true
fi

# Determine parameter type (skip if already set to resume)
if [[ "$RESUME_MODE" == "false" ]]; then
  if [[ -z "$PARAM" ]] || [[ "$PARAM" == "quick" ]]; then
    PARAM_TYPE="none"
  elif bd show "$PARAM" --json >/dev/null 2>&1; then
    PARAM_TYPE="task-id"
    TASK_ID="$PARAM"
  else
    # Could be agent name
    PARAM_TYPE="agent-name"
    REQUESTED_AGENT="$PARAM"
  fi
fi
```

---

### STEP 1: Session-Aware Agent Registration

**CRITICAL: Always update session file for statusline**

#### 1A: Check Current Agent Status

**Use bash test command to check session status (RECOMMENDED - cleaner output):**

```bash
# Step 1: Get session ID using helper script
~/code/jat/scripts/get-current-session-id 2>/dev/null | tr -d '\n'
# → Output: "a019c84c-7b54-45cc-9eee-dd6a70dea1a3"

# Step 2: Check if agent file exists using test command (cleaner - no error shown)
SESSION_ID="a019c84c-7b54-45cc-9eee-dd6a70dea1a3"; test -f ".claude/agent-${SESSION_ID}.txt" && cat ".claude/agent-${SESSION_ID}.txt" || echo "NO_AGENT"
# → If exists: shows agent name
# → If not exists: shows "NO_AGENT" (much clearer than "Error reading file")

# Step 3: Based on result, either resume or create new agent
```

**Alternative: Use Read tool (works but shows confusing "Error"):**

```bash
# This works but shows "Error reading file" when no agent registered yet
Read(.claude/agent-a019c84c-7b54-45cc-9eee-dd6a70dea1a3.txt)
# ⚠️  Confusing UX: "Error" makes it look broken when it's actually the happy path
```

**Alternative: Use bash with explicit variable assignment:**

```bash
# ✅ CORRECT: Use semicolon with explicit variable assignment
SESSION_ID="a019c84c-7b54-45cc-9eee-dd6a70dea1a3"; test -f ".claude/agent-${SESSION_ID}.txt" && cat ".claude/agent-${SESSION_ID}.txt" || echo "NO_AGENT"

# ❌ WRONG: Command substitution gets escaped by Bash tool
SESSION_ID=$(~/code/jat/scripts/get-current-session-id 2>/dev/null | tr -d '\n')
# This causes: SESSION_ID=\$ ( ... ) syntax error
```

**PPID-based session tracking:**
- Each terminal has unique PPID (parent process ID)
- Statusline writes session ID to `/tmp/claude-session-${PPID}.txt`
- Prevents race conditions between multiple Claude Code instances
- Clean process isolation across terminals

#### 1B: Handle Agent Registration Based on Parameter

**If PARAM_TYPE == "agent-name":**
```bash
# User explicitly requested an agent - check if it exists GLOBALLY
# (Agents are globally unique - no project filtering needed)
AGENT_NAME="$REQUESTED_AGENT"

# Simple global lookup using am-agents
if am-agents | grep -q "^  ${AGENT_NAME}$"; then
  echo "✅ Resuming existing agent: $AGENT_NAME"
  # Don't re-register - agent already exists globally
else
  echo "✨ Creating new agent: $AGENT_NAME"
  am-register --name "$AGENT_NAME" --program claude-code --model sonnet-4.5
fi
```

**CRITICAL: Block duplicate active agents (applies to ALL registration paths):**

After determining AGENT_NAME (from any path above), check if already active:

**Method 1: Use Read/Bash tools (RECOMMENDED):**

```bash
# Step 1: Get session ID (separate Bash call)
~/code/jat/scripts/get-current-session-id
# → "a019c84c-7b54-45cc-9eee-dd6a70dea1a3"

# Step 2: Check if agent is ACTIVELY working (session file modified in last 10 min)
~/code/jat/scripts/check-agent-active "AgentName" 10 && echo "ACTIVE" || echo "NOT_ACTIVE"
# → If ACTIVE: shows session filename and exits with 0
# → If NOT_ACTIVE: exits with 1

# Step 3: If agent IS actively working, show error and exit
# If agent is NOT actively working (old session file), OK to proceed

# Step 4: Write agent name to session file (use Write tool)
Write(.claude/agent-a019c84c-7b54-45cc-9eee-dd6a70dea1a3.txt, "AgentName")
```

**Method 2: Use bash with explicit variables (ALTERNATIVE):**

```bash
# ✅ CORRECT: Run helper script first, then use result
~/code/jat/scripts/get-current-session-id | tr -d '\n'
# → Get session ID output

# Then in separate Bash call with explicit assignment:
SESSION_ID="a019c84c-7b54-45cc-9eee-dd6a70dea1a3"; grep -l "AgentName" .claude/agent-*.txt | grep -v "agent-${SESSION_ID}.txt" && echo "ALREADY_ACTIVE" || echo "OK"

# Then write with explicit variable:
SESSION_ID="a019c84c-7b54-45cc-9eee-dd6a70dea1a3"; mkdir -p .claude && echo "AgentName" > ".claude/agent-${SESSION_ID}.txt"
```

**❌ WRONG: Don't use command substitution in variable assignment:**

```bash
# This gets escaped by Bash tool and causes syntax errors:
SESSION_ID=$(~/code/jat/scripts/get-current-session-id)
# Error: SESSION_ID=\$ ( ... ) syntax error
```

**If AGENT_REGISTERED == true:**
```bash
# Use existing agent from session
AGENT_NAME="$CURRENT_AGENT"
echo "✅ Resuming as $AGENT_NAME (session agent)"
```

**If AGENT_REGISTERED == false AND no agent requested:**
```bash
# Check if user wants to resume existing agent or auto-create new (default)
if [[ "$RESUME_MODE" == "true" ]]; then
  # RESUME MODE: Show menu to choose from LOGGED OUT agents only
  # (Agents without active session files)

  # Get all registered agents
  ALL_AGENTS=$(am-agents --json)

  # Filter out agents that are currently logged in (have active session files)
  # An agent is "logged in" if .claude/agent-*.txt contains their name
  LOGGED_OUT_AGENTS=$(echo "$ALL_AGENTS" | jq -r '
    [.[] |
      select(
        # Check if any session file contains this agent name
        # This requires bash grep check - we filter in next step
        .name as $agent_name | $agent_name
      )
    ]
  ')

  # Filter out actively logged in agents using bash
  AVAILABLE_AGENTS=""
  while IFS= read -r agent_name; do
    # Check if this agent has an active session file
    if ! grep -q "^${agent_name}$" .claude/agent-*.txt 2>/dev/null; then
      # Agent is NOT logged in - add to available list
      AVAILABLE_AGENTS="${AVAILABLE_AGENTS}${agent_name}\n"
    fi
  done < <(echo "$ALL_AGENTS" | jq -r '.[].name')

  # Count available (logged out) agents
  AGENT_COUNT=$(echo -e "$AVAILABLE_AGENTS" | grep -v '^$' | wc -l)

  if [[ "$AGENT_COUNT" -gt 0 ]]; then
    # Found logged-out agents - show selection menu

    echo "╔══════════════════════════════════════════════════════════════════════════╗"
    echo "║             🔍 Found $AGENT_COUNT Available Agent(s) (Logged Out)          ║"
    echo "╚══════════════════════════════════════════════════════════════════════════╝"
    echo ""

    # Show only logged-out agents
    echo "Available agents (not currently logged in):"
    echo -e "$AVAILABLE_AGENTS" | grep -v '^$' | while read agent_name; do
      # Get last active time for this agent
      last_active=$(echo "$ALL_AGENTS" | jq -r --arg name "$agent_name" \
        '.[] | select(.name == $name) | .last_active_ago // "never"')
      echo "  • $agent_name (last active: $last_active)"
    done
    echo ""

    # Use AskUserQuestion to let user choose:
    # Option 1: "Create new agent" → Fresh identity
    # Option 2: "Resume [AgentName]" → Use existing logged-out agent

  else
    # No logged-out agents available - all are currently active
    TOTAL_AGENTS=$(echo "$ALL_AGENTS" | jq 'length')

    echo "╔══════════════════════════════════════════════════════════════════════════╗"
    echo "║              ℹ️  All Agents Currently Logged In ($TOTAL_AGENTS total)        ║"
    echo "╚══════════════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "All registered agents are currently active in other sessions."
    echo ""
    echo "Options:"
    echo "  1. Create new agent (recommended)"
    echo "  2. Close other terminal to free up an agent"
    echo ""

    # Auto-create new agent
    echo "Creating new agent identity..."

    # Register new agent
    am-register --program claude-code --model sonnet-4.5
    # → Output shows agent name

    # Extract agent name from output
    # Example output: "✓ ✨ Created new agent: RichPrairie"
    # Parse the agent name and use it
  fi
else
  # DEFAULT MODE: Auto-create new agent (FAST - no prompt!)
  echo "╔══════════════════════════════════════════════════════════════════════════╗"
  echo "║                    ✨ Creating New Agent Session                         ║"
  echo "╚══════════════════════════════════════════════════════════════════════════╝"
  echo ""

  # Register new agent immediately (no questions asked)
  am-register --program claude-code --model sonnet-4.5
  # → Output shows agent name

  # Extract agent name from output
  # Example output: "✓ ✨ Created new agent: RichPrairie"
  # Parse the agent name and use it

  echo ""
  echo "💡 Tip: Use '/agent:start resume' to choose from existing agents"
fi

# After agent selection/creation, continue to session file writing...
```

**Key Decision Points:**

**Default behavior (no `resume` parameter):**
- Always auto-creates new agent immediately
- Fast! No prompts or menu
- Fresh identity every time
- Use this 99% of the time

**Resume mode (`/agent:start resume`):**
- Shows menu of ONLY logged-out agents (agents without active session files)
- Filters out agents currently logged in (have `.claude/agent-*.txt` files)
- User chooses which logged-out agent to resume or create new
- If all agents are logged in: auto-creates new agent
- Clean separation: can't accidentally log in as same agent in two terminals

**Note:** An agent is "logged in" if any `.claude/agent-*.txt` file contains their name

**CRITICAL: Check for duplicate active agents and write to session file:**

After registering the agent (or when no agents exist and creating new), ALWAYS check if agent is already active:

**Use Read/Bash/Write tools (RECOMMENDED):**

```bash
# Step 1: Get session ID (separate Bash call)
~/code/jat/scripts/get-current-session-id
# → "a019c84c-7b54-45cc-9eee-dd6a70dea1a3"

# Step 2: Check if agent already active (use Bash tool)
grep -l "YourAgentName" .claude/agent-*.txt 2>/dev/null
# → If found: ".claude/agent-9b2a2fac-61d7-4333-97da-230d64d19f04.txt"
# → If not found: no output

# Step 3: Compare found session to current session
# If different: Show error and exit
# If same or not found: Continue

# Step 4: Write agent name using Write tool
Write(.claude/agent-a019c84c-7b54-45cc-9eee-dd6a70dea1a3.txt, "YourAgentName")
# → Creates/updates the session file
```

**Alternative: Use bash with explicit variables:**

```bash
# ✅ CORRECT: First get session ID
~/code/jat/scripts/get-current-session-id | tr -d '\n'

# Then use explicit variable in separate call:
SESSION_ID="a019c84c-7b54-45cc-9eee-dd6a70dea1a3"; grep -l "YourAgentName" .claude/agent-*.txt | grep -v "agent-${SESSION_ID}.txt" && echo "ERROR: Already active" || (mkdir -p .claude && echo "YourAgentName" > ".claude/agent-${SESSION_ID}.txt" && echo "✓ Registered")
```

**Why Session Files Matter:**
- Each Claude Code session has a unique `session_id`
- Statusline reads from `.claude/agent-{session_id}.txt` (PRIMARY)
- `export AGENT_NAME` doesn't work (statusline is separate process)
- This enables multiple concurrent agents in different terminals

---

### STEP 1.5: Smart Cleanup of Previous Work

**IMPORTANT:** Before starting new work, check for and clean up stale state from previous tasks.

This prevents issues like:
- Stale file reservations showing wrong task in statusline
- Tasks stuck in `in_progress` when already completed
- Confusion about what's actually being worked on

#### Check for Active Reservations

```bash
# Get active reservations for this agent
ACTIVE_RESERVATIONS=$(am-reservations --agent "$AGENT_NAME" --json 2>/dev/null | jq -r '.[] | select(.released_ts == null)')

if [[ -n "$ACTIVE_RESERVATIONS" ]]; then
    # Extract task IDs from reservation reasons
    RESERVATION_TASKS=$(echo "$ACTIVE_RESERVATIONS" | jq -r '.reason' | grep -oE '(jat|chimaro|jomarchy)-[a-z0-9]{3}' | sort -u)

    if [[ -n "$RESERVATION_TASKS" ]]; then
        echo ""
        echo "⚠️  Found active file reservations from previous work:"

        # Check each task's status
        for task_id in $RESERVATION_TASKS; do
            # Get task status from Beads
            TASK_STATUS=$(bd show "$task_id" --json 2>/dev/null | jq -r '.[0].status // "unknown"')

            if [[ "$TASK_STATUS" == "closed" ]] || [[ "$TASK_STATUS" == "completed" ]]; then
                # Task is done - auto-release silently
                echo "  🔒 Task $task_id is closed - auto-releasing reservations"

                # Get patterns for this task
                PATTERNS=$(echo "$ACTIVE_RESERVATIONS" | jq -r "select(.reason | contains(\"$task_id\")) | .pattern" | tr '\n' ' ')

                for pattern in $PATTERNS; do
                    am-release "$pattern" --agent "$AGENT_NAME" >/dev/null 2>&1
                done

            elif [[ "$TASK_STATUS" == "in_progress" ]]; then
                # Task still active - ask user what to do
                echo ""
                echo "  📋 Task $task_id is still in_progress"
                echo "  🔒 File reservations are active"
                echo ""

                # Use AskUserQuestion
                # Options:
                # 1. "Complete task $task_id" → Run /agent:complete $task_id logic
                # 2. "Abandon task $task_id" → Release locks, unassign
                # 3. "Keep working on $task_id" → Cancel /agent:start, resume work
                # 4. "Force release locks only" → Just release, don't change task status

                # For now, show warning and let user decide
                echo "Options:"
                echo "  1. Run /agent:complete $task_id first"
                echo "  2. Run /agent:pause $task_id to abandon"
                echo "  3. Continue working on $task_id (cancel this /agent:start)"
                echo ""
                read -p "What do you want to do? (1/2/3): " -n 1 -r
                echo ""

                case $REPLY in
                    1)
                        echo "Please run: /agent:complete $task_id"
                        exit 1
                        ;;
                    2)
                        echo "Please run: /agent:pause $task_id --reason 'Switching tasks'"
                        exit 1
                        ;;
                    3)
                        echo "Cancelled. Continue working on $task_id"
                        exit 0
                        ;;
                    *)
                        echo "Invalid choice. Exiting."
                        exit 1
                        ;;
                esac
            fi
        done
    fi
fi
```

#### Alternative: Simple Auto-Release

For a simpler implementation (less interactive):

```bash
# Auto-release ALL reservations if they're from closed tasks
ACTIVE_RESERVATIONS=$(am-reservations --agent "$AGENT_NAME" 2>/dev/null | grep -v "^$")

if [[ -n "$ACTIVE_RESERVATIONS" ]]; then
    echo "🔧 Checking for stale reservations..."

    # Extract task IDs from reasons
    TASK_IDS=$(echo "$ACTIVE_RESERVATIONS" | grep "^Reason:" | grep -oE '(jat|chimaro|jomarchy)-[a-z0-9]{3}' | sort -u)

    for task_id in $TASK_IDS; do
        TASK_STATUS=$(bd show "$task_id" --json 2>/dev/null | jq -r '.[0].status // "unknown"')

        if [[ "$TASK_STATUS" == "closed" ]]; then
            echo "  ✓ Releasing locks from closed task: $task_id"
            # Release all reservations for this agent (using JSON to avoid pipe issues)
            PATTERNS=$(am-reservations --agent "$AGENT_NAME" --json 2>/dev/null | jq -r '.[].path_pattern' | tr '\n' ' ')
            for pattern in $PATTERNS; do
                am-release "$pattern" --agent "$AGENT_NAME" 2>/dev/null || true
            done
        fi
    done
fi
```

**When to run this:**
- After agent registration (STEP 1)
- Before task selection (STEP 2)
- Always run for safety (minimal performance cost)

**Benefits:**
- ✅ Automatically cleans up completed work
- ✅ Prevents stale statusline display
- ✅ Asks user for guidance on ambiguous cases
- ✅ Single-command workflow (`/agent:start` just works)

---

### STEP 2: Determine Task to Work On

#### If PARAM_TYPE == "task-id":
```bash
TASK_ID="$PARAM"  # Already extracted in STEP 0
# Verify task exists
if ! bd show "$TASK_ID" --json >/dev/null 2>&1; then
  echo "❌ Error: Task '$TASK_ID' not found in Beads"
  echo "💡 Use 'bd list' to see available tasks"
  exit 1
fi
```

#### If PARAM_TYPE == "none" or "agent-name":
```bash
# Show task recommendations (DO NOT auto-start)
# User must explicitly run /agent:start TASK_ID to begin work

READY_TASKS=$(bd ready --json)
READY_COUNT=$(echo "$READY_TASKS" | jq 'length')

if [[ "$READY_COUNT" -eq 0 ]]; then
  echo ""
  echo "❌ No ready tasks available"
  echo "💡 Use 'bd create' to create a task or 'bd list' to see all tasks"
  echo ""
  exit 0
fi

# Show available tasks with details
echo ""
echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║                         📋 Available Tasks                               ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Display tasks in a readable format
echo "$READY_TASKS" | jq -r '.[] |
  "  [\(.priority | if . == 0 then "P0" elif . == 1 then "P1" else "P2" end)] \(.id) - \(.title)
   Type: \(.issue_type) | Status: \(.status) | Assignee: \(.assignee // "unassigned")
"'

echo "────────────────────────────────────────────────────────────────────────────"
echo ""
echo "💡 To start working on a task, run:"
echo ""
echo "   /agent:start TASK_ID"
echo ""
echo "Example: /agent:start $(echo "$READY_TASKS" | jq -r '.[0].id')"
echo ""

# EXIT HERE - don't continue to STEP 3-9
exit 0
```

---

**🚨 IMPORTANT: The following steps (3-9) ONLY execute when a task-id is provided.**

When no task is specified (`PARAM_TYPE == "none"` or `"agent-name"`), we exit after showing recommendations in STEP 2. The user must explicitly run `/agent:start TASK_ID` to actually start work.

---

### STEP 3: Detect Task Type (Bulk vs Normal)

**This step and all following steps only run when PARAM_TYPE == "task-id"**

Analyze task to determine completion strategy:

```bash
task_info=$(bd show "$TASK_ID" --json)
title=$(echo "$task_info" | jq -r '.title')
description=$(echo "$task_info" | jq -r '.description')
labels=$(echo "$task_info" | jq -r '.labels[]' 2>/dev/null || echo "")

# Check bulk indicators
bulk_indicators=0

# Title patterns (case-insensitive)
if echo "$title" | grep -iE "(fix .* errors|eliminate|cleanup|remove all)" >/dev/null; then
  ((bulk_indicators++))
fi

# Label patterns
if echo "$labels" | grep -E "(bulk|remediation|cleanup|tech-debt|mass-fix)" >/dev/null; then
  ((bulk_indicators++))
fi

if [[ $bulk_indicators -ge 2 ]]; then
  TASK_MODE="bulk"
  echo "🔧 Detected BULK REMEDIATION task"
else
  TASK_MODE="normal"
fi
```

---

### STEP 4: Conflict Detection (Skip if QUICK_MODE or BULK)

**Only run if QUICK_MODE=false AND TASK_MODE=normal:**

#### A) Check File Reservations
```bash
# Get current reservations
RESERVATIONS=$(am-reservations --json)

# Check if task files are locked by another agent
# Parse task description for file patterns
# Check for conflicts

# If conflicts found:
#   - Show which agent has locks
#   - Ask user: Override? Wait? Pick different task?
```

#### B) Check Git Working Directory
```bash
# Check for uncommitted changes
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
  echo "⚠️  Warning: Uncommitted changes detected"
  echo "💡 Consider committing or stashing before starting new work"
  # Ask user: Continue? Commit first? Stash?
fi
```

#### C) Check Task Dependencies
```bash
# Check if task has unmet dependencies
deps=$(echo "$task_info" | jq -r '.dependencies[]' 2>/dev/null)
if [[ -n "$deps" ]]; then
  # Verify all dependency tasks are completed
  # If blocked: Show blocking tasks and suggest working on those first
fi
```

---

### STEP 5: Reserve Files for This Task

```bash
# Parse task description for file patterns
# Common patterns to reserve based on task type:
# - Frontend: src/routes/**, src/lib/components/**
# - Backend: src/api/**, src/lib/server/**
# - Docs: docs/**, README.md

# Example reservation:
am-reserve "src/routes/auth/**" "src/lib/auth/**" \
  --agent "$AGENT_NAME" \
  --ttl 7200 \
  --exclusive \
  --reason "$TASK_ID"

echo "🔒 Reserved files for $TASK_ID"
```

---

### STEP 6: Announce Start in Agent Mail

```bash
# Send message to project thread
am-send "[$TASK_ID] Starting: $TASK_TITLE" \
  "Starting work on $TASK_ID

**Task:** $TASK_TITLE
**Agent:** $AGENT_NAME
**Reserved files:** (list patterns)
**ETA:** (estimate based on task complexity)

Will update thread with progress." \
  --from "$AGENT_NAME" \
  --to "Team" \
  --thread "$TASK_ID"

echo "📬 Announced start in Agent Mail"
```

---

### STEP 7: Update Beads Task Status

```bash
# Mark task as in_progress (note: underscore not hyphen!)
bd update "$TASK_ID" --status in_progress --assignee "$AGENT_NAME"

echo "✅ Updated Beads task status"
```

---

### STEP 8: Review Inbox (Quick Check)

```bash
# Quick inbox check (don't block on this)
UNREAD_COUNT=$(am-inbox "$AGENT_NAME" --unread --json | jq 'length')

if [[ "$UNREAD_COUNT" -gt 0 ]]; then
  echo "📬 Note: You have $UNREAD_COUNT unread messages"
  echo "💡 Run /agent:status to review messages"
fi
```

---

### STEP 9: Show Task Context and Start

Display comprehensive start summary:

```
╔══════════════════════════════════════════════════════════════════════════╗
║                    🚀 STARTING WORK: {TASK_ID}                           ║
╚══════════════════════════════════════════════════════════════════════════╝

✅ Agent: {AGENT_NAME}
📋 Task: {TASK_TITLE}
🎯 Priority: P{X}
📁 Type: {bug/feature/task}
⏱️  Status: In Progress

┌─ TASK DETAILS ─────────────────────────────────────────────────────────┐
│                                                                        │
│  {DESCRIPTION}                                                         │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ WORK CONTEXT ─────────────────────────────────────────────────────────┐
│                                                                        │
│  🔒 Files reserved: {PATTERNS}                                         │
│  📬 Agent Mail thread: {TASK_ID}                                       │
│  🔗 Dependencies: {NONE or list}                                       │
│  ⚠️  Conflicts: {NONE or details}                                      │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ NEXT STEPS ───────────────────────────────────────────────────────────┐
│                                                                        │
│  1. Read task description and acceptance criteria                     │
│  2. Make your changes                                                  │
│  3. Test your work                                                     │
│  4. Commit with message: "feat: {description} [{TASK_ID}]"            │
│  5. Run /agent:complete {TASK_ID} when done                           │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

💡 You're all set! Start coding.
```

---

## Quick Mode Behavior

When `QUICK_MODE=true`:
- ✅ Registration (always)
- ✅ Session file update (always)
- ✅ Task selection (always)
- ❌ Conflict detection (SKIPPED)
- ❌ Dependency checks (SKIPPED)
- ✅ File reservation (always)
- ✅ Agent Mail announcement (always)
- ✅ Beads status update (always)

**Use quick mode when:**
- You're the only one working on the project
- You know there are no conflicts
- You need to start immediately

---

## Bulk Remediation Mode

When `TASK_MODE=bulk` is detected:
- Different completion strategy (see `/agent:complete` for bulk handling)
- May skip some conflict checks (bulk work often touches many files)
- Updates Agent Mail with bulk progress tracking

---

## Parameter Combinations

| Command | Behavior |
|---------|----------|
| `/agent:start` | **Auto-create new agent** (fast!) → show task recommendations (no auto-start) |
| `/agent:start resume` | Show menu to **choose from existing agents** → show task recommendations |
| `/agent:start MyAgent` | Register as MyAgent → show task recommendations (no auto-start) |
| `/agent:start task-abc` | Auto-create agent if needed → **actually start** task-abc (full flow) |
| `/agent:start task-abc quick` | Auto-create agent → **actually start** task-abc (skip conflict checks) |

**Key distinctions:**
- **Default (no param)**: Auto-creates new agent immediately (FAST!)
- **With `resume`**: Shows menu to choose existing agents (when you want to resume)
- **Without task-id**: Shows task recommendations, exits, waits for user to choose
- **With task-id**: Actually starts work (reserves files, updates Beads, sends mail)

---

## Session Awareness Details

**How statusline works:**
1. Statusline writes session ID to `/tmp/claude-session-${PPID}.txt` (PPID = parent process ID)
2. Looks for `.claude/agent-{session_id}.txt` (session-specific file)
3. If found: displays that agent name
4. If not found: checks `$AGENT_NAME` env var (fallback)

**Why PPID-based tracking?**

Previous approach used a shared file `.claude/current-session-id.txt` which caused race conditions when multiple Claude Code instances ran simultaneously. PPID-based tracking solves this by giving each process its own unique file.

**Why this matters:**
- Prevents race conditions between concurrent Claude Code sessions
- Each terminal can have a different agent identity
- Statusline always shows correct agent for YOUR session
- Process isolation ensures no conflicts

**File locations:**
- `/tmp/claude-session-${PPID}.txt` - Written by statusline (your session ID, PPID-based, auto-deleted on exit)
- `.claude/agent-{session_id}.txt` - Written by this command (your agent name, persistent)

**CRITICAL Implementation Detail:**

Always use **Read/Write tools** or **explicit bash variables** for session file handling:

```bash
✅ CORRECT Method 1 (RECOMMENDED): Use Read/Write tools
# Step 1: Get session ID
~/code/jat/scripts/get-current-session-id
# → Output: "a019c84c-7b54-45cc-9eee-dd6a70dea1a3"

# Step 2: Use Write tool with the session ID from step 1
Write(.claude/agent-a019c84c-7b54-45cc-9eee-dd6a70dea1a3.txt, "AgentName")

✅ CORRECT Method 2 (ALTERNATIVE): Use bash with explicit variable
# First get session ID:
~/code/jat/scripts/get-current-session-id | tr -d '\n'

# Then in SEPARATE bash call with explicit assignment:
SESSION_ID="a019c84c-7b54-45cc-9eee-dd6a70dea1a3"; mkdir -p .claude && echo "AgentName" > ".claude/agent-${SESSION_ID}.txt"

❌ WRONG: Command substitution in variable assignment
# This gets escaped by Bash tool and causes syntax errors:
SESSION_ID=$(~/code/jat/scripts/get-current-session-id 2>/dev/null | tr -d '\n')
# Error: SESSION_ID=\$ ( ... ) syntax error

❌ WRONG: Using $PPID directly
# Each Bash tool invocation runs in a NEW subprocess with DIFFERENT PPID!
SESSION_ID=$(cat /tmp/claude-session-${PPID}.txt | tr -d '\n')  # BROKEN
```

**Why this approach works:**
- Read/Write tools work directly (no bash escaping issues)
- Explicit bash variables avoid command substitution escaping
- Helper script finds most recently modified session file (by timestamp)
- Works even when bash commands run in subprocesses with different PPIDs
- Each Bash tool invocation gets a new PPID, so can't rely on $PPID
- Statusline updates the session file on every render, so newest = active
- No race conditions between multiple Claude Code instances

---

## Error Handling

**Common errors:**
- "Task not found" → Check task ID, use `bd list` to see tasks
- "Agent registration failed" → Check Agent Mail DB permissions
- "Agent already active" → Another terminal is using this agent name. Close that session or choose different name
- "File reservation conflict" → Another agent has locks, coordinate or wait
- "No ready tasks" → Create task with `bd create` or use `bd list`
- "Could not detect session ID" → Statusline hasn't run yet or `/tmp/claude-session-${PPID}.txt` missing
- "Session file not updating" → Check PPID file exists: `cat /tmp/claude-session-${PPID}.txt`

---

## Notes

- **Global agent uniqueness:** Agent names are globally unique across all projects - no duplicates allowed
- **Simple global lookup:** Uses `am-agents | grep` for simple, fast agent detection (no project filtering)
- **Smart cleanup:** Auto-releases file reservations from closed tasks before starting new work
- **Stale state detection:** Checks for in_progress tasks and prompts user when ambiguous
- **PPID-based isolation:** Uses `/tmp/claude-session-${PPID}.txt` for race-free multi-terminal support
- **One agent per terminal:** Blocks registration if agent is already active in another session
- **Session-first:** Always writes to session file before env var
- **Helper script approach:** Use `get-current-session-id` script (finds most recent session file by timestamp)
- **Resume existing agents:** Always checks if agent name exists globally before registering to prevent duplicates
- **Smart defaults:** Auto-detects recent agents, picks best task
- **Conflict-aware:** Checks locks, git status, dependencies
- **Actually starts:** Not just recommendations - reserves files and updates status
- **Multi-agent ready:** Supports concurrent agents in different terminals (each with unique name globally)
- **Quick mode:** Skip safety checks when you need speed

---

## Comparison with Other Commands

| Command | Use Case |
|---------|----------|
| `/agent:start` | "Show me what to work on" - registration + show recommendations (no auto-start) |
| `/agent:start MyAgent` | "Register as specific agent" - explicit identity + show recommendations |
| `/agent:start task-abc` | "Start this specific task NOW" - direct task start (full flow) |
| `/agent:complete` | "I'm done with this task" - complete and release |
| `/agent:status` | "What am I working on?" - current status check |
