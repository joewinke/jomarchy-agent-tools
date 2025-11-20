Initiate a new agent session - register and obtain identity from Agent Mail, and review Beads tasks.

# Register & Review

Follow these steps in order:

1. Connect to Agent Mail and discover existing agents
   - Run: `am-register --program claude-code --model sonnet-4.5`
   - Run: `am-agents` (list all agents in project)
   - Run: `am-reservations` (see all active file reservations)

2. Present agent identity options to user with AskUserQuestion:
   - Show list of existing agents sorted by last_active (most recent first)
   - For each agent show: name, last active time (X hours/days ago), current task, active reservations
   - Options:
     * [Default] Resume most recent agent (just press Enter)
     * Resume a specific agent from the list
     * Create new agent identity (for parallel coordination work)

3. Register based on user choice:
   - If resuming: Run `am-register --name AgentName --program claude-code --model sonnet-4.5`
   - If creating new: Run `am-register --program claude-code --model sonnet-4.5` (auto-generates name)

3.5. **CRITICAL:** Update session file for statusline (session-aware persistence):
   ```bash
   # Get session ID
   SESSION_ID=$(cat .claude/current-session-id.txt 2>/dev/null | tr -d '\n')

   # Write to session file (PRIMARY - statusline reads this)
   if [[ -n "$SESSION_ID" ]]; then
     mkdir -p .claude
     echo "$AGENT_NAME" > ".claude/agent-${SESSION_ID}.txt"
     echo "✓ Session file updated: .claude/agent-${SESSION_ID}.txt"
   fi

   # Export env var (FALLBACK - for bash scripts)
   export AGENT_NAME="$AGENT_NAME"
   ```

   **Why session files matter:**
   - Each Claude Code session has a unique `session_id`
   - Statusline reads from `.claude/agent-{session_id}.txt` (PRIMARY)
   - `export AGENT_NAME` doesn't work (statusline is separate process)
   - This enables multiple concurrent agents in different terminals

4. Review inbox and acknowledge messages:
   - Run: `am-inbox AgentName --unread`
   - For each message: `am-ack message-id --agent AgentName`
   - Or acknowledge all at once: `am-inbox AgentName --unread --json | jq -r '.[].id' | xargs -I {} am-ack {} --agent AgentName`

5. Run `bd ready --json` to review all ready tasks in Beads

6. Determine which tasks you are capable of working on

7. Report findings to console with formatted output

---

## Output Format

After completing all steps above, format your final output using this template:

```
╔══════════════════════════════════════════════════════════════════════════╗
║                    🎯 AGENT REGISTRATION & REVIEW                        ║
║                                                                          ║
║                    🤖 Agent: [YOUR-AGENT-NAME]                           ║
║                    📌 Status: [Resumed / New Identity]                  ║
╚══════════════════════════════════════════════════════════════════════════╝

┌─ AGENT IDENTITY SELECTION ─────────────────────────────────────────────┐
│                                                                        │
│  Found [X] existing agents in project                                  │
│  Zombie agents: [X] (unused identities - run cleanup if > 5)          │
│  User chose: [Resume "AgentName" / Create new identity]                │
│  Previous activity: [timestamp or "N/A - new agent"]                   │
│                                                                        │
│  💡 Tip: Run `cleanup-agent-mail-zombies` if zombies accumulate        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ AGENT MAIL STATUS ────────────────────────────────────────────────────┐
│                                                                        │
│  📬 Inbox messages: [X total]                                          │
│  ✅ Messages acknowledged: [X]                                         │
│  ⚠️  Urgent items: [X or "None"]                                       │
│  🔒 Active file reservations: [X or "None"]                            │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ BEADS READY TASKS ────────────────────────────────────────────────────┐
│                                                                        │
│  📊 Total ready tasks: [X]                                             │
│                                                                        │
│  [List each task from `bd ready --json`:]                              │
│  • [task-id] (P[X]) - [title]                                          │
│  • [task-id] (P[X]) - [title]                                          │
│  • [task-id] (P[X]) - [title]                                          │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ CAPABLE TASKS (What I Can Work On) ───────────────────────────────────┐
│                                                                        │
│  ✅ [task-id] (P[X]) - [title]                                         │
│     Reason: [Why you can work on this]                                 │
│                                                                        │
│  ✅ [task-id] (P[X]) - [title]                                         │
│     Reason: [Why you can work on this]                                 │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ NOT CAPABLE / BLOCKED TASKS ──────────────────────────────────────────┐
│                                                                        │
│  ⛔ [task-id] (P[X]) - [title]                                         │
│     Reason: [Why you cannot work on this]                              │
│                                                                        │
│  ⛔ [task-id] (P[X]) - [title]                                         │
│     Reason: [Why you cannot work on this]                              │
│                                                                        │
│  📝 Or: "All ready tasks are within capability"                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║                   ✅ REGISTRATION & REVIEW COMPLETE ✅                   ║
║                                                                          ║
║                    🤖 Agent: [YOUR-AGENT-NAME]                           ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

**IMPORTANT:**
- Always show your agent name at the top and bottom
- Query existing agents BEFORE prompting user (so they see real options)
- Use AskUserQuestion tool to present agent choices interactively
- Default option should be to resume most recent agent (press Enter)
- Only use create_agent_identity if user explicitly requests new identity
- Must run `bd ready --json` to get actual task list from Beads
- Categorize each task as either capable or not capable with clear reasoning

**AGENT IDENTITY BEST PRACTICES:**
- Resuming = Same agent across sessions = continuous history/context
- New identity = Parallel coordination work = multiple agents working simultaneously
- Most users want to resume (not create new agents every session)

**EXAMPLE INTERACTION:**

After querying agents, use AskUserQuestion like this:

```
Question: "Which agent identity should I use for this session?"
Header: "Agent Identity"
Options:
  1. "Resume ChimaroDev (most recent)"
     Description: "Last active 2 hours ago. Task: Batch video generator. 2 active file reservations."

  2. "Resume ChimaroFix"
     Description: "Last active 3 days ago. Task: Bug fixes. No active reservations."

  3. "Create new agent identity"
     Description: "Start a new agent for parallel coordination work (generates unique name)"

MultiSelect: false
```

If user presses Enter (no selection), default to option 1 (most recent).