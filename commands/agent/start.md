---
argument-hint: [agent-name | task-id | quick]
---

Get to work! Unified smart command that handles registration, task selection, conflict detection, and actually starts work.

# Start Working - Unified Smart Command

**Usage:**
- `/agent:start` - Auto-detect/create agent, show task recommendations
- `/agent:start agent-name` - Register as specific agent, show tasks
- `/agent:start task-id` - Auto-register if needed, start that task
- `/agent:start task-id quick` - Skip conflict checks (fast mode)

**What this command does:**
1. **Smart Registration:** Auto-detects recent agents (last 60 min) or creates new
2. **Session Persistence:** Updates `.claude/agent-{session_id}.txt` for statusline
3. **Task Selection:** From parameter, conversation context, or priority
4. **Conflict Detection:** File locks, git changes, dependencies
5. **Actually Starts Work:** Reserves files, sends Agent Mail, updates Beads

---

## Implementation Steps

### STEP 0: Parse Parameters

Extract parameter and detect mode:

```bash
PARAM="$1"  # Could be: empty, agent-name, task-id, or "quick"
QUICK_MODE=false

# Check for quick mode
if [[ "$PARAM" == "quick" ]] || [[ "$2" == "quick" ]]; then
  QUICK_MODE=true
fi

# Determine parameter type
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
```

---

### STEP 1: Session-Aware Agent Registration

**CRITICAL: Always update session file for statusline**

#### 1A: Check Current Agent Status

```bash
# Get session ID
SESSION_ID=$(cat .claude/current-session-id.txt 2>/dev/null | tr -d '\n')

# Check if agent already registered for this session
if [[ -n "$SESSION_ID" ]] && [[ -f ".claude/agent-${SESSION_ID}.txt" ]]; then
  CURRENT_AGENT=$(cat ".claude/agent-${SESSION_ID}.txt" 2>/dev/null | tr -d '\n')
  AGENT_REGISTERED=true
else
  CURRENT_AGENT=""
  AGENT_REGISTERED=false
fi
```

#### 1B: Handle Agent Registration Based on Parameter

**If PARAM_TYPE == "agent-name":**
```bash
# User explicitly requested an agent
AGENT_NAME="$REQUESTED_AGENT"
am-register --name "$AGENT_NAME" --program claude-code --model sonnet-4.5

# Write to session file (PRIMARY - statusline reads this)
if [[ -n "$SESSION_ID" ]]; then
  mkdir -p .claude
  echo "$AGENT_NAME" > ".claude/agent-${SESSION_ID}.txt"
fi

# Export env var (FALLBACK - for bash scripts)
export AGENT_NAME="$AGENT_NAME"
```

**If AGENT_REGISTERED == true:**
```bash
# Use existing agent from session
AGENT_NAME="$CURRENT_AGENT"
echo "✅ Resuming as $AGENT_NAME (session agent)"
```

**If AGENT_REGISTERED == false AND no agent requested:**
```bash
# Smart agent detection (1-hour window)
RECENT_AGENTS=$(./scripts/get-recent-agents 60 2>/dev/null)
AGENT_COUNT=$(echo "$RECENT_AGENTS" | jq 'length' 2>/dev/null || echo "0")

if [[ "$AGENT_COUNT" -gt 0 ]]; then
  # Found recent agents - offer menu
  MOST_RECENT=$(echo "$RECENT_AGENTS" | jq -r '.[0].name')

  # Use AskUserQuestion to show options:
  # Option 1: Resume {MOST_RECENT} (default)
  # Option 2: Create new agent
  # Option 3: See all agents (redirect to /agent:register)

  # Based on user selection:
  # - If resume: AGENT_NAME=$MOST_RECENT
  # - If create new: generate random name
  # - If see all: redirect to /agent:register and exit

else
  # No recent agents - auto-create
  echo "╔══════════════════════════════════════════════════════════════════════════╗"
  echo "║                    🌟 Starting Fresh Session                             ║"
  echo "╚══════════════════════════════════════════════════════════════════════════╝"
  echo ""
  echo "No agents active in the last hour. Creating new agent identity..."

  AGENT_NAME=$(am-register --program claude-code --model sonnet-4.5 | \
    grep "Registered:" | awk '{print $3}')

  echo "✨ Created new agent: $AGENT_NAME"
fi

# Register the selected/created agent
am-register --name "$AGENT_NAME" --program claude-code --model sonnet-4.5

# CRITICAL: Write to session file (statusline reads this)
if [[ -n "$SESSION_ID" ]]; then
  mkdir -p .claude
  echo "$AGENT_NAME" > ".claude/agent-${SESSION_ID}.txt"
  echo "✓ Session file updated: .claude/agent-${SESSION_ID}.txt"
fi

# Export env var (fallback)
export AGENT_NAME="$AGENT_NAME"
```

**Why Session Files Matter:**
- Each Claude Code session has a unique `session_id`
- Statusline reads from `.claude/agent-{session_id}.txt` (PRIMARY)
- `export AGENT_NAME` doesn't work (statusline is separate process)
- This enables multiple concurrent agents in different terminals

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

#### If PARAM_TYPE == "none":
```bash
# Smart task selection based on conversation context

# A) Analyze Recent Conversation
# Review last 3-5 messages for context:
# - Feature/work discussed?
# - Bug/issue described?
# - User needs expressed?

# B) Search Beads for Related Tasks
# If conversation context detected:
#   1. Search Beads using keywords
#   2. If matches found: Ask user to confirm or select
#   3. If no matches: Offer to create task from context

# C) Fall Back to Auto-Select
# If no conversation context:
#   1. Run: bd ready --json
#   2. Pick highest priority task (P0 > P1 > P2)
#   3. If no ready tasks: Report and suggest /agent:plan

READY_TASKS=$(bd ready --json)
READY_COUNT=$(echo "$READY_TASKS" | jq 'length')

if [[ "$READY_COUNT" -eq 0 ]]; then
  echo "❌ No ready tasks available"
  echo "💡 Use 'bd create' to create a task or 'bd list' to see all tasks"
  exit 1
fi

# Pick highest priority task
TASK_ID=$(echo "$READY_TASKS" | jq -r '.[0].id')
TASK_TITLE=$(echo "$READY_TASKS" | jq -r '.[0].title')

echo "🎯 Auto-selected: $TASK_ID - $TASK_TITLE"
```

---

### STEP 3: Detect Task Type (Bulk vs Normal)

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
# Mark task as in-progress
bd update "$TASK_ID" --status in-progress --assignee "$AGENT_NAME"

# Add start note
bd add "$TASK_ID" "Started work (agent: $AGENT_NAME)"

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
| `/agent:start` | Auto-detect/create agent → show task recommendations |
| `/agent:start MyAgent` | Register as MyAgent → show task recommendations |
| `/agent:start task-abc` | Auto-register if needed → start task-abc |
| `/agent:start task-abc quick` | Auto-register → start task-abc (skip conflict checks) |

---

## Session Awareness Details

**How statusline works:**
1. Statusline reads `.claude/current-session-id.txt` (e.g., "abc123")
2. Looks for `.claude/agent-abc123.txt` (session-specific file)
3. If found: displays that agent name
4. If not found: checks `$AGENT_NAME` env var (fallback)

**Why this matters:**
- Supports multiple concurrent Claude Code sessions
- Each terminal can have a different agent
- Statusline always shows correct agent for YOUR session

**File locations:**
- `.claude/current-session-id.txt` - Written by statusline (your session ID)
- `.claude/agent-{session_id}.txt` - Written by this command (your agent name)

---

## Error Handling

**Common errors:**
- "Task not found" → Check task ID, use `bd list` to see tasks
- "Agent registration failed" → Check Agent Mail DB permissions
- "File reservation conflict" → Another agent has locks, coordinate or wait
- "No ready tasks" → Create task with `bd create` or use `bd list`

---

## Notes

- **Session-first:** Always writes to session file before env var
- **Smart defaults:** Auto-detects recent agents, picks best task
- **Conflict-aware:** Checks locks, git status, dependencies
- **Actually starts:** Not just recommendations - reserves files and updates status
- **Multi-agent ready:** Supports concurrent agents in different terminals
- **Quick mode:** Skip safety checks when you need speed

---

## Comparison with Other Commands

| Command | Use Case |
|---------|----------|
| `/agent:start` | "Just get me working" - registration + task start |
| `/agent:start MyAgent` | "Work as specific agent" - explicit identity |
| `/agent:start task-abc` | "Start this task" - direct task start |
| `/agent:register` | "Show me all agents" - explicit registration with full review |
| `/agent:complete` | "I'm done with this task" - complete and release |
| `/agent:status` | "What am I working on?" - current status check |
