/**
 * Drawer Store
 * Manages state for task creation drawer
 */

import { writable } from 'svelte/store';

// Task drawer state
export const isTaskDrawerOpen = writable(false);

// Helper functions
export function openTaskDrawer() {
	isTaskDrawerOpen.set(true);
}

export function closeTaskDrawer() {
	isTaskDrawerOpen.set(false);
}
