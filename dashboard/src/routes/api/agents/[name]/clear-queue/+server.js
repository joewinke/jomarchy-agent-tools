/**
 * Agent Clear Queue API - Unassign All Tasks from Agent
 * POST /api/agents/[name]/clear-queue
 *
 * Unassigns all open tasks from the agent using bd update
 */

import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** @type {import('./$types').RequestHandler} */
export async function POST({ params }) {
	try {
		const agentName = params.name;

		if (!agentName) {
			return json({
				error: 'Missing agent name',
				message: 'Agent name is required'
			}, { status: 400 });
		}

		// Get list of tasks assigned to this agent
		const listCommand = `bd list --json`;

		try {
			const { stdout } = await execAsync(listCommand, { cwd: process.env.HOME + '/code/jat' });
			const allTasks = JSON.parse(stdout.trim());

			// Filter to open tasks assigned to this agent
			const agentTasks = allTasks.filter(
				(t) => t.assignee === agentName && t.status === 'open'
			);

			if (agentTasks.length === 0) {
				return json({
					success: true,
					agentName,
					message: 'No open tasks to clear',
					clearedCount: 0,
					timestamp: new Date().toISOString()
				});
			}

			// Unassign each task
			const updatePromises = agentTasks.map((task) =>
				execAsync(`bd update ${task.id} --assignee ""`, { cwd: process.env.HOME + '/code/jat' })
			);

			await Promise.all(updatePromises);

			return json({
				success: true,
				agentName,
				message: `Cleared ${agentTasks.length} tasks from ${agentName}'s queue`,
				clearedCount: agentTasks.length,
				clearedTasks: agentTasks.map((t) => t.id),
				timestamp: new Date().toISOString()
			});
		} catch (execError) {
			console.error('clear-queue error:', execError);

			return json({
				error: 'Failed to clear queue',
				message: execError.stderr || execError.message,
				agentName
			}, { status: 500 });
		}
	} catch (error) {
		console.error('Error in POST /api/agents/[name]/clear-queue:', error);
		return json({
			error: 'Internal server error',
			message: error.message
		}, { status: 500 });
	}
}
