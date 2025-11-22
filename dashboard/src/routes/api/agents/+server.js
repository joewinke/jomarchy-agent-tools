/**
 * Unified Agents API Endpoint
 *
 * GET /api/agents              → Simple agent list (lightweight, for dropdowns/lists)
 * GET /api/agents?full=true    → Full orchestration data (agents + tasks + reservations + stats + activities)
 * GET /api/agents?orchestration=true → Alias for full orchestration data
 * GET /api/agents?usage=true   → Include token usage data for each agent
 * POST /api/agents             → Assign task to agent (body: { taskId, agentName })
 *
 * Each agent in full mode includes an 'activities' array with recent Beads task history:
 * - ts: timestamp (ISO 8601)
 * - preview: task status update (e.g., "[jat-abc] Completed: Task title")
 * - content: task description
 * - type: 'urgent' | 'action_required' | 'message' (based on task status)
 */

import { json } from '@sveltejs/kit';
import { getAgents, getReservations, getBeadsActivities } from '$lib/server/agent-mail.js';
import { getTasks } from '$lib/server/beads.js';
import { getAllAgentUsage, getHourlyUsage } from '$lib/utils/tokenUsage.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	// Check if full orchestration data requested
	const fullData = url.searchParams.get('full') === 'true' ||
	                 url.searchParams.get('orchestration') === 'true';

	if (!fullData) {
		// Simple agent list (backward compatible)
		try {
			const projectFilter = url.searchParams.get('project');
			const agents = getAgents(projectFilter);
			return json({ agents });
		} catch (error) {
			console.error('Error fetching agents:', error);
			return json({ error: 'Failed to fetch agents', agents: [] }, { status: 500 });
		}
	}

	// Full orchestration data
	try {
		const projectFilter = url.searchParams.get('project');
		const agentFilter = url.searchParams.get('agent');
		const includeUsage = url.searchParams.get('usage') === 'true';
		const includeHourly = url.searchParams.get('hourly') === 'true';

		// Fetch all data sources in parallel for performance
		// NOTE: Agents and reservations are NOT filtered by project
		// because agents work across multiple projects. Only tasks are filtered.
		const promises = [
			Promise.resolve(getAgents(null)),  // Show all agents (don't filter by project)
			Promise.resolve(getReservations(agentFilter, null)),  // Show all reservations
			Promise.resolve(getTasks({ projectName: projectFilter }))  // Filter tasks only
		];

		const projectPath = process.cwd().replace('/dashboard', '');

		// Optionally fetch token usage data
		if (includeUsage) {
			promises.push(
				getAllAgentUsage('today', projectPath),
				getAllAgentUsage('week', projectPath)
			);
		}

		// Optionally fetch hourly token usage data (raw data for sparklines)
		if (includeHourly) {
			promises.push(getHourlyUsage(projectPath));
		}

		const results = await Promise.all(promises);
		const agents = results[0];
		const reservations = results[1];
		const tasks = results[2];
		const usageToday = includeUsage ? results[3] : null;
		const usageWeek = includeUsage ? results[4] : null;
		const hourlyUsage = includeHourly ? results[includeUsage ? 5 : 3] : null;

		// Calculate agent statistics
		const agentStats = agents.map(agent => {
			// Count reservations per agent
			const agentReservations = reservations.filter(r => r.agent_name === agent.name);

			// Count tasks assigned to agent
			const agentTasks = tasks.filter(t => t.assignee === agent.name);
			const openTasks = agentTasks.filter(t => t.status === 'open').length;
			const inProgressTasks = agentTasks.filter(t => t.status === 'in_progress').length;

			// Determine if agent is active based on reservations or active tasks
			const hasActiveReservations = agentReservations.some(r => {
				const expiresAt = new Date(r.expires_ts);
				return expiresAt > new Date() && !r.released_ts;
			});

			// Get recent activities from Beads task history (last 10 task updates)
			let activities = [];
			try {
				activities = getBeadsActivities(agent.name, tasks);
			} catch (error) {
				console.error(`Failed to fetch activities for agent ${agent.name}:`, error);
				// Continue with empty activities array
			}

			const baseStats = {
				...agent,
				reservation_count: agentReservations.length,
				task_count: agentTasks.length,
				open_tasks: openTasks,
				in_progress_tasks: inProgressTasks,
				active: hasActiveReservations || inProgressTasks > 0,
				activities: activities
			};

			// Optionally include token usage data
			if (includeUsage && usageToday && usageWeek) {
				const todayUsage = usageToday.get(agent.name);
				const weekUsage = usageWeek.get(agent.name);

				baseStats.usage = {
					today: todayUsage ? {
						total_tokens: todayUsage.total_tokens,
						cost: todayUsage.cost,
						sessionCount: todayUsage.sessionCount
					} : { total_tokens: 0, cost: 0, sessionCount: 0 },
					week: weekUsage ? {
						total_tokens: weekUsage.total_tokens,
						cost: weekUsage.cost,
						sessionCount: weekUsage.sessionCount
					} : { total_tokens: 0, cost: 0, sessionCount: 0 }
				};
			}

			return baseStats;
		});

		// Group reservations by agent for easy lookup
		const reservationsByAgent = {};
		reservations.forEach(r => {
			if (!reservationsByAgent[r.agent_name]) {
				reservationsByAgent[r.agent_name] = [];
			}
			reservationsByAgent[r.agent_name].push(r);
		});

		// Calculate task statistics
		const taskStats = {
			total: tasks.length,
			open: tasks.filter(t => t.status === 'open').length,
			in_progress: tasks.filter(t => t.status === 'in_progress').length,
			blocked: tasks.filter(t => t.status === 'blocked').length,
			closed: tasks.filter(t => t.status === 'closed').length,
			by_priority: {
				p0: tasks.filter(t => t.priority === 0).length,
				p1: tasks.filter(t => t.priority === 1).length,
				p2: tasks.filter(t => t.priority === 2).length,
				p3: tasks.filter(t => t.priority === 3).length,
				p4: tasks.filter(t => t.priority === 4).length
			}
		};

		// Find tasks with dependencies for visualization
		const tasksWithDeps = tasks.filter(t =>
			(t.depends_on && t.depends_on.length > 0) ||
			(t.blocked_by && t.blocked_by.length > 0)
		);

		// Find unassigned tasks (ready for assignment)
		const unassignedTasks = tasks.filter(t =>
			!t.assignee && t.status === 'open'
		);

		// Return unified orchestration data
		return json({
			agents: agentStats,
			reservations,
			reservations_by_agent: reservationsByAgent,
			tasks: tasks, // Return all tasks (frontend handles pagination/filtering)
			unassigned_tasks: unassignedTasks,
			task_stats: taskStats,
			tasks_with_deps_count: tasksWithDeps.length,
			tasks_with_deps: tasksWithDeps,
			hourlyUsage: hourlyUsage, // Raw hourly token usage (last 24 hours)
			timestamp: new Date().toISOString(),
			meta: {
				poll_interval_ms: 3000, // Recommended poll interval for frontend
				data_sources: ['agent-mail', 'beads'],
				cache_ttl_ms: 2000 // Data freshness guarantee
			}
		});
	} catch (error) {
		console.error('Error fetching agent data:', error);
		console.error('Error stack:', error.stack);

		return json({
			error: 'Failed to fetch agent data',
			message: error.message,
			stack: error.stack,
			agents: [],
			reservations: [],
			reservations_by_agent: {},
			tasks: [],
			unassigned_tasks: [],
			task_stats: {
				total: 0,
				open: 0,
				in_progress: 0,
				blocked: 0,
				closed: 0,
				by_priority: { p0: 0, p1: 0, p2: 0, p3: 0, p4: 0 }
			},
			tasks_with_deps_count: 0,
			tasks_with_deps: [],
			timestamp: new Date().toISOString()
		}, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const { taskId, agentName } = await request.json();

		// Validate input
		if (!taskId || !agentName) {
			return json({
				error: 'Missing required fields',
				message: 'Both taskId and agentName are required'
			}, { status: 400 });
		}

		// Validate task ID format (project-xxx)
		if (!/^[a-z]+-[a-z0-9]{3}$/.test(taskId)) {
			return json({
				error: 'Invalid task ID format',
				message: 'Task ID must be in format: project-xxx (e.g., jat-abc)'
			}, { status: 400 });
		}

		// Verify task exists before assigning
		try {
			const { stdout } = await execAsync(`bd show "${taskId}" --json`);
			const taskData = JSON.parse(stdout);
			if (!taskData || taskData.length === 0) {
				return json({
					error: 'Task not found',
					message: `Task ${taskId} does not exist`
				}, { status: 404 });
			}
		} catch (error) {
			return json({
				error: 'Task not found',
				message: `Task ${taskId} does not exist or could not be retrieved`
			}, { status: 404 });
		}

		// Assign task to agent using bd CLI
		try {
			const { stdout, stderr } = await execAsync(
				`bd update "${taskId}" --assignee "${agentName}"`
			);

			// Get updated task data
			const { stdout: updatedTaskJson } = await execAsync(`bd show "${taskId}" --json`);
			const updatedTask = JSON.parse(updatedTaskJson);

			return json({
				success: true,
				message: `Task ${taskId} assigned to ${agentName}`,
				task: updatedTask[0]
			});
		} catch (error) {
			console.error('Failed to assign task:', error);
			return json({
				error: 'Failed to assign task',
				message: error.message || 'Unknown error occurred'
			}, { status: 500 });
		}
	} catch (error) {
		console.error('Error in POST /api/agents:', error);
		return json({
			error: 'Invalid request',
			message: error.message || 'Failed to parse request body'
		}, { status: 400 });
	}
}
