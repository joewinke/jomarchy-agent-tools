/**
 * Agent Inbox API - View Agent Messages
 * GET /api/agents/[name]/inbox
 *
 * Retrieves agent's unread messages using am-inbox
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

		// Use am-inbox command with --json flag for structured output
		const command = `${process.env.HOME}/bin/am-inbox "${agentName}" --json`;

		try {
			const { stdout } = await execAsync(command);

			// Parse JSON output from am-inbox
			let messages = [];
			try {
				messages = JSON.parse(stdout.trim());
			} catch (parseError) {
				console.error('Failed to parse am-inbox output:', parseError);
			}

			return json({
				success: true,
				agentName,
				messages,
				count: messages.length,
				timestamp: new Date().toISOString()
			});
		} catch (execError) {
			console.error('am-inbox error:', execError);

			// If agent not found or no inbox, return empty array
			if (execError.stderr?.includes('not found') || execError.stderr?.includes('No messages')) {
				return json({
					success: true,
					agentName,
					messages: [],
					count: 0,
					timestamp: new Date().toISOString()
				});
			}

			return json({
				error: 'Failed to fetch inbox',
				message: execError.stderr || execError.message,
				agentName
			}, { status: 500 });
		}
	} catch (error) {
		console.error('Error in GET /api/agents/[name]/inbox:', error);
		return json({
			error: 'Internal server error',
			message: error.message
		}, { status: 500 });
	}
}
