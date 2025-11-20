#!/bin/bash
#
# Claude Code statusline for jat (Jomarchy Agent Tools)
# Shows: Agent Name | [Priority] Task ID - Task Title [Indicators]
#
# Features:
#   1. Agent identification (requires AGENT_NAME env var - set by /register)
#   2. Task priority badge [P0/P1/P2] with color coding (Red/Yellow/Green)
#   3. Task ID and title from Beads database
#   4. File lock count indicator (🔒N)
#   5. Unread messages count (📬N)
#   6. Time remaining on shortest lock (⏱Xm or Xh)
#   7. Task progress percentage if available (N%)
#
# IMPORTANT: Each session must explicitly set AGENT_NAME via /register.
# New sessions will show "no agent registered" until /register is run.
#
# Example output:
#   jat | no agent registered (new session, run /register)
#   FreeMarsh | [P1] jomarchy-agent-tools-4p0 - Demo: Frontend... [🔒2 📬1 ⏱45m]
#   FreeMarsh | idle [📬2]
#

# ANSI color codes
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
RED='\033[0;31m'
MAGENTA='\033[0;35m'
RESET='\033[0m'
BOLD='\033[1m'

# Read JSON from stdin (provided by Claude Code)
json_input=$(cat)

# Get session info from JSON
cwd=$(echo "$json_input" | jq -r '.cwd // empty')
session_id=$(echo "$json_input" | jq -r '.session_id // empty')

# Store session_id for slash commands to access
# (Commands don't get JSON input, so we persist it for them)
if [[ -n "$session_id" ]] && [[ -n "$cwd" ]]; then
    echo "$session_id" > "$cwd/.claude/current-session-id.txt" 2>/dev/null
fi

# Get agent name from session-specific file
# Each Claude Code session gets its own agent identity file
agent_name=""

if [[ -n "$session_id" ]] && [[ -f "$cwd/.claude/agent-${session_id}.txt" ]]; then
    # Read from session-specific file (supports multiple concurrent agents)
    agent_name=$(cat "$cwd/.claude/agent-${session_id}.txt" 2>/dev/null | tr -d '\n')
elif [[ -n "$AGENT_NAME" ]]; then
    # Fall back to environment variable if set
    agent_name="$AGENT_NAME"
fi

# If no agent name, show "not registered" status
if [[ -z "$agent_name" ]]; then
    echo -e "${GRAY}jat${RESET} ${GRAY}|${RESET} ${CYAN}no agent registered${RESET}"
    exit 0
fi

# Get current task from file reservations
task_id=""
task_title=""

if command -v am-reservations &>/dev/null; then
    # Get the most recent reservation for this agent and extract task ID from reason
    reservation_info=$(am-reservations --agent "$agent_name" 2>/dev/null)

    if [[ -n "$reservation_info" ]]; then
        # Extract task ID from reason field (format: "task-id: description" or just "task-id")
        # Match exactly 3 alphanumeric characters after the prefix (standard Beads format)
        task_id=$(echo "$reservation_info" | grep "^Reason:" | sed 's/^Reason: //' | grep -oE 'jomarchy-agent-tools-[a-z0-9]{3}\b' | head -1)
    fi
fi

# If we have a task ID, get task details from Beads
task_priority=""
task_progress=""

if [[ -n "$task_id" ]] && command -v bd &>/dev/null; then
    # Change to project directory if provided
    if [[ -n "$cwd" ]] && [[ -d "$cwd" ]]; then
        cd "$cwd" 2>/dev/null || true
    fi

    task_json=$(bd show "$task_id" --json 2>/dev/null)
    task_title=$(echo "$task_json" | jq -r '.[0].title // empty')
    task_priority=$(echo "$task_json" | jq -r '.[0].priority // empty')
    task_progress=$(echo "$task_json" | jq -r '.[0].progress // empty')

    # Truncate title if too long
    if [[ ${#task_title} -gt 40 ]]; then
        task_title="${task_title:0:37}..."
    fi
fi

# Get additional status indicators
lock_count=0
unread_count=0
time_remaining=""

if [[ -n "$agent_name" ]]; then
    # Count file locks
    if command -v am-reservations &>/dev/null; then
        lock_count=$(am-reservations --agent "$agent_name" 2>/dev/null | grep -c "^ID:" || echo "0")

        # Calculate time remaining on shortest lock
        if [[ $lock_count -gt 0 ]]; then
            expires=$(am-reservations --agent "$agent_name" 2>/dev/null | grep "^Expires:" | head -1 | sed 's/^Expires: //')
            if [[ -n "$expires" ]]; then
                expires_epoch=$(date -d "$expires" +%s 2>/dev/null || echo "0")
                now_epoch=$(date +%s)
                seconds_remaining=$((expires_epoch - now_epoch))

                if [[ $seconds_remaining -gt 0 ]]; then
                    minutes_remaining=$((seconds_remaining / 60))
                    if [[ $minutes_remaining -lt 60 ]]; then
                        time_remaining="${minutes_remaining}m"
                    else
                        hours_remaining=$((minutes_remaining / 60))
                        time_remaining="${hours_remaining}h"
                    fi
                fi
            fi
        fi
    fi

    # Count unread messages
    if command -v am-inbox &>/dev/null; then
        unread_count=$(am-inbox "$agent_name" --unread 2>/dev/null | grep -c "^ID:" || echo "0")
    fi
fi

# Build status line with all indicators
status_line=""

# Start with agent name
status_line="${BOLD}${BLUE}${agent_name}${RESET}"

if [[ -n "$task_id" ]]; then
    # Add priority badge if available
    if [[ -n "$task_priority" ]]; then
        case "$task_priority" in
            0)
                priority_badge="${BOLD}${RED}[P0]${RESET}"
                ;;
            1)
                priority_badge="${BOLD}${YELLOW}[P1]${RESET}"
                ;;
            2)
                priority_badge="${BOLD}${GREEN}[P2]${RESET}"
                ;;
            *)
                priority_badge="${GRAY}[P${task_priority}]${RESET}"
                ;;
        esac
        status_line="${status_line} ${GRAY}|${RESET} ${priority_badge}"
    else
        status_line="${status_line} ${GRAY}|${RESET}"
    fi

    # Add task ID
    status_line="${status_line} ${GREEN}${task_id}${RESET}"

    # Add task title if available
    if [[ -n "$task_title" ]]; then
        status_line="${status_line} ${GRAY}-${RESET} ${YELLOW}${task_title}${RESET}"
    fi

    # Build indicators section
    indicators=""

    # Add lock count
    if [[ $lock_count -gt 0 ]]; then
        indicators="${indicators}🔒${lock_count}"
    fi

    # Add unread messages
    if [[ $unread_count -gt 0 ]]; then
        [[ -n "$indicators" ]] && indicators="${indicators} "
        indicators="${indicators}📬${unread_count}"
    fi

    # Add time remaining
    if [[ -n "$time_remaining" ]]; then
        [[ -n "$indicators" ]] && indicators="${indicators} "
        indicators="${indicators}⏱${time_remaining}"
    fi

    # Add progress if available
    if [[ -n "$task_progress" ]] && [[ "$task_progress" != "null" ]]; then
        [[ -n "$indicators" ]] && indicators="${indicators} "
        indicators="${indicators}${task_progress}%"
    fi

    # Append indicators if any
    if [[ -n "$indicators" ]]; then
        status_line="${status_line} ${GRAY}[${RESET}${indicators}${GRAY}]${RESET}"
    fi

elif [[ -n "$agent_name" ]]; then
    # Agent registered but no active task - show idle with basic indicators
    status_line="${status_line} ${GRAY}|${RESET} ${CYAN}idle${RESET}"

    # Show unread messages even when idle
    if [[ $unread_count -gt 0 ]]; then
        status_line="${status_line} ${GRAY}[${RESET}📬${unread_count}${GRAY}]${RESET}"
    fi
else
    # Fallback
    status_line="${GRAY}jat${RESET}"
fi

echo -e "$status_line"
