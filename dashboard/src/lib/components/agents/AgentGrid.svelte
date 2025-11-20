<script>
	import AgentCard from './AgentCard.svelte';
	import AutoAssignModal from './AutoAssignModal.svelte';
	import { generateAutoAssignments } from '$lib/utils/autoAssign';

	let { agents = [], tasks = [], reservations = [], onTaskAssign = () => {} } = $props();

	// Modal state
	let showModal = $state(false);
	let assignments = $state([]);
	let isAssigning = $state(false);

	// Get unassigned tasks (status='open' and no assignee)
	const unassignedTasks = $derived(
		tasks.filter(t => t.status === 'open' && !t.assignee)
	);

	// Helper to compute agent status (matches AgentCard.svelte and store logic)
	function getAgentStatus(agent) {
		const hasActiveLocks = agent.reservation_count > 0;
		const hasInProgressTask = agent.in_progress_tasks > 0;

		let timeSinceActive = Infinity;
		if (agent.last_active_ts) {
			const isoTimestamp = agent.last_active_ts.includes('T')
				? agent.last_active_ts
				: agent.last_active_ts.replace(' ', 'T') + 'Z';
			const lastActivity = new Date(isoTimestamp);
			timeSinceActive = Date.now() - lastActivity.getTime();
		}

		// Priority 1: LIVE - Very recent activity (< 1 minute)
		if (timeSinceActive < 60000) {
			return 'live';
		}

		// Priority 2: WORKING - Recently working (1-10 minutes) with active task/locks
		if (timeSinceActive < 600000 && (hasInProgressTask || hasActiveLocks)) {
			return 'working';
		}

		// Priority 3: ACTIVE - Recent activity (< 10 minutes)
		if (timeSinceActive < 600000) {
			return 'active';
		}

		// Priority 4: IDLE - Within 1 hour
		if (timeSinceActive < 3600000) {
			return 'idle';
		}

		// Priority 5: OFFLINE
		return 'offline';
	}

	// Status priority for sorting (lower number = higher priority)
	function getStatusPriority(status) {
		const priorities = {
			live: 1,
			working: 2,
			active: 3,
			idle: 4,
			offline: 5
		};
		return priorities[status] || 999;
	}

	// Sort agents by status priority (live > working > active > idle > offline)
	const sortedAgents = $derived(() => {
		return [...agents].sort((a, b) => {
			const statusA = getAgentStatus(a);
			const statusB = getAgentStatus(b);
			const priorityA = getStatusPriority(statusA);
			const priorityB = getStatusPriority(statusB);

			// Sort by status priority first
			if (priorityA !== priorityB) {
				return priorityA - priorityB;
			}

			// Within same status, sort by last activity (most recent first)
			if (a.last_active_ts && b.last_active_ts) {
				return new Date(b.last_active_ts).getTime() - new Date(a.last_active_ts).getTime();
			}

			// If one has activity and other doesn't, prioritize the one with activity
			if (a.last_active_ts && !b.last_active_ts) return -1;
			if (!a.last_active_ts && b.last_active_ts) return 1;

			// Finally sort by name alphabetically
			return a.name.localeCompare(b.name);
		});
	});

	// Auto-assign button action
	function handleAutoAssign() {
		// Generate assignments using the algorithm
		const proposed = generateAutoAssignments(unassignedTasks, agents, reservations);

		if (proposed.length === 0) {
			alert('No suitable assignments found. All agents may be at capacity or tasks are blocked.');
			return;
		}

		// Show preview modal
		assignments = proposed;
		showModal = true;
	}

	// Confirm and apply assignments
	async function confirmAssignments() {
		isAssigning = true;

		try {
			// Batch assign all tasks via API
			const promises = assignments.map(assignment =>
				fetch('/api/tasks/assign', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						taskId: assignment.task.id,
						agentName: assignment.agent.name
					})
				}).then(res => res.json())
			);

			const results = await Promise.all(promises);

			// Check for errors
			const errors = results.filter(r => r.error);
			if (errors.length > 0) {
				console.error('Some assignments failed:', errors);
				alert(`${errors.length} assignment(s) failed. Check console for details.`);
			} else {
				console.log('All assignments successful!');
			}

			// Close modal
			showModal = false;
			assignments = [];

			// Refresh data (parent component will handle via polling)
		} catch (error) {
			console.error('Error applying assignments:', error);
			alert('Failed to apply assignments. See console for details.');
		} finally {
			isAssigning = false;
		}
	}

	// Cancel assignment preview
	function cancelAssignments() {
		showModal = false;
		assignments = [];
	}

	// Smart balance action (placeholder)
	function handleSmartBalance() {
		console.log('Smart balance logic will be implemented in P1 task');
		// TODO: Implement in jomarchy-agent-tools-kpw
	}

	// Refresh data (placeholder)
	function handleRefresh() {
		console.log('Manual refresh triggered');
		// Parent component will handle data fetching
	}
</script>

<div class="flex flex-col h-full">
	<!-- Toolbar -->
	<div class="bg-base-100 border-b border-base-300 p-4">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-lg font-semibold text-base-content">Active Agents</h2>
				<p class="text-sm text-base-content/70">
					{agents.length} agent{agents.length !== 1 ? 's' : ''} online
				</p>
			</div>

			<!-- Action Buttons -->
			<div class="flex gap-2">
				<button class="btn btn-sm btn-primary" onclick={handleAutoAssign}>
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
							d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
						/>
					</svg>
					Auto-Assign
				</button>

				<button class="btn btn-sm btn-ghost" onclick={handleSmartBalance}>
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
							d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
						/>
					</svg>
					Smart Balance
				</button>

				<button class="btn btn-sm btn-ghost" onclick={handleRefresh}>
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
							d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
						/>
					</svg>
					Refresh
				</button>
			</div>
		</div>
	</div>

	<!-- Agent Grid -->
	<div class="flex-1 overflow-auto p-4">
		{#if agents.length === 0}
			<!-- Empty State -->
			<div class="flex flex-col items-center justify-center h-full text-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="w-16 h-16 text-base-content/20 mb-4"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
					/>
				</svg>
				<h3 class="text-lg font-medium text-base-content/70 mb-2">No Agents Online</h3>
				<p class="text-sm text-base-content/50 max-w-md">
					Agents will appear here when they register and start working. Use Agent Mail's
					<code class="text-xs bg-base-300 px-1 py-0.5 rounded">am-register</code> command to create
					agents.
				</p>
			</div>
		{:else}
			<!-- Responsive Grid -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
				{#each sortedAgents() as agent (agent.id || agent.name)}
					<AgentCard {agent} {tasks} {reservations} {onTaskAssign} />
				{/each}
			</div>
		{/if}
	</div>

	<!-- Capacity Bar (bottom) -->
	<div class="bg-base-100 border-t border-base-300 p-4">
		<div class="flex items-center justify-between mb-2">
			<span class="text-sm font-medium text-base-content">System Capacity</span>
			<span class="text-xs text-base-content/70">
				<!-- TODO: Calculate actual capacity in P2 task (jomarchy-agent-tools-m68) -->
				0h / 0h
			</span>
		</div>
		<progress class="progress progress-primary w-full" value="0" max="100"></progress>
	</div>
</div>

<!-- Auto-Assign Preview Modal -->
{#if showModal}
	<AutoAssignModal
		{assignments}
		{isAssigning}
		onConfirm={confirmAssignments}
		onCancel={cancelAssignments}
	/>
{/if}
