# Tests

Test suite for jomarchy-agent-tools.

## Beads + Agent Mail Integration Tests

Run integration tests to verify cross-referencing between Beads tasks and Agent Mail coordination:

```bash
node test/test-integration.js
```

Tests verify:
- ✅ Cross-referencing between Beads and Agent Mail
- ✅ File reservation tracking
- ✅ Agent assignment queries
- ✅ Active work tracking
- ✅ Handoff history
- ✅ Integration statistics

## macOS Compatibility Tests

Test Agent Mail bash tools for macOS compatibility:

```bash
bash test/test-macos-compat.sh
```

Tests verify:
- ✅ Platform detection (Linux vs macOS)
- ✅ Bash version (3.2+ required)
- ✅ SQLite3 with JSON support
- ✅ Date command handling (GNU vs BSD)
- ✅ Bash features (regex, parameter expansion)
- ✅ Required commands (grep, sed, awk, jq)
- ✅ Tool syntax validation
- ✅ Integration test (if database exists)

### macOS Requirements

- bash 3.2+ (macOS default: 3.2.57)
- sqlite3 with JSON support (macOS 10.14+)
- jq (install via: `brew install jq`)

### Platform Support

All tools are cross-platform compatible:
- **Linux**: Uses GNU date (`date -d`)
- **macOS**: Uses BSD date (`date -v`)
- Automatic platform detection with fallback handling

## Running All Tests

```bash
# Integration tests
node test/test-integration.js

# macOS compatibility
bash test/test-macos-compat.sh

# Beads workflow test
bash mail/test-workflow.sh
```
