---
argument-hint: [quick]
---

Complete current task and immediately start the next one. Drive mode for high-velocity work.

# Agent Next - Complete and Continue

**Usage:**
- `/agent:next` - **Complete task + auto-start next** (DEFAULT - full verification)
- `/agent:next quick` - Complete task + auto-start next (skip verification, fast)

**What this command does:**
1. **Full Completion Protocol** (unless quick mode):
   - Verify task (tests, lint, security, browser checks)
   - Commit changes with proper message
2. **Agent Mail Coordination**:
   - Check and acknowledge ALL unread messages
   - Announce task completion (thread: task-id)
3. **Beads Task Management**:
   - Mark task as complete in Beads
   - Release file reservations
4. **Auto-Continue**:
   - Automatically pick highest priority ready task
   - Start work immediately (no menu, no pause)

**When to use:**
- **Drive mode**: You're in flow state and want to keep going
- **Sprint work**: Burning through a task list
- **High velocity**: Trust your work, don't want interruptions

**When NOT to use:**
- Need to choose next task manually → use `/agent:complete` instead
- Need to pivot to different work → use `/agent:pause` instead
- Uncertain about quality → run `/agent:verify` first

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

---

## Implementation Steps

### STEP 0: Parse Mode

```bash
MODE="${1:-verify}"  # Default to full verification

if [[ "$1" == "quick" ]]; then
  SKIP_VERIFICATION=true
else
  SKIP_VERIFICATION=false
fi
```

---

### STEP 1: Get Current Task and Agent Identity

#### 1A: Get Session ID
```bash
# Use Read tool to get session ID
Read(/tmp/claude-session-${PPID}.txt)
# → Extract session_id value from output
```

#### 1B: Get Agent Name
```bash
# Use Read tool to get agent name
Read(.claude/agent-${session_id}.txt)
# → Extract agent_name from output
```

#### 1C: Get Current Task
```bash
# Get task from Beads (in_progress tasks for this agent)
bd list --json | jq -r --arg agent "$agent_name" \
  '.[] | select(.assignee == $agent and .status == "in_progress") | .id' | head -1
```

**Error handling:**
- If no session ID found → error "No active session. Run /agent:start first"
- If no agent name found → error "No agent registered. Run /agent:start first"
- If no in_progress task → error "No task in progress. Run /agent:start to begin work"

---

### STEP 2: Verify Task (Unless Quick Mode)

**Only run if `SKIP_VERIFICATION=false`**

```bash
if [[ "$SKIP_VERIFICATION" == "false" ]]; then
  echo "🔍 Verifying task before completion..."

  # Run /agent:verify for current task
  # This handles: tests, lint, security, browser checks
  # (Delegate to verify.md implementation)

  # If verification fails, STOP and report issues
  # Do NOT continue to completion
fi
```

---

### STEP 3: Commit Changes

```bash
echo "💾 Committing changes..."

# Get task details for commit message
task_json=$(bd show "$task_id" --json)
task_title=$(echo "$task_json" | jq -r '.title')
task_type=$(echo "$task_json" | jq -r '.type')

# Check git status
git_status=$(git status --porcelain)

if [[ -n "$git_status" ]]; then
  # Stage all changes
  git add .

  # Create commit message
  git commit -m "$(cat <<EOF
$task_type: $task_title

Task: $task_id

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
else
  echo "✅ No changes to commit"
fi
```

---

### STEP 4: Agent Mail Coordination

#### 4A: Check Unread Messages
```bash
echo "📬 Checking Agent Mail..."

unread_count=$(am-inbox "$agent_name" --unread --json | jq '. | length')

if [[ "$unread_count" -gt 0 ]]; then
  echo "📬 $unread_count unread messages - acknowledging all..."

  # Get all unread message IDs and acknowledge them
  am-inbox "$agent_name" --unread --json | jq -r '.[].id' | while read msg_id; do
    am-ack "$msg_id" --agent "$agent_name"
  done

  echo "✅ Acknowledged $unread_count messages"
fi
```

#### 4B: Announce Completion
```bash
echo "📢 Announcing task completion..."

# Send completion message to Agent Mail
am-send "[$task_id] Completed: $task_title" \
  "Task completed by $agent_name and moving to next task.

Status: ✅ Complete
Type: $task_type
Verification: $(if [[ "$SKIP_VERIFICATION" == "false" ]]; then echo "Full"; else echo "Quick (skipped)"; fi)

Starting next task automatically." \
  --from "$agent_name" \
  --to @active \
  --thread "$task_id" \
  --importance normal
```

---

### STEP 5: Mark Task Complete in Beads

```bash
echo "✅ Marking task complete in Beads..."

bd close "$task_id" --reason "Completed by $agent_name"
```

---

### STEP 6: Release File Reservations

```bash
echo "🔓 Releasing file reservations..."

# Get all reservations for this agent
reservations=$(am-reservations --agent "$agent_name")

if [[ -n "$reservations" ]]; then
  # Release all patterns
  # Note: am-release takes glob patterns, extract from reservation info
  echo "$reservations" | grep -oE '"[^"]*"' | tr -d '"' | while read pattern; do
    am-release "$pattern" --agent "$agent_name"
  done

  echo "✅ Released all file reservations"
else
  echo "✅ No active reservations"
fi
```

---

### STEP 7: Auto-Start Next Task

```bash
echo "🚀 Starting next task automatically..."

# Get highest priority ready task
next_task=$(bd ready --json | jq -r '.[0].id')

if [[ -z "$next_task" ]] || [[ "$next_task" == "null" ]]; then
  echo "✅ Task completed!"
  echo ""
  echo "📋 No more ready tasks available."
  echo "🎉 All caught up!"
  exit 0
fi

# Show which task we're starting
next_task_json=$(bd show "$next_task" --json)
next_task_title=$(echo "$next_task_json" | jq -r '.title')
next_task_priority=$(echo "$next_task_json" | jq -r '.priority')

echo ""
echo "➡️  Auto-starting next task:"
echo "   Task: $next_task"
echo "   Priority: P$next_task_priority"
echo "   Title: $next_task_title"
echo ""

# Delegate to /agent:start to actually start the task
# This handles: conflict detection, file reservation, agent mail announcement
# Pass task_id and "quick" mode (skip conflict checks since we're in flow)
/agent:start "$next_task" quick
```

---

## Quick Mode Behavior

**When using `/agent:next quick`:**

**Skipped:**
- ❌ Task verification (tests, lint, security, browser)
- ❌ Conflict detection when starting next task

**Still done:**
- ✅ Commit changes
- ✅ Acknowledge all Agent Mail messages
- ✅ Announce completion
- ✅ Mark task complete in Beads
- ✅ Release file reservations
- ✅ Auto-start next task

**Use quick mode when:**
- You're solo (no conflicts possible)
- You trust your work (ran tests manually)
- Speed is critical (rapid iteration)

---

## Output Example

**Default mode (`/agent:next`):**
```
🔍 Verifying task before completion...
   ✅ Tests passed (12/12)
   ✅ Lint clean
   ✅ Security scan clean
   ✅ Browser checks passed

💾 Committing changes...
   ✅ Committed: "feat: Add user settings page"

📬 Checking Agent Mail...
   📬 3 unread messages - acknowledging all...
   ✅ Acknowledged 3 messages

📢 Announcing task completion...
   ✅ Sent completion message to @active

✅ Marking task complete in Beads...
   ✅ Closed jat-abc

🔓 Releasing file reservations...
   ✅ Released src/lib/**/*.ts (2 files)

🚀 Starting next task automatically...

➡️  Auto-starting next task:
   Task: jat-xyz
   Priority: P1
   Title: Update documentation for new API

[... /agent:start jat-xyz quick runs here ...]
```

**Quick mode (`/agent:next quick`):**
```
💾 Committing changes...
   ✅ Committed: "feat: Add user settings page"

📬 Checking Agent Mail...
   ✅ No unread messages

📢 Announcing task completion...
   ✅ Sent completion message to @active

✅ Marking task complete in Beads...
   ✅ Closed jat-abc

🔓 Releasing file reservations...
   ✅ Released all reservations

🚀 Starting next task automatically...

➡️  Auto-starting next task:
   Task: jat-xyz
   Priority: P1
   Title: Update documentation for new API

[Starting immediately without verification...]
```

---

## Error Handling

**No active session:**
```
❌ No active session detected.
💡 Run /agent:start to begin working
```

**No task in progress:**
```
❌ No task currently in progress.
💡 Run /agent:start to pick a task
```

**Verification failed:**
```
❌ Task verification failed:
   • 2 tests failing
   • 5 lint errors

💡 Fix issues and try again, or use /agent:next quick to skip verification
```

**Git commit failed:**
```
❌ Failed to commit changes:
   [git error message]

💡 Fix git issues and try again
```

**No next task available:**
```
✅ Task completed!

📋 No more ready tasks available.
🎉 All caught up!
```
