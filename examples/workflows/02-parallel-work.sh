#!/usr/bin/env bash
#
# Example 2: Parallel Work Without Conflicts
#
# Pattern: Multiple agents working simultaneously on independent tasks
#
# Scenario:
#   - PaleStar builds query layers (foundation work)
#   - DashboardBuilder builds UI components (depends on foundation)
#   - Both work in parallel without conflicts using file reservations
#
# Key concepts:
#   - Non-overlapping file reservations
#   - Parallel execution
#   - Dependency awareness
#   - Completion notifications
#
# Based on real jat (Jomarchy Agent Tools) development session!
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIL_DIR="$(cd "$SCRIPT_DIR/../../mail" && pwd)"
cd "$MAIL_DIR"

# Use a test database
export AGENT_MAIL_DB="/tmp/example-02.db"
rm -f "$AGENT_MAIL_DB"

echo "════════════════════════════════════════════════════════════"
echo "Example 2: Parallel Work Without Conflicts"
echo "Database: $AGENT_MAIL_DB"
echo "════════════════════════════════════════════════════════════"
echo ""

# Step 1: Register agents
echo "Step 1: Register two agents for parallel work"
./am-register --name PaleStar --program claude-code --model sonnet-4.5 --task "Building query layers"
./am-register --name DashboardBuilder --program claude-code --model sonnet-4.5 --task "Building dashboard UI"
echo ""

# Step 2: DashboardBuilder welcomes PaleStar and suggests parallel work
echo "Step 2: DashboardBuilder sends welcome message with parallel work opportunities"
./am-send "Welcome PaleStar! Parallel work ready" \
  "$(cat <<'EOF'
I'm setting up the dashboard foundation. Here are P0 tasks we can do in parallel:

1. Build Beads query layer (lib/beads.js)
2. Build Agent Mail query layer (lib/agent-mail.js)

These are independent of my dashboard/ work. Pick one and we'll coordinate!
EOF
)" \
  --from DashboardBuilder --to PaleStar --thread project-kickoff --importance high
echo ""

# Step 3: Both agents reserve non-overlapping file patterns
echo "Step 3: Agents reserve different file patterns (no conflicts!)"
./am-reserve "dashboard/**" --agent DashboardBuilder --ttl 3600 --exclusive --reason "Setting up SvelteKit"
./am-reserve "lib/**" --agent PaleStar --ttl 3600 --exclusive --reason "Building query layers"
echo ""

# Step 4: Both announce their work
echo "Step 4: Both agents announce their parallel work"
./am-send "[dashboard-setup] Starting SvelteKit foundation" \
  "Setting up minimal SvelteKit + Svelte 5. ETA: 20 minutes." \
  --from DashboardBuilder --to PaleStar --thread dashboard-setup

./am-send "[query-layers] Starting Beads query layer" \
  "Building lib/beads.js with better-sqlite3. ETA: 30 minutes." \
  --from PaleStar --to DashboardBuilder --thread query-layers
echo ""

# Step 5: DashboardBuilder finishes first
echo "Step 5: DashboardBuilder completes foundation"
./am-send "[dashboard-setup] ✅ COMPLETE - SvelteKit ready" \
  "Dashboard foundation complete. Ready for query layer integration!" \
  --from DashboardBuilder --to PaleStar --thread dashboard-setup --importance high
./am-release "dashboard/**" --agent DashboardBuilder
echo ""

# Step 6: PaleStar finishes query layer
echo "Step 6: PaleStar completes query layer"
./am-send "[query-layers] ✅ COMPLETE - Beads layer ready" \
  "lib/beads.js complete with full test coverage. Dashboard can now query tasks!" \
  --from PaleStar --to DashboardBuilder --thread query-layers --importance high
./am-release "lib/**" --agent PaleStar
echo ""

# Step 7: Check what was accomplished
echo "Step 7: Review reservations (all released)"
./am-reservations
echo ""

echo "Step 8: Check message threads"
./am-search "COMPLETE"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "✓ Example complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Key takeaways:"
echo "  • Non-overlapping file patterns = zero conflicts"
echo "  • dashboard/** and lib/** can be worked on simultaneously"
echo "  • Completion messages notify dependent work is ready"
echo "  • Releasing files early enables next phase of work"
echo "  • Total time: ~30 min parallel vs ~50 min sequential"
echo ""
echo "Real-world result from this pattern:"
echo "  • PaleStar + DashboardBuilder completed 3 P0 tasks in 1 session"
echo "  • Zero merge conflicts"
echo "  • Clean handoff (foundation → UI integration)"
echo ""
