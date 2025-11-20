<script lang="ts">
	import type { Task } from '$lib/stores/agents.svelte';
	import {
		analyzeDependencies,
		getDependencyBadge,
		getAgentForTask,
		buildDependencyChain
	} from '$lib/utils/dependencyUtils';

	/**
	 * Dependency Indicator Component
	 *
	 * Shows visual indicators for task dependencies:
	 * - 🚫 Red badge if blocked by unresolved tasks
	 * - ⚠️ Yellow badge if blocking other tasks
	 * - Interactive tooltip with dependency chain
	 */
	let { task, allTasks = [], size = 'sm' } = $props();

	let showTooltip = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);

	// Analyze dependencies
	const depStatus = $derived(() => analyzeDependencies(task));
	const badge = $derived(() => getDependencyBadge(depStatus()));
	const dependencyChain = $derived(() => buildDependencyChain(task, allTasks));

	function handleMouseEnter(event: MouseEvent) {
		showTooltip = true;
		updateTooltipPosition(event);
	}

	function handleMouseMove(event: MouseEvent) {
		if (showTooltip) {
			updateTooltipPosition(event);
		}
	}

	function handleMouseLeave() {
		showTooltip = false;
	}

	function updateTooltipPosition(event: MouseEvent) {
		tooltipX = event.clientX;
		tooltipY = event.clientY;
	}
</script>

{#if badge().show}
	<div
		class="inline-block"
		onmouseenter={handleMouseEnter}
		onmousemove={handleMouseMove}
		onmouseleave={handleMouseLeave}
	>
		<span
			class="badge badge-{size} {badge().color} gap-1 cursor-help"
			title={badge().tooltip}
		>
			{badge().text}
		</span>
	</div>

	<!-- Detailed Tooltip -->
	{#if showTooltip}
		<div
			class="fixed z-50 pointer-events-none"
			style="left: {tooltipX + 15}px; top: {tooltipY + 15}px;"
		>
			<div class="bg-base-100 border-2 border-base-300 rounded-lg shadow-xl p-3 max-w-md">
				<div class="space-y-2">
					<!-- Header -->
					<div class="flex items-center gap-2 pb-2 border-b border-base-300">
						<span class="text-lg">{badge().icon}</span>
						<div>
							<div class="text-sm font-semibold text-base-content">
								{depStatus().hasBlockers ? 'Blocked By' : 'Blocking'}
							</div>
							<div class="text-xs text-base-content/70">
								{depStatus().hasBlockers
									? `${depStatus().blockerCount} ${depStatus().blockerCount === 1 ? 'task' : 'tasks'} must be completed first`
									: `${depStatus().blockedCount} ${depStatus().blockedCount === 1 ? 'task is' : 'tasks are'} waiting on this`}
							</div>
						</div>
					</div>

					<!-- Blockers List (if blocked) -->
					{#if depStatus().hasBlockers}
						<div class="space-y-1 max-h-64 overflow-y-auto">
							<div class="text-xs font-medium text-base-content/70 mb-1">
								Must Complete First:
							</div>
							{#each depStatus().unresolvedBlockers as blocker}
								<div
									class="flex items-start justify-between gap-2 text-xs bg-error/10 rounded px-2 py-1.5 border border-error/20"
								>
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-1">
											<span class="badge badge-xs badge-error">P{blocker.priority}</span>
											<span class="font-medium truncate text-base-content/90" title={blocker.title}>
												{blocker.title}
											</span>
										</div>
										<div
											class="text-base-content/50 font-mono text-xs truncate mt-0.5"
											title={blocker.id}
										>
											{blocker.id}
										</div>
										{#if getAgentForTask(blocker.id, allTasks)}
											<div class="text-base-content/60 text-xs mt-0.5">
												Assigned to: <span class="font-medium"
													>{getAgentForTask(blocker.id, allTasks)}</span
												>
											</div>
										{:else}
											<div class="text-warning text-xs mt-0.5">⚠️ Unassigned</div>
										{/if}
									</div>
									<span
										class="badge badge-xs {blocker.status === 'in_progress'
											? 'badge-info'
											: blocker.status === 'blocked'
												? 'badge-error'
												: 'badge-ghost'}"
									>
										{blocker.status}
									</span>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Blocked Tasks List (if blocking) -->
					{#if depStatus().hasBlockedTasks}
						<div class="space-y-1 max-h-64 overflow-y-auto">
							<div class="text-xs font-medium text-base-content/70 mb-1">
								Tasks Waiting:
							</div>
							{#each depStatus().blockedTasks as blocked}
								<div
									class="flex items-start justify-between gap-2 text-xs bg-warning/10 rounded px-2 py-1.5 border border-warning/20"
								>
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-1">
											<span class="badge badge-xs badge-warning">P{blocked.priority}</span>
											<span class="font-medium truncate text-base-content/90" title={blocked.title}>
												{blocked.title}
											</span>
										</div>
										<div
											class="text-base-content/50 font-mono text-xs truncate mt-0.5"
											title={blocked.id}
										>
											{blocked.id}
										</div>
										{#if getAgentForTask(blocked.id, allTasks)}
											<div class="text-base-content/60 text-xs mt-0.5">
												Assigned to: <span class="font-medium"
													>{getAgentForTask(blocked.id, allTasks)}</span
												>
											</div>
										{/if}
									</div>
									<span
										class="badge badge-xs {blocked.status === 'in_progress'
											? 'badge-info'
											: blocked.status === 'blocked'
												? 'badge-error'
												: 'badge-ghost'}"
									>
										{blocked.status}
									</span>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Dependency Chain (if blocked and has chain) -->
					{#if depStatus().hasBlockers && dependencyChain().length > 1}
						<div class="pt-2 border-t border-base-300">
							<div class="text-xs font-medium text-base-content/70 mb-1">
								Full Dependency Chain:
							</div>
							<div class="bg-base-200 rounded p-2 font-mono text-xs text-base-content/80 space-y-0.5">
								<div class="text-primary font-semibold">Current: {task.id}</div>
								{#each dependencyChain() as { level, task: depTask }}
									<div class="pl-{level * 2}">
										{'  '.repeat(level - 1)}{level > 1 ? '↳' : '→'}
										<span
											class="{depTask.status === 'closed'
												? 'text-success'
												: depTask.status === 'in_progress'
													? 'text-info'
													: 'text-error'}"
										>
											{depTask.id}
										</span>
										({depTask.status})
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
{/if}
