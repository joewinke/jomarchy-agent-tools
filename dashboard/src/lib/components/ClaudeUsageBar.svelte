<script lang="ts">
	/**
	 * ClaudeUsageBar Component
	 * Hover-to-expand stats widget displaying Claude API usage metrics
	 *
	 * Features:
	 * - Compact badge showing subscription tier and token limits
	 * - Hover/focus expansion with detailed breakdown
	 * - Real-time metrics from claudeUsageMetrics utility
	 * - Graceful degradation for unavailable data
	 * - Auto-refresh polling (30 seconds)
	 *
	 * Design Pattern: Follows chimaro stats widget hover-to-expand pattern
	 */

	import { slide } from 'svelte/transition';
	import type { ClaudeUsageMetrics } from '$lib/utils/claudeUsageMetrics';

	// Component state
	let showDetails = $state(false);
	let metrics = $state<ClaudeUsageMetrics | null>(null);
	let isLoading = $state(true);
	let activeTab = $state<'api-limits' | 'subscription-usage'>('api-limits');

	// Fetch metrics from API endpoint (server-side)
	async function loadMetrics() {
		try {
			isLoading = true;
			const response = await fetch('/api/claude/usage');
			if (!response.ok) {
				throw new Error(`Failed to fetch metrics: ${response.statusText}`);
			}
			metrics = await response.json();
		} catch (error) {
			console.error('Error loading Claude usage metrics:', error);
		} finally {
			isLoading = false;
		}
	}

	// Polling effect
	$effect(() => {
		// Initial load
		loadMetrics();

		// Poll every 30 seconds
		const interval = setInterval(loadMetrics, 30_000);

		return () => clearInterval(interval);
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
</script>

<div
	class="absolute right-0 inline-flex"
	role="button"
	tabindex="0"
	onmouseenter={() => (showDetails = true)}
	onmouseleave={() => (showDetails = false)}
	onfocus={() => (showDetails = true)}
	onblur={() => (showDetails = false)}
	aria-label="Claude API usage - hover for details"
>
	{#if !showDetails && metrics && !isLoading}
		<!-- Compact Badge (Default State) -->
		<button
			class="badge badge-lg gap-2 px-3 py-3 {tierColor} hover:brightness-110 transition-all"
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

			<!-- Tier Display -->
			<span class="font-mono font-semibold uppercase">{metrics.tier}</span>

			<!-- Token Limit -->
			<span class="text-xs opacity-70">
				{formatNumber(metrics.tierLimits.tokensPerMin)}/min
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
					<!-- Subscription Usage Tab (Placeholder) -->
					<div class="text-center py-4">
						<span class="text-xs text-base-content/50">
							Subscription usage tracking coming soon...
						</span>
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
