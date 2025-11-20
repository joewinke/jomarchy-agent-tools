<script lang="ts">
	import CapacityBar from '$lib/components/CapacityBar.svelte';
	import { calculateSystemCapacity } from '$lib/utils/capacityCalculations';
	import type { Agent, Task } from '$lib/stores/agents.svelte';

	/**
	 * System-wide capacity bar showing aggregate load across all agents
	 */
	let { agents = [], tasks = [] } = $props();

	// Calculate system capacity
	const systemCapacity = $derived(() => {
		return calculateSystemCapacity(agents, tasks, 8);
	});

	// Prepare agent breakdown for tooltip
	const agentBreakdown = $derived(() => {
		return systemCapacity().agentBreakdown.map((agent) => ({
			taskId: agent.agentName,
			title: agent.agentName,
			estimatedHours: agent.usedHours,
			priority: agent.status === 'high' ? 0 : agent.status === 'moderate' ? 1 : 2
		}));
	});

	// Get total agent count by status
	const agentStats = $derived(() => {
		const breakdown = systemCapacity().agentBreakdown;
		return {
			working: breakdown.filter((a) => a.usedHours > 0).length,
			overloaded: breakdown.filter((a) => a.status === 'high').length,
			moderate: breakdown.filter((a) => a.status === 'moderate').length,
			available: breakdown.filter((a) => a.status === 'good' && a.usedHours > 0).length,
			idle: breakdown.filter((a) => a.usedHours === 0).length
		};
	});
</script>

<div class="fixed bottom-0 left-0 right-0 bg-base-100 border-t-2 border-base-300 shadow-lg z-40">
	<div class="container mx-auto px-4 py-3">
		<div class="flex items-center gap-4">
			<!-- System Status Icon -->
			<div class="flex-none">
				<div class="flex items-center gap-2">
					<div
						class="w-3 h-3 rounded-full animate-pulse {systemCapacity().status === 'good' ? 'bg-success' : systemCapacity().status === 'moderate' ? 'bg-warning' : 'bg-error'}"
					></div>
					<span class="text-sm font-semibold text-base-content">
						System Load
					</span>
				</div>
			</div>

			<!-- Capacity Bar (Main) -->
			<div class="flex-1">
				<CapacityBar
					usedHours={systemCapacity().totalUsedHours}
					availableHours={systemCapacity().totalAvailableHours}
					percentage={systemCapacity().percentage}
					status={systemCapacity().status}
					tasksBreakdown={agentBreakdown()}
					showLabel={false}
					size="lg"
				/>
			</div>

			<!-- System Stats -->
			<div class="flex-none flex items-center gap-4 text-xs">
				<div class="flex items-center gap-2">
					<span class="text-base-content/70">Agents:</span>
					<div class="flex items-center gap-1">
						<span class="badge badge-xs badge-info">{agentStats().working}</span>
						<span class="text-base-content/50">working</span>
					</div>
					{#if agentStats().overloaded > 0}
						<div class="flex items-center gap-1">
							<span class="badge badge-xs badge-error">{agentStats().overloaded}</span>
							<span class="text-base-content/50">overloaded</span>
						</div>
					{/if}
					{#if agentStats().moderate > 0}
						<div class="flex items-center gap-1">
							<span class="badge badge-xs badge-warning">{agentStats().moderate}</span>
							<span class="text-base-content/50">moderate</span>
						</div>
					{/if}
					<div class="flex items-center gap-1">
						<span class="badge badge-xs badge-ghost">{agentStats().idle}</span>
						<span class="text-base-content/50">idle</span>
					</div>
				</div>
				<div class="divider divider-horizontal"></div>
				<div class="text-right">
					<div
						class="text-lg font-bold {systemCapacity().status === 'good' ? 'text-success' : systemCapacity().status === 'moderate' ? 'text-warning' : 'text-error'}"
					>
						{Math.round(systemCapacity().percentage)}%
					</div>
					<div class="text-base-content/50 uppercase text-xs font-medium">
						{systemCapacity().status}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
