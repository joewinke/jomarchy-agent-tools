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

	return json(task);
}

/** @type {import('./$types').RequestHandler} */
export async function PUT({ params, request }) {
	const taskId = params.id;
	const updates = await request.json();

	try {
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

		// Execute bd update command
		if (args.length > 0) {
			const command = `bd update ${taskId} ${args.join(' ')}`;
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
