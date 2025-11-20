---
argument-hint: [task-id] [--reason | --blocked | --handoff | --abandon]
---

Stop working on a task temporarily or permanently. Unified command for pause, block, handoff, and abandon scenarios.

# Pause/Stop Work - Unified Command

**Usage:**
- `/agent:pause task-id --reason "text"` - Simple pause (keep reservation)
- `/agent:pause task-id --blocked --reason "Waiting for API"` - Mark blocked
- `/agent:pause task-id --handoff AgentName --reason "Need expert"` - Hand off
- `/agent:pause task-id --abandon --reason "No longer needed"` - Abandon work

**What this command does:**
1. Releases file reservations (if specified)
2. Updates task status in Beads
3. Sends Agent Mail notification
4. Optionally hands off to another agent
5. Updates session state

---

## Implementation Steps

### STEP 0: Parse Parameters

```bash
TASK_ID="$1"
MODE="pause"  # Default mode
REASON=""
HANDOFF_TO=""
KEEP_RESERVATION=true

# Parse flags
while [[ $# -gt 0 ]]; do
  case $1 in
    --reason)
      REASON="$2"
      shift 2
      ;;
    --blocked)
      MODE="blocked"
      shift
      ;;
    --handoff)
      MODE="handoff"
      HANDOFF_TO="$2"
      shift 2
      ;;
    --abandon)
      MODE="abandon"
      KEEP_RESERVATION=false
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# Validate task ID
if [[ -z "$TASK_ID" ]]; then
  echo "❌ Error: Task ID required"
  echo "Usage: /agent:pause task-id [options]"
  exit 1
fi

# Verify task exists
if ! bd show "$TASK_ID" --json >/dev/null 2>&1; then
  echo "❌ Error: Task '$TASK_ID' not found"
  exit 1
fi

# Validate reason for certain modes
if [[ "$MODE" != "pause" ]] && [[ -z "$REASON" ]]; then
  echo "❌ Error: --reason required for --${MODE}"
  exit 1
fi
```

---

### STEP 1: Get Current Agent and Task Info

```bash
# Get session ID and agent name
SESSION_ID=$(cat /tmp/claude-session-${PPID}.txt 2>/dev/null | tr -d '\n')

if [[ -n "$SESSION_ID" ]] && [[ -f ".claude/agent-${SESSION_ID}.txt" ]]; then
  AGENT_NAME=$(cat ".claude/agent-${SESSION_ID}.txt" 2>/dev/null | tr -d '\n')
else
  echo "❌ Error: No agent registered for this session"
  echo "💡 Run /agent:start or /agent:register first"
  exit 1
fi

# Get task info
task_info=$(bd show "$TASK_ID" --json)
TASK_TITLE=$(echo "$task_info" | jq -r '.title')
CURRENT_STATUS=$(echo "$task_info" | jq -r '.status')
```

---

### STEP 2: Release File Reservations (Conditional)

**Release files based on mode:**

```bash
# Get current reservations for this agent and task
RESERVATIONS=$(am-reservations --agent "$AGENT_NAME" --json | \
  jq -r ".[] | select(.reason == \"$TASK_ID\") | .pattern")

if [[ -n "$RESERVATIONS" ]]; then
  if [[ "$KEEP_RESERVATION" == "false" ]] || [[ "$MODE" == "handoff" ]]; then
    # Release all reservations for this task
    while IFS= read -r pattern; do
      am-release "$pattern" --agent "$AGENT_NAME"
      echo "🔓 Released: $pattern"
    done <<< "$RESERVATIONS"
  else
    echo "🔒 Keeping file reservations (use --abandon to release)"
  fi
fi
```

---

### STEP 3: Update Task Status in Beads

**Update based on mode:**

```bash
case "$MODE" in
  pause)
    # Simple pause - keep status as-is, add note
    bd add "$TASK_ID" "Paused by $AGENT_NAME. Reason: ${REASON:-Taking a break}"
    echo "⏸️  Paused task (status unchanged)"
    ;;

  blocked)
    # Mark as blocked
    bd update "$TASK_ID" --status blocked
    bd add "$TASK_ID" "Blocked: $REASON (paused by $AGENT_NAME)"
    echo "🚫 Marked task as blocked"
    ;;

  handoff)
    # Reassign to new agent
    bd update "$TASK_ID" --assignee "$HANDOFF_TO"
    bd add "$TASK_ID" "Handed off from $AGENT_NAME to $HANDOFF_TO. Reason: $REASON"
    echo "👋 Handed off to $HANDOFF_TO"
    ;;

  abandon)
    # Unassign and mark as open
    bd update "$TASK_ID" --status open --assignee ""
    bd add "$TASK_ID" "Abandoned by $AGENT_NAME. Reason: $REASON"
    echo "🛑 Abandoned task (now available for others)"
    ;;
esac
```

---

### STEP 4: Send Agent Mail Notification

**Notification based on mode:**

```bash
case "$MODE" in
  pause)
    SUBJECT="[$TASK_ID] Paused"
    BODY="Pausing work on $TASK_ID

**Task:** $TASK_TITLE
**Agent:** $AGENT_NAME
**Reason:** ${REASON:-Taking a break}
**Reservations:** ${KEEP_RESERVATION:-Kept}

Will resume later."
    ;;

  blocked)
    SUBJECT="[$TASK_ID] BLOCKED"
    BODY="⚠️ Task is now BLOCKED

**Task:** $TASK_TITLE
**Blocked by:** $AGENT_NAME
**Reason:** $REASON
**Files released:** All reservations released

Task cannot proceed until blocker is resolved."
    IMPORTANCE="high"
    ;;

  handoff)
    SUBJECT="[$TASK_ID] Handoff: $AGENT_NAME → $HANDOFF_TO"
    BODY="👋 Handing off task to $HANDOFF_TO

**Task:** $TASK_TITLE
**From:** $AGENT_NAME
**To:** $HANDOFF_TO
**Reason:** $REASON
**Files released:** All reservations released

$HANDOFF_TO, please review task details and continue work."
    TO_AGENT="$HANDOFF_TO"
    ;;

  abandon)
    SUBJECT="[$TASK_ID] Abandoned"
    BODY="🛑 Work abandoned on $TASK_ID

**Task:** $TASK_TITLE
**Agent:** $AGENT_NAME
**Reason:** $REASON
**Status:** Now open/available for others

Task is back in the queue for anyone to pick up."
    ;;
esac

# Send Agent Mail
am-send "$SUBJECT" "$BODY" \
  --from "$AGENT_NAME" \
  --to "${TO_AGENT:-Team}" \
  --thread "$TASK_ID" \
  ${IMPORTANCE:+--importance "$IMPORTANCE"}

echo "📬 Sent notification in Agent Mail"
```

---

### STEP 5: Update Local Session State

```bash
# If abandoning, clear any local task tracking
if [[ "$MODE" == "abandon" ]]; then
  # Clear any task-specific state files if they exist
  rm -f ".claude/current-task-${SESSION_ID}.txt" 2>/dev/null
fi
```

---

### STEP 6: Show Summary

Display appropriate summary based on mode:

```
╔══════════════════════════════════════════════════════════════════════════╗
║                    ⏸️  WORK PAUSED: {TASK_ID}                            ║
╚══════════════════════════════════════════════════════════════════════════╝

Mode: {PAUSE | BLOCKED | HANDOFF | ABANDON}
Task: {TASK_TITLE}
Agent: {AGENT_NAME}
Reason: {REASON}

┌─ ACTIONS TAKEN ────────────────────────────────────────────────────────┐
│                                                                        │
│  {MODE-SPECIFIC ACTIONS}                                               │
│  • File reservations: {Released | Kept}                               │
│  • Task status: {Updated | Unchanged}                                 │
│  • Agent Mail: Notification sent                                      │
│  • Next owner: {AgentName | None | Anyone}                            │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ WHAT HAPPENS NEXT ────────────────────────────────────────────────────┐
│                                                                        │
│  {MODE-SPECIFIC GUIDANCE}                                              │
│                                                                        │
│  Pause:    Resume with /agent:start {TASK_ID}                         │
│  Blocked:  Task will appear in bd list when deps resolved             │
│  Handoff:  {HANDOFF_TO} will receive notification                     │
│  Abandon:  Task is available in bd ready for anyone                   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Mode-specific summaries:**

**Pause:**
```
✅ Work paused on task-abc

You can resume anytime with:
  /agent:start task-abc

File reservations are still active (expires in Xh).
```

**Blocked:**
```
🚫 Task marked as BLOCKED

Task will not appear in bd ready until:
  • Dependencies are resolved
  • Someone manually unblocks it with: bd update task-abc --status open

File reservations released - others can work on related areas.
```

**Handoff:**
```
👋 Task handed off to {HANDOFF_TO}

File reservations released.
{HANDOFF_TO} will receive Agent Mail notification.
Task is now assigned to them in Beads.
```

**Abandon:**
```
🛑 Work abandoned

File reservations released.
Task unassigned and marked as open.
Available for anyone to pick up with /agent:start or bd ready.
```

---

## Parameter Combinations

| Command | Behavior | File Reservations | Task Status | Assignee |
|---------|----------|-------------------|-------------|----------|
| `/agent:pause task-abc --reason "Break"` | Simple pause | Kept | Unchanged | Unchanged |
| `/agent:pause task-abc --blocked --reason "API down"` | Mark blocked | Released | → blocked | Unchanged |
| `/agent:pause task-abc --handoff Alice --reason "Need expert"` | Hand off | Released | Unchanged | → Alice |
| `/agent:pause task-abc --abandon --reason "Not needed"` | Abandon | Released | → open | Cleared |

---

## When to Use Each Mode

**Simple Pause (default):**
- Taking a break
- Switching to urgent task temporarily
- End of day (will resume tomorrow)
- Want to keep file locks

**Blocked (`--blocked`):**
- Waiting for external dependency
- API/service is down
- Blocked by another task
- Cannot proceed until X happens
- Want to signal "not my fault, can't continue"

**Handoff (`--handoff`):**
- Task needs different expertise
- You're overloaded, someone else available
- Better fit for another agent's skillset
- Coordinated transfer of work

**Abandon (`--abandon`):**
- Requirements changed, task obsolete
- Realized wrong approach, task needs rethinking
- Task is duplicate or no longer needed
- Want to put it back in the queue

---

## Integration with Other Commands

**Resume paused work:**
```bash
/agent:start task-abc  # Automatically resumes paused task
```

**Check your paused tasks:**
```bash
/agent:status  # Shows paused tasks with reservations
```

**See blocked tasks:**
```bash
bd list --status blocked  # Shows all blocked tasks
```

**Complete after unblocking:**
```bash
bd update task-abc --status open  # Unblock manually
/agent:start task-abc  # Resume work
```

---

## Notes

- **Simple pause keeps reservations:** Won't expire if TTL hasn't passed
- **Other modes release:** Others can work on those files
- **Agent Mail notification:** Always sent to keep team informed
- **Beads status:** Updated appropriately for each mode
- **Resuming:** Use /agent:start task-id to resume any paused work
- **No confirmation prompts:** Trust agent to use correct mode

---

## Error Handling

**Common errors:**
- "Task not found" → Check task ID with `bd list`
- "No agent registered" → Run `/agent:start` first
- "Handoff agent not found" → Check agent name with `am-agents`
- "Reason required" → Add `--reason "text"` for blocked/handoff/abandon
