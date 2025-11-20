/**
 * Agent Management API - Delete Agent
 * DELETE /api/agents/[name]
 *
 * Deletes an agent using the am-delete-agent command
 */

import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ params }) {
	try {
		const agentName = params.name;

		if (!agentName) {
			return json({
				error: 'Missing agent name',
				message: 'Agent name is required'
			}, { status: 400 });
		}

		// Use am-delete-agent command with --force to skip confirmation
		// Use full path since Node doesn't inherit ~/bin in PATH
		const command = `${process.env.HOME}/bin/am-delete-agent "${agentName}" --force`;

		try {
			const { stdout, stderr } = await execAsync(command);

			// am-delete-agent outputs status messages to stderr (not errors)
			// Only treat it as an error if the command actually failed or stderr contains "Error:"
			// Success message: "✓ Agent 'X' deleted successfully"
			const isSuccess = stdout.includes('deleted successfully') || stdout.includes('✓');

			if (!isSuccess && stderr && stderr.includes('Error:')) {
				return json({
					error: 'Failed to delete agent',
					message: stderr,
					agentName
				}, { status: 500 });
			}

			return json({
				success: true,
				agentName,
				message: `Agent ${agentName} deleted successfully`,
				output: stdout,
				timestamp: new Date().toISOString()
			});
		} catch (execError) {
			console.error('am-delete-agent error:', execError);

			// Parse error message
			const errorMessage = execError.stderr || execError.message;

			// Check if agent not found
			if (errorMessage.includes('not found')) {
				return json({
					error: 'Agent not found',
					message: `Agent '${agentName}' does not exist`,
					agentName
				}, { status: 404 });
			}

			return json({
				error: 'Failed to delete agent',
				message: errorMessage,
				agentName
			}, { status: 500 });
		}
	} catch (error) {
		console.error('Error in DELETE /api/agents/[name]:', error);
		return json({
			error: 'Internal server error',
			message: error.message
		}, { status: 500 });
	}
}
