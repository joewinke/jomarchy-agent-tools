<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import TaskList from '$lib/components/TaskList.svelte';
	import DependencyGraph from '$lib/components/DependencyGraph.svelte';
	import TaskDetailModal from '$lib/components/TaskDetailModal.svelte';

	let selectedPriority = $state('all');
	let selectedStatus = $state('all');
	let searchQuery = $state('');
	let viewMode = $state<'list' | 'graph'>('list');
	let tasks = $state<any[]>([]);
	let allTasks = $state<any[]>([]);
	let selectedTaskId = $state<string | null>(null);

	// Read project from URL parameter
	const projectParam = $derived($page.url.searchParams.get('project'));

	// Filter tasks by project
	const filteredTasks = $derived(() => {
		if (!projectParam || projectParam === 'All Projects') {
			return allTasks;
		}
		// Filter by project prefix (e.g., "jat-abc" matches "jat")
		return allTasks.filter((task) => task.id.startsWith(projectParam + '-'));
	});

	// Fetch all tasks
	async function fetchTasks() {
		const params = new URLSearchParams();
		if (selectedStatus !== 'all') params.append('status', selectedStatus);
		if (selectedPriority !== 'all') params.append('priority', selectedPriority);

		const response = await fetch(`/api/tasks?${params}`);
		const data = await response.json();
		allTasks = data.tasks || [];
	}

	// Handle node click in graph
	function handleNodeClick(taskId: string) {
		selectedTaskId = taskId;
	}

	// Handle modal close
	function handleModalClose() {
		selectedTaskId = null;
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
	<!-- Secondary filters (priority, status, search) -->
	<div class="bg-base-100 border-b border-base-300 p-4">
		<div class="flex flex-wrap gap-4">
			<div class="form-control">
				<label class="label" for="priority-filter">
					<span class="label-text">Priority</span>
				</label>
				<select id="priority-filter" class="select select-bordered select-sm" bind:value={selectedPriority}>
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
				<select id="status-filter" class="select select-bordered select-sm" bind:value={selectedStatus}>
					<option value="all">All Statuses</option>
					<option value="open">Open</option>
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

	{#if viewMode === 'list'}
		<TaskList
			bind:selectedPriority
			bind:selectedStatus
			bind:searchQuery
		/>
	{:else}
		<div class="p-4">
			<DependencyGraph {tasks} onNodeClick={handleNodeClick} />
		</div>
	{/if}

	<!-- Task Detail Modal -->
	<TaskDetailModal taskId={selectedTaskId} onClose={handleModalClose} />
</div>
