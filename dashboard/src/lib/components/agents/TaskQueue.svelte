<script>
	import { dndzone } from 'svelte-dnd-action';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DependencyIndicator from '$lib/components/DependencyIndicator.svelte';
	import { analyzeDependencies } from '$lib/utils/dependencyUtils';

	let { tasks = [], agents = [], reservations = [], selectedProject = 'All Projects', ontaskclick } = $props();

	// Initialize filters from URL params (default to open tasks)
	let searchQuery = $state('');
	let selectedPriorities = $state(new Set(['0', '1', '2', '3'])); // All priorities by default
	let selectedStatuses = $state(new Set(['open'])); // Default to open tasks only
	let selectedTypes = $state(new Set()); // Empty = all types
	let selectedLabels = $state(new Set());
	let dragDisabled = $state(true);
	let isDragging = $state(false);

	// Sync filters with URL on mount and page changes
	$effect(() => {
		const params = new URLSearchParams(window.location.search);
		searchQuery = params.get('search') || '';

		const priorities = params.get('priorities');
		if (priorities) {
			selectedPriorities = new Set(priorities.split(','));
		} else {
			selectedPriorities = new Set(['0', '1', '2', '3']); // Default: all priorities
		}

		const statuses = params.get('statuses');
		if (statuses) {
			selectedStatuses = new Set(statuses.split(','));
		} else {
			selectedStatuses = new Set(['open']); // Default: open only
		}

		const types = params.get('types');
		if (types) {
			selectedTypes = new Set(types.split(','));
		} else {
			selectedTypes = new Set(); // Default: all types
		}

		const labels = params.get('labels');
		if (labels) {
			selectedLabels = new Set(labels.split(','));
		} else {
			selectedLabels = new Set();
		}
	});

	// Update URL when filters change
	function updateURL() {
		const params = new URLSearchParams();

		if (searchQuery) params.set('search', searchQuery);
		if (selectedPriorities.size > 0 && selectedPriorities.size < 4) {
			params.set('priorities', Array.from(selectedPriorities).join(','));
		}
		if (selectedStatuses.size > 0) {
			params.set('statuses', Array.from(selectedStatuses).join(','));
		}
		if (selectedTypes.size > 0) {
			params.set('types', Array.from(selectedTypes).join(','));
		}
		if (selectedLabels.size > 0) {
			params.set('labels', Array.from(selectedLabels).join(','));
		}

		const newURL = params.toString() ? `?${params.toString()}` : window.location.pathname;
		window.history.replaceState({}, '', newURL);
	}

	// Compute filtered tasks using $derived.by()
	const filteredTasks = $derived.by(() => {
		let result = tasks;

		// Filter by search
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(task) =>
					task.title?.toLowerCase().includes(query) ||
					task.description?.toLowerCase().includes(query)
			);
		}

		// Filter by priority (OR logic: task priority must be in selected set)
		if (selectedPriorities.size > 0 && selectedPriorities.size < 4) {
			result = result.filter((task) => selectedPriorities.has(String(task.priority)));
		}

		// Filter by status (OR logic: task status must be in selected set)
		if (selectedStatuses.size > 0) {
			result = result.filter((task) => selectedStatuses.has(task.status));
		}

		// Filter by type (OR logic: task type must be in selected set)
		if (selectedTypes.size > 0) {
			result = result.filter((task) => selectedTypes.has(task.issue_type));
		}

		// Filter by labels (AND logic: task must have ALL selected labels)
		if (selectedLabels.size > 0) {
			result = result.filter((task) => {
				const taskLabels = task.labels || [];
				return Array.from(selectedLabels).every((label) => taskLabels.includes(label));
			});
		}

		return result;
	});

	// Get unique labels from tasks
	const availableLabels = $derived.by(() => {
		const labelsSet = new Set();
		tasks.forEach((task) => {
			task.labels?.forEach((label) => labelsSet.add(label));
		});
		return Array.from(labelsSet).sort();
	});

	// Get unique types from tasks
	const availableTypes = $derived.by(() => {
		const typesSet = new Set();
		tasks.forEach((task) => {
			if (task.issue_type) typesSet.add(task.issue_type);
		});
		return Array.from(typesSet).sort();
	});

	// Toggle priority selection
	function togglePriority(priority) {
		if (selectedPriorities.has(priority)) {
			selectedPriorities.delete(priority);
		} else {
			selectedPriorities.add(priority);
		}
		selectedPriorities = new Set(selectedPriorities); // Trigger reactivity
		updateURL();
	}

	// Toggle status selection
	function toggleStatus(status) {
		if (selectedStatuses.has(status)) {
			selectedStatuses.delete(status);
		} else {
			selectedStatuses.add(status);
		}
		selectedStatuses = new Set(selectedStatuses); // Trigger reactivity
		updateURL();
	}

	// Toggle type selection
	function toggleType(type) {
		if (selectedTypes.has(type)) {
			selectedTypes.delete(type);
		} else {
			selectedTypes.add(type);
		}
		selectedTypes = new Set(selectedTypes); // Trigger reactivity
		updateURL();
	}

	// Toggle label selection
	function toggleLabel(label) {
		if (selectedLabels.has(label)) {
			selectedLabels.delete(label);
		} else {
			selectedLabels.add(label);
		}
		selectedLabels = new Set(selectedLabels); // Trigger reactivity
		updateURL();
	}

	// Clear all filters
	function clearAllFilters() {
		searchQuery = '';
		selectedPriorities = new Set(['0', '1', '2', '3']); // Reset to all priorities
		selectedStatuses = new Set(['open']); // Reset to open only
		selectedTypes = new Set(); // Reset to all types
		selectedLabels = new Set();
		updateURL();
	}

	// Priority badge colors
	function getPriorityBadge(priority) {
		switch (priority) {
			case 0:
				return 'badge-error'; // P0 - Red
			case 1:
				return 'badge-warning'; // P1 - Yellow
			case 2:
				return 'badge-info'; // P2 - Blue
			default:
				return 'badge-ghost'; // P3+ - Gray
		}
	}

	// Handle drag start - enable dragging
	function handleDragStart(event) {
		isDragging = true;
		dragDisabled = false;
		// Store task data for drop handling
		const taskId = event.target.closest('[data-task-id]')?.dataset.taskId;
		if (taskId) {
			event.dataTransfer.setData('text/plain', taskId);
			event.dataTransfer.effectAllowed = 'move';
		}
	}

	// Handle drag end - disable dragging
	function handleDragEnd() {
		dragDisabled = true;
		// Delay resetting isDragging to prevent click event firing
		setTimeout(() => {
			isDragging = false;
		}, 100);
	}

	// Handle task click - open drawer
	function handleTaskClick(taskId) {
		// Don't trigger click if we're dragging
		if (isDragging) return;

		// Emit event to parent component
		if (ontaskclick) {
			ontaskclick(taskId);
		}
	}
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="p-4 pb-1 border-b border-base-300">
		<input
			type="text"
			placeholder="Search {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}..."
			class="input input-bordered input-sm w-full mb-3"
			bind:value={searchQuery}
			oninput={() => updateURL()}
		/>

		<!-- Filters -->
		<div class="flex flex-col gap-1">
			<!-- Priority Filter -->
			<div class="form-control">
				<label class="label py-1">
					<span class="label-text text-xs">Priority ({selectedPriorities.size} selected)</span>
				</label>
				<div class="flex flex-wrap gap-1.5 p-2 bg-base-200 rounded-lg">
					{#each ['0', '1', '2', '3'] as priority}
						<button
							class="badge badge-sm transition-all duration-200 cursor-pointer {selectedPriorities.has(priority) ? 'badge-primary shadow-md' : 'badge-ghost hover:badge-primary/20 hover:shadow-sm hover:scale-105'}"
							onclick={() => togglePriority(priority)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									togglePriority(priority);
								}
							}}
						>
							P{priority} <span class="ml-1 opacity-70">({tasks.filter((task) => String(task.priority) === priority).length})</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Status Filter -->
			<div class="form-control">
				<label class="label py-1">
					<span class="label-text text-xs">Status ({selectedStatuses.size} selected)</span>
				</label>
				<div class="flex flex-wrap gap-1.5 p-2 bg-base-200 rounded-lg">
					{#each ['open', 'in_progress', 'blocked', 'closed'] as status}
						<button
							class="badge badge-sm transition-all duration-200 cursor-pointer {selectedStatuses.has(status) ? 'badge-primary shadow-md' : 'badge-ghost hover:badge-primary/20 hover:shadow-sm hover:scale-105'}"
							onclick={() => toggleStatus(status)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									toggleStatus(status);
								}
							}}
						>
							{status} <span class="ml-1 opacity-70">({tasks.filter((task) => task.status === status).length})</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Type Filter -->
			{#if availableTypes.length > 0}
				<div class="form-control">
					<label class="label py-1">
						<span class="label-text text-xs">Type ({selectedTypes.size > 0 ? selectedTypes.size : 'all'} selected)</span>
					</label>
					<div class="flex flex-wrap gap-1.5 p-2 bg-base-200 rounded-lg">
						{#each availableTypes as type}
							<button
								class="badge badge-sm transition-all duration-200 cursor-pointer {selectedTypes.has(type) ? 'badge-primary shadow-md' : 'badge-ghost hover:badge-primary/20 hover:shadow-sm hover:scale-105'}"
								onclick={() => toggleType(type)}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										toggleType(type);
									}
								}}
							>
								{type} <span class="ml-1 opacity-70">({tasks.filter((task) => task.issue_type === type).length})</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Multi-select Label Filter -->
			{#if availableLabels.length > 0}
				<div class="form-control">
					<label class="label py-1">
						<span class="label-text text-xs">Labels ({selectedLabels.size} selected)</span>
					</label>
					<div class="flex flex-wrap gap-1.5 p-2 bg-base-200 rounded-lg max-h-40 overflow-y-auto">
						{#each availableLabels as label}
							<button
								class="badge badge-sm transition-all duration-200 cursor-pointer {selectedLabels.has(label) ? 'badge-primary shadow-md' : 'badge-ghost hover:badge-primary/20 hover:shadow-sm hover:scale-105'}"
								onclick={() => toggleLabel(label)}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										toggleLabel(label);
									}
								}}
							>
								{label} <span class="ml-1 opacity-70">({tasks.filter((task) => task.labels?.includes(label)).length})</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Active Filters as Badges -->
		{#if searchQuery || selectedPriorities.size < 4 || selectedStatuses.size > 0 || selectedTypes.size > 0 || selectedLabels.size > 0}
			<div class="mt-3 mb-2">
				<div class="text-xs text-base-content/50 mb-1">Active Filters:</div>
				<div class="flex flex-wrap gap-1">
					{#if searchQuery}
						<span class="badge badge-sm badge-primary gap-1">
							🔍 {searchQuery}
							<button
								class="btn btn-ghost btn-xs p-0 h-auto min-h-0"
								onclick={() => {
									searchQuery = '';
									updateURL();
								}}
							>
								✕
							</button>
						</span>
					{/if}

					{#each Array.from(selectedPriorities) as priority}
						<span class="badge badge-sm badge-warning gap-1">
							P{priority}
							<button
								class="btn btn-ghost btn-xs p-0 h-auto min-h-0"
								onclick={() => togglePriority(priority)}
							>
								✕
							</button>
						</span>
					{/each}

					{#each Array.from(selectedStatuses) as status}
						<span class="badge badge-sm badge-info gap-1">
							{status}
							<button
								class="btn btn-ghost btn-xs p-0 h-auto min-h-0"
								onclick={() => toggleStatus(status)}
							>
								✕
							</button>
						</span>
					{/each}

					{#each Array.from(selectedTypes) as type}
						<span class="badge badge-sm badge-accent gap-1">
							{type}
							<button
								class="btn btn-ghost btn-xs p-0 h-auto min-h-0"
								onclick={() => toggleType(type)}
							>
								✕
							</button>
						</span>
					{/each}

					{#each Array.from(selectedLabels) as label}
						<span class="badge badge-sm badge-ghost gap-1">
							{label}
							<button
								class="btn btn-ghost btn-xs p-0 h-auto min-h-0"
								onclick={() => toggleLabel(label)}
							>
								✕
							</button>
						</span>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- Task List -->
	<div class="flex-1 overflow-y-auto p-4">
		{#if filteredTasks.length === 0}
			<div class="text-center py-8 text-base-content/50">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="w-12 h-12 mx-auto mb-2 opacity-30"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
					/>
				</svg>
				<p>No tasks found</p>
				{#if searchQuery || selectedPriorities.size < 4 || selectedStatuses.size > 0 || selectedTypes.size > 0 || selectedLabels.size > 0}
					<button class="btn btn-sm btn-ghost mt-2" onclick={clearAllFilters}>
						Clear filters
					</button>
				{/if}
			</div>
		{:else}
			{#each filteredTasks as task (task.id)}
				{@const depStatus = analyzeDependencies(task)}
				<div
					class="card bg-base-100 border border-base-300 hover:border-primary cursor-pointer transition-all mb-4 {!dragDisabled ? 'opacity-50' : ''} {depStatus.hasBlockers ? 'opacity-60 border-error/30' : ''}"
					draggable="true"
					data-task-id={task.id}
					ondragstart={handleDragStart}
					ondragend={handleDragEnd}
					onclick={() => handleTaskClick(task.id)}
					title={depStatus.hasBlockers ? `⚠️ ${depStatus.blockingReason}` : ''}
				>
					<div class="card-body p-3 relative">
						<!-- Task ID badge on left -->
						<div class="absolute -top-2 left-2">
							<span class="badge badge-sm badge-ghost text-xs text-base-content/50 font-mono">
								{task.id}
							</span>
						</div>

						<!-- Priority and Dependency badges on right -->
						<div class="absolute -top-2 right-2 flex items-center gap-1">
							<DependencyIndicator {task} allTasks={tasks} size="sm" />
							<span class="badge badge-sm {getPriorityBadge(task.priority)}">
								P{task.priority}
							</span>
						</div>

						<!-- Task Title -->
						<div class="mt-1.5 -mb-1">
							<h3 class="font-medium text-sm text-base-content truncate" title={task.title}>
								{task.title}
							</h3>
						</div>

						<!-- Task Description (truncated) -->
						{#if task.description}
							<p class="text-xs text-base-content/70 line-clamp-4">
								{task.description}
							</p>
						{/if}

						<!-- Labels -->
						{#if task.labels && task.labels.length > 0}
							<div class="flex flex-wrap gap-1 mt-2">
								{#each task.labels.slice(0, 3) as label}
									<span class="badge badge-ghost badge-xs">{label}</span>
								{/each}
								{#if task.labels.length > 3}
									<span class="badge badge-ghost badge-xs">+{task.labels.length - 3}</span>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>
