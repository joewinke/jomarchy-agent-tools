<script lang="ts">
	/**
	 * Nav Component - Unified navigation bar for all dashboard pages
	 *
	 * Simplified to be page-agnostic:
	 * - No context-based configuration
	 * - Imports navItems from navConfig.ts
	 * - Page detection via $page.url.pathname
	 * - Active state based on current route
	 * - Always shows ProjectSelector and ThemeSelector
	 * - No view toggle (nav items replace this)
	 * - Help guide modal with keyboard shortcuts (Ctrl+/)
	 *
	 * Props:
	 * - projects: string[] (for project dropdown)
	 * - selectedProject: string (current project selection)
	 * - onProjectChange: (project: string) => void
	 * - taskCounts: Map<string, number> (optional task counts per project)
	 */

	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import { unifiedNavConfig } from '$lib/config/navConfig';
	import ThemeSelector from './ThemeSelector.svelte';
	import ProjectSelector from './ProjectSelector.svelte';
	import UserProfile from './UserProfile.svelte';
	import ClaudeUsageBar from './ClaudeUsageBar.svelte';

	interface Props {
		projects?: string[];
		selectedProject?: string;
		onProjectChange?: (project: string) => void;
		taskCounts?: Map<string, number> | null;
	}

	let {
		projects = [],
		selectedProject = 'All Projects',
		onProjectChange = () => {},
		taskCounts = null
	}: Props = $props();

	// Get current pathname for active state detection
	const currentPath = $derived($page.url.pathname);

	// Helper to check if nav item is active
	function isActive(href: string): boolean {
		// Exact match for home
		if (href === '/' && currentPath === '/') {
			return true;
		}
		// Prefix match for other routes
		if (href !== '/' && currentPath.startsWith(href)) {
			return true;
		}
		return false;
	}

	// Icon SVG paths (same as before)
	const icons: Record<string, string> = {
		list: 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z',
		graph: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
		users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z'
	};

	// Help modal state
	let showHelpModal = $state(false);

	// Toggle help modal
	function toggleHelp() {
		showHelpModal = !showHelpModal;
	}

	// Keyboard shortcut handler for Ctrl+/ and Escape
	function handleKeyDown(event: KeyboardEvent) {
		// Escape to close help modal if it's open
		if (event.key === 'Escape' && showHelpModal) {
			event.preventDefault();
			showHelpModal = false;
			return;
		}

		// Ctrl+/ or Cmd+/ to toggle help
		if ((event.ctrlKey || event.metaKey) && event.key === '/') {
			event.preventDefault();
			toggleHelp();
		}
	}

	// Setup keyboard listener
	onMount(() => {
		if (browser) {
			window.addEventListener('keydown', handleKeyDown);
		}
	});

	// Cleanup on destroy
	onDestroy(() => {
		if (browser) {
			window.removeEventListener('keydown', handleKeyDown);
		}
	});
</script>

<div class="navbar bg-base-100 border-b border-base-300">
	<!-- Left: Navigation Items (flex-nowrap prevents wrapping) -->
	<div class="flex-1">
		<div class="flex flex-nowrap items-center gap-1.5">
			<!-- Render nav items from config -->
			{#each unifiedNavConfig.navItems as navItem}
				<a
					href={navItem.href}
					class="btn btn-sm {isActive(navItem.href) ? 'btn-primary' : 'btn-ghost'}"
					aria-label={navItem.label}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="w-4 h-4"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d={icons[navItem.icon]} />
					</svg>
					<span class="hidden lg:inline ml-1">{navItem.label}</span>
				</a>
			{/each}
		</div>
	</div>

	<!-- Right: Controls (flex-nowrap prevents wrapping) -->
	<div class="flex-none flex flex-nowrap items-center gap-1.5">
		<!-- Project Filter (always show if projects available) -->
		{#if unifiedNavConfig.showProjectFilter && projects.length > 0}
			<div class="w-36 sm:w-40 md:w-48">
				<ProjectSelector
					{projects}
					{selectedProject}
					{onProjectChange}
					{taskCounts}
					compact={true}
				/>
			</div>
		{/if}

		<!-- Theme Selector (always show) -->
		{#if unifiedNavConfig.showThemeSelector}
			<ThemeSelector />
		{/if}

		<!-- Claude Usage Bar -->
		<ClaudeUsageBar />

		<!-- Help Button -->
		<div class="tooltip tooltip-bottom" data-tip="Help (Ctrl+/)">
			<button
				class="btn btn-sm btn-circle btn-ghost"
				onclick={toggleHelp}
				aria-label="Show help guide (Ctrl+/)"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			</button>
		</div>

		<!-- User Profile -->
		<UserProfile />
	</div>
</div>

<!-- Help Guide Modal -->
{#if showHelpModal}
	<div class="modal modal-open">
		<div class="modal-box max-w-4xl">
			<!-- Header -->
			<div class="flex items-center justify-between mb-6">
				<h3 class="text-2xl font-bold">Keyboard Shortcuts</h3>
				<button
					class="btn btn-sm btn-circle btn-ghost"
					onclick={toggleHelp}
					aria-label="Close help"
				>
					✕
				</button>
			</div>

			<!-- Content Sections -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<!-- Global Shortcuts -->
				<div>
					<h4 class="text-lg font-semibold mb-3 flex items-center gap-2">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						Global
					</h4>
					<div class="space-y-2">
						<div class="flex justify-between items-center">
							<span class="text-sm">Open command palette</span>
							<span class="flex gap-1">
								<kbd class="kbd kbd-sm">Cmd</kbd>
								<span>+</span>
								<kbd class="kbd kbd-sm">K</kbd>
							</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-sm">Show help guide</span>
							<span class="flex gap-1">
								<kbd class="kbd kbd-sm">Ctrl</kbd>
								<span>+</span>
								<kbd class="kbd kbd-sm">/</kbd>
							</span>
						</div>
					</div>
				</div>

				<!-- Task Drawer Shortcuts -->
				<div>
					<h4 class="text-lg font-semibold mb-3 flex items-center gap-2">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
						Task Drawer
					</h4>
					<div class="space-y-2">
						<div class="flex justify-between items-center">
							<span class="text-sm">Close drawer</span>
							<kbd class="kbd kbd-sm">Esc</kbd>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-sm">Toggle edit mode</span>
							<kbd class="kbd kbd-sm">E</kbd>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-sm">Mark complete</span>
							<kbd class="kbd kbd-sm">M</kbd>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-sm">Assign to me</span>
							<kbd class="kbd kbd-sm">A</kbd>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-sm">Save (edit mode)</span>
							<span class="flex gap-1">
								<kbd class="kbd kbd-sm">Cmd</kbd>
								<span>+</span>
								<kbd class="kbd kbd-sm">Enter</kbd>
							</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-sm">Show shortcuts</span>
							<kbd class="kbd kbd-sm">?</kbd>
						</div>
					</div>
				</div>

				<!-- Command Palette Shortcuts -->
				<div>
					<h4 class="text-lg font-semibold mb-3 flex items-center gap-2">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
						Command Palette
					</h4>
					<div class="space-y-2">
						<div class="flex justify-between items-center">
							<span class="text-sm">Navigate up/down</span>
							<span class="flex gap-1">
								<kbd class="kbd kbd-sm">↑</kbd>
								<kbd class="kbd kbd-sm">↓</kbd>
							</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-sm">Execute action</span>
							<kbd class="kbd kbd-sm">Enter</kbd>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-sm">Close / Go back</span>
							<kbd class="kbd kbd-sm">Esc</kbd>
						</div>
					</div>
				</div>

				<!-- Task Status Indicators -->
				<div>
					<h4 class="text-lg font-semibold mb-3 flex items-center gap-2">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
							/>
						</svg>
						Status Indicators
					</h4>
					<div class="space-y-2">
						<div class="flex justify-between items-center">
							<span class="text-sm">Open</span>
							<span class="badge badge-info">open</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-sm">In Progress</span>
							<span class="badge badge-warning">in_progress</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-sm">Blocked</span>
							<span class="badge badge-error">blocked</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-sm">Closed</span>
							<span class="badge badge-success">closed</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Divider -->
			<div class="divider my-6"></div>

			<!-- Tips Section -->
			<div>
				<h4 class="text-lg font-semibold mb-3">Tips</h4>
				<div class="space-y-2">
					<div class="alert alert-info">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							class="stroke-current shrink-0 w-5 h-5"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
						<span class="text-sm"
							>Use <kbd class="kbd kbd-sm">Cmd+K</kbd> to quickly navigate, search tasks, and perform
							actions.</span
						>
					</div>
					<div class="alert alert-info">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							class="stroke-current shrink-0 w-5 h-5"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
						<span class="text-sm"
							>Click any task card to open details. Press <kbd class="kbd kbd-sm">?</kbd> inside the
							drawer for more shortcuts.</span
						>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="modal-action">
				<button class="btn" onclick={toggleHelp}>Close</button>
			</div>
		</div>
	</div>
{/if}
