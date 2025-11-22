<script lang="ts">
	/**
	 * CommandPalette Component
	 * Global command palette with Cmd+K shortcut (Raycast/Spotlight style)
	 *
	 * Features:
	 * - Keyboard shortcut (Cmd+K on Mac, Ctrl+K on Windows/Linux)
	 * - Fuzzy search for actions
	 * - Keyboard navigation (arrow keys, Enter to execute)
	 * - Escape to close
	 * - Common actions: navigate, create, search
	 */

	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isTaskDrawerOpen } from '$lib/stores/drawerStore';

	// Modal state
	let isOpen = $state(false);
	let searchQuery = $state('');
	let selectedIndex = $state(0);
	let searchInput: HTMLInputElement;
	let resultsContainer: HTMLDivElement;
	let isKeyboardNavigation = $state(false); // Track if user is using keyboard

	// Task search state
	let searchMode = $state<'actions' | 'tasks'>('actions'); // 'actions' = command palette, 'tasks' = task search
	let tasks = $state([]);
	let isLoadingTasks = $state(false);
	let searchDebounceTimer: number;

	// Action registry
	interface Action {
		id: string;
		label: string;
		description: string;
		icon: string;
		keywords: string[];
		execute: () => void;
	}

	const actions: Action[] = [
		{
			id: 'nav-home',
			label: 'Go to Home',
			description: 'View all tasks in list mode',
			icon: '🏠',
			keywords: ['home', 'dashboard', 'tasks', 'list'],
			execute: () => {
				goto('/');
				close();
			}
		},
		{
			id: 'nav-graph',
			label: 'Go to Graph',
			description: 'View task dependency graph and relationships',
			icon: '🔗',
			keywords: ['graph', 'dependency', 'relationships', 'deps'],
			execute: () => {
				goto('/graph');
				close();
			}
		},
		{
			id: 'nav-timeline',
			label: 'Go to Timeline',
			description: 'View task timeline and history',
			icon: '📅',
			keywords: ['timeline', 'history', 'chronological', 'time'],
			execute: () => {
				goto('/timeline');
				close();
			}
		},
		{
			id: 'nav-kanban',
			label: 'Go to Kanban',
			description: 'View tasks in kanban board format',
			icon: '📋',
			keywords: ['kanban', 'board', 'columns', 'workflow'],
			execute: () => {
				goto('/kanban');
				close();
			}
		},
		{
			id: 'nav-agents',
			label: 'Go to Agents',
			description: 'View agent coordination and task assignment',
			icon: '👥',
			keywords: ['agents', 'team', 'coordination', 'assign'],
			execute: () => {
				goto('/agents');
				close();
			}
		},
		{
			id: 'create-task',
			label: 'Create Task',
			description: 'Open task creation drawer',
			icon: '➕',
			keywords: ['create', 'new', 'task', 'add'],
			execute: () => {
				close();
				isTaskDrawerOpen.set(true);
			}
		},
		{
			id: 'search-tasks',
			label: 'Search Tasks',
			description: 'Find tasks by searching keywords',
			icon: '🔍',
			keywords: ['search', 'find', 'filter', 'query'],
			execute: () => {
				// Switch to task search mode
				searchMode = 'tasks';
				searchQuery = '';
				selectedIndex = 0;
				tasks = [];
				// Don't close - stay in modal for search
			}
		},
		{
			id: 'toggle-theme',
			label: 'Change Theme',
			description: 'Switch between light and dark themes',
			icon: '🎨',
			keywords: ['theme', 'dark', 'light', 'appearance', 'style'],
			execute: () => {
				// Focus theme selector
				const themeBtn = document.querySelector('[aria-label="Change Theme"]');
				if (themeBtn instanceof HTMLElement) {
					themeBtn.click();
				}
				close();
			}
		},
		{
			id: 'refresh-data',
			label: 'Refresh Data',
			description: 'Reload current page data',
			icon: '🔄',
			keywords: ['refresh', 'reload', 'update', 'sync'],
			execute: () => {
				window.location.reload();
				close();
			}
		}
	];

	// Fuzzy search function
	function fuzzyMatch(query: string, text: string): boolean {
		const normalizedQuery = query.toLowerCase();
		const normalizedText = text.toLowerCase();

		// Simple substring match for now
		if (normalizedText.includes(normalizedQuery)) {
			return true;
		}

		// Check keywords
		return false;
	}

	function searchActions(query: string): Action[] {
		if (!query.trim()) {
			return actions;
		}

		return actions.filter((action) => {
			// Check label
			if (fuzzyMatch(query, action.label)) {
				return true;
			}

			// Check description
			if (fuzzyMatch(query, action.description)) {
				return true;
			}

			// Check keywords
			return action.keywords.some((keyword) => fuzzyMatch(query, keyword));
		});
	}

	// Filtered actions based on search
	const filteredActions = $derived(searchActions(searchQuery));

	// Task search function with debouncing
	async function searchTasks(query: string) {
		// Clear existing timer
		if (searchDebounceTimer) {
			clearTimeout(searchDebounceTimer);
		}

		// If query is empty, clear tasks
		if (!query.trim()) {
			tasks = [];
			isLoadingTasks = false;
			return;
		}

		// Set loading state
		isLoadingTasks = true;

		// Debounce API call (300ms)
		searchDebounceTimer = setTimeout(async () => {
			try {
				const response = await fetch(`/api/tasks?search=${encodeURIComponent(query)}`);
				const data = await response.json();
				tasks = data.tasks || [];
			} catch (error) {
				console.error('Task search error:', error);
				tasks = [];
			} finally {
				isLoadingTasks = false;
			}
		}, 300) as unknown as number;
	}

	// Trigger task search when query changes (only in task mode)
	$effect(() => {
		if (searchMode === 'tasks' && searchQuery) {
			searchTasks(searchQuery);
		}
	});

	// Open/close functions
	function open() {
		isOpen = true;
		searchQuery = '';
		selectedIndex = 0;
		searchMode = 'actions'; // Reset to actions mode
		tasks = [];
		isLoadingTasks = false;
		isKeyboardNavigation = false; // Reset keyboard navigation

		// Focus input after modal opens
		setTimeout(() => {
			searchInput?.focus();
		}, 50);
	}

	function close() {
		isOpen = false;
		searchQuery = '';
		selectedIndex = 0;
		searchMode = 'actions'; // Reset to actions mode
		tasks = [];
		isLoadingTasks = false;
		isKeyboardNavigation = false; // Reset keyboard navigation

		// Clear any pending search timers
		if (searchDebounceTimer) {
			clearTimeout(searchDebounceTimer);
		}
	}

	// Keyboard navigation
	function handleKeyDown(e: KeyboardEvent) {
		if (!isOpen) return;

		const maxIndex = searchMode === 'actions' ? filteredActions.length - 1 : tasks.length - 1;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				isKeyboardNavigation = true;
				selectedIndex = Math.min(selectedIndex + 1, maxIndex);
				break;
			case 'ArrowUp':
				e.preventDefault();
				isKeyboardNavigation = true;
				selectedIndex = Math.max(selectedIndex - 1, 0);
				break;
			case 'Enter':
				e.preventDefault();
				if (searchMode === 'actions') {
					if (filteredActions[selectedIndex]) {
						filteredActions[selectedIndex].execute();
					}
				} else {
					// Task mode: navigate to task
					if (tasks[selectedIndex]) {
						const task = tasks[selectedIndex];
						goto(`/?task=${task.id}`); // Navigate to home with task query param
						close();
					}
				}
				break;
			case 'Escape':
				e.preventDefault();
				// If in task mode, go back to actions mode
				if (searchMode === 'tasks') {
					searchMode = 'actions';
					searchQuery = '';
					selectedIndex = 0;
					tasks = [];
				} else {
					close();
				}
				break;
		}
	}

	// Global keyboard shortcut listener
	onMount(() => {
		function handleGlobalKeyDown(e: KeyboardEvent) {
			// Cmd+K on Mac, Ctrl+K on Windows/Linux
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				if (isOpen) {
					close();
				} else {
					open();
				}
			}
		}

		window.addEventListener('keydown', handleGlobalKeyDown);

		return () => {
			window.removeEventListener('keydown', handleGlobalKeyDown);
		};
	});

	// Reset selected index when query changes
	$effect(() => {
		if (searchQuery) {
			selectedIndex = 0;
			isKeyboardNavigation = false; // Reset keyboard navigation when typing
		}
	});

	// Scroll selected item into view when selection changes
	$effect(() => {
		if (isOpen && resultsContainer) {
			const selectedButton = resultsContainer.querySelector(`[data-index="${selectedIndex}"]`);
			if (selectedButton) {
				selectedButton.scrollIntoView({
					block: 'nearest',
					behavior: 'smooth'
				});
			}
		}
	});
</script>

<!-- Quick Actions Button (visible in navbar) -->
<button
	class="btn btn-sm btn-ghost gap-1"
	onclick={open}
	aria-label="Quick actions (Cmd+K)"
>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		fill="none"
		viewBox="0 0 24 24"
		stroke-width="1.5"
		stroke="currentColor"
		class="w-4 h-4"
	>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
		/>
	</svg>
	<kbd class="kbd kbd-xs hidden md:inline">⌘K</kbd>
</button>

<!-- Modal (stays in DOM, toggle modal-open class) -->
<div class="modal {isOpen ? 'modal-open' : ''}" role="dialog" aria-modal="true" aria-labelledby="command-palette-title">
	<!-- Backdrop -->
	<div
		class="modal-backdrop bg-base-300/80"
		role="button"
		tabindex="-1"
		onclick={close}
		onkeydown={(e) => e.key === 'Enter' && close()}
	></div>

	<!-- Command palette -->
	<div class="modal-box max-w-2xl p-0 overflow-hidden">
			<!-- Search input -->
			<div class="p-4 border-b border-base-300">
				<div class="flex items-center gap-3">
					<span class="text-2xl">🔍</span>
					<input
						bind:this={searchInput}
						bind:value={searchQuery}
						onkeydown={handleKeyDown}
						type="text"
						placeholder={searchMode === 'actions' ? 'Search actions...' : 'Search tasks...'}
						class="input input-ghost w-full focus:outline-none text-lg"
						autocomplete="off"
						aria-label={searchMode === 'actions' ? 'Search command palette' : 'Search tasks'}
					/>
					<kbd class="kbd kbd-sm">ESC</kbd>
				</div>
			</div>

			<!-- Results list -->
			<div class="max-h-96 overflow-y-auto" bind:this={resultsContainer}>
				{#if searchMode === 'actions'}
					<!-- Actions list -->
					{#if filteredActions.length === 0}
						<div class="p-8 text-center text-base-content/50">
							<p class="text-lg mb-2">No actions found</p>
							<p class="text-sm">Try different search terms</p>
						</div>
					{:else}
						<div class="p-2 space-y-1">
							{#each filteredActions as action, index}
								<button
									type="button"
									data-index={index}
									class="flex items-start gap-3 p-3 rounded-lg w-full {index === selectedIndex
										? 'bg-primary text-primary-content'
										: 'hover:bg-base-200'}"
									onclick={() => action.execute()}
									onmouseenter={() => {
										if (!isKeyboardNavigation) {
											selectedIndex = index;
										}
									}}
									onmousemove={() => {
										isKeyboardNavigation = false;
									}}
								>
										<span class="text-2xl flex-shrink-0">{action.icon}</span>
										<div class="flex-1 text-left min-w-0">
											<div class="font-medium">{action.label}</div>
											<div
												class="text-sm opacity-70 {index === selectedIndex
													? 'text-primary-content/70'
													: 'text-base-content/70'}"
											>
												{action.description}
											</div>
										</div>
									{#if index === selectedIndex}
										<kbd class="kbd kbd-sm flex-shrink-0 bg-primary-content/20 text-primary-content border-primary-content/30">↵</kbd>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				{:else}
					<!-- Task search results -->
					{#if isLoadingTasks}
						<div class="p-8 text-center">
							<span class="loading loading-spinner loading-lg text-primary"></span>
							<p class="text-sm text-base-content/70 mt-4">Searching tasks...</p>
						</div>
					{:else if !searchQuery.trim()}
						<div class="p-8 text-center text-base-content/50">
							<p class="text-lg mb-2">Start typing to search</p>
							<p class="text-sm">Search by task ID, title, description, or labels</p>
						</div>
					{:else if tasks.length === 0}
						<div class="p-8 text-center text-base-content/50">
							<p class="text-lg mb-2">No tasks found</p>
							<p class="text-sm">Try different search terms</p>
						</div>
					{:else}
						<!-- Group tasks by project -->
						{@const groupedTasks = tasks.reduce((acc, task) => {
							const project = task.project || 'unknown';
							if (!acc[project]) acc[project] = [];
							acc[project].push(task);
							return acc;
						}, {})}

						<div class="p-2">
							{#each Object.entries(groupedTasks) as [project, projectTasks]}
								<!-- Project header -->
								<div class="px-3 py-1.5 text-xs font-semibold text-base-content/50 uppercase tracking-wider sticky top-0 bg-base-200/90 backdrop-blur-sm">
									{project} ({projectTasks.length})
								</div>

								<!-- Tasks in this project -->
								<div class="mb-3 space-y-1">
									{#each projectTasks as task}
										{@const flatIndex = tasks.indexOf(task)}
										<button
											type="button"
											data-index={flatIndex}
											class="flex items-start gap-3 p-3 rounded-lg w-full {flatIndex === selectedIndex
												? 'bg-primary text-primary-content'
												: 'hover:bg-base-200'}"
											onclick={() => {
												goto(`/?task=${task.id}`);
												close();
											}}
											onmouseenter={() => {
												if (!isKeyboardNavigation) {
													selectedIndex = flatIndex;
												}
											}}
											onmousemove={() => {
												isKeyboardNavigation = false;
											}}
										>
												<!-- Priority badge -->
												<div class="flex-shrink-0">
													<span
														class="badge badge-sm {task.priority === 0
															? 'badge-error'
															: task.priority === 1
																? 'badge-warning'
																: task.priority === 2
																	? 'badge-info'
																	: 'badge-ghost'}"
													>
														P{task.priority}
													</span>
												</div>
												<!-- Task details -->
												<div class="flex-1 text-left min-w-0">
													<div class="flex items-center gap-2 mb-1">
														<span class="font-mono text-xs {flatIndex === selectedIndex ? 'text-primary-content/70' : 'text-base-content/50'}">
															{task.id}
														</span>
														<span class="font-medium truncate">{task.title}</span>
													</div>
													{#if task.description}
														<div
															class="text-sm opacity-70 line-clamp-1 {flatIndex === selectedIndex
																? 'text-primary-content/70'
																: 'text-base-content/70'}"
														>
															{task.description}
														</div>
													{/if}
													{#if task.labels && task.labels.length > 0}
														<div class="flex gap-1 mt-1 flex-wrap">
															{#each task.labels.slice(0, 3) as label}
																<span class="badge badge-xs badge-outline">{label}</span>
															{/each}
															{#if task.labels.length > 3}
																<span class="badge badge-xs badge-ghost">+{task.labels.length - 3}</span>
															{/if}
														</div>
													{/if}
												</div>
											{#if flatIndex === selectedIndex}
												<kbd class="kbd kbd-sm flex-shrink-0 bg-primary-content/20 text-primary-content border-primary-content/30">↵</kbd>
											{/if}
										</button>
									{/each}
								</div>
							{/each}
						</div>
					{/if}
				{/if}
			</div>

			<!-- Footer with keyboard hints -->
			<div class="p-3 border-t border-base-300 bg-base-200 flex items-center justify-between text-xs">
				<div class="flex gap-4">
					<div class="flex items-center gap-1">
						<kbd class="kbd kbd-xs">↑</kbd>
						<kbd class="kbd kbd-xs">↓</kbd>
						<span class="text-base-content/70">Navigate</span>
					</div>
					<div class="flex items-center gap-1">
						<kbd class="kbd kbd-xs">↵</kbd>
						<span class="text-base-content/70">Select</span>
					</div>
					<div class="flex items-center gap-1">
						<kbd class="kbd kbd-xs">ESC</kbd>
						<span class="text-base-content/70">{searchMode === 'tasks' ? 'Back' : 'Close'}</span>
					</div>
				</div>
				<div class="flex items-center gap-1">
					<kbd class="kbd kbd-xs">⌘</kbd>
					<span class="text-base-content/70">+</span>
					<kbd class="kbd kbd-xs">K</kbd>
					<span class="text-base-content/70 ml-1">to open</span>
				</div>
			</div>
		</div>
	</div>
