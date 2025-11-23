#!/bin/bash
#
# Migration: Rename jomarchy-agent-tools-* tasks to jat-*
#
# This script updates task IDs in the jat Beads database:
# - Changes all jomarchy-agent-tools-XXX -> jat-XXX
# - Updates references in dependencies table
# - Creates backup before making changes
#

set -e  # Exit on error

DB_PATH="$HOME/code/jat/.beads/beads.db"
BACKUP_PATH="$HOME/code/jat/.beads/beads.db.backup-$(date +%Y%m%d-%H%M%S)"

echo "🔍 Beads Database Migration: jomarchy-agent-tools → jat"
echo ""

# Check if database exists
if [[ ! -f "$DB_PATH" ]]; then
    echo "❌ Error: Database not found at $DB_PATH"
    exit 1
fi

# Count tasks to migrate
TASK_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM issues WHERE id LIKE 'jomarchy-agent-tools-%';")
echo "📊 Found $TASK_COUNT tasks to migrate"

if [[ "$TASK_COUNT" -eq 0 ]]; then
    echo "✓ No tasks to migrate. Exiting."
    exit 0
fi

# Create backup
echo ""
echo "💾 Creating backup..."
cp "$DB_PATH" "$BACKUP_PATH"
echo "✓ Backup created: $BACKUP_PATH"

# Show sample of tasks that will be migrated
echo ""
echo "📋 Sample tasks (first 5):"
sqlite3 "$DB_PATH" "SELECT id, title FROM issues WHERE id LIKE 'jomarchy-agent-tools-%' LIMIT 5;" | while read line; do
    echo "  - $line"
done

# Confirm migration
echo ""
read -p "Continue with migration? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled"
    exit 0
fi

echo ""
echo "🚀 Starting migration..."

# Run migration SQL
sqlite3 "$DB_PATH" <<'EOF'
BEGIN TRANSACTION;

-- Update issues table: jomarchy-agent-tools-XXX → jat-XXX
UPDATE issues
SET id = 'jat-' || substr(id, length('jomarchy-agent-tools-') + 1)
WHERE id LIKE 'jomarchy-agent-tools-%';

-- Update dependencies table: issue_id column
UPDATE dependencies
SET issue_id = 'jat-' || substr(issue_id, length('jomarchy-agent-tools-') + 1)
WHERE issue_id LIKE 'jomarchy-agent-tools-%';

-- Update dependencies table: depends_on_id column
UPDATE dependencies
SET depends_on_id = 'jat-' || substr(depends_on_id, length('jomarchy-agent-tools-') + 1)
WHERE depends_on_id LIKE 'jomarchy-agent-tools-%';

-- Update labels table: issue_id column
UPDATE labels
SET issue_id = 'jat-' || substr(issue_id, length('jomarchy-agent-tools-') + 1)
WHERE issue_id LIKE 'jomarchy-agent-tools-%';

COMMIT;

-- Verify migration
SELECT 'Migration complete. Updated tasks:' as status;
SELECT COUNT(*) || ' tasks now have jat- prefix' as result
FROM issues
WHERE id LIKE 'jat-%'
  AND id NOT LIKE 'jomarchy-agent-tools-%';

SELECT COUNT(*) || ' tasks still have old prefix (should be 0)' as check
FROM issues
WHERE id LIKE 'jomarchy-agent-tools-%';
EOF

echo ""
echo "✅ Migration completed successfully!"
echo ""
echo "📊 Summary:"
sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM issues WHERE id LIKE 'jat-%';" | while read count; do
    echo "  Total jat-* tasks: $count"
done
sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM issues WHERE id LIKE 'jomarchy-agent-tools-%';" | while read count; do
    echo "  Remaining jomarchy-agent-tools-* tasks: $count"
done

echo ""
echo "💡 Tip: If something went wrong, restore from backup:"
echo "   cp $BACKUP_PATH $DB_PATH"
echo ""
echo "🎉 Done! Refresh your dashboard to see the changes."
