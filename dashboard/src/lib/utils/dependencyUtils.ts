/**
 * Dependency Analysis Utilities
 *
 * Provides functions to analyze task dependencies, identify blockers,
 * and determine if tasks can be assigned.
 */

import type { Task } from '$lib/stores/agents.svelte';

export interface DependencyStatus {
	hasBlockers: boolean;
	hasBlockedTasks: boolean;
	blockerCount: number;
	blockedCount: number;
	unresolvedBlockers: Array<{
		id: string;
		title: string;
		status: string;
		priority: number;
	}>;
	blockedTasks: Array<{
		id: string;
		title: string;
		status: string;
		priority: number;
	}>;
	canBeAssigned: boolean;
	blockingReason: string | null;
}

/**
 * Analyze a task's dependency status
 */
export function analyzeDependencies(task: Task): DependencyStatus {
	const unresolvedBlockers = (task.depends_on || []).filter(
		(dep) => dep.status !== 'closed'
	);

	const blockedTasks = task.blocked_by || [];

	const hasBlockers = unresolvedBlockers.length > 0;
	const canBeAssigned = !hasBlockers;

	let blockingReason = null;
	if (hasBlockers) {
		blockingReason = `Blocked by ${unresolvedBlockers.length} unresolved ${
			unresolvedBlockers.length === 1 ? 'task' : 'tasks'
		}`;
	}

	return {
		hasBlockers,
		hasBlockedTasks: blockedTasks.length > 0,
		blockerCount: unresolvedBlockers.length,
		blockedCount: blockedTasks.length,
		unresolvedBlockers,
		blockedTasks,
		canBeAssigned,
		blockingReason
	};
}

/**
 * Get dependency badge configuration
 */
export function getDependencyBadge(depStatus: DependencyStatus): {
	show: boolean;
	text: string;
	color: string;
	icon: string;
	tooltip: string;
} {
	if (depStatus.hasBlockers) {
		return {
			show: true,
			text: `🚫 ${depStatus.blockerCount}`,
			color: 'badge-error',
			icon: '🚫',
			tooltip: `Blocked by ${depStatus.blockerCount} ${
				depStatus.blockerCount === 1 ? 'task' : 'tasks'
			}`
		};
	}

	if (depStatus.hasBlockedTasks) {
		return {
			show: true,
			text: `⚠️ ${depStatus.blockedCount}`,
			color: 'badge-warning',
			icon: '⚠️',
			tooltip: `Blocking ${depStatus.blockedCount} ${
				depStatus.blockedCount === 1 ? 'task' : 'tasks'
			}`
		};
	}

	return {
		show: false,
		text: '',
		color: '',
		icon: '',
		tooltip: ''
	};
}

/**
 * Get agent assignments for dependency tasks
 */
export function getAgentForTask(taskId: string, allTasks: Task[]): string | null {
	const task = allTasks.find(t => t.id === taskId);
	return task?.assignee || null;
}

/**
 * Build full dependency chain (recursive)
 */
export function buildDependencyChain(
	task: Task,
	allTasks: Task[],
	visited = new Set<string>()
): Array<{ level: number; task: Task }> {
	if (visited.has(task.id)) {
		return []; // Prevent infinite loops
	}

	visited.add(task.id);

	const chain: Array<{ level: number; task: Task }> = [];

	// Add direct blockers at level 1
	if (task.depends_on) {
		task.depends_on.forEach((dep) => {
			const blockerTask = allTasks.find(t => t.id === dep.id);
			if (blockerTask) {
				chain.push({ level: 1, task: blockerTask });

				// Recursively add blockers of blockers
				const subChain = buildDependencyChain(blockerTask, allTasks, visited);
				subChain.forEach((item) => {
					chain.push({ level: item.level + 1, task: item.task });
				});
			}
		});
	}

	return chain;
}

/**
 * Format dependency chain for display
 */
export function formatDependencyChain(chain: Array<{ level: number; task: Task }>): string {
	if (chain.length === 0) return 'No dependencies';

	const lines: string[] = [];
	chain.forEach(({ level, task }) => {
		const indent = '  '.repeat(level - 1);
		const prefix = level > 1 ? '↳ ' : '→ ';
		lines.push(`${indent}${prefix}${task.id}: ${task.title} (${task.status})`);
	});

	return lines.join('\n');
}
