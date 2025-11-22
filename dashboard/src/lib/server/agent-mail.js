/**
 * Server-side Agent Mail integration
 * Wraps lib/agent-mail.js for use in SvelteKit server routes
 */

import agentMail from '../../../../lib/agent-mail.js';

/**
 * Get all messages in a thread
 * @param {string} threadId - Thread identifier
 * @returns {Array} - Array of message objects
 */
export function getThreadMessages(threadId) {
	return agentMail.getThreadMessages(threadId);
}

/**
 * Get inbox messages for an agent (optionally filtered by thread)
 * @param {string} agentName - Agent name
 * @param {string|null} threadId - Thread identifier (null for all messages)
 * @param {Object} options - Query options
 * @returns {Array} - Array of message objects
 */
export function getInboxForThread(agentName, threadId = null, options = {}) {
	return agentMail.getInboxForThread(agentName, threadId, options);
}

/**
 * Get recent activities for an agent (last 10 messages)
 * @deprecated Use getBeadsActivities() instead - shows agent's task history, not shared inbox
 * @param {string} agentName - Agent name
 * @returns {Array} - Array of activity objects {ts, preview, content, type}
 */
export function getAgentActivities(agentName) {
	const messages = agentMail.getInboxForThread(agentName, null, {});

	// Convert messages to activities format
	// Sort by timestamp (most recent first) and limit to 10
	return messages
		.sort((a, b) => new Date(b.created_ts) - new Date(a.created_ts))
		.slice(0, 10)
		.map(msg => ({
			ts: msg.created_ts,
			preview: msg.subject || 'No subject',
			content: msg.body_md || '',
			type: msg.importance === 'urgent' ? 'urgent' :
			      msg.ack_required ? 'action_required' : 'message'
		}));
}

/**
 * Get recent Beads task activities for an agent (last 10 task updates)
 * Shows tasks the agent worked on, with their status transitions
 * @param {string} agentName - Agent name
 * @param {Array} allTasks - All tasks from Beads (from getTasks())
 * @returns {Array} - Array of activity objects {ts, preview, content, type}
 */
export function getBeadsActivities(agentName, allTasks) {
	if (!allTasks || allTasks.length === 0) {
		return [];
	}

	// Filter tasks that were assigned to this agent (current or past)
	const agentTasks = allTasks.filter(task => task.assignee === agentName);

	// Convert tasks to activity format
	// Sort by updated_at (most recent first) and limit to 10
	const activities = agentTasks
		.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
		.slice(0, 10)
		.map(task => {
			// Generate preview text based on task status
			let preview = `[${task.id}] ${task.title}`;

			// Add status indicator to preview
			if (task.status === 'closed') {
				preview = `[${task.id}] Completed: ${task.title}`;
			} else if (task.status === 'in_progress') {
				preview = `[${task.id}] Working: ${task.title}`;
			} else if (task.status === 'blocked') {
				preview = `[${task.id}] Blocked: ${task.title}`;
			} else if (task.status === 'open') {
				preview = `[${task.id}] Starting: ${task.title}`;
			}

			// Determine activity type based on task status
			let type = 'message';
			if (task.status === 'blocked') {
				type = 'urgent';
			} else if (task.status === 'in_progress') {
				type = 'action_required';
			}

			return {
				ts: task.updated_at,
				preview: preview,
				content: task.description || task.title,
				type: type
			};
		});

	return activities;
}

/**
 * Get all registered agents
 * @param {string|null} projectPath - Optional project path to filter by
 * @returns {Array} - Array of agent objects
 */
export function getAgents(projectPath = null) {
	return agentMail.getAgents(projectPath);
}

/**
 * Get all message threads
 * @returns {Array} - Array of thread objects
 */
export function getThreads() {
	return agentMail.getThreads();
}

/**
 * Search messages by query string
 * @param {string} query - Search query
 * @returns {Array} - Array of matching message objects
 */
export function searchMessages(query) {
	return agentMail.searchMessages(query);
}

/**
 * Get file reservations
 * @param {string|null} agentName - Optional agent name to filter by
 * @param {string|null} projectPath - Optional project path to filter by
 * @returns {Array} - Array of reservation objects
 */
export function getReservations(agentName = null, projectPath = null) {
	return agentMail.getReservations(agentName, projectPath);
}
