<script lang="ts">
	/**
	 * ClaudeUsageBar Component
	 * Fixed-bottom status bar displaying Claude API usage metrics and agent coordination
	 *
	 * Features:
	 * - Weekly quota tracking with color-coded thresholds
	 * - Cost monitoring (daily and weekly trends)
	 * - Agent status overview ([X working] [Y idle] [Z offline])
	 * - Real-time session context (rate limits)
	 * - Responsive tooltips with detailed breakdowns
	 * - Auto-refresh polling (configurable intervals)
	 */

	import { onMount } from 'svelte';

	// ===== Props =====
	interface SessionContext {
		requestsUsed: number;
		requestsLimit: number;
		tokensUsed: number;
		tokensLimit: number;
		requestsReset?: Date;
		tokensReset?: Date;
	}

	interface WeeklyQuotaData {
		tokensUsed: number;
		tokensLimit: number;
		costUsd: number;
		costLimit: number;
		periodStart: Date;
		periodEnd: Date;
		estimatedEndOfWeekCost?: number;
	}

	interface AgentStats {
		total: number;
		working: number;
		idle: number;
		offline: number;
		lastUpdate: Date;
	}

	// Default props
	const defaultSessionContext: SessionContext = {
		requestsUsed: 0,
		requestsLimit: 100,
		tokensUsed: 0,
		tokensLimit: 100000
	};

	const defaultWeeklyQuota: WeeklyQuotaData = {
		tokensUsed: 0,
		tokensLimit: 1000000,
		costUsd: 0,
		costLimit: 100,
		periodStart: new Date(),
		periodEnd: new Date()
	};

	const defaultAgentStats: AgentStats = {
		total: 0,
		working: 0,
		idle: 0,
		offline: 0,
		lastUpdate: new Date()
	};

	// Component state
	let sessionContext = $state<SessionContext>(defaultSessionContext);
	let weeklyQuota = $state<WeeklyQuotaData>(defaultWeeklyQuota);
	let agentStats = $state<AgentStats>(defaultAgentStats);

	// ===== Derived Values =====
	const weeklyPercentage = $derived(
		weeklyQuota.tokensLimit > 0 ? (weeklyQuota.tokensUsed / weeklyQuota.tokensLimit) * 100 : 0
	);

	const costPercentage = $derived(
		weeklyQuota.costLimit > 0 ? (weeklyQuota.costUsd / weeklyQuota.costLimit) * 100 : 0
	);

	const dailyAvgCost = $derived(weeklyQuota.costUsd / 7);

	const dailyAvgTokens = $derived(Math.floor(weeklyQuota.tokensUsed / 7));

	const estimatedWeeklyTotal = $derived(dailyAvgCost * 7);

	const sessionRequestsPercentage = $derived(
		sessionContext.requestsLimit > 0
			? (sessionContext.requestsUsed / sessionContext.requestsLimit) * 100
			: 0
	);

	const sessionTokensPercentage = $derived(
		sessionContext.tokensLimit > 0
			? (sessionContext.tokensUsed / sessionContext.tokensLimit) * 100
			: 0
	);

	// ===== Color Threshold Logic =====
	function getQuotaColor(percentage: number): string {
		if (percentage < 60) return 'bg-success';
		if (percentage < 80) return 'bg-warning';
		if (percentage < 95) return 'bg-orange-500';
		return 'bg-error';
	}

	function getCostColor(percentage: number): string {
		if (percentage < 50) return 'text-success';
		if (percentage < 80) return 'text-warning';
		return 'text-error';
	}

	const quotaColor = $derived(getQuotaColor(weeklyPercentage));
	const costColor = $derived(getCostColor(costPercentage));

	// ===== Formatting Helpers =====
	function formatNumber(num: number): string {
		if (num >= 1000000) {
			return `${(num / 1000000).toFixed(1)}M`;
		} else if (num >= 1000) {
			return `${(num / 1000).toFixed(0)}K`;
		}
		return num.toString();
	}

	function formatDate(date: Date): string {
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function formatTimeRemaining(resetDate?: Date): string {
		if (!resetDate) return 'unknown';
		const now = new Date();
		const diff = resetDate.getTime() - now.getTime();
		if (diff <= 0) return 'resetting...';

		const seconds = Math.floor(diff / 1000);
		if (seconds < 60) return `${seconds}s`;

		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m`;

		const hours = Math.floor(minutes / 60);
		return `${hours}h`;
	}

	// ===== Tooltip Content Builders =====
	function buildWeeklyQuotaTooltip(): string {
		return `Period: ${formatDate(weeklyQuota.periodStart)} - ${formatDate(weeklyQuota.periodEnd)}

Usage:
• Tokens: ${formatNumber(weeklyQuota.tokensUsed)} / ${formatNumber(weeklyQuota.tokensLimit)} (${weeklyPercentage.toFixed(1)}%)
• Cost: $${weeklyQuota.costUsd.toFixed(2)} / $${weeklyQuota.costLimit} (${costPercentage.toFixed(1)}%)

Daily Average:
• Tokens: ${formatNumber(dailyAvgTokens)} per day
• Cost: $${dailyAvgCost.toFixed(2)} per day

Projected End-of-Week:
• Total cost: $${estimatedWeeklyTotal.toFixed(2)}

Session Context (last 1 min):
• Requests: ${sessionContext.requestsUsed} / ${sessionContext.requestsLimit} (${sessionRequestsPercentage.toFixed(0)}%)
• Tokens: ${formatNumber(sessionContext.tokensUsed)} / ${formatNumber(sessionContext.tokensLimit)} (${sessionTokensPercentage.toFixed(0)}%)
• Resets in: ${formatTimeRemaining(sessionContext.tokensReset)}`;
	}

	function buildCostTooltip(): string {
		return `Weekly Total: $${weeklyQuota.costUsd.toFixed(2)} / $${weeklyQuota.costLimit} (${costPercentage.toFixed(1)}%)

Daily Trend:
• Today: $${dailyAvgCost.toFixed(2)}
• Avg: $${dailyAvgCost.toFixed(2)} per day

Estimated weekly cost: $${estimatedWeeklyTotal.toFixed(2)}

Note: Detailed per-model breakdown coming soon`;
	}

	function buildAgentTooltip(): string {
		const lines = [`Total Agents: ${agentStats.total}`, ''];

		if (agentStats.working > 0) {
			lines.push(`Working (${agentStats.working}):`);
			lines.push('• Agent details coming soon');
			lines.push('');
		}

		if (agentStats.idle > 0) {
			lines.push(`Idle (${agentStats.idle}):`);
			lines.push('• Agent details coming soon');
			lines.push('');
		}

		if (agentStats.offline > 0) {
			lines.push(`Offline (${agentStats.offline}):`);
			lines.push('• Agent details coming soon');
			lines.push('');
		}

		const updateTime = new Date(agentStats.lastUpdate);
		const minutesAgo = Math.floor((Date.now() - updateTime.getTime()) / 60000);
		lines.push(`Last updated: ${minutesAgo === 0 ? 'just now' : `${minutesAgo} min ago`}`);

		return lines.join('\n');
	}

	// ===== Data Fetching =====
	async function fetchWeeklyQuota() {
		try {
			const response = await fetch('/api/claude/weekly-quota');
			if (!response.ok) {
				console.error('Failed to fetch weekly quota:', response.statusText);
				return;
			}
			const data = await response.json();
			weeklyQuota = {
				...defaultWeeklyQuota,
				...data,
				periodStart: new Date(data.periodStart),
				periodEnd: new Date(data.periodEnd)
			};
		} catch (error) {
			console.error('Error fetching weekly quota:', error);
		}
	}

	async function fetchAgentStats() {
		try {
			const response = await fetch('/api/agents/stats');
			if (!response.ok) {
				console.error('Failed to fetch agent stats:', response.statusText);
				return;
			}
			const data = await response.json();
			agentStats = {
				...defaultAgentStats,
				...data,
				lastUpdate: new Date(data.lastUpdate || Date.now())
			};
		} catch (error) {
			console.error('Error fetching agent stats:', error);
		}
	}

	// Update session context from global store or API
	function updateSessionContext(context: Partial<SessionContext>) {
		sessionContext = {
			...sessionContext,
			...context,
			requestsReset: context.requestsReset ? new Date(context.requestsReset) : undefined,
			tokensReset: context.tokensReset ? new Date(context.tokensReset) : undefined
		};
	}

	// ===== Polling Effects =====
	$effect(() => {
		// Initial fetch
		fetchWeeklyQuota();
		fetchAgentStats();

		// Poll weekly quota every 5 minutes
		const weeklyInterval = setInterval(fetchWeeklyQuota, 5 * 60 * 1000);

		// Poll agent stats every 30 seconds
		const agentInterval = setInterval(fetchAgentStats, 30 * 1000);

		return () => {
			clearInterval(weeklyInterval);
			clearInterval(agentInterval);
		};
	});
</script>

<!-- Fixed Bottom Bar -->
<div
	class="fixed bottom-0 left-0 right-0 z-50 h-12 bg-base-100 border-t border-base-300 px-4 py-2"
>
	<div class="flex items-center justify-between gap-4 max-w-full">
		<!-- Section 1: Weekly Quota (35% width) -->
		<div
			class="flex-1 flex items-center gap-2 min-w-0 tooltip tooltip-top"
			title={buildWeeklyQuotaTooltip()}
			data-tip={buildWeeklyQuotaTooltip()}
		>
			<div class="flex flex-col gap-1 min-w-0 flex-1">
				<div class="flex items-center justify-between gap-2">
					<span class="text-xs font-medium text-base-content/70 hidden sm:inline"
						>Weekly Quota</span
					>
					<span class="text-xs font-mono {quotaColor.replace('bg-', 'text-')}"
						>{weeklyPercentage.toFixed(0)}%</span
					>
				</div>
				<div class="flex-1 h-2 bg-base-300 rounded-full overflow-hidden">
					<div
						class="h-full {quotaColor} transition-all duration-300"
						style="width: {weeklyPercentage}%"
					></div>
				</div>
				<span class="text-xs text-base-content/50 hidden md:inline">
					{formatNumber(weeklyQuota.tokensUsed)} / {formatNumber(weeklyQuota.tokensLimit)} tokens
				</span>
			</div>
		</div>

		<!-- Section 2: Cost Tracking (30% width) -->
		<div
			class="flex flex-col gap-1 min-w-0 tooltip tooltip-top"
			title={buildCostTooltip()}
			data-tip={buildCostTooltip()}
		>
			<div class="flex items-center gap-2">
				<span class="text-xs font-medium text-base-content/70 hidden sm:inline">Cost</span>
				<span class="text-xs font-mono {costColor}">
					${weeklyQuota.costUsd.toFixed(2)} / ${weeklyQuota.costLimit}
				</span>
			</div>
			<span class="text-xs text-base-content/50 hidden md:inline">
				Daily: ${dailyAvgCost.toFixed(2)}
			</span>
		</div>

		<!-- Section 3: Session Stats (15% width) - Hidden on mobile -->
		<div class="hidden lg:flex flex-col gap-1 min-w-0">
			<span class="text-xs text-base-content/50">
				Session: {formatNumber(sessionContext.tokensUsed)} / {formatNumber(
					sessionContext.tokensLimit
				)}
			</span>
			<span class="text-xs text-base-content/50">
				Resets: {formatTimeRemaining(sessionContext.tokensReset)}
			</span>
		</div>

		<!-- Section 4: Agent Status (20% width) -->
		<div
			class="flex items-center gap-1 tooltip tooltip-top"
			title={buildAgentTooltip()}
			data-tip={buildAgentTooltip()}
		>
			<span class="text-xs font-medium text-base-content/70 hidden sm:inline mr-1">Agents</span>
			<div class="flex gap-1">
				{#if agentStats.working > 0}
					<span class="badge badge-xs badge-primary">{agentStats.working} working</span>
				{/if}
				{#if agentStats.idle > 0}
					<span class="badge badge-xs badge-ghost">{agentStats.idle} idle</span>
				{/if}
				{#if agentStats.offline > 0}
					<span class="badge badge-xs badge-error badge-outline">{agentStats.offline} offline</span
					>
				{/if}
			</div>
		</div>
	</div>
</div>
