---
argument-hint:
---

Pause current task quickly (without full completion) and show available tasks to pivot to different work.

# Agent Pause - Quick Pivot

**Usage:**
- `/agent:pause` - Pause current task, show menu to pivot to different work

**What this command does:**
1. **Quick Save** (always fast, no verification):
   - Quick commit or stash uncommitted changes
   - No tests, no lint, no quality checks
2. **Agent Mail Coordination**:
   - Check and acknowledge ALL unread messages
   - Send pause notification with reason (thread: task-id)
3. **Beads Task Management**:
   - Mark task as "worked on but incomplete" (status stays in_progress)
   - Update task with pause note
   - Release file reservations
4. **Next Task Selection**:
   - Show available tasks menu
   - Wait for user to choose (does NOT auto-start)

**When to use:**
- **Emergency exit**: Laptop dying, need to stop immediately
- **Pivot to different work**: Got distracted, want to switch tasks
- **Blocked**: Can't continue, need to work on something else
- **Context switch**: Switching from frontend to backend work

**When NOT to use:**
- Task is actually complete → use `/agent:complete` instead
- Want to auto-continue → use `/agent:next` instead

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
- If no in_progress task → warning "No task in progress" but continue to show menu

---

### STEP 2: Quick Save Changes

```bash
echo "💾 Quick saving changes..."

# Check git status
git_status=$(git status --porcelain)

if [[ -n "$git_status" ]]; then
  # Stage all changes
  git add .

  # Quick commit (no verification)
  task_json=$(bd show "$task_id" --json)
  task_title=$(echo "$task_json" | jq -r '.title')

  git commit -m "$(cat <<EOF
WIP: $task_title

Task: $task_id (paused, incomplete)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"

  echo "✅ Quick commit done"
else
  echo "✅ No changes to save"
fi
```

---

### STEP 3: Agent Mail Coordination

#### 3A: Check Unread Messages
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

#### 3B: Announce Pause
```bash
echo "📢 Announcing task pause..."

# Send pause message to Agent Mail
am-send "[$task_id] Paused: $task_title" \
  "Task paused by $agent_name (incomplete).

Status: ⏸️  Paused (in_progress)
Reason: Switching to different work

Agent is now available for next task." \
  --from "$agent_name" \
  --to @active \
  --thread "$task_id" \
  --importance low
```

---

### STEP 4: Update Task in Beads

```bash
echo "⏸️  Updating task status in Beads..."

# Add pause note to task (keep status as in_progress)
# Note: Task remains assigned to agent and in_progress
# This allows agent to resume later or other agents to see it's paused

# We could add a label "paused" or update description
# For now, just leave it as in_progress with the Agent Mail notification

echo "✅ Task remains in_progress (can resume later)"
```

---

### STEP 5: Release File Reservations

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

### STEP 6: Show Available Tasks Menu

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏸️  Task Paused: $task_id \"$task_title\""
echo "👤 Agent: $agent_name"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get available tasks (exclude current paused task)
available_tasks=$(bd ready --json | jq --arg task "$task_id" \
  '.[] | select(.id != $task)')
task_count=$(echo "$available_tasks" | jq -s '. | length')

if [[ "$task_count" -eq 0 ]]; then
  echo "📋 No other ready tasks available."
  echo ""
  echo "💡 Next steps:"
  echo "   • /agent:start $task_id - Resume this task"
  echo "   • /agent:plan - Create new tasks"
  echo "   • Close terminal if done for the day"
  exit 0
fi

# Get recommended next task (highest priority)
recommended_task=$(echo "$available_tasks" | jq -s '.[0]')
rec_id=$(echo "$recommended_task" | jq -r '.id')
rec_title=$(echo "$recommended_task" | jq -r '.title')
rec_priority=$(echo "$recommended_task" | jq -r '.priority')
rec_type=$(echo "$recommended_task" | jq -r '.type')

echo "📋 Available Tasks to Switch To ($task_count total):"
echo ""

# Display tasks in table format
echo "$available_tasks" | jq -s -r '.[] |
  "   [\(.priority)] \(.id) - \(.title) (\(.type))"' | head -10

if [[ "$task_count" -gt 10 ]]; then
  echo ""
  echo "   ... and $((task_count - 10)) more tasks"
  echo ""
  echo "   Run 'bd ready' to see all tasks"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Next steps:"
echo "   • /agent:start $rec_id - Start highest priority task"
echo "   • /agent:start <task-id> - Start different task"
echo "   • /agent:start $task_id - Resume paused task"
echo "   • Close terminal if done for the day"
echo ""
```

---

## Output Example

**Successful pause:**
```
💾 Quick saving changes...
   ✅ Quick commit done

📬 Checking Agent Mail...
   📬 2 unread messages - acknowledging all...
   ✅ Acknowledged 2 messages

📢 Announcing task pause...
   ✅ Sent pause notification to @active

⏸️  Updating task status in Beads...
   ✅ Task remains in_progress (can resume later)

🔓 Releasing file reservations...
   ✅ Released src/lib/**/*.ts (3 files)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸️  Task Paused: jat-abc "Add user settings page"
👤 Agent: JustGrove
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Available Tasks to Switch To (7 total):

   [1] jat-xyz - Update documentation for new API (task)
   [1] jat-def - Fix authentication timeout bug (bug)
   [2] jat-ghi - Add dark mode toggle (feature)
   [2] jat-jkl - Refactor database queries (chore)
   [3] jat-mno - Update dependencies (chore)
   [3] jat-pqr - Add user profile page (feature)
   [3] jat-stu - Fix typos in README (chore)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Next steps:
   • /agent:start jat-xyz - Start highest priority task
   • /agent:start <task-id> - Start different task
   • /agent:start jat-abc - Resume paused task
   • Close terminal if done for the day
```

**No other tasks available:**
```
⏸️  Task Paused: jat-abc "Add user settings page"
👤 Agent: JustGrove

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 No other ready tasks available.

💡 Next steps:
   • /agent:start jat-abc - Resume this task
   • /agent:plan - Create new tasks
   • Close terminal if done for the day
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
⚠️  No task currently in progress.

[Shows available tasks menu anyway]
```

**Git commit failed:**
```
❌ Failed to quick commit changes:
   [git error message]

💡 Fix git issues or use 'git stash' manually
```

---

## Use Cases

**Emergency exit (laptop dying):**
```bash
# Battery at 2%!
/agent:pause
# → Quick commit (2 seconds)
# → Release locks
# → Done! Close lid
```

**Pivot to different work:**
```bash
# Working on frontend, suddenly need to fix backend bug
/agent:pause
# → Shows backend tasks in menu
/agent:start jat-backend-bug
```

**Blocked by dependency:**
```bash
# Can't continue, waiting for API team
/agent:pause
# → Shows other tasks
/agent:start jat-different-task
# (Original task stays in_progress, can resume later)
```

**Context switch:**
```bash
# Been doing UI work for 2 hours, want to switch to backend
/agent:pause
# → Shows all tasks
/agent:start jat-backend-refactor
```
