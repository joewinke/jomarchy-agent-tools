# Agent Mail - Bash/SQLite Implementation

Lightweight coordination system for multi-agent workflows using bash + SQLite.

## Overview

Agent Mail provides a mail-like communication layer that lets coding agents coordinate asynchronously without consuming token budgets. Built with bash scripts and SQLite, it offers:

- **Agent identities** - Register agents with names, programs, and models
- **Threaded messaging** - Send messages with subjects, bodies (markdown), and thread IDs
- **File reservations** - Advisory locks to prevent edit conflicts
- **Full-text search** - FTS5-powered message search
- **Acknowledgments** - Track message reads and acknowledgments
- **Human-auditable** - All data in SQLite, committable to git

## Installation

Tools are automatically linked to `~/bin` during setup. Ensure `~/bin` is in your PATH:

```bash
export PATH="$HOME/bin:$PATH"
```

## Database

Default location: `~/.agent-mail.db`

Override with: `export AGENT_MAIL_DB=/path/to/database.db`

## Quick Start

### 1. Register agents

```bash
# Auto-generate name
am-register --program claude-code --model sonnet-4.5 --task "Frontend work"

# Specify name
am-register --name Alice --program cursor --model gpt-4 --task "Backend"
```

### 2. Reserve files before editing

```bash
# Exclusive lock (default)
am-reserve "src/**/*.ts" --agent Alice --ttl 3600 --reason "bd-123"

# Shared lock
am-reserve "docs/**" --agent Bob --ttl 7200 --shared
```

### 3. Send messages

```bash
# Simple message
am-send "Update" "Progress report" --from Alice --to Bob

# With thread and acknowledgment
am-send "[bd-123] Ready" "Files reserved" \
  --from Alice --to Bob,Carol \
  --thread bd-123 --importance high --ack
```

### 4. Check inbox

```bash
# All messages
am-inbox Alice

# Unread only
am-inbox Bob --unread

# By thread
am-inbox Carol --thread bd-123 --mark-read
```

### 5. Acknowledge and reply

```bash
# Acknowledge
am-ack 5 --agent Bob

# Reply
am-reply 5 "Thanks for the update" --agent Bob
```

### 6. Search and discover

```bash
# Full-text search
am-search "authentication bug"

# Within thread
am-search "review" --thread bd-123

# List agents
am-agents

# List reservations
am-reservations
am-reservations --agent Alice

# Check identity
am-whoami --agent Alice
```

### 7. Release reservations

```bash
# By pattern
am-release "src/**/*.ts" --agent Alice

# By ID
am-release --id 5

# All for agent
am-release --all --agent Alice
```

## Tool Reference

All tools support `--help` for detailed usage.

### Core Tools

| Tool | Purpose |
|------|---------|
| `am-register` | Register or update agent identity |
| `am-send` | Send message to agents |
| `am-inbox` | View inbox with filters |
| `am-reply` | Reply to message |
| `am-ack` | Acknowledge message |
| `am-search` | Full-text search messages |
| `am-reserve` | Reserve files/paths |
| `am-release` | Release reservations |
| `am-reservations` | List active reservations |
| `am-agents` | List all agents |
| `am-whoami` | Show agent identity |

### Message Importance Levels

- `normal` (default)
- `high`
- `urgent`

### Reservation Types

- **Exclusive** (default) - Blocks all other reservations
- **Shared** (`--shared`) - Allows other shared locks

## Integration with Beads

Use Beads task IDs as message thread IDs for unified workflows:

```bash
# Pick work
bd ready --json

# Reserve files
am-reserve "src/**" --agent Alice --ttl 3600 --reason "bd-123"

# Announce
am-send "[bd-123] Starting work" "..." --from Alice --to Team --thread bd-123

# Complete
bd close bd-123 --reason "Done"
am-release "src/**" --agent Alice
am-send "[bd-123] Completed" "Summary" --from Alice --to Team --thread bd-123
```

## File Conflict Prevention

Before editing files:

```bash
# 1. Reserve
am-reserve "path/to/files/**" --agent MyAgent --ttl 3600 --exclusive --reason "bd-456"

# 2. Edit files
# ... make changes ...

# 3. Release
am-release "path/to/files/**" --agent MyAgent
```

If conflict:
```
✗ FILE_RESERVATION_CONFLICT
  Pattern: src/**/*.ts
  Held by: OtherAgent (exclusive lock)
  Expires: 2025-11-19 19:34:19

Wait for expiry or contact OtherAgent to release.
```

## Schema

### Tables

- `projects` - Git repositories or logical groupings
- `agents` - Coding assistants (name, program, model)
- `messages` - Communication with threading
- `message_recipients` - Who receives messages (to/cc)
- `file_reservations` - Advisory file locks
- `messages_fts` - FTS5 full-text search index

### Indexes

All foreign keys and common query patterns indexed for performance.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_MAIL_DB` | `~/.agent-mail.db` | Database location |
| `PROJECT_KEY` | `$(pwd)` | Project identifier |
| `AGENT_NAME` | - | Default agent name |

## Testing

Run comprehensive workflow test:

```bash
./test-workflow.sh
```

Tests all 11 tools with realistic multi-agent scenario.

## Architecture

### Design Principles

1. **Bash + SQLite only** - No HTTP servers, no background daemons
2. **System dependencies** - Requires: sqlite3, jq, bash 4.0+
3. **Single connection for writes** - Avoid `last_insert_rowid()` bugs
4. **FTS5 for search** - Full-text indexing with triggers
5. **Advisory locks** - Non-blocking file coordination
6. **Git-friendly** - SQLite database can be committed

### Token Savings

Compared to MCP server approach:
- **80x reduction** - ~32K tokens saved by using bash tools instead of MCP server definitions
- **No running services** - No server startup, no ports, no protocol negotiation
- **Cross-CLI** - Works with Claude Code, Cursor, Aider, etc.

### Performance

- Agent registration: ~10ms
- Message send: ~15ms
- Inbox query: ~5ms
- Search (FTS5): ~20ms
- Reservation check: ~5ms

All operations use prepared statements and indexes.

## Common Patterns

### Daily standup

```bash
am-send "Daily Update" \
  "Yesterday: Fixed auth bug
   Today: Working on API
   Blockers: None" \
  --from Alice --to Team --importance normal
```

### Handoff between agents

```bash
# Agent 1 finishes
am-release "frontend/**" --agent Alice
am-send "[bd-123] Ready for review" "..." --from Alice --to Bob

# Agent 2 takes over
am-reserve "frontend/**" --agent Bob --ttl 3600 --reason "bd-123"
```

### Blocking issue

```bash
am-send "[bd-456] BLOCKED" \
  "Need database access to continue" \
  --from Carol --to Alice,Bob \
  --thread bd-456 --importance urgent --ack
```

## Troubleshooting

### Agent not found

```bash
am-register --name MyAgent --program claude-code --model sonnet-4.5
```

### Reservation conflict

Wait for expiry or contact holding agent:

```bash
am-reservations --agent OtherAgent  # Check expiry time
am-send "Can you release src/**?" --from Me --to OtherAgent
```

### Database locked

SQLite locks database during writes. If persistent:

```bash
lsof ~/.agent-mail.db  # Check for stuck connections
```

### Search not finding messages

Ensure FTS triggers are working:

```bash
sqlite3 ~/.agent-mail.db "SELECT COUNT(*) FROM messages_fts;"
```

Should match message count.

## Future Enhancements

- [ ] Cleanup script for expired/released reservations
- [ ] Export messages to markdown
- [ ] Reservation conflict notifications
- [ ] Message attachments (file paths/content)
- [ ] Web UI for visualization
- [ ] Multi-project dashboard
- [ ] Integration with git hooks
- [ ] Automatic Beads task updates

## Credits

Inspired by:
- [mcp_agent_mail](https://github.com/Dicklesworthstone/mcp_agent_mail) - Original Python/MCP implementation
- [Beads](https://github.com/steveyegge/beads) - Dependency-aware task management
- [What if you don't need MCP?](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/) - Token efficiency philosophy

## License

MIT
