/**
 * Project Color Utilities
 * Provides consistent, visually distinct colors for projects
 */

// Vibrant color palette for project borders
const projectColorPalette = [
	'#3b82f6', // blue
	'#8b5cf6', // purple
	'#ec4899', // pink
	'#f59e0b', // amber
	'#10b981', // emerald
	'#06b6d4', // cyan
	'#f97316', // orange
	'#6366f1', // indigo
	'#14b8a6', // teal
	'#a855f7', // violet
	'#84cc16', // lime
	'#22d3ee', // sky
	'#fb923c', // orange-400
	'#4ade80', // green-400
	'#c084fc', // purple-400
	'#fb7185'  // rose-400
];

/**
 * Get consistent color for a project
 * Uses simple hash to ensure same project always gets same color
 */
export function getProjectColor(taskId: string): string {
	if (!taskId) return '#6b7280'; // gray for unknown

	// Extract project prefix (e.g., "jat-abc" → "jat")
	const projectPrefix = taskId.split('-')[0];

	// Simple hash function to get consistent color
	let hash = 0;
	for (let i = 0; i < projectPrefix.length; i++) {
		hash = projectPrefix.charCodeAt(i) + ((hash << 5) - hash);
	}

	// Map hash to color palette index
	const index = Math.abs(hash) % projectColorPalette.length;
	return projectColorPalette[index];
}

/**
 * Get all unique projects from task list with their colors
 */
export function getProjectColorMap(tasks: Array<{ id: string }>): Map<string, string> {
	const map = new Map<string, string>();

	tasks.forEach((task) => {
		const projectPrefix = task.id.split('-')[0];
		if (!map.has(projectPrefix)) {
			map.set(projectPrefix, getProjectColor(task.id));
		}
	});

	return map;
}
