/**
 * Task Detail API Route
 * Provides individual task details including dependencies and enables
 */
import { json } from '@sveltejs/kit';
import { getTaskById } from '../../../../../../lib/beads.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	const taskId = params.id;

	const task = getTaskById(taskId);

	if (!task) {
		return json({ error: 'Task not found' }, { status: 404 });
	}

	return json({ task });
}

/** @type {import('./$types').RequestHandler} */
export async function PUT({ params, request }) {
	const taskId = params.id;
	const updates = await request.json();

	try {
		// Get existing task to find project path
		const existingTask = getTaskById(taskId);
		if (!existingTask) {
			return json({ error: 'Task not found' }, { status: 404 });
		}

		// Build bd update command
		const args = [];

		// Update title if changed
		if (updates.title !== undefined) {
			args.push(`--title "${updates.title.replace(/"/g, '\\"')}"`);
		}

		// Update description if changed
		if (updates.description !== undefined) {
			args.push(`--description "${updates.description.replace(/"/g, '\\"')}"`);
		}

		// Update priority if changed
		if (updates.priority !== undefined) {
			args.push(`--priority ${updates.priority}`);
		}

		// Update status if changed
		if (updates.status !== undefined) {
			args.push(`--status ${updates.status}`);
		}

		// Execute bd update command in correct project directory
		if (args.length > 0) {
			const projectPath = existingTask.project_path;
			const command = `cd "${projectPath}" && bd update ${taskId} ${args.join(' ')}`;
			const { stdout, stderr } = await execAsync(command);

			if (stderr && !stderr.includes('✓')) {
				console.error('bd update error:', stderr);
				return json({ error: 'Failed to update task', details: stderr }, { status: 500 });
			}
		}

		// Get updated task
		const updatedTask = getTaskById(taskId);

		if (!updatedTask) {
			return json({ error: 'Task not found after update' }, { status: 404 });
		}

		return json({ task: updatedTask });
	} catch (error) {
		console.error('Error updating task:', error);
		return json({ error: 'Failed to update task', details: error.message }, { status: 500 });
	}
}

/**
 * Update task fields (partial updates supported)
 * Supports updating: title, description, priority, status, assignee, dependencies
 * Note: Labels are NOT supported by bd update command (only settable during creation)
 * @type {import('./$types').RequestHandler}
 */
export async function PATCH({ params, request }) {
	const taskId = params.id;

	try {
		// Check if task exists first
		const existingTask = getTaskById(taskId);
		if (!existingTask) {
			return json(
				{ error: true, message: `Task '${taskId}' not found` },
				{ status: 404 }
			);
		}

		// Parse request body
		const updates = await request.json();

		// Validate that at least one field is provided
		if (!updates || Object.keys(updates).length === 0) {
			return json(
				{ error: true, message: 'No update fields provided. Provide at least one field to update.' },
				{ status: 400 }
			);
		}

		// Validate individual fields if provided
		const validationErrors = [];

		// Validate title (if provided, must be non-empty string)
		if (updates.title !== undefined) {
			if (typeof updates.title !== 'string' || updates.title.trim() === '') {
				validationErrors.push('title: Must be a non-empty string');
			}
		}

		// Validate priority (if provided, must be 0-3)
		if (updates.priority !== undefined && updates.priority !== null) {
			const priority = parseInt(updates.priority);
			if (isNaN(priority) || priority < 0 || priority > 3) {
				validationErrors.push('priority: Must be 0 (P0), 1 (P1), 2 (P2), or 3 (P3)');
			}
		}

		// Validate status (if provided, must be valid enum value)
		if (updates.status !== undefined) {
			const validStatuses = ['open', 'in_progress', 'blocked', 'closed'];
			if (!validStatuses.includes(updates.status)) {
				validationErrors.push(`status: Must be one of: ${validStatuses.join(', ')}`);
			}
		}

		// Note: Labels are not supported by bd update command (skip validation)
		// Labels can only be set during task creation with bd create --labels

		// Validate dependencies (if provided, must be array of task IDs)
		if (updates.dependencies !== undefined && updates.dependencies !== null) {
			if (!Array.isArray(updates.dependencies)) {
				validationErrors.push('dependencies: Must be an array of task IDs (e.g., ["jat-abc", "jat-xyz"])');
			}
		}

		// Return validation errors if any
		if (validationErrors.length > 0) {
			return json(
				{
					error: true,
					message: 'Validation failed',
					errors: validationErrors
				},
				{ status: 400 }
			);
		}

		// Build bd update command with provided fields
		const args = [];

		// Update title
		if (updates.title !== undefined) {
			const sanitizedTitle = updates.title.trim();
			args.push(`--title "${sanitizedTitle.replace(/"/g, '\\"')}"`);
		}

		// Update description
		if (updates.description !== undefined) {
			const sanitizedDesc = updates.description ? updates.description.trim() : '';
			args.push(`--description "${sanitizedDesc.replace(/"/g, '\\"')}"`);
		}

		// Update priority
		if (updates.priority !== undefined && updates.priority !== null) {
			args.push(`--priority ${parseInt(updates.priority)}`);
		}

		// Update status
		if (updates.status !== undefined) {
			args.push(`--status ${updates.status}`);
		}

		// Update assignee
		if (updates.assignee !== undefined) {
			const sanitizedAssignee = updates.assignee ? updates.assignee.trim() : '';
			args.push(`--assignee "${sanitizedAssignee.replace(/"/g, '\\"')}"`);
		}

		// Note: Labels are NOT supported by bd update command
		// Labels can only be set during task creation (bd create --labels)
		// To update labels, you would need to use a different bd command (if available)
		// For now, we skip labels updates in PATCH requests

		// Execute bd update command (only if we have args)
		if (args.length > 0) {
			const projectPath = existingTask.project_path;
			const command = `cd "${projectPath}" && bd update ${taskId} ${args.join(' ')}`;
			const { stdout, stderr } = await execAsync(command);

			// Check for errors in stderr (bd CLI uses stderr for some output)
			if (stderr && stderr.includes('Error:')) {
				console.error('bd update error:', stderr);
				return json(
					{
						error: true,
						message: 'Failed to update task',
						details: stderr.trim()
					},
					{ status: 500 }
				);
			}
		}

		// Handle dependencies separately using bd dep add/remove
		// Note: bd CLI doesn't support --deps flag for updates, need to use bd dep add
		if (updates.dependencies !== undefined && Array.isArray(updates.dependencies)) {
			// Get current dependencies
			const currentDeps = existingTask.dependencies || [];
			const newDeps = updates.dependencies;

			// Find deps to add (in new but not in current)
			const depsToAdd = newDeps.filter(d => !currentDeps.includes(d));

			// Find deps to remove (in current but not in new)
			const depsToRemove = currentDeps.filter(d => !newDeps.includes(d));

			// Add new dependencies
			for (const depId of depsToAdd) {
				try {
					const projectPath = existingTask.project_path;
					const addDepCommand = `cd "${projectPath}" && bd dep add ${taskId} ${depId}`;
					await execAsync(addDepCommand);
				} catch (err) {
					console.error(`Failed to add dependency ${depId}:`, err.message);
					// Continue with other deps even if one fails
				}
			}

			// Remove old dependencies
			for (const depId of depsToRemove) {
				try {
					const projectPath = existingTask.project_path;
					const removeDepCommand = `cd "${projectPath}" && bd dep remove ${taskId} ${depId}`;
					await execAsync(removeDepCommand);
				} catch (err) {
					console.error(`Failed to remove dependency ${depId}:`, err.message);
					// Continue with other deps even if one fails
				}
			}
		}

		// Fetch and return updated task
		const updatedTask = getTaskById(taskId);

		if (!updatedTask) {
			return json(
				{
					error: true,
					message: 'Task was updated but failed to retrieve updated data'
				},
				{ status: 500 }
			);
		}

		return json({
			success: true,
			task: updatedTask,
			message: `Task ${taskId} updated successfully`
		});

	} catch (err) {
		console.error('Error updating task:', err);

		// Check if it's a validation error from bd CLI
		if (err.stderr && err.stderr.includes('Error:')) {
			return json(
				{
					error: true,
					message: err.stderr.trim(),
					type: 'validation_error'
				},
				{ status: 400 }
			);
		}

		return json(
			{
				error: true,
				message: err.message || 'Internal server error updating task',
				type: 'server_error'
			},
			{ status: 500 }
		);
	}
}

/**
 * Delete task (closes task in Beads)
 * @type {import('./$types').RequestHandler}
 */
export async function DELETE({ params }) {
	const taskId = params.id;

	try {
		// Check if task exists first
		const existingTask = getTaskById(taskId);
		if (!existingTask) {
			return json(
				{ error: true, message: `Task '${taskId}' not found` },
				{ status: 404 }
			);
		}

		// Close the task using bd close command in the correct project directory
		// Note: We use "close" rather than "delete" to preserve task history
		const projectPath = existingTask.project_path;
		const command = `cd "${projectPath}" && bd close ${taskId} --reason "Deleted via dashboard"`;
		const { stdout, stderr } = await execAsync(command);

		// Check for errors in stderr
		if (stderr && stderr.includes('Error:')) {
			console.error('bd close error:', stderr);
			return json(
				{
					error: true,
					message: 'Failed to delete task',
					details: stderr.trim()
				},
				{ status: 500 }
			);
		}

		return json({
			success: true,
			message: `Task ${taskId} deleted successfully`
		});

	} catch (err) {
		console.error('Error deleting task:', err);

		// Check if it's a validation error from bd CLI
		if (err.stderr && err.stderr.includes('Error:')) {
			return json(
				{
					error: true,
					message: err.stderr.trim(),
					type: 'validation_error'
				},
				{ status: 400 }
			);
		}

		return json(
			{
				error: true,
				message: err.message || 'Internal server error deleting task',
				type: 'server_error'
			},
			{ status: 500 }
		);
	}
}
