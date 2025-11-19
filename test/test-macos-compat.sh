#!/usr/bin/env bash
# macOS Compatibility Test for Agent Mail Tools
#
# This script tests all Agent Mail bash tools for macOS compatibility.
# Run this on macOS to verify cross-platform functionality.
#
# Requirements:
# - bash 3.2+ (macOS default is 3.2.57)
# - sqlite3 with JSON support (macOS includes 3.43.2+)
# - Standard Unix tools: grep, sed, jq

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║         macOS Compatibility Test - Agent Mail Tools                      ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }

# Test 1: Platform Detection
echo "┌─ Platform Detection ───────────────────────────────────────────────────┐"
PLATFORM=$(uname -s)
echo "  Platform: $PLATFORM"

if [[ "$PLATFORM" == "Darwin" ]]; then
    pass "Running on macOS"
elif [[ "$PLATFORM" == "Linux" ]]; then
    pass "Running on Linux (testing GNU compatibility)"
else
    warn "Unknown platform: $PLATFORM (proceeding anyway)"
fi
echo ""

# Test 2: Bash Version
echo "┌─ Bash Version ─────────────────────────────────────────────────────────┐"
BASH_VERSION_MAJOR="${BASH_VERSINFO[0]}"
BASH_VERSION_MINOR="${BASH_VERSINFO[1]}"
BASH_VERSION_FULL="${BASH_VERSION}"

echo "  Bash version: $BASH_VERSION_FULL"
echo "  Major: $BASH_VERSION_MAJOR, Minor: $BASH_VERSION_MINOR"

if [[ "$BASH_VERSION_MAJOR" -ge 3 ]] && [[ "$BASH_VERSION_MINOR" -ge 2 ]]; then
    pass "Bash 3.2+ detected (compatible)"
elif [[ "$BASH_VERSION_MAJOR" -ge 4 ]]; then
    pass "Bash 4+ detected (fully compatible)"
else
    fail "Bash 3.2+ required (found $BASH_VERSION_FULL)"
fi
echo ""

# Test 3: SQLite3 Availability and Version
echo "┌─ SQLite3 Check ────────────────────────────────────────────────────────┐"
if command -v sqlite3 &> /dev/null; then
    SQLITE_VERSION=$(sqlite3 --version | awk '{print $1}')
    echo "  SQLite version: $SQLITE_VERSION"
    pass "sqlite3 command available"

    # Test JSON support
    JSON_TEST=$(sqlite3 :memory: "SELECT json_object('test', 'value');" 2>&1 || echo "ERROR")
    if [[ "$JSON_TEST" == '{"test":"value"}' ]]; then
        pass "SQLite JSON support working"
    else
        fail "SQLite JSON support required (upgrade SQLite)"
    fi
else
    fail "sqlite3 not found (install via: brew install sqlite)"
fi
echo ""

# Test 4: Date Command Compatibility
echo "┌─ Date Command (GNU vs BSD) ────────────────────────────────────────────┐"
TTL_SECONDS=3600

# Try GNU date first (Linux), then BSD date (macOS)
EXPIRES_TS=$(date -u -d "+${TTL_SECONDS} seconds" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -u -v "+${TTL_SECONDS}S" '+%Y-%m-%d %H:%M:%S')

echo "  TTL: $TTL_SECONDS seconds"
echo "  Computed expiry: $EXPIRES_TS"

if [[ "$EXPIRES_TS" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}\ [0-9]{2}:[0-9]{2}:[0-9]{2}$ ]]; then
    pass "Date calculation working (format: YYYY-MM-DD HH:MM:SS)"
else
    fail "Date calculation failed (expected YYYY-MM-DD HH:MM:SS)"
fi

# Verify the date is actually in the future
if [[ "$PLATFORM" == "Darwin" ]]; then
    CURRENT_TS=$(date -u '+%Y-%m-%d %H:%M:%S')
elif [[ "$PLATFORM" == "Linux" ]]; then
    CURRENT_TS=$(date -u '+%Y-%m-%d %H:%M:%S')
fi

echo "  Current time: $CURRENT_TS"
if [[ "$EXPIRES_TS" > "$CURRENT_TS" ]]; then
    pass "Expiry timestamp is in the future"
else
    fail "Expiry timestamp calculation incorrect"
fi
echo ""

# Test 5: Bash Features (regex, parameter expansion)
echo "┌─ Bash Features ────────────────────────────────────────────────────────┐"

# Test regex matching (bash 3.2+)
TEST_STRING="am-register"
if [[ "$TEST_STRING" =~ ^am- ]]; then
    pass "Regex matching (=~) working"
else
    fail "Regex matching not working"
fi

# Test parameter expansion
TEST_VAR="hello world"
if [[ "${TEST_VAR// /_}" == "hello_world" ]]; then
    pass "Parameter expansion working"
else
    fail "Parameter expansion not working"
fi

# Test set -euo pipefail (used in all tools)
(set -euo pipefail && true) 2>&1
if [[ $? -eq 0 ]]; then
    pass "set -euo pipefail supported"
else
    fail "set -euo pipefail not supported"
fi
echo ""

# Test 6: Required Commands
echo "┌─ Required Commands ────────────────────────────────────────────────────┐"
REQUIRED_COMMANDS=("grep" "sed" "awk" "cut" "jq")

for cmd in "${REQUIRED_COMMANDS[@]}"; do
    if command -v "$cmd" &> /dev/null; then
        VERSION=$("$cmd" --version 2>&1 | head -1 || echo "version unknown")
        pass "$cmd available: $VERSION"
    else
        if [[ "$cmd" == "jq" ]]; then
            fail "$cmd not found (install via: brew install jq)"
        else
            fail "$cmd not found"
        fi
    fi
done
echo ""

# Test 7: Agent Mail Tools Syntax
echo "┌─ Agent Mail Tools Syntax Check ────────────────────────────────────────┐"
TOOLS_DIR="$PROJECT_ROOT/mail"

if [[ ! -d "$TOOLS_DIR" ]]; then
    fail "Tools directory not found: $TOOLS_DIR"
fi

TOOL_COUNT=0
PASS_COUNT=0
FAIL_COUNT=0

for tool in "$TOOLS_DIR"/am-*; do
    if [[ -f "$tool" ]] && [[ -x "$tool" ]]; then
        TOOL_COUNT=$((TOOL_COUNT + 1))
        TOOL_NAME=$(basename "$tool")

        # Check if it's a bash script
        if head -1 "$tool" | grep -q "^#!/usr/bin/env bash"; then
            # Syntax check
            if bash -n "$tool" 2>&1; then
                pass "$TOOL_NAME syntax OK"
                PASS_COUNT=$((PASS_COUNT + 1))
            else
                fail "$TOOL_NAME syntax error"
                FAIL_COUNT=$((FAIL_COUNT + 1))
            fi
        fi
    fi
done

echo ""
echo "  Tools checked: $TOOL_COUNT"
echo "  Passed: $PASS_COUNT"
echo "  Failed: $FAIL_COUNT"
echo ""

# Test 8: Integration Test (if database exists)
echo "┌─ Integration Test ─────────────────────────────────────────────────────┐"
AGENT_MAIL_DB="${AGENT_MAIL_DB:-$HOME/.agent-mail.db}"

if [[ -f "$AGENT_MAIL_DB" ]]; then
    echo "  Database: $AGENT_MAIL_DB"

    # Test basic SQL query
    PROJECT_COUNT=$(sqlite3 "$AGENT_MAIL_DB" "SELECT COUNT(*) FROM projects;" 2>&1 || echo "ERROR")
    if [[ "$PROJECT_COUNT" =~ ^[0-9]+$ ]]; then
        pass "Database accessible (projects: $PROJECT_COUNT)"
    else
        warn "Database query failed: $PROJECT_COUNT"
    fi

    # Test Agent Mail tools (if jw code path exists)
    if [[ -d "$PROJECT_ROOT" ]]; then
        # Run am-whoami to test basic functionality
        WHOAMI_OUTPUT=$("$TOOLS_DIR/am-whoami" 2>&1 || echo "ERROR")
        if [[ "$WHOAMI_OUTPUT" != "ERROR" ]]; then
            pass "am-whoami executed successfully"
        else
            warn "am-whoami failed (this is OK if no agent registered)"
        fi
    fi
else
    warn "Agent Mail database not found (create via: am-register)"
    echo "  Expected path: $AGENT_MAIL_DB"
fi
echo ""

# Summary
echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║                        Test Summary                                       ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "  Platform: $PLATFORM"
echo "  Bash: $BASH_VERSION_FULL"
echo "  SQLite: $SQLITE_VERSION"
echo ""

if [[ "$FAIL_COUNT" -eq 0 ]]; then
    pass "ALL TESTS PASSED - Agent Mail tools are macOS compatible!"
    echo ""
    echo "You can safely use all am-* tools on this system."
    exit 0
else
    fail "SOME TESTS FAILED - See errors above"
    exit 1
fi
