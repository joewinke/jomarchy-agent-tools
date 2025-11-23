# Prune and Resume Session

**Purpose:** Exit current session, prune conversation to 35 messages, and resume automatically.

**What this does:**
1. Gets current session ID
2. Creates a background process that waits for Claude Code to exit
3. Background process runs `npx claude-prune SESSION_ID -k 35`
4. Background process runs `claude -r SESSION_ID` to resume
5. Exits Claude Code session

**Usage:** `/prune-resume`

**Note:** This uses a background process that survives Claude Code exit. Check `/tmp/prune-resume.log` if issues occur.

---

Execute the following steps:

1. **Get session ID** from environment or `.claude/session-id.txt` if it exists

2. **Capture current working directory** (`$PWD`) - critical for finding `.claude/` folder

3. **Create background process** that will:
   - Wait for Claude Code process to exit
   - Change to the original working directory
   - Run `npx claude-prune SESSION_ID -k 35`
   - Run `claude -r SESSION_ID`
   - Log output to `/tmp/prune-resume.log`

4. **Use `nohup` and `disown`** to ensure background process survives

5. **Exit Claude Code** by terminating the process

Implementation notes:
- The background process checks if Claude Code is still running using `kill -0 $PID`
- **CRITICAL:** Must `cd` to original working directory before running `npx claude-prune`
- The prune command needs to run in the same directory as `.claude/` folder
- Once Claude Code exits, worker runs the prune command
- Then it automatically resumes the session
- All output is logged to `/tmp/prune-resume.log` for debugging
- The process is disowned so it survives Claude Code exit
- If `cd` to original directory fails, worker exits with error logged

**Alternative (Manual):** If automatic resume fails, you can also create an executable script at `/tmp/prune-resume.sh` that the user can run manually after exit.
