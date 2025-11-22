<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import TaskList from '$lib/components/TaskList.svelte';
	import TaskDetailDrawer from '$lib/components/TaskDetailDrawer.svelte';

	let selectedPriority = $state('all');
	let selectedStatus = $state('all');
	let searchQuery = $state('');
	let tasks = $state<any[]>([]);
	let allTasks = $state<any[]>([]);
	let selectedTaskId = $state<string | null>(null);
	let drawerOpen = $state(false);
	let drawerMode = $state<'view' | 'edit'>('view');

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
	<!-- Secondary filters (priority, status, search) with Claude Usage Widget -->
	<div class="bg-base-100 border-b border-base-300 p-4 relative">
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

	<TaskList
		bind:selectedPriority
		bind:selectedStatus
		bind:searchQuery
	/>

	<!-- Task Detail Modal -->
	<TaskDetailDrawer bind:taskId={selectedTaskId} bind:mode={drawerMode} bind:isOpen={drawerOpen} />
</div>
