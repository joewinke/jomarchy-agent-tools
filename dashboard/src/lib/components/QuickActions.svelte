<script lang="ts">
	/**
	 * QuickActions Component - Command Palette
	 *
	 * Global quick actions menu with keyboard shortcut (Cmd+K / Ctrl+K).
	 * Modal with search input and common actions (navigate, create task, search).
	 * Uses DaisyUI modal component.
	 *
	 * Features:
	 * - Keyboard shortcut: Cmd+K (Mac) / Ctrl+K (Windows/Linux)
	 * - Arrow key navigation
	 * - Enter to execute action
	 * - ESC to close
	 * - Fuzzy search filtering
	 */

	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isTaskDrawerOpen } from '$lib/stores/drawerStore';

	interface Action {
		id: string;
		label: string;
		description: string;
		icon: string;
		action: () => void;
		category: string;
	}

	let isOpen = $state(false);
	let searchQuery = $state('');
	let selectedIndex = $state(0);
	let searchInput: HTMLInputElement;

	// Icon SVG paths
	const icons = {
		home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
		users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
		api: 'M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z',
		plus: 'M12 4.5v15m7.5-7.5h-15',
		search: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z'
	};

	// Define all available actions
	const allActions: Action[] = [
		{
			id: 'nav-home',
			label: 'Go to Home',
			description: 'Navigate to dashboard home',
			icon: icons.home,
			category: 'Navigation',
			action: () => {
				goto('/');
				closeModal();
			}
		},
		{
			id: 'nav-agents',
			label: 'Go to Agents',
			description: 'View agent coordination',
			icon: icons.users,
			category: 'Navigation',
			action: () => {
				goto('/agents');
				closeModal();
			}
		},
		{
			id: 'nav-api-demo',
			label: 'Go to API Demo',
			description: 'Test API endpoints',
			icon: icons.api,
			category: 'Navigation',
			action: () => {
				goto('/api-demo');
				closeModal();
			}
		},
		{
			id: 'create-task',
			label: 'Create Task',
			description: 'Open task creation drawer',
			icon: icons.plus,
			category: 'Actions',
			action: () => {
				closeModal();
				isTaskDrawerOpen.set(true);
			}
		},
		{
			id: 'search-tasks',
			label: 'Search Tasks',
			description: 'Search all tasks (placeholder)',
			icon: icons.search,
			category: 'Actions',
			action: () => {
				alert('Task search not implemented yet');
				closeModal();
			}
		}
	];

	// Filtered actions based on search query
	const filteredActions = $derived(() => {
		if (!searchQuery.trim()) {
			return allActions;
		}

		const query = searchQuery.toLowerCase();
		return allActions.filter(
			(action) =>
				action.label.toLowerCase().includes(query) ||
				action.description.toLowerCase().includes(query) ||
				action.category.toLowerCase().includes(query)
		);
	});

	// Open modal
	function openModal() {
		isOpen = true;
		searchQuery = '';
		selectedIndex = 0;
		// Focus search input after modal opens
		setTimeout(() => {
			searchInput?.focus();
		}, 100);
	}

	// Close modal
	function closeModal() {
		isOpen = false;
		searchQuery = '';
		selectedIndex = 0;
	}

	// Execute selected action
	function executeAction(action: Action) {
		action.action();
	}

	// Handle keyboard navigation
	function handleKeydown(event: KeyboardEvent) {
		const actions = filteredActions();

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			selectedIndex = (selectedIndex + 1) % actions.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			selectedIndex = selectedIndex === 0 ? actions.length - 1 : selectedIndex - 1;
		} else if (event.key === 'Enter') {
			event.preventDefault();
			if (actions[selectedIndex]) {
				executeAction(actions[selectedIndex]);
			}
		} else if (event.key === 'Escape') {
			closeModal();
		}
	}

	// Global keyboard shortcut (Cmd+K / Ctrl+K)
	onMount(() => {
		const handleGlobalKeydown = (event: KeyboardEvent) => {
			// Cmd+K (Mac) or Ctrl+K (Windows/Linux)
			if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
				event.preventDefault();
				if (isOpen) {
					closeModal();
				} else {
					openModal();
				}
			}
		};

		window.addEventListener('keydown', handleGlobalKeydown);
		return () => window.removeEventListener('keydown', handleGlobalKeydown);
	});

	// Reset selected index when search query changes
	$effect(() => {
		if (searchQuery) {
			selectedIndex = 0;
		}
	});
</script>

<!-- Quick Actions Button -->
<button
	class="btn btn-sm btn-ghost gap-1"
	onclick={openModal}
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
		<path stroke-linecap="round" stroke-linejoin="round" d={icons.search} />
	</svg>
	<kbd class="kbd kbd-xs hidden md:inline">⌘K</kbd>
</button>

<!-- Modal -->
{#if isOpen}
	<div class="modal modal-open" onclick={closeModal}>
		<!-- Modal Content -->
		<div
			class="modal-box max-w-2xl p-0"
			onclick={(e) => e.stopPropagation()}
			onkeydown={handleKeydown}
		>
			<!-- Search Input -->
			<div class="p-4 border-b border-base-300">
				<div class="relative">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/50"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d={icons.search} />
					</svg>
					<input
						type="text"
						placeholder="Type a command or search..."
						class="input input-bordered w-full pl-10 pr-4"
						bind:value={searchQuery}
						bind:this={searchInput}
					/>
				</div>
			</div>

			<!-- Actions List -->
			<div class="max-h-96 overflow-y-auto">
				{#if filteredActions().length === 0}
					<div class="p-8 text-center text-base-content/50">
						<p>No actions found</p>
					</div>
				{:else}
					<!-- Group by category -->
					{#each Object.entries( filteredActions().reduce((acc, action) => { if (!acc[action.category]) acc[action.category] = []; acc[action.category].push(action); return acc; }, {} as Record<string, Action[]>) ) as [category, actions]}
						<div class="px-2 pt-2">
							<div class="text-xs font-semibold text-base-content/50 px-3 py-1">{category}</div>
							{#each actions as action, index}
								{@const globalIndex = filteredActions().indexOf(action)}
								<button
									class="w-full text-left px-3 py-2 rounded-lg hover:bg-base-200 flex items-center gap-3 {globalIndex ===
									selectedIndex
										? 'bg-primary text-primary-content'
										: ''}"
									onclick={() => executeAction(action)}
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="1.5"
										stroke="currentColor"
										class="w-5 h-5 flex-shrink-0"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d={action.icon} />
									</svg>
									<div class="flex-1 min-w-0">
										<div class="font-medium truncate">{action.label}</div>
										<div
											class="text-sm {globalIndex === selectedIndex
												? 'text-primary-content/70'
												: 'text-base-content/60'} truncate"
										>
											{action.description}
										</div>
									</div>
								</button>
							{/each}
						</div>
					{/each}
				{/if}
			</div>

			<!-- Footer -->
			<div
				class="px-4 py-2 border-t border-base-300 flex items-center justify-between text-xs text-base-content/50"
			>
				<div class="flex gap-4">
					<span><kbd class="kbd kbd-xs">↑↓</kbd> Navigate</span>
					<span><kbd class="kbd kbd-xs">↵</kbd> Select</span>
					<span><kbd class="kbd kbd-xs">ESC</kbd> Close</span>
				</div>
			</div>
		</div>
	</div>
{/if}
