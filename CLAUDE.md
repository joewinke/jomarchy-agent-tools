# Jomarchy Agent Tools

Lightweight bash tools for agent orchestration, database operations, monitoring, development, and browser automation.

## Project Structure

```
jomarchy-agent-tools/
├── agent-mail/          # Agent Mail coordination system (11 tools)
├── database/            # Database tools (3 tools)
├── monitoring/          # Monitoring tools (5 tools)
├── development/         # Development tools (7 tools)
├── browser/             # Browser automation tools (11 tools)
├── dashboard/           # Beads Task Dashboard (SvelteKit app)
├── tools/               # Shared utilities
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

When you run `/agent:register`, it automatically:
1. Registers your agent in Agent Mail
2. Writes agent name to `.claude/agent-{session_id}.txt`
3. Statusline reads from that file and displays your identity

**No manual setup needed** - just register and the statusline updates!

### What the Statusline Shows

**Format:** `AgentName | [Priority] Task ID - Task Title [Indicators]`

**Indicators:**
- 🔒N - Active file reservations
- 📬N - Unread messages in inbox
- ⏱Xm/Xh - Time until lock expires
- N% - Task progress (if tracked)

**Examples:**
```
FreeMarsh | [P1] jomarchy-agent-tools-m95 - Update /start... [🔒2 📬1 ⏱45m]
FreeMarsh | idle [📬3]
jomarchy-agent-tools | no agent registered
```

### Multi-Agent Sessions

**Run as many agents as you want simultaneously!** Each session maintains its own identity:

```bash
# Terminal 1
/agent:register  # Choose FreeMarsh
# Statusline shows: FreeMarsh | ...

# Terminal 2
/agent:register  # Choose PaleStar
# Statusline shows: PaleStar | ...

# Terminal 3
/agent:register  # Choose StrongShore
# Statusline shows: StrongShore | ...
```

All three sessions work independently with their own agent identities.

### Files Created

- `.claude/agent-{session_id}.txt` - Your agent name for this session
- `.claude/current-session-id}.txt` - Latest session ID (for slash commands)
- `.claude/statusline.sh` - The statusline script

**These files are session-specific** - don't commit `agent-*.txt` files to git (they're per-developer session).

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
# Register agent (required for each session)
# Use /agent:register slash command - automatically updates statusline!
# Or manually: am-register --name AgentName --program claude-code --model sonnet-4.5

# Reserve files
am-reserve "src/**/*.ts" --agent AgentName --ttl 3600 --exclusive --reason "bd-123"

# Send message
am-send "Subject" "Body" --from Agent1 --to Agent2 --thread bd-123

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

Use Beads issue IDs (e.g., `bd-123`) as:
- Agent Mail `thread_id`
- File reservation `reason`
- Commit message references

```bash
# Example workflow
bd ready --json                                    # Pick work
am-reserve "src/**/*.ts" --agent Me --reason "bd-123"  # Reserve files
# ... do work ...
bd close bd-123 --reason "Completed"               # Mark done
am-release "src/**/*.ts" --agent Me                # Release files
```

## Common Issues

### Dashboard themes not working
1. Check `dashboard/src/app.css` uses Tailwind v4 syntax
2. See `dashboard/CLAUDE.md` for detailed troubleshooting

### Agent Mail "not registered"
```bash
am-register --name YourAgentName --program claude-code --model sonnet-4.5
```

### Browser tools not found
```bash
cd /home/jw/code/jomarchy-agent-tools
./install.sh
```

### Fresh dashboard build needed
```bash
cd dashboard
rm -rf .svelte-kit node_modules/.vite
npm run dev
```

## References

- **Dashboard docs**: `dashboard/CLAUDE.md`
- **Global Agent Mail docs**: `~/.claude/CLAUDE.md`
- **Tool source**: Each tool directory contains implementation
- **Installation**: `install.sh` for symlink setup
