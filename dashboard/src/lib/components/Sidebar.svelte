<script lang="ts">
	/**
	 * Sidebar Component - Vertical navigation using DaisyUI drawer sidebar pattern
	 *
	 * Features:
	 * - Vertical nav menu with 5 main routes (List, Dependency, Timeline, Kanban, Agents)
	 * - Active state highlighting based on current route
	 * - Icon + label layout with tooltips when collapsed
	 * - Responsive: Full-width on desktop (lg:drawer-open), collapsible on mobile
	 * - Bottom utilities: Help button, Theme selector
	 * - Smooth transitions between collapsed/open states
	 *
	 * Usage: Place inside drawer-side div in root layout
	 */

	import { page } from '$app/stores';
	import { unifiedNavConfig } from '$lib/config/navConfig';
	import ThemeSelector from './ThemeSelector.svelte';

	// Helper to check if nav item is active
	function isActive(href: string): boolean {
		const currentPath = $page.url.pathname;
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

	// Icon SVG paths
	const icons: Record<string, string> = {
		list: 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z',
		graph: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
		calendar:
			'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
		columns:
			'M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z',
		users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
		help: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
	};

	// Help modal state
	let showHelpModal = $state(false);

	function toggleHelp() {
		showHelpModal = !showHelpModal;
	}
</script>

<aside
	class="drawer-side lg:drawer-open z-40 bg-base-200 border-r border-base-300 transition-all duration-300"
>
	<!-- Drawer overlay (mobile only) -->
	<label for="main-drawer" class="drawer-overlay lg:hidden"></label>

	<!-- Sidebar content -->
	<div
		class="flex flex-col h-full bg-base-200 is-drawer-close:w-14 is-drawer-open:w-64 transition-all duration-300"
	>
		<!-- Main navigation items -->
		<ul class="menu p-2 grow gap-1">
			{#each unifiedNavConfig.navItems as navItem}
				<li>
					<a
						href={navItem.href}
						class="tooltip tooltip-right transition-all duration-200 {isActive(navItem.href)
							? 'active bg-primary text-primary-content'
							: ''}"
						data-tip={navItem.label}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="w-5 h-5 flex-shrink-0"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d={icons[navItem.icon]} />
						</svg>
						<span class="is-drawer-close:hidden">{navItem.label}</span>
					</a>
				</li>
			{/each}
		</ul>

		<!-- Bottom utilities -->
		<ul class="menu p-2 gap-1">
			<!-- Help button -->
			<li>
				<button
					class="tooltip tooltip-right"
					data-tip="Help & Shortcuts"
					onclick={toggleHelp}
					aria-label="Show help guide"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="w-5 h-5 flex-shrink-0"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d={icons.help} />
					</svg>
					<span class="is-drawer-close:hidden">Help</span>
				</button>
			</li>

			<!-- Theme Selector (compact mode when collapsed) -->
			<li class="is-drawer-open:px-2">
				<div class="is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Theme">
					<ThemeSelector compact={true} />
				</div>
			</li>
		</ul>
	</div>
</aside>

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
					</div>
				</div>

				<!-- Navigation Shortcuts -->
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
								d="M13 10V3L4 14h7v7l9-11h-7z"
							/>
						</svg>
						Navigation
					</h4>
					<div class="space-y-2">
						<div class="flex justify-between items-center">
							<span class="text-sm">Go to List view</span>
							<kbd class="kbd kbd-sm">G</kbd>
							<span>then</span>
							<kbd class="kbd kbd-sm">L</kbd>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-sm">Go to Agents view</span>
							<kbd class="kbd kbd-sm">G</kbd>
							<span>then</span>
							<kbd class="kbd kbd-sm">A</kbd>
						</div>
					</div>
				</div>

				<!-- Status Indicators -->
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
