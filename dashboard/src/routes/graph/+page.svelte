<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import DependencyGraph from '$lib/components/DependencyGraph.svelte';
	import TaskDetailDrawer from '$lib/components/TaskDetailDrawer.svelte';

	// Task data
	let tasks = $state([]);
	let allTasks = $state([]);
	let loading = $state(true);
	let error = $state(null);
	let selectedTaskId = $state(null);
	let drawerOpen = $state(false);
	let drawerMode = $state<'view' | 'edit'>('view');

	// Filters
	let selectedPriority = $state('all');
	let selectedStatus = $state('open');
	let searchQuery = $state('');

	// Read project filter from URL (managed by root layout)
	let selectedProject = $state('All Projects');

	// Sync selectedProject from URL params
	$effect(() => {
		const projectParam = $page.url.searchParams.get('project');
		selectedProject = projectParam || 'All Projects';
	});

	// Filter tasks by project
	const filteredTasks = $derived(() => {
		if (!selectedProject || selectedProject === 'All Projects') {
			return allTasks;
		}

		// Filter by project prefix (e.g., "jat-abc" matches "jat")
		return allTasks.filter((task) => task.id.startsWith(selectedProject + '-'));
	});

	// Fetch tasks
	async function fetchTasks() {
		try {
			loading = true;
			error = null;

			const params = new URLSearchParams();
			if (selectedStatus !== 'all') params.append('status', selectedStatus);
			if (selectedPriority !== 'all') params.append('priority', selectedPriority);

			const response = await fetch(`/api/tasks?${params}`);
			if (!response.ok) throw new Error('Failed to fetch tasks');

			const data = await response.json();
			allTasks = data.tasks || [];
		} catch (err) {
			error = err.message;
			console.error('Failed to fetch tasks:', err);
		} finally {
			loading = false;
		}
	}

	// Handle node click in graph
	function handleNodeClick(taskId) {
		selectedTaskId = taskId;
		drawerMode = 'view';
		drawerOpen = true;
	}

	// Refetch tasks when filters change
	$effect(() => {
		fetchTasks();
	});

	// Update displayed tasks when project filter or allTasks change
	$effect(() => {
		tasks = filteredTasks();
	});

	onMount(() => {
		fetchTasks();
	});
</script>

<div class="min-h-screen bg-base-200">
	<!-- Filters Bar -->
	<div class="bg-base-100 border-b border-base-300 p-4">
		<div class="flex flex-wrap items-center gap-4">
			<!-- Filters -->
			<div class="form-control">
				<label class="label" for="priority-filter">
					<span class="label-text">Priority</span>
				</label>
				<select
					id="priority-filter"
					class="select select-bordered select-sm"
					bind:value={selectedPriority}
				>
					<option value="all">All Priorities</option>
					<option value="0">P0 (Critical)</option>
					<option value="1">P1 (High)</option>
					<option value="2">P2 (Medium)</option>
					<option value="3">P3 (Low)</option>
				</select>
			</div>

			<div class="form-control">
				<label class="label" for="status-filter">
					<span class="label-text">Status</span>
				</label>
				<select
					id="status-filter"
					class="select select-bordered select-sm"
					bind:value={selectedStatus}
				>
					<option value="all">All Statuses</option>
					<option value="open">Open</option>
					<option value="in_progress">In Progress</option>
					<option value="blocked">Blocked</option>
					<option value="closed">Closed</option>
				</select>
			</div>

			<div class="form-control">
				<label class="label" for="search-filter">
					<span class="label-text">Search</span>
				</label>
				<input
					id="search-filter"
					type="text"
					placeholder="Search tasks..."
					class="input input-bordered input-sm"
					bind:value={searchQuery}
				/>
			</div>
		</div>
	</div>

	<!-- Loading State -->
	{#if loading}
		<div class="flex items-center justify-center h-96">
			<div class="loading loading-spinner loading-lg text-primary"></div>
		</div>

	<!-- Error State -->
	{:else if error}
		<div class="alert alert-error m-4">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="stroke-current shrink-0 h-6 w-6"
				fill="none"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span>Error: {error}</span>
		</div>

	<!-- Main Content: Dependency Graph -->
	{:else}
		<div class="p-4">
			<DependencyGraph {tasks} onNodeClick={handleNodeClick} />
		</div>
	{/if}

	<!-- Task Detail Modal -->
	<TaskDetailDrawer bind:taskId={selectedTaskId} bind:mode={drawerMode} bind:isOpen={drawerOpen} />
</div>
