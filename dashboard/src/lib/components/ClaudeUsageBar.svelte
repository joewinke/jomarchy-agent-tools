<script lang="ts">
	/**
	 * ClaudeUsageBar Component
	 * Hover-to-expand stats widget displaying Claude API usage metrics
	 *
	 * Features:
	 * - Compact badge showing subscription tier and token limits
	 * - Hover/focus expansion with detailed breakdown
	 * - Real-time metrics from claudeUsageMetrics utility
	 * - System-wide usage stats and top agents
	 * - Graceful degradation for unavailable data
	 * - Auto-refresh polling (30 seconds)
	 * - Sparkline visualization of token usage over time
	 *
	 * Design Pattern: Follows chimaro stats widget hover-to-expand pattern
	 */

	import { slide } from 'svelte/transition';
	import type { ClaudeUsageMetrics } from '$lib/utils/claudeUsageMetrics';
	import { formatTokens, formatCost, getUsageColor } from '$lib/utils/numberFormat';
	import Sparkline from './Sparkline.svelte';

	// Props
	let { mode = 'badge', agentsProp = null } = $props<{
		mode?: 'badge' | 'inline';
		agentsProp?: any[] | null;
	}>();

	// Component state
	let showDetails = $state(false);
	let metrics = $state<ClaudeUsageMetrics | null>(null);
	let agents = $state<any[]>([]);
	let isLoading = $state(true);
	let activeTab = $state<'api-limits' | 'subscription-usage'>('api-limits');

	// Sparkline data (24 hours of hourly token usage)
	let sparklineData = $state<Array<{ timestamp: string; tokens: number; cost: number }>>([]);

	// Fetch tier metrics from API endpoint
	async function loadMetrics() {
		try {
			const response = await fetch('/api/claude/usage');
			if (!response.ok) {
				throw new Error(`Failed to fetch metrics: ${response.statusText}`);
			}
			metrics = await response.json();
		} catch (error) {
			console.error('Error loading Claude usage metrics:', error);
		}
	}

	// Fetch agent usage data for system stats
	async function loadAgentUsage() {
		try {
			const response = await fetch('/api/agents?full=true&usage=true');
			if (!response.ok) {
				throw new Error(`Failed to fetch agent usage: ${response.statusText}`);
			}
			const data = await response.json();
			agents = data.agents || [];
		} catch (error) {
			console.error('Error loading agent usage:', error);
		}
	}

	// Fetch sparkline data (system-wide, no agent filter)
	async function fetchSparklineData() {
		try {
			const response = await fetch('/api/agents/sparkline?range=24h');
			const result = await response.json();

			if (result.error) {
				console.error('Sparkline API error:', result.error);
				sparklineData = [];
				return;
			}

			// Update sparkline data
			sparklineData = result.data || [];
		} catch (error) {
			console.error('Failed to fetch sparkline data:', error);
			sparklineData = [];
		}
	}

	// Polling effect
	$effect(() => {
		// Initial load
		async function initialLoad() {
			isLoading = true;
			await Promise.all([loadMetrics(), loadAgentUsage(), fetchSparklineData()]);
			isLoading = false;
		}
		initialLoad();

		// Poll every 30 seconds
		const interval = setInterval(() => {
			loadMetrics();
			loadAgentUsage();
			fetchSparklineData();
		}, 30_000);

		return () => clearInterval(interval);
	});

	// Reset tab state when panel closes
	$effect(() => {
		if (!showDetails) {
			activeTab = 'api-limits';
		}
	});

	// Calculate system-wide usage statistics
	const systemStats = $derived(() => {
		// Use agentsProp if provided (inline mode), otherwise use fetched agents (badge mode)
		const agentData = agentsProp || agents;

		if (!agentData || agentData.length === 0) {
			return {
				tokensToday: 0,
				costToday: 0,
				tokensWeek: 0,
				costWeek: 0,
				activeAgents: 0
			};
		}

		let tokensToday = 0;
		let costToday = 0;
		let tokensWeek = 0;
		let costWeek = 0;
		let activeAgents = 0;

		agentData.forEach(agent => {
			if (agent.active) {
				activeAgents++;
			}

			if (agent.usage) {
				tokensToday += agent.usage.today?.total_tokens || 0;
				costToday += agent.usage.today?.cost || 0;
				tokensWeek += agent.usage.week?.total_tokens || 0;
				costWeek += agent.usage.week?.cost || 0;
			}
		});

		// For inline mode, show total agent count (like old "X agents online")
		// For badge mode, show only active agents
		const agentCount = mode === 'inline' ? agentData.length : activeAgents;

		return {
			tokensToday,
			costToday,
			tokensWeek,
			costWeek,
			activeAgents: agentCount
		};
	});

	// Calculate top consumers (top 3 agents by token usage today)
	const topConsumers = $derived(() => {
		if (!agents || agents.length === 0) {
			return [];
		}

		return agents
			.filter(agent => agent.usage && agent.usage.today?.total_tokens > 0)
			.sort((a, b) => (b.usage?.today?.total_tokens || 0) - (a.usage?.today?.total_tokens || 0))
			.slice(0, 3)
			.map(agent => ({
				name: agent.name,
				tokens: agent.usage?.today?.total_tokens || 0,
				cost: agent.usage?.today?.cost || 0
			}));
	});

	// Formatting helpers
	function formatNumber(num: number): string {
		if (num >= 1_000_000) {
			return `${(num / 1_000_000).toFixed(1)}M`;
		} else if (num >= 1_000) {
			return `${(num / 1_000).toFixed(0)}K`;
		}
		return num.toString();
	}

	function formatPercentage(used: number, total: number): string {
		if (total === 0) return '0%';
		return `${Math.round((used / total) * 100)}%`;
	}

	// Tab change handler
	function handleTabChange(tab: 'api-limits' | 'subscription-usage') {
		activeTab = tab;
	}

	// Derived values
	const tierColor = $derived(
		metrics?.tier === 'max' ? 'badge-accent' : metrics?.tier === 'build' ? 'badge-primary' : 'badge-secondary'
	);

	// Summary badge text (e.g., "1138M $695 MAX")
	const badgeSummary = $derived(() => {
		// Format tokens without decimals
		const tokensToday = systemStats().tokensToday;
		let tokensStr = '0';
		if (tokensToday >= 1_000_000) {
			tokensStr = `${Math.round(tokensToday / 1_000_000)}M`;
		} else if (tokensToday >= 1_000) {
			tokensStr = `${Math.round(tokensToday / 1_000)}K`;
		} else {
			tokensStr = tokensToday.toString();
		}

		// Format cost without decimals
		const costToday = systemStats().costToday;
		const costStr = `$${Math.round(costToday)}`;

		const tier = metrics?.tier?.toUpperCase() || 'FREE';
		return `${tokensStr} ${costStr} ${tier}`;
	});
</script>

{#if mode === 'badge'}
	<!-- Badge Mode: Hover-to-expand widget (default) -->
	<div
		class="relative inline-flex"
		role="button"
		tabindex="0"
		onmouseenter={() => (showDetails = true)}
		onmouseleave={() => (showDetails = false)}
		onfocus={() => (showDetails = true)}
		onblur={() => (showDetails = false)}
		aria-label="Claude API usage - hover for details"
	>
		{#if metrics && !isLoading && agents.length > 0}
			<!-- Compact Badge (Always Visible) -->
			<button
				class="badge badge-lg gap-2 px-3 py-3 whitespace-nowrap {tierColor} hover:brightness-110 transition-all"
			>
			<!-- API Icon -->
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
					d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z"
				/>
			</svg>

			<!-- Summary: Tokens Cost Tier -->
			<span class="font-mono text-xs font-semibold">
				{badgeSummary()}
			</span>
		</button>
	{/if}

	{#if showDetails && metrics && !isLoading}
		<!-- Expanded Details Panel (Hover State) -->
		<div
			class="absolute right-0 top-0 z-50 bg-base-100 border border-base-200 rounded-lg shadow-xl p-4 min-w-[320px]"
			transition:slide={{ duration: 200 }}
		>
			<!-- Header with Icon and Tier -->
			<div class="flex items-center gap-3 mb-4 pb-3 border-b border-base-200">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="w-6 h-6 text-primary"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z"
					/>
				</svg>
				<div class="flex-1">
					<h3 class="font-bold text-base uppercase">{metrics.tier} Tier</h3>
					<p class="text-xs text-base-content/60">Claude API Usage</p>
				</div>
			</div>

			<!-- Tabs Navigation (folder tabs) -->
			<div role="tablist" class="tabs tabs-lifted">
				<button
					role="tab"
					class="tab {activeTab === 'api-limits' ? 'tab-active' : ''}"
					onclick={() => handleTabChange('api-limits')}
				>
					API Limits
				</button>
				<button
					role="tab"
					class="tab {activeTab === 'subscription-usage' ? 'tab-active' : ''}"
					onclick={() => handleTabChange('subscription-usage')}
				>
					System Usage
				</button>
			</div>

			<!-- Tab Panels -->
			<div class="space-y-3">
				{#if activeTab === 'api-limits'}
					<!-- API Limits Tab -->
					<!-- Rate Limits -->
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="w-4 h-4 text-info"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
								/>
							</svg>
							<span class="text-sm">Tokens/min</span>
						</div>
						<span class="font-mono text-sm font-semibold">
							{formatNumber(metrics.tierLimits.tokensPerMin)}
						</span>
					</div>

					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="w-4 h-4 text-info"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<span class="text-sm">Tokens/day</span>
						</div>
						<span class="font-mono text-sm font-semibold">
							{formatNumber(metrics.tierLimits.tokensPerDay)}
						</span>
					</div>

					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="w-4 h-4 text-success"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3 3m0 0l3-3m-3 3V1.5m6 9h.75a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-.75"
								/>
							</svg>
							<span class="text-sm">Requests/min</span>
						</div>
						<span class="font-mono text-sm font-semibold">
							{formatNumber(metrics.tierLimits.requestsPerMin)}
						</span>
					</div>

					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="w-4 h-4 text-success"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
								/>
							</svg>
							<span class="text-sm">Requests/day</span>
						</div>
						<span class="font-mono text-sm font-semibold">
							{formatNumber(metrics.tierLimits.requestsPerDay)}
						</span>
					</div>

					<!-- Session Context (if available) -->
					{#if metrics.sessionContext}
						<div class="divider divider-start my-2">
							<span class="text-xs text-base-content/60">Real-Time Usage</span>
						</div>

						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
									class="w-4 h-4 text-warning"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								<span class="text-sm">Tokens Remaining</span>
							</div>
							<span class="font-mono text-sm font-semibold text-warning">
								{formatNumber(metrics.sessionContext.inputTokensRemaining)}
							</span>
						</div>

						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
									class="w-4 h-4 text-warning"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3 3m0 0l3-3m-3 3V1.5m6 9h.75a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-.75"
									/>
								</svg>
								<span class="text-sm">Requests Remaining</span>
							</div>
							<span class="font-mono text-sm font-semibold text-warning">
								{metrics.sessionContext.requestsRemaining}
							</span>
						</div>
					{:else}
						<!-- Placeholder when session context unavailable -->
						<div class="divider divider-start my-2">
							<span class="text-xs text-base-content/60">Real-Time Usage</span>
						</div>

						<div class="text-center py-2">
							<span class="text-xs text-base-content/50">
								Session context unavailable<br />
								<span class="text-[10px]">(Requires API integration)</span>
							</span>
						</div>
					{/if}

					<!-- Agent Metrics (if available) -->
					{#if metrics.agentMetrics}
						<div class="divider divider-start my-2">
							<span class="text-xs text-base-content/60">Agent Activity</span>
						</div>

						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
									class="w-4 h-4 text-primary"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
									/>
								</svg>
								<span class="text-sm">Agent Load</span>
							</div>
							<span class="font-mono text-sm font-semibold text-primary">
								{metrics.agentMetrics.loadPercentage.toFixed(0)}%
							</span>
						</div>

						<div class="flex items-center justify-between text-xs text-base-content/60">
							<span>{metrics.agentMetrics.workingAgents} working</span>
							<span>{metrics.agentMetrics.idleAgents} idle</span>
							<span>{metrics.agentMetrics.sleepingAgents} sleeping</span>
						</div>
					{/if}
				{:else if activeTab === 'subscription-usage'}
					<!-- System Usage Tab (Real Data) -->
					<div class="space-y-3">
						<!-- System Stats -->
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
									class="w-4 h-4 text-{getUsageColor(systemStats().tokensToday, 'today')}"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
									/>
								</svg>
								<span class="text-sm">Tokens Today</span>
							</div>
							<span class="font-mono text-sm font-semibold text-{getUsageColor(systemStats().tokensToday, 'today')}">
								{formatTokens(systemStats().tokensToday)}
							</span>
						</div>

						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
									class="w-4 h-4 text-{getUsageColor(systemStats().tokensToday, 'today')}"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								<span class="text-sm">Spend Today</span>
							</div>
							<span class="font-mono text-sm font-semibold text-{getUsageColor(systemStats().tokensToday, 'today')}">
								{formatCost(systemStats().costToday)}
							</span>
						</div>

						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
									class="w-4 h-4 text-primary"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
									/>
								</svg>
								<span class="text-sm">Active Agents</span>
							</div>
							<span class="font-mono text-sm font-semibold text-primary">
								{systemStats().activeAgents}
							</span>
						</div>

						<!-- Token Usage Sparkline -->
						{#if sparklineData.length > 0}
							<div class="divider divider-start my-2">
								<span class="text-xs text-base-content/60">Usage Trend (24h)</span>
							</div>

							<div class="w-full">
								<Sparkline
									data={sparklineData}
									width="100%"
									height={40}
									colorMode="usage"
									showTooltip={true}
									showGrid={false}
								/>
							</div>
						{/if}

						<!-- Top Agents -->
						{#if topConsumers().length > 0}
							<div class="divider divider-start my-2">
								<span class="text-xs text-base-content/60">Top Agents</span>
							</div>

							<div class="space-y-2">
								{#each topConsumers() as consumer, index}
									<div class="flex justify-between items-center text-sm">
										<span class="font-medium">
											{index + 1}. {consumer.name}
										</span>
										<span class="text-{getUsageColor(consumer.tokens, 'today')} font-mono text-xs">
											{formatTokens(consumer.tokens)} · {formatCost(consumer.cost)}
										</span>
									</div>
								{/each}
							</div>
						{:else}
							<div class="divider divider-start my-2">
								<span class="text-xs text-base-content/60">Top Agents</span>
							</div>

							<div class="text-center py-2">
								<span class="text-xs text-base-content/50">No usage data yet</span>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Footer (shown on all tabs) -->
				<div class="divider my-2"></div>
				<div class="text-center text-xs text-base-content/50">
					Last updated: {new Date(metrics.lastUpdated).toLocaleTimeString()}
				</div>
			</div>
		</div>
	{/if}

		{#if isLoading}
			<!-- Loading State -->
			<button class="badge badge-lg badge-ghost gap-2 px-3 py-3">
				<span class="loading loading-spinner loading-xs"></span>
				<span class="text-xs">Loading...</span>
			</button>
		{/if}
	</div>
{:else if mode === 'inline'}
	<!-- Inline Mode: Compact horizontal layout with 3 metrics + sparkline -->
	<div class="flex items-center gap-6 w-full">
		<!-- Left: 3 Metrics Stacked -->
		<div class="flex flex-col gap-1">
			<!-- Tokens Today -->
			<div class="flex items-center gap-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="w-3 h-3 text-{getUsageColor(systemStats().tokensToday, 'today')}"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
					/>
				</svg>
				<span class="text-xs text-base-content/70">Tokens Today</span>
				<span class="text-xs font-mono font-semibold text-{getUsageColor(systemStats().tokensToday, 'today')}">
					{formatTokens(systemStats().tokensToday)}
				</span>
			</div>

			<!-- Spend Today -->
			<div class="flex items-center gap-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="w-3 h-3 text-{getUsageColor(systemStats().tokensToday, 'today')}"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span class="text-xs text-base-content/70">Spend Today</span>
				<span class="text-xs font-mono font-semibold text-{getUsageColor(systemStats().tokensToday, 'today')}">
					{formatCost(systemStats().costToday)}
				</span>
			</div>

			<!-- Active Agents -->
			<div class="flex items-center gap-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="w-3 h-3 text-primary"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
					/>
				</svg>
				<span class="text-xs text-base-content/70">Active Agents</span>
				<span class="text-xs font-mono font-semibold text-primary">
					{systemStats().activeAgents}
				</span>
			</div>
		</div>

		<!-- Right: Sparkline (flexible width to fill space) -->
		{#if sparklineData.length > 0}
			<div class="flex-1 min-w-0 h-12">
				<Sparkline
					data={sparklineData}
					width="100%"
					height={48}
					colorMode="usage"
					showTooltip={false}
					showGrid={false}
				/>
			</div>
		{/if}
	</div>
{/if}
