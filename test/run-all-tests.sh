#!/usr/bin/env bash
#
# Run all tests for jat (Jomarchy Agent Tools)
#
# Orchestrates all test scripts:
#   - Node.js tests (test-beads.js, test-agent-mail.js)
#   - Agent Mail workflow test (mail/test-workflow.sh)
#   - Example workflow scripts (examples/workflows/*.sh)
#
# Exit codes:
#   0 - All tests passed
#   1 - One or more tests failed
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track test results
PASSED=0
FAILED=0
TOTAL=0

echo "════════════════════════════════════════════════════════════"
echo "Running All Tests for JAT (Jomarchy Agent Tools)"
echo "════════════════════════════════════════════════════════════"
echo ""

# Function to run a test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"

    TOTAL=$((TOTAL + 1))
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BLUE}TEST ${TOTAL}: ${test_name}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    if eval "$test_command"; then
        echo ""
        echo -e "${GREEN}✓ PASSED${NC}: ${test_name}"
        PASSED=$((PASSED + 1))
    else
        echo ""
        echo -e "${RED}✗ FAILED${NC}: ${test_name}"
        FAILED=$((FAILED + 1))
    fi
    echo ""
}

# Check prerequisites
echo "Checking prerequisites..."
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found${NC}"
    echo "Please install Node.js (https://nodejs.org/)"
    exit 1
fi
echo -e "${GREEN}✓ Node.js found:${NC} $(node --version)"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm not found${NC}"
    echo "Please install npm"
    exit 1
fi
echo -e "${GREEN}✓ npm found:${NC} $(npm --version)"

# Check for sqlite3
if ! command -v sqlite3 &> /dev/null; then
    echo -e "${YELLOW}⚠ sqlite3 CLI not found${NC}"
    echo "Some tests may fail without sqlite3"
else
    echo -e "${GREEN}✓ sqlite3 found:${NC} $(sqlite3 --version)"
fi

# Check for node_modules
if [ ! -d "node_modules" ]; then
    echo ""
    echo -e "${YELLOW}⚠ node_modules not found${NC}"
    echo "Running npm install..."
    npm install
    echo ""
fi
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "Running Tests"
echo "════════════════════════════════════════════════════════════"
echo ""

# Run Node.js tests
run_test "Beads SQLite Query Layer" "node test/test-beads.js"
run_test "Agent Mail SQLite Query Layer" "node test/test-agent-mail.js"

# Run Agent Mail workflow test
run_test "Agent Mail Workflow" "bash mail/test-workflow.sh"

# Run example workflow scripts (these are demonstrative, not strict tests)
# We'll just verify they execute without errors
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}VERIFYING: Example Workflow Scripts${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Example workflows are demonstrative scripts."
echo "We'll verify they execute without errors (smoke test)."
echo ""

EXAMPLE_PASSED=0
EXAMPLE_FAILED=0

for example in examples/workflows/*.sh; do
    if [ -f "$example" ]; then
        example_name=$(basename "$example")
        echo -n "  • Testing $example_name... "

        if bash "$example" > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC}"
            EXAMPLE_PASSED=$((EXAMPLE_PASSED + 1))
        else
            echo -e "${RED}✗${NC}"
            EXAMPLE_FAILED=$((EXAMPLE_FAILED + 1))
        fi
    fi
done

echo ""
echo -e "Example workflows: ${GREEN}${EXAMPLE_PASSED} passed${NC}, ${RED}${EXAMPLE_FAILED} failed${NC}"
echo ""

# Summary
echo "════════════════════════════════════════════════════════════"
echo "Test Summary"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Total tests: $TOTAL"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
