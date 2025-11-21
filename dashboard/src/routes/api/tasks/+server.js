/**
 * Tasks API Route
 * Provides Beads task data to the dashboard
 */
import { json } from '@sveltejs/kit';
import { getTasks, getProjects, getTaskById } from '../../../../../lib/beads.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	const project = url.searchParams.get('project');
	const status = url.searchParams.get('status');
	const priority = url.searchParams.get('priority');
	const search = url.searchParams.get('search');

	const filters = {};
	if (project) filters.project = project;
	if (status) filters.status = status;
	if (priority !== null) filters.priority = parseInt(priority);

	let tasks = getTasks(filters);
	const projects = getProjects();

	// Apply search filter if provided
	if (search && search.trim()) {
		const searchLower = search.toLowerCase().trim();
		tasks = tasks.filter(task => {
			// Search in task ID
			if (task.id && task.id.toLowerCase().includes(searchLower)) {
				return true;
			}
			// Search in title
			if (task.title && task.title.toLowerCase().includes(searchLower)) {
				return true;
			}
			// Search in description
			if (task.description && task.description.toLowerCase().includes(searchLower)) {
				return true;
			}
			// Search in labels
			if (task.labels && Array.isArray(task.labels)) {
				return task.labels.some(label =>
					label.toLowerCase().includes(searchLower)
				);
			}
			return false;
		});
	}

	return json({
		tasks,
		projects,
		count: tasks.length
	});
}

/**
 * Create a new task using bd create CLI
 * @type {import('./$types').RequestHandler}
 */
export async function POST({ request }) {
	try {
		// Parse request body
		const body = await request.json();

		// Validate required fields
		if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
			return json(
				{ error: true, message: 'Title is required and must be a non-empty string' },
				{ status: 400 }
			);
		}

		if (!body.type || typeof body.type !== 'string') {
			return json(
				{ error: true, message: 'Type is required (task, bug, feature, epic, chore)' },
				{ status: 400 }
			);
		}

		// Validate type is one of allowed values
		const validTypes = ['task', 'bug', 'feature', 'epic', 'chore'];
		if (!validTypes.includes(body.type)) {
			return json(
				{
					error: true,
					message: `Type must be one of: ${validTypes.join(', ')}. Got: ${body.type}`
				},
				{ status: 400 }
			);
		}

		// Validate priority if provided
		if (body.priority !== undefined && body.priority !== null) {
			const priority = parseInt(body.priority);
			if (isNaN(priority) || priority < 0 || priority > 3) {
				return json(
					{
						error: true,
						message: 'Priority must be 0 (P0), 1 (P1), 2 (P2), or 3 (P3)'
					},
					{ status: 400 }
				);
			}
		}

		// Sanitize inputs
		const title = body.title.trim();
		const description = body.description ? body.description.trim() : '';
		const priority = body.priority !== undefined ? parseInt(body.priority) : 2; // Default to P2
		const type = body.type.trim().toLowerCase();
		const project = body.project ? body.project.trim() : null;

		// Build bd create command
		let command = `bd create "${title.replace(/"/g, '\\"')}"`;

		// Add type flag
		command += ` --type ${type}`;

		// Add priority flag
		command += ` --priority ${priority}`;

		// Add description if provided
		if (description) {
			command += ` --description "${description.replace(/"/g, '\\"')}"`;
		}

		// Add labels if provided
		if (body.labels && Array.isArray(body.labels) && body.labels.length > 0) {
			const sanitizedLabels = body.labels
				.filter(l => typeof l === 'string' && l.trim())
				.map(l => l.trim())
				.join(',');
			if (sanitizedLabels) {
				command += ` --labels ${sanitizedLabels}`;
			}
		}

		// Add dependencies if provided
		if (body.deps && Array.isArray(body.deps) && body.deps.length > 0) {
			const sanitizedDeps = body.deps
				.filter(d => typeof d === 'string' && d.trim())
				.map(d => d.trim())
				.join(',');
			if (sanitizedDeps) {
				command += ` --deps ${sanitizedDeps}`;
			}
		}

		// Add project if provided (changes working directory)
		if (project) {
			const projectPath = `${process.env.HOME}/code/${project}`;
			command = `cd ${projectPath} && ${command}`;
		}

		// Execute bd create command
		const { stdout, stderr } = await execAsync(command);

		// Parse task ID from output (e.g., "✓ Created issue: jat-abc")
		const match = stdout.match(/Created issue: ([a-z]+-[a-z0-9]+)/i);
		if (!match) {
			console.error('Failed to parse task ID from bd create output:', stdout);
			return json(
				{
					error: true,
					message: 'Task may have been created but failed to parse task ID',
					output: stdout,
					stderr: stderr
				},
				{ status: 500 }
			);
		}

		const taskId = match[1];

		// Fetch the created task to return full object
		const createdTask = getTaskById(taskId);

		if (!createdTask) {
			return json(
				{
					error: true,
					message: 'Task created but failed to retrieve',
					taskId: taskId
				},
				{ status: 500 }
			);
		}

		return json({
			success: true,
			task: createdTask,
			message: `Task ${taskId} created successfully`
		}, { status: 201 });

	} catch (err) {
		console.error('Error creating task:', err);

		// Check if it's a validation error from bd create
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
				message: err.message || 'Internal server error creating task',
				type: 'server_error'
			},
			{ status: 500 }
		);
	}
}
