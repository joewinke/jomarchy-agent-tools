<script lang="ts">
	import { onMount } from 'svelte';
	import { agents as agentsStore } from '$lib/stores/agents.svelte';
	import ThemeSelector from '$lib/components/ThemeSelector.svelte';

	// Reactive state derived from agents store
	const agents = $derived(agentsStore.agents);
	const reservations = $derived(agentsStore.reservations);
	const tasks = $derived(agentsStore.tasks);
	const taskStats = $derived(agentsStore.taskStats);
	const activeAgents = $derived(agentsStore.activeAgents);
	const idleAgents = $derived(agentsStore.idleAgents);
	const loading = $derived(agentsStore.loading);
	const error = $derived(agentsStore.error);

	// Manual API test state
	let selectedEndpoint = $state('/api/agents?full=true');
	let apiResponse = $state('');
	let apiLoading = $state(false);

	// Start polling when component mounts
	$effect(() => {
		agentsStore.startPolling();
		return () => agentsStore.stopPolling();
	});

	// Manual API fetch for testing
	async function testEndpoint() {
		try {
			apiLoading = true;
			const response = await fetch(selectedEndpoint);
			const data = await response.json();
			apiResponse = JSON.stringify(data, null, 2);
		} catch (err) {
			apiResponse = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
		} finally {
			apiLoading = false;
		}
	}

	const endpoints = [
		'/api/agents?full=true',
		'/api/agents',
		'/api/reservations',
		'/api/tasks',
		'/api/tasks?status=open',
		'/api/tasks?priority=0'
	];
</script>

<div class="min-h-screen bg-base-200">
	<!-- Header -->
	<div class="navbar bg-base-100 border-b border-base-300">
		<div class="flex-1">
			<div>
				<h1 class="text-2xl font-bold text-base-content">Agents API Demo</h1>
				<p class="text-sm text-base-content/70">
					Live integration showcase for /api/agents endpoint + reactive store
				</p>
			</div>
		</div>
		<div class="flex-none gap-2">
			<a href="/" class="btn btn-sm btn-ghost">← Back to Dashboard</a>
			<ThemeSelector />
		</div>
	</div>

	<div class="container mx-auto p-4 space-y-6">
		<!-- Status Banner -->
		{#if loading}
			<div class="alert alert-info">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					class="stroke-current shrink-0 w-6 h-6"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					></path>
				</svg>
				<span>Loading agent data...</span>
			</div>
		{:else if error}
			<div class="alert alert-error">
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
		{:else}
			<div class="alert alert-success">
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
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span>Connected - polling every 3 seconds</span>
			</div>
		{/if}

		<!-- Integration Examples Section -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Left: Store Usage -->
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h2 class="card-title">🔗 Reactive Store Integration</h2>
					<div class="space-y-4">
						<div class="mockup-code text-xs">
							<pre><code>{`// Import the store
import { agents as agentsStore } from '$lib/stores/agents.svelte';

// Use reactive state
const agents = $derived(agentsStore.agents);
const tasks = $derived(agentsStore.tasks);

// Start polling
$effect(() => {
  agentsStore.startPolling();
  return () => agentsStore.stopPolling();
});`}</code></pre>
						</div>

						<div class="divider">Live Data</div>

						<div class="stats stats-vertical shadow w-full">
							<div class="stat">
								<div class="stat-title">Total Agents</div>
								<div class="stat-value text-primary">{agents.length}</div>
								<div class="stat-desc">
									{activeAgents.length} active, {idleAgents.length} idle
								</div>
							</div>

							<div class="stat">
								<div class="stat-title">Active Reservations</div>
								<div class="stat-value text-secondary">{reservations.length}</div>
								<div class="stat-desc">File locks preventing conflicts</div>
							</div>

							<div class="stat">
								<div class="stat-title">Total Tasks</div>
								<div class="stat-value">{taskStats.total}</div>
								<div class="stat-desc">
									{taskStats.open} open, {taskStats.in_progress} in progress
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Right: Manual API Testing -->
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h2 class="card-title">🧪 API Endpoint Tester</h2>
					<div class="space-y-4">
						<div class="form-control">
							<label class="label" for="endpoint-select">
								<span class="label-text">Select Endpoint</span>
							</label>
							<select
								id="endpoint-select"
								class="select select-bordered w-full"
								bind:value={selectedEndpoint}
							>
								{#each endpoints as endpoint}
									<option value={endpoint}>{endpoint}</option>
								{/each}
							</select>
						</div>

						<button class="btn btn-primary w-full" onclick={testEndpoint} disabled={apiLoading}>
							{#if apiLoading}
								<span class="loading loading-spinner"></span>
								Fetching...
							{:else}
								Test Endpoint
							{/if}
						</button>

						{#if apiResponse}
							<div class="mockup-code text-xs max-h-96 overflow-auto">
								<pre><code>{apiResponse}</code></pre>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Agent Details -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">👥 Active Agents ({activeAgents.length})</h2>
				{#if activeAgents.length === 0}
					<p class="text-base-content/70">No active agents currently</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="table table-zebra">
							<thead>
								<tr>
									<th>Name</th>
									<th>Program</th>
									<th>Model</th>
									<th>Reservations</th>
									<th>Tasks</th>
									<th>Status</th>
								</tr>
							</thead>
							<tbody>
								{#each activeAgents as agent}
									<tr>
										<td class="font-bold">{agent.name}</td>
										<td>{agent.program}</td>
										<td>{agent.model}</td>
										<td>
											<span class="badge badge-secondary">{agent.reservation_count}</span>
										</td>
										<td>
											<span class="badge badge-primary">{agent.task_count}</span>
											<span class="text-xs text-base-content/70">
												({agent.open_tasks} open, {agent.in_progress_tasks} in progress)
											</span>
										</td>
										<td>
											<span class="badge badge-success">Active</span>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>

		<!-- File Reservations -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">🔒 Active File Reservations ({reservations.length})</h2>
				{#if reservations.length === 0}
					<p class="text-base-content/70">No active reservations</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="table table-zebra">
							<thead>
								<tr>
									<th>Agent</th>
									<th>Pattern</th>
									<th>Type</th>
									<th>Reason</th>
									<th>Expires</th>
								</tr>
							</thead>
							<tbody>
								{#each reservations as reservation}
									<tr>
										<td class="font-bold">{reservation.agent_name}</td>
										<td>
											<code class="text-xs bg-base-200 px-2 py-1 rounded">
												{reservation.path_pattern}
											</code>
										</td>
										<td>
											{#if reservation.exclusive}
												<span class="badge badge-error">Exclusive</span>
											{:else}
												<span class="badge badge-info">Shared</span>
											{/if}
										</td>
										<td class="text-sm">{reservation.reason}</td>
										<td class="text-sm text-base-content/70">
											{new Date(reservation.expires_ts).toLocaleString()}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>

		<!-- Task Statistics -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">📊 Task Statistics</h2>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title">Open</div>
						<div class="stat-value text-info">{taskStats.open}</div>
					</div>
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title">In Progress</div>
						<div class="stat-value text-warning">{taskStats.in_progress}</div>
					</div>
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title">Blocked</div>
						<div class="stat-value text-error">{taskStats.blocked}</div>
					</div>
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title">Closed</div>
						<div class="stat-value text-success">{taskStats.closed}</div>
					</div>
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title">Total</div>
						<div class="stat-value">{taskStats.total}</div>
					</div>
				</div>

				<div class="divider">By Priority</div>

				<div class="grid grid-cols-2 md:grid-cols-5 gap-4">
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title">P0</div>
						<div class="stat-value text-sm">{taskStats.by_priority.p0}</div>
					</div>
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title">P1</div>
						<div class="stat-value text-sm">{taskStats.by_priority.p1}</div>
					</div>
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title">P2</div>
						<div class="stat-value text-sm">{taskStats.by_priority.p2}</div>
					</div>
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title">P3</div>
						<div class="stat-value text-sm">{taskStats.by_priority.p3}</div>
					</div>
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title">P4</div>
						<div class="stat-value text-sm">{taskStats.by_priority.p4}</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Recent Tasks Sample -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">📝 Recent Tasks (showing {Math.min(10, tasks.length)} of {tasks.length})</h2>
				{#if tasks.length === 0}
					<p class="text-base-content/70">No tasks available</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="table table-zebra">
							<thead>
								<tr>
									<th>ID</th>
									<th>Title</th>
									<th>Status</th>
									<th>Priority</th>
									<th>Project</th>
									<th>Labels</th>
								</tr>
							</thead>
							<tbody>
								{#each tasks.slice(0, 10) as task}
									<tr>
										<td>
											<code class="text-xs bg-base-200 px-2 py-1 rounded">{task.id}</code>
										</td>
										<td class="max-w-xs truncate">{task.title}</td>
										<td>
											<span class="badge badge-sm" class:badge-success={task.status === 'closed'} class:badge-info={task.status === 'open'} class:badge-warning={task.status === 'in_progress'} class:badge-error={task.status === 'blocked'}>
												{task.status}
											</span>
										</td>
										<td>
											<span class="badge badge-sm">P{task.priority}</span>
										</td>
										<td class="text-sm">{task.project}</td>
										<td>
											<div class="flex flex-wrap gap-1">
												{#each task.labels.slice(0, 3) as label}
													<span class="badge badge-outline badge-xs">{label}</span>
												{/each}
												{#if task.labels.length > 3}
													<span class="badge badge-outline badge-xs">+{task.labels.length - 3}</span>
												{/if}
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>

		<!-- Documentation -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">📚 Integration Documentation</h2>
				<div class="prose">
					<h3>How to Use the Orchestration Store</h3>
					<ol>
						<li>Import the store: <code>import {'{ agents }'} from '$lib/stores/agents.svelte';</code></li>
						<li>Use <code>$derived()</code> to access reactive state</li>
						<li>Start polling in <code>$effect()</code> hook</li>
						<li>Clean up on unmount by returning cleanup function</li>
					</ol>

					<h3>Available Data</h3>
					<ul>
						<li><code>agents.agents</code> - All registered agents with stats</li>
						<li><code>agents.reservations</code> - Active file locks</li>
						<li><code>agents.tasks</code> - Tasks from all projects</li>
						<li><code>agents.taskStats</code> - Aggregated statistics</li>
						<li><code>agents.activeAgents</code> - Filtered active agents</li>
						<li><code>agents.idleAgents</code> - Filtered idle agents</li>
						<li><code>agents.loading</code> - Loading state</li>
						<li><code>agents.error</code> - Error message if any</li>
					</ul>

					<h3>API Endpoints</h3>
					<ul>
						<li><code>/api/agents?full=true</code> - Unified endpoint (recommended)</li>
						<li><code>/api/agents</code> - Agent data only</li>
						<li><code>/api/reservations</code> - File reservations only</li>
						<li><code>/api/tasks</code> - Tasks only</li>
						<li><code>/api/tasks/[id]</code> - Single task details</li>
					</ul>

					<p class="text-sm text-base-content/70 mt-4">
						See <code>dashboard/API_DOCUMENTATION.md</code> for complete API reference.
					</p>
				</div>
			</div>
		</div>
	</div>
</div>
