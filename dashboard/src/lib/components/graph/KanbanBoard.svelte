<script lang="ts">
	import { getProjectColor } from '$lib/utils/projectColors';

	// Props
	let { tasks = [], onTaskClick = null } = $props();

	// Status columns configuration
	const columns = [
		{ id: 'open', label: 'Open', color: 'border-blue-500', bgColor: 'bg-blue-500/10' },
		{
			id: 'in_progress',
			label: 'In Progress',
			color: 'border-amber-500',
			bgColor: 'bg-amber-500/10'
		},
		{ id: 'blocked', label: 'Blocked', color: 'border-red-500', bgColor: 'bg-red-500/10' },
		{ id: 'closed', label: 'Closed', color: 'border-green-500', bgColor: 'bg-green-500/10' }
	];

	// Priority badge colors
	const priorityColors = {
		0: 'badge-error',  // P0 - red
		1: 'badge-warning', // P1 - amber
		2: 'badge-info',   // P2 - blue
		3: 'badge-success', // P3 - green
		99: 'badge-ghost'  // default
	};

	// Group tasks by status
	const tasksByStatus = $derived(
		columns.reduce((acc, column) => {
			acc[column.id] = tasks.filter((task) => task.status === column.id);
			return acc;
		}, {})
	);

	// Handle task card click
	function handleTaskClick(taskId) {
		if (onTaskClick) {
			onTaskClick(taskId);
		}
	}
</script>

<div class="w-full bg-base-100 rounded-lg p-6 shadow">
	<!-- Kanban Board Header -->
	<div class="flex items-center justify-between mb-6">
		<h2 class="text-2xl font-bold text-base-content">Task Kanban Board</h2>
		<div class="text-sm text-base-content/70">
			Total: {tasks.length} task{tasks.length === 1 ? '' : 's'}
		</div>
	</div>

	<!-- Kanban Columns -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
		{#each columns as column}
			{@const columnTasks = tasksByStatus[column.id] || []}
			<div class="flex flex-col h-full">
				<!-- Column Header -->
				<div
					class="flex items-center justify-between p-3 border-t-4 {column.color} {column.bgColor} rounded-t-lg"
				>
					<h3 class="font-semibold text-base-content">{column.label}</h3>
					<span class="badge badge-sm">{columnTasks.length}</span>
				</div>

				<!-- Column Content (Scrollable) -->
				<div class="flex-1 bg-base-200 rounded-b-lg p-3 min-h-[400px] max-h-[600px] overflow-y-auto">
					{#if columnTasks.length === 0}
						<div class="text-center text-base-content/50 py-8 text-sm">No tasks</div>
					{:else}
						<div class="space-y-3">
							{#each columnTasks as task}
								<button
									class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow w-full text-left"
									style="border-left: 4px solid {getProjectColor(task.id)}"
									onclick={() => handleTaskClick(task.id)}
								>
									<div class="card-body p-4">
										<!-- Task ID + Priority -->
										<div class="flex items-start justify-between gap-2 mb-2">
											<code class="text-xs bg-base-200 px-2 py-1 rounded font-mono">
												{task.id}
											</code>
											<span class="badge badge-sm {priorityColors[task.priority ?? 99]}">
												P{task.priority ?? '?'}
											</span>
										</div>

										<!-- Task Title -->
										<h4 class="text-sm font-medium text-base-content line-clamp-2">
											{task.title}
										</h4>

										<!-- Task Meta -->
										<div class="flex items-center gap-2 mt-2 text-xs text-base-content/60">
											{#if task.assignee}
												<div class="flex items-center gap-1">
													<svg
														xmlns="http://www.w3.org/2000/svg"
														fill="none"
														viewBox="0 0 24 24"
														stroke-width="1.5"
														stroke="currentColor"
														class="w-3 h-3"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
														/>
													</svg>
													<span>{task.assignee}</span>
												</div>
											{/if}

											{#if task.labels && task.labels.length > 0}
												<div class="flex items-center gap-1">
													<svg
														xmlns="http://www.w3.org/2000/svg"
														fill="none"
														viewBox="0 0 24 24"
														stroke-width="1.5"
														stroke="currentColor"
														class="w-3 h-3"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"
														/>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															d="M6 6h.008v.008H6V6z"
														/>
													</svg>
													<span>{task.labels.slice(0, 2).join(', ')}</span>
													{#if task.labels.length > 2}
														<span>+{task.labels.length - 2}</span>
													{/if}
												</div>
											{/if}
										</div>

										<!-- Dependencies indicator -->
										{#if task.depends_on && task.depends_on.length > 0}
											<div class="mt-2 text-xs text-warning flex items-center gap-1">
												<svg
													xmlns="http://www.w3.org/2000/svg"
													fill="none"
													viewBox="0 0 24 24"
													stroke-width="1.5"
													stroke="currentColor"
													class="w-3 h-3"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
													/>
												</svg>
												<span>{task.depends_on.length} dep{task.depends_on.length > 1 ? 's' : ''}</span>
											</div>
										{/if}
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- Board Stats -->
	<div class="mt-6 stats stats-horizontal shadow w-full">
		<div class="stat">
			<div class="stat-title">Total Tasks</div>
			<div class="stat-value text-2xl">{tasks.length}</div>
		</div>
		{#each columns as column}
			{@const columnTasks = tasksByStatus[column.id] || []}
			<div class="stat">
				<div class="stat-title">{column.label}</div>
				<div class="stat-value text-2xl">{columnTasks.length}</div>
				<div class="stat-desc">
					{columnTasks.length === 0
						? 'No tasks'
						: `${((columnTasks.length / tasks.length) * 100).toFixed(0)}% of total`}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
