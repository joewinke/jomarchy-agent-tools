/**
 * Agent Reservations API - View Agent File Locks
 * GET /api/agents/[name]/reservations
 *
 * Retrieves agent's active file reservations using am-reservations
 */

import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	try {
		const agentName = params.name;

		if (!agentName) {
			return json({
				error: 'Missing agent name',
				message: 'Agent name is required'
			}, { status: 400 });
		}

		// Use am-reservations command with --agent filter and --json flag
		const command = `${process.env.HOME}/bin/am-reservations --agent "${agentName}" --json`;

		try {
			const { stdout } = await execAsync(command);

			// Parse JSON output from am-reservations
			let reservations = [];
			try {
				reservations = JSON.parse(stdout.trim());
			} catch (parseError) {
				console.error('Failed to parse am-reservations output:', parseError);
			}

			return json({
				success: true,
				agentName,
				reservations,
				count: reservations.length,
				timestamp: new Date().toISOString()
			});
		} catch (execError) {
			console.error('am-reservations error:', execError);

			// If no reservations, return empty array
			if (execError.stderr?.includes('No reservations') || execError.code === 0) {
				return json({
					success: true,
					agentName,
					reservations: [],
					count: 0,
					timestamp: new Date().toISOString()
				});
			}

			return json({
				error: 'Failed to fetch reservations',
				message: execError.stderr || execError.message,
				agentName
			}, { status: 500 });
		}
	} catch (error) {
		console.error('Error in GET /api/agents/[name]/reservations:', error);
		return json({
			error: 'Internal server error',
			message: error.message
		}, { status: 500 });
	}
}
