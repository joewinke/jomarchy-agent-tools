#!/bin/bash

# Install Agent Mail (bash + SQLite tools)
# Multi-agent coordination system

set -e

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Installing Agent Mail (bash + SQLite)...${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$HOME/bin"
AGENT_MAIL_DB="${AGENT_MAIL_DB:-$HOME/.agent-mail.db}"

# Create ~/bin if needed
if [ ! -d "$BIN_DIR" ]; then
    mkdir -p "$BIN_DIR"
    echo -e "${GREEN}  ✓ Created $BIN_DIR${NC}"
fi

# Symlink Agent Mail tools
echo "  → Symlinking Agent Mail tools to ~/bin..."
TOOLS_INSTALLED=0
for tool in "$SCRIPT_DIR/mail"/am-*; do
    if [ -f "$tool" ] && [ -x "$tool" ] && [[ "$tool" != *.sh ]]; then
        tool_name=$(basename "$tool")
        target="$BIN_DIR/$tool_name"
        if [ -L "$target" ]; then
            rm "$target"
        fi
        ln -sf "$tool" "$target"
        TOOLS_INSTALLED=$((TOOLS_INSTALLED + 1))
    fi
done
echo -e "${GREEN}  ✓ Installed $TOOLS_INSTALLED Agent Mail tools${NC}"

# Initialize database
if [ ! -f "$AGENT_MAIL_DB" ]; then
    if [ -f "$SCRIPT_DIR/mail/schema.sql" ]; then
        sqlite3 "$AGENT_MAIL_DB" < "$SCRIPT_DIR/mail/schema.sql"
        echo -e "${GREEN}  ✓ Created database: $AGENT_MAIL_DB${NC}"
    fi
else
    echo -e "${YELLOW}  ⊘ Database already exists: $AGENT_MAIL_DB${NC}"
fi

echo -e "${GREEN}  ✓ Agent Mail ready${NC}"
echo ""
echo "  Usage:"
echo "    am-register --name AgentName --program claude-code --model sonnet-4.5"
echo "    am-inbox AgentName"
echo "    am-send \"Subject\" \"Body\" --from Agent1 --to Agent2 --thread bd-123"
echo ""
