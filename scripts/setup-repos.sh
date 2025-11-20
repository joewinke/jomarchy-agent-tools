#!/bin/bash

# Per-Repository Setup
# - Initialize Beads (bd init) in each project
# - Create/update project CLAUDE.md with template

set -e

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}Setting up repositories for agent tools...${NC}"
echo ""

# Check if bd command is available
if ! command -v bd &> /dev/null; then
    echo -e "${RED}ERROR: 'bd' command not found${NC}"
    echo "Please install Beads CLI first (run beads-cli.sh)"
    exit 1
fi

# Scan ~/code/ for projects
CODE_DIR="$HOME/code"

if [ ! -d "$CODE_DIR" ]; then
    echo -e "${YELLOW}⚠ ~/code/ directory not found${NC}"
    echo "Creating $CODE_DIR..."
    mkdir -p "$CODE_DIR"
fi

# Find all directories in ~/code/
echo "Scanning ~/code/ for projects..."
echo ""

REPOS_FOUND=0
BEADS_INITIALIZED=0
CLAUDE_MD_CREATED=0
SKIPPED=0

for repo_dir in "$CODE_DIR"/*; do
    # Skip if not a directory
    if [ ! -d "$repo_dir" ]; then
        continue
    fi

    REPO_NAME=$(basename "$repo_dir")
    echo -e "${BLUE}→ ${REPO_NAME}${NC}"

    # Check if it's a git repository
    if [ ! -d "$repo_dir/.git" ]; then
        echo -e "  ${YELLOW}⊘ Not a git repository, skipping${NC}"
        ((SKIPPED++))
        echo ""
        continue
    fi

    ((REPOS_FOUND++))

    # Initialize Beads if needed
    if [ ! -d "$repo_dir/.beads" ]; then
        echo "  → Initializing Beads..."
        cd "$repo_dir"

        # Run bd init non-interactively
        # Answer prompts: yes to git hooks, yes to merge driver
        echo -e "Y\nY\n" | bd init > /dev/null 2>&1 || {
            echo -e "  ${YELLOW}⚠ Beads init failed (may already be partially initialized)${NC}"
        }

        if [ -d "$repo_dir/.beads" ]; then
            echo -e "  ${GREEN}✓ Beads initialized${NC}"
            ((BEADS_INITIALIZED++))
        fi
    else
        echo -e "  ${GREEN}✓${NC} Beads already initialized"
    fi

    # Create/update CLAUDE.md
    CLAUDE_MD="$repo_dir/CLAUDE.md"

    if [ ! -f "$CLAUDE_MD" ]; then
        # Copy template
        # Try jat first, then fall back to jomarchy
        if [ -f "$HOME/code/jat/templates/project-claude.md" ]; then
            TEMPLATE="$HOME/code/jat/templates/project-claude.md"
        elif [ -f "$HOME/code/jomarchy/scripts/templates/project-claude.md" ]; then
            TEMPLATE="$HOME/code/jomarchy/scripts/templates/project-claude.md"
        else
            TEMPLATE=""
        fi
        if [ -f "$TEMPLATE" ]; then
            cp "$TEMPLATE" "$CLAUDE_MD"

            # Update date in template
            CURRENT_DATE=$(date +"%B %d, %Y")
            sed -i "s/\[Date\]/$CURRENT_DATE/" "$CLAUDE_MD"

            echo -e "  ${GREEN}✓ Created CLAUDE.md from template${NC}"
            ((CLAUDE_MD_CREATED++))
        else
            echo -e "  ${YELLOW}⚠ Template not found, creating minimal CLAUDE.md${NC}"
            cat > "$CLAUDE_MD" << EOF
# $REPO_NAME

## Agent Tools Configuration

**Global instructions:** See \`~/.claude/CLAUDE.md\` for Agent Mail, Beads, and bash tools documentation.

**This project uses:**
- ✅ Beads task planning (\`.beads/\` directory)
- ✅ Agent Mail coordination (project key: \`$repo_dir\`)
- ✅ 28 generic bash tools available globally

**Quick start for AI assistants:**
\`\`\`bash
# See tasks ready to work
bd ready

# Register with Agent Mail
am-register --program claude-code --model sonnet-4.5

# Reserve files before editing
am-reserve "src/**" --agent AgentName --ttl 3600 --reason "bd-123"
\`\`\`
EOF
            ((CLAUDE_MD_CREATED++))
        fi
    else
        # Check if it has our marker
        if ! grep -q "## Agent Tools Configuration" "$CLAUDE_MD"; then
            echo "  → Appending agent tools section to CLAUDE.md..."

            cat >> "$CLAUDE_MD" << EOF

---

## Agent Tools Configuration

**Global instructions:** See \`~/.claude/CLAUDE.md\` for Agent Mail, Beads, and bash tools documentation.

**This project uses:**
- ✅ Beads task planning (\`.beads/\` directory)
- ✅ Agent Mail coordination (project key: \`$repo_dir\`)
- ✅ 28 generic bash tools available globally

**Quick start for AI assistants:**
\`\`\`bash
# See tasks ready to work
bd ready

# Register with Agent Mail
am-register --program claude-code --model sonnet-4.5

# Reserve files before editing
am-reserve "src/**" --agent AgentName --ttl 3600 --reason "bd-123"
\`\`\`
EOF
            echo -e "  ${GREEN}✓ Updated CLAUDE.md with agent tools section${NC}"
            ((CLAUDE_MD_CREATED++))
        else
            echo -e "  ${GREEN}✓${NC} CLAUDE.md already configured"
        fi
    fi

    echo ""
done

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Repository Setup Complete${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "  Total repos found: $REPOS_FOUND"
echo "  Beads initialized: $BEADS_INITIALIZED"
echo "  CLAUDE.md created/updated: $CLAUDE_MD_CREATED"
echo "  Skipped (not git repos): $SKIPPED"
echo ""

if [ $REPOS_FOUND -eq 0 ]; then
    echo -e "${YELLOW}  ⚠ No repositories found in ~/code/${NC}"
    echo "  Clone some projects to ~/code/ to get started"
else
    echo "  All repositories are now configured for AI-assisted development!"
    echo ""
    echo "  Test in any project:"
    echo "    cd ~/code/<project>"
    echo "    bd ready                    # See tasks"
    echo "    am-register --program claude-code"
    echo ""
fi
