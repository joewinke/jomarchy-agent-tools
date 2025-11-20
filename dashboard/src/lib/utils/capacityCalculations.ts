/**
 * Capacity Calculation Utilities
 *
 * Provides hour-based capacity calculations for agents and tasks,
 * with color-coded thresholds and detailed breakdowns.
 */

import type { Task, Agent } from '$lib/stores/agents.svelte';

/**
 * Estimate hours for a single task based on priority, type, and labels
 */
export function estimateTaskHours(task: Task): number {
	// Base hours by priority
	const priorityHours: Record<number, number> = {
		0: 6, // P0: critical, 4-8 hours
		1: 3, // P1: high, 2-4 hours
		2: 1.5, // P2: medium, 1-2 hours
		3: 0.75, // P3: low, 0.5-1 hour
		4: 0.375 // P4: very low, 0.25-0.5 hour
	};

	let hours = priorityHours[task.priority] || 1.5; // default to P2 (medium)

	// Type multipliers
	const typeMultipliers: Record<string, number> = {
		bug: 0.8, // bugs usually faster to fix
		feature: 1.2, // features take longer
		task: 1.0, // baseline
		epic: 3.0, // epics are much larger
		chore: 0.6 // chores are usually quick
	};

	hours *= typeMultipliers[task.issue_type] || 1.0;

	// Label modifiers (additive, not multiplicative)
	const labelModifiers: Record<string, number> = {
		urgent: 0.5, // add time for urgency/coordination
		complex: 1.0, // add time for complexity
		'tech-debt': -0.5, // usually simpler cleanup
		documentation: -0.5, // usually quicker
		testing: 0.5, // add time for thorough testing
		refactoring: 0.75 // moderate time addition
	};

	task.labels?.forEach((label) => {
		if (labelModifiers[label]) {
			hours += labelModifiers[label];
		}
	});

	// Ensure minimum of 0.25 hours (15 min)
	return Math.max(hours, 0.25);
}

/**
 * Calculate total hours for a list of tasks
 */
export function calculateTotalHours(tasks: Task[]): number {
	return tasks.reduce((total, task) => total + estimateTaskHours(task), 0);
}

/**
 * Calculate agent capacity metrics
 */
export interface AgentCapacity {
	usedHours: number;
	availableHours: number;
	percentage: number;
	status: 'good' | 'moderate' | 'high';
	tasksBreakdown: Array<{
		taskId: string;
		title: string;
		estimatedHours: number;
		priority: number;
	}>;
}

export function calculateAgentCapacity(
	agent: Agent,
	tasks: Task[],
	availableHoursPerDay: number = 8
): AgentCapacity {
	// Get tasks assigned to this agent (open or in-progress)
	const agentTasks = tasks.filter(
		(t) =>
			t.assignee === agent.name &&
			(t.status === 'open' || t.status === 'in_progress')
	);

	// Calculate used hours
	const usedHours = calculateTotalHours(agentTasks);

	// Calculate percentage
	const percentage = Math.min((usedHours / availableHoursPerDay) * 100, 100);

	// Determine status based on thresholds
	let status: 'good' | 'moderate' | 'high';
	if (percentage < 60) {
		status = 'good';
	} else if (percentage < 90) {
		status = 'moderate';
	} else {
		status = 'high';
	}

	// Build tasks breakdown
	const tasksBreakdown = agentTasks.map((task) => ({
		taskId: task.id,
		title: task.title,
		estimatedHours: estimateTaskHours(task),
		priority: task.priority
	}));

	return {
		usedHours,
		availableHours: availableHoursPerDay,
		percentage,
		status,
		tasksBreakdown
	};
}

/**
 * Calculate system-wide capacity across all agents
 */
export interface SystemCapacity {
	totalUsedHours: number;
	totalAvailableHours: number;
	percentage: number;
	status: 'good' | 'moderate' | 'high';
	agentBreakdown: Array<{
		agentName: string;
		usedHours: number;
		availableHours: number;
		percentage: number;
		status: 'good' | 'moderate' | 'high';
	}>;
}

export function calculateSystemCapacity(
	agents: Agent[],
	tasks: Task[],
	availableHoursPerDay: number = 8
): SystemCapacity {
	const agentBreakdown = agents.map((agent) => {
		const capacity = calculateAgentCapacity(agent, tasks, availableHoursPerDay);
		return {
			agentName: agent.name,
			usedHours: capacity.usedHours,
			availableHours: capacity.availableHours,
			percentage: capacity.percentage,
			status: capacity.status
		};
	});

	const totalUsedHours = agentBreakdown.reduce((sum, a) => sum + a.usedHours, 0);
	const totalAvailableHours = agents.length * availableHoursPerDay;

	const percentage = totalAvailableHours > 0
		? Math.min((totalUsedHours / totalAvailableHours) * 100, 100)
		: 0;

	let status: 'good' | 'moderate' | 'high';
	if (percentage < 60) {
		status = 'good';
	} else if (percentage < 90) {
		status = 'moderate';
	} else {
		status = 'high';
	}

	return {
		totalUsedHours,
		totalAvailableHours,
		percentage,
		status,
		agentBreakdown
	};
}

/**
 * Format hours to readable string (e.g., "2.5h" or "45m")
 */
export function formatHours(hours: number): string {
	if (hours >= 1) {
		return `${hours.toFixed(1)}h`;
	} else {
		const minutes = Math.round(hours * 60);
		return `${minutes}m`;
	}
}
