/**
 * Agent Message API - Send Message to Agent
 * POST /api/agents/[name]/message
 *
 * Sends a message to agent using am-send
 */

import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** @type {import('./$types').RequestHandler} */
export async function POST({ params, request }) {
	try {
		const agentName = params.name;
		const { subject, body } = await request.json();

		if (!agentName || !subject || !body) {
			return json({
				error: 'Missing required fields',
				message: 'Agent name, subject, and body are required'
			}, { status: 400 });
		}

		// Escape quotes in subject and body for shell
		const escapedSubject = subject.replace(/"/g, '\\"');
		const escapedBody = body.replace(/"/g, '\\"');

		// Use am-send command
		// From: Dashboard, To: agentName
		const command = `${process.env.HOME}/bin/am-send "${escapedSubject}" "${escapedBody}" --from Dashboard --to "${agentName}"`;

		try {
			const { stdout } = await execAsync(command);

			return json({
				success: true,
				agentName,
				subject,
				message: 'Message sent successfully',
				output: stdout,
				timestamp: new Date().toISOString()
			});
		} catch (execError) {
			console.error('am-send error:', execError);

			return json({
				error: 'Failed to send message',
				message: execError.stderr || execError.message,
				agentName
			}, { status: 500 });
		}
	} catch (error) {
		console.error('Error in POST /api/agents/[name]/message:', error);
		return json({
			error: 'Internal server error',
			message: error.message
		}, { status: 500 });
	}
}
