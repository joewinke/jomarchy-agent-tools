import { json } from '@sveltejs/kit';
import { execSync } from 'child_process';

/**
 * API endpoint for fetching agent statistics
 *
 * Returns agent status breakdown from Agent Mail + Beads
 *
 * Response format:
 * {
 *   total: number,
 *   working: number,    // Agents with in_progress tasks
 *   idle: number,       // Agents with no tasks, active <24h
 *   offline: number,    // Agents inactive >24h
 *   lastUpdate: ISO date string
 * }
 */
export async function GET({ url }) {
	try {
		// Get all tasks from Beads
		const tasksJson = execSync('bd list --json', {
			encoding: 'utf-8',
			cwd: process.env.HOME + '/code/jat'
		});
		const tasks = JSON.parse(tasksJson);

		// Get all agents from Agent Mail
		const agentsOutput = execSync('am-agents', {
			encoding: 'utf-8',
			cwd: process.env.HOME + '/code/jat'
		});

		// Parse agent list (format: "AgentName <program> last_active_minutes_ago")
		const agentLines = agentsOutput
			.split('\n')
			.filter((line) => line.trim() && !line.startsWith('Agent') && !line.startsWith('==='));

		const registeredAgents = new Set();
		const agentLastActive = new Map();

		agentLines.forEach((line) => {
			const parts = line.trim().split(/\s+/);
			if (parts.length >= 3) {
				const agentName = parts[0];
				const minutesAgo = parseInt(parts[2]) || 0;
				registeredAgents.add(agentName);
				agentLastActive.set(agentName, minutesAgo);
			}
		});

		// Find agents with in_progress tasks
		const workingAgents = new Set();
		tasks.forEach((task) => {
			if (task.status === 'in_progress' && task.assignee) {
				workingAgents.add(task.assignee);
			}
		});

		// Categorize agents
		let working = 0;
		let idle = 0;
		let offline = 0;

		registeredAgents.forEach((agent) => {
			const minutesAgo = agentLastActive.get(agent) || 0;

			if (workingAgents.has(agent)) {
				working++;
			} else if (minutesAgo < 24 * 60) {
				// Active in last 24 hours
				idle++;
			} else {
				// Inactive >24h
				offline++;
			}
		});

		return json({
			total: registeredAgents.size,
			working,
			idle,
			offline,
			lastUpdate: new Date().toISOString()
		});
	} catch (error) {
		console.error('Error fetching agent stats:', error);

		// Return fallback data on error
		return json({
			total: 0,
			working: 0,
			idle: 0,
			offline: 0,
			lastUpdate: new Date().toISOString()
		});
	}
}

/**
 * Enhancement ideas for future:
 *
 * 1. Cache results (30-second TTL)
 * 2. Add agent details (names, tasks, time working)
 * 3. Add workload distribution (tasks per agent)
 * 4. Add agent performance metrics (tasks completed today)
 * 5. Add agent availability forecast (based on historical patterns)
 */
