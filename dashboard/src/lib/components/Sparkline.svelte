<script lang="ts">
	/**
	 * Sparkline Component
	 *
	 * Lightweight SVG-based sparkline for token usage visualization.
	 * Color-coded based on usage thresholds, with hover tooltips.
	 */

	import { formatTokens, formatCost, getUsageColor } from '$lib/utils/numberFormat.js';

	// ============================================================================
	// Props
	// ============================================================================

	interface DataPoint {
		timestamp: string;
		tokens: number;
		cost: number;
	}

	interface Props {
		/** Time-series data points */
		data: DataPoint[];
		/** Width in pixels or '100%' for responsive (default: '100%') */
		width?: number | string;
		/** Height in pixels (default: 40) */
		height?: number;
		/** Show tooltip on hover (default: true) */
		showTooltip?: boolean;
		/** Show grid lines (default: false) */
		showGrid?: boolean;
		/** Color mode: 'usage' for threshold-based, 'static' for single color (default: 'usage') */
		colorMode?: 'usage' | 'static';
		/** Static color when colorMode='static' */
		staticColor?: string;
		/** Show style toolbar (default: true) */
		showStyleToolbar?: boolean;
	}

	let {
		data,
		width = '100%',
		height = 40,
		showTooltip = true,
		showGrid = false,
		colorMode = 'usage',
		staticColor = 'oklch(var(--p))',
		showStyleToolbar = true
	}: Props = $props();

	// ============================================================================
	// State
	// ============================================================================

	type ChartType = 'line' | 'bars' | 'area' | 'dots';
	let chartType = $state<ChartType>('line');
	let hoveredIndex = $state<number | null>(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let svgElement: SVGSVGElement;

	// ============================================================================
	// Computed Values
	// ============================================================================

	/** SVG viewBox dimensions */
	const viewBoxWidth = 100;
	const viewBoxHeight = 100;
	const padding = 2;

	/** Calculate Y-axis range */
	const yRange = $derived.by(() => {
		if (!data || data.length === 0) {
			return { min: 0, max: 1 };
		}

		const tokens = data.map((d) => d.tokens);
		const min = Math.min(...tokens);
		const max = Math.max(...tokens);

		// Add 10% padding to top and bottom
		const range = max - min;
		const paddedMin = Math.max(0, min - range * 0.1);
		const paddedMax = max + range * 0.1;

		return { min: paddedMin, max: paddedMax };
	});

	/** Scale Y value to SVG coordinates */
	function scaleY(value: number): number {
		if (yRange.max === yRange.min) return viewBoxHeight / 2;

		const normalized = (value - yRange.min) / (yRange.max - yRange.min);
		return viewBoxHeight - padding - normalized * (viewBoxHeight - 2 * padding);
	}

	/** Generate SVG path from data points */
	const pathData = $derived.by(() => {
		if (!data || data.length === 0) return '';

		const points = data.map((point, index) => {
			const x = padding + (index / (data.length - 1 || 1)) * (viewBoxWidth - 2 * padding);
			const y = scaleY(point.tokens);
			return { x, y };
		});

		let path = `M ${points[0].x},${points[0].y}`;

		// Smooth curve using cubic bezier for all themes
		for (let i = 1; i < points.length; i++) {
			const prev = points[i - 1];
			const curr = points[i];
			const cpX1 = prev.x + (curr.x - prev.x) / 3;
			const cpY1 = prev.y;
			const cpX2 = prev.x + (2 * (curr.x - prev.x)) / 3;
			const cpY2 = curr.y;
			path += ` C ${cpX1},${cpY1} ${cpX2},${cpY2} ${curr.x},${curr.y}`;
		}

		return path;
	});

	/** Calculate color for a specific data point based on relative position in range */
	function getColorForValue(tokens: number): string {
		if (colorMode === 'static') {
			return staticColor;
		}

		if (!data || data.length === 0) return '#3b82f6';

		// Use relative thresholds based on actual data range
		const allTokens = data.map((d) => d.tokens);
		const min = Math.min(...allTokens);
		const max = Math.max(...allTokens);
		const range = max - min;

		// Calculate percentile position (0-100)
		const percentile = range > 0 ? ((tokens - min) / range) * 100 : 50;

		// Color gradient based on percentile
		if (percentile < 25) return '#22c55e'; // Green (bottom 25%)
		if (percentile < 50) return '#3b82f6'; // Blue (25-50%)
		if (percentile < 75) return '#f59e0b'; // Orange (50-75%)
		return '#ef4444'; // Red (top 25%)
	}

	/** Calculate line color based on average usage */
	const lineColor = $derived.by(() => {
		if (!data || data.length === 0) return '#3b82f6';
		const avgTokens = data.reduce((sum, d) => sum + d.tokens, 0) / data.length;
		return getColorForValue(avgTokens);
	});

	/** Hovered data point */
	const hoveredPoint = $derived.by(() => {
		if (hoveredIndex === null || !data) return null;
		return data[hoveredIndex];
	});

	// ============================================================================
	// Event Handlers
	// ============================================================================

	/**
	 * Handle mouse move over SVG to show tooltip
	 */
	function handleMouseMove(event: MouseEvent) {
		if (!showTooltip || !data || data.length === 0 || !svgElement) return;

		// Get mouse position relative to SVG
		const rect = svgElement.getBoundingClientRect();
		const mouseX = event.clientX - rect.left;

		// Calculate which data point is closest
		const index = Math.round(((mouseX / rect.width) * (data.length - 1)));
		const clampedIndex = Math.max(0, Math.min(data.length - 1, index));

		hoveredIndex = clampedIndex;
		tooltipX = event.clientX;
		tooltipY = event.clientY;
	}

	/**
	 * Handle mouse leave to hide tooltip
	 */
	function handleMouseLeave() {
		hoveredIndex = null;
	}

	/**
	 * Format timestamp for tooltip
	 */
	function formatTimestamp(timestamp: string): string {
		if (!timestamp) return 'No timestamp';

		const date = new Date(timestamp);

		// Check if date is valid
		if (isNaN(date.getTime())) {
			return 'Invalid date';
		}

		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}
</script>

<div class="sparkline-container" style="width: {typeof width === 'number' ? width + 'px' : width};">
	<!-- Chart Type Toolbar -->
	{#if showStyleToolbar}
		<div class="sparkline-toolbar">
			<button
				class="btn btn-xs {chartType === 'line' ? 'btn-primary' : 'btn-ghost'}"
				onclick={() => (chartType = 'line')}
				title="Line chart"
			>
				<svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M2 12 L5 8 L8 10 L14 4" stroke-linecap="round" />
				</svg>
			</button>
			<button
				class="btn btn-xs {chartType === 'bars' ? 'btn-primary' : 'btn-ghost'}"
				onclick={() => (chartType = 'bars')}
				title="Bar chart (equalizer style)"
			>
				<svg class="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
					<rect x="1" y="8" width="2" height="6" />
					<rect x="4" y="4" width="2" height="10" />
					<rect x="7" y="6" width="2" height="8" />
					<rect x="10" y="2" width="2" height="12" />
					<rect x="13" y="5" width="2" height="9" />
				</svg>
			</button>
			<button
				class="btn btn-xs {chartType === 'area' ? 'btn-primary' : 'btn-ghost'}"
				onclick={() => (chartType = 'area')}
				title="Area chart (filled)"
			>
				<svg class="w-3 h-3" viewBox="0 0 16 16" fill="currentColor" opacity="0.6">
					<path d="M2 14 L2 12 L5 8 L8 10 L14 4 L14 14 Z" />
				</svg>
			</button>
			<button
				class="btn btn-xs {chartType === 'dots' ? 'btn-primary' : 'btn-ghost'}"
				onclick={() => (chartType = 'dots')}
				title="Dot plot"
			>
				<svg class="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
					<circle cx="2" cy="12" r="1.5" />
					<circle cx="5" cy="8" r="1.5" />
					<circle cx="8" cy="10" r="1.5" />
					<circle cx="11" cy="6" r="1.5" />
					<circle cx="14" cy="4" r="1.5" />
				</svg>
			</button>
		</div>
	{/if}

	<svg
		bind:this={svgElement}
		viewBox="0 0 {viewBoxWidth} {viewBoxHeight}"
		preserveAspectRatio="none"
		style="height: {height}px; width: 100%; border-radius: 0.375rem;"
		onmousemove={handleMouseMove}
		onmouseleave={handleMouseLeave}
		role="img"
		aria-label="Token usage sparkline"
	>
		<!-- Optional grid lines -->
		{#if showGrid}
			<line
				x1={padding}
				y1={viewBoxHeight / 2}
				x2={viewBoxWidth - padding}
				y2={viewBoxHeight / 2}
				stroke="oklch(var(--bc) / 0.1)"
				stroke-width="0.5"
			/>
		{/if}

		<!-- Chart rendering -->
		{#if data && data.length > 0}
			{#if chartType === 'line'}
				<!-- Line chart (smooth curve) -->
				<path
					d={pathData}
					fill="none"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					style="stroke: {lineColor}; transition: stroke 0.3s ease, d 0.3s ease;"
				/>
			{:else if chartType === 'bars'}
				<!-- Bar chart (equalizer style) -->
				{#each data as point, index}
					{@const x = padding + (index / (data.length - 1 || 1)) * (viewBoxWidth - 2 * padding)}
					{@const y = scaleY(point.tokens)}
					{@const barWidth = (viewBoxWidth - 2 * padding) / data.length * 0.8}
					{@const barHeight = viewBoxHeight - padding - y}
					{@const color = getColorForValue(point.tokens)}
					<rect
						x={x - barWidth / 2}
						y={y}
						width={barWidth}
						height={barHeight}
						fill={color}
						opacity="0.9"
						rx="0.5"
						style="transition: fill 0.3s ease, height 0.3s ease;"
					/>
				{/each}
			{:else if chartType === 'area'}
				<!-- Area chart (filled) -->
				{@const points = data.map((point, index) => ({
					x: padding + (index / (data.length - 1 || 1)) * (viewBoxWidth - 2 * padding),
					y: scaleY(point.tokens)
				}))}
				{@const areaPath = `M ${points[0].x},${viewBoxHeight - padding} L ${points[0].x},${points[0].y} ${points.map(p => `L ${p.x},${p.y}`).join(' ')} L ${points[points.length - 1].x},${viewBoxHeight - padding} Z`}
				<path
					d={areaPath}
					fill={lineColor}
					fill-opacity="0.3"
					stroke={lineColor}
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					style="transition: fill 0.3s ease, stroke 0.3s ease, d 0.3s ease;"
				/>
			{:else if chartType === 'dots'}
				<!-- Dot plot (crisp dots only) -->
				{#each data as point, index}
					{@const x = padding + (index / (data.length - 1 || 1)) * (viewBoxWidth - 2 * padding)}
					{@const y = scaleY(point.tokens)}
					{@const color = getColorForValue(point.tokens)}
					<circle
						cx={x}
						cy={y}
						r="1.5"
						fill={color}
						opacity="1"
						style="transition: fill 0.3s ease, cy 0.3s ease;"
					/>
				{/each}
			{/if}

			<!-- Hover indicator -->
			{#if hoveredIndex !== null}
				{@const point = data[hoveredIndex]}
				{@const x = padding + (hoveredIndex / (data.length - 1 || 1)) * (viewBoxWidth - 2 * padding)}
				{@const y = scaleY(point.tokens)}

				<circle cx={x} cy={y} r="2" fill={lineColor} stroke="white" stroke-width="1" />
			{/if}
		{/if}
	</svg>

	<!-- Tooltip -->
	{#if showTooltip && hoveredPoint}
		<div
			class="sparkline-tooltip"
			style="left: {tooltipX}px; top: {tooltipY - 10}px;"
			role="tooltip"
		>
			<div class="text-xs font-medium">{formatTimestamp(hoveredPoint.timestamp)}</div>
			<div class="text-xs">
				{formatTokens(hoveredPoint.tokens)} tokens
			</div>
			<div class="text-xs font-semibold">{formatCost(hoveredPoint.cost)}</div>
		</div>
	{/if}
</div>

<style>
	.sparkline-container {
		position: relative;
		display: inline-block;
	}

	.sparkline-toolbar {
		display: flex;
		justify-content: flex-end;
		gap: 0.25rem;
		margin-bottom: 0.25rem;
		padding: 0.25rem;
		opacity: 0.7;
		transition: opacity 0.2s ease;
	}

	.sparkline-toolbar:hover {
		opacity: 1;
	}

	svg {
		display: block;
		cursor: crosshair;
	}

	.sparkline-tooltip {
		position: fixed;
		background: oklch(var(--b1));
		border: 1px solid oklch(var(--bc) / 0.2);
		border-radius: 0.375rem;
		padding: 0.5rem;
		pointer-events: none;
		z-index: 1000;
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
		transform: translate(-50%, -100%);
		white-space: nowrap;
	}

	.sparkline-tooltip::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		border: 6px solid transparent;
		border-top-color: oklch(var(--b1));
	}
</style>
