<script>
	import { dndzone } from 'svelte-dnd-action';

	let { tasks = [], agents = [], reservations = [] } = $props();

	let searchQuery = $state('');
	let priorityFilter = $state('all');
	let statusFilter = $state('all');
	let labelFilter = $state('all');
	let dragDisabled = $state(true);

	// Compute filtered tasks using $derived
	const filteredTasks = $derived(() => {
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

		// Filter by priority
		if (priorityFilter !== 'all') {
			result = result.filter((task) => String(task.priority) === priorityFilter);
		}

		// Filter by status
		if (statusFilter !== 'all') {
			result = result.filter((task) => task.status === statusFilter);
		}

		// Filter by label
		if (labelFilter !== 'all') {
			result = result.filter((task) => task.labels?.includes(labelFilter));
		}

		return result;
	});

	// Get unique labels from tasks
	const availableLabels = $derived(() => {
		const labelsSet = new Set();
		tasks.forEach((task) => {
			task.labels?.forEach((label) => labelsSet.add(label));
		});
		return Array.from(labelsSet).sort();
	});

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
	}
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="p-4 border-b border-base-300">
		<h2 class="text-lg font-semibold text-base-content mb-3">Task Queue</h2>

		<!-- Search -->
		<input
			type="text"
			placeholder="Search tasks..."
			class="input input-bordered input-sm w-full mb-3"
			bind:value={searchQuery}
		/>

		<!-- Filters -->
		<div class="flex flex-col gap-2">
			<!-- Priority Filter -->
			<select class="select select-bordered select-sm w-full" bind:value={priorityFilter}>
				<option value="all">All Priorities</option>
				<option value="0">P0 (Critical)</option>
				<option value="1">P1 (High)</option>
				<option value="2">P2 (Medium)</option>
				<option value="3">P3 (Low)</option>
			</select>

			<!-- Status Filter -->
			<select class="select select-bordered select-sm w-full" bind:value={statusFilter}>
				<option value="all">All Statuses</option>
				<option value="open">Open</option>
				<option value="blocked">Blocked</option>
				<option value="ready">Ready</option>
			</select>

			<!-- Label Filter -->
			{#if availableLabels().length > 0}
				<select class="select select-bordered select-sm w-full" bind:value={labelFilter}>
					<option value="all">All Labels</option>
					{#each availableLabels() as label}
						<option value={label}>{label}</option>
					{/each}
				</select>
			{/if}
		</div>

		<!-- Task Count -->
		<div class="mt-3 text-sm text-base-content/70">
			{filteredTasks().length} task{filteredTasks().length !== 1 ? 's' : ''}
			{#if filteredTasks().length !== tasks.length}
				of {tasks.length} total
			{/if}
		</div>
	</div>

	<!-- Task List -->
	<div class="flex-1 overflow-y-auto p-4 space-y-2">
		{#if filteredTasks().length === 0}
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
				{#if searchQuery || priorityFilter !== 'all' || statusFilter !== 'all' || labelFilter !== 'all'}
					<button
						class="btn btn-sm btn-ghost mt-2"
						onclick={() => {
							searchQuery = '';
							priorityFilter = 'all';
							statusFilter = 'all';
							labelFilter = 'all';
						}}
					>
						Clear filters
					</button>
				{/if}
			</div>
		{:else}
			{#each filteredTasks() as task (task.id)}
				<div
					class="card bg-base-100 border border-base-300 hover:border-primary cursor-move transition-all {!dragDisabled ? 'opacity-50' : ''}"
					draggable="true"
					data-task-id={task.id}
					ondragstart={handleDragStart}
					ondragend={handleDragEnd}
				>
					<div class="card-body p-3">
						<!-- Task Header -->
						<div class="flex items-start justify-between gap-2 mb-2">
							<div class="flex-1 min-w-0">
								<h3 class="font-medium text-sm text-base-content truncate" title={task.title}>
									{task.title}
								</h3>
								<p class="text-xs text-base-content/50 font-mono">{task.id}</p>
							</div>
							<span class="badge badge-sm {getPriorityBadge(task.priority)}">
								P{task.priority}
							</span>
						</div>

						<!-- Task Description (truncated) -->
						{#if task.description}
							<p class="text-xs text-base-content/70 line-clamp-2">
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

						<!-- Drag Handle Icon -->
						<div class="mt-2 flex justify-center">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="w-4 h-4 text-base-content/30"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M3.75 9h16.5m-16.5 6.75h16.5"
								/>
							</svg>
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>
