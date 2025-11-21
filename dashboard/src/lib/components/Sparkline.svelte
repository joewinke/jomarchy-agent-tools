<script lang="ts">
	/**
	 * Sparkline Component
	 *
	 * Lightweight SVG-based sparkline for token usage visualization.
	 * Features hover-to-expand controls for chart type, time range, and display options.
	 * Color-coded based on usage thresholds with configurable defaults.
	 *
	 * @example
	 * ```svelte
	 * <Sparkline
	 *   data={sparklineData}
	 *   height={40}
	 *   defaultTimeRange="24h"
	 *   defaultColorMode="usage"
	 *   showStyleToolbar={true}
	 * />
	 * ```
	 */

	import { formatTokens, formatCost, getUsageColor } from '$lib/utils/numberFormat.js';
	import { slide } from 'svelte/transition';

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
		/** Show style toolbar (default: true) - DEPRECATED: use showStyleToolbar for backward compatibility */
		showStyleToolbar?: boolean;
		/** Default time range for initial display (default: '24h') */
		defaultTimeRange?: '1h' | '24h' | '7d' | '30d' | 'all';
		/** Default color mode for initial display (default: 'usage') */
		defaultColorMode?: 'usage' | 'static';
	}

	let {
		data,
		width = '100%',
		height = 40,
		showTooltip = true,
		showGrid = false,
		colorMode = 'usage',
		staticColor = 'hsl(var(--p))',
		showStyleToolbar = true,
		defaultTimeRange = '24h',
		defaultColorMode = 'usage'
	}: Props = $props();

	// ============================================================================
	// State
	// ============================================================================

	type ChartType = 'line' | 'bars' | 'area' | 'dots';
	type TimeRange = '1h' | '24h' | '7d' | '30d' | 'all' | 'custom';
	let chartType = $state<ChartType>('line');
	let timeRange = $state<TimeRange>(defaultTimeRange); // Initialize from prop
	let hoveredIndex = $state<number | null>(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let svgElement: SVGSVGElement;
	let showControls = $state(false); // Hover-to-expand control panel
	let customDateFrom = $state<string>(''); // Custom date range start (YYYY-MM-DD)
	let customDateTo = $state<string>(''); // Custom date range end (YYYY-MM-DD)
	let showCustomDatePicker = $state(false); // Show custom date inputs

	// Options toggles
	let internalShowGrid = $state(false); // Internal grid toggle state (starts off, user can toggle)
	let smoothCurves = $state(true); // Enable bezier curve smoothing
	let internalColorMode = $state<'usage' | 'static'>(defaultColorMode); // Initialize from prop

	// ============================================================================
	// Computed Values
	// ============================================================================

	/** SVG viewBox dimensions */
	const viewBoxWidth = 100;
	const viewBoxHeight = 100;
	const padding = 2;

	/** Filter data based on selected time range */
	const filteredData = $derived.by(() => {
		if (!data || data.length === 0) return [];

		const now = new Date();
		let cutoffTime: Date;

		switch (timeRange) {
			case '1h':
				cutoffTime = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
				break;
			case '24h':
				cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
				break;
			case '7d':
				cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
				break;
			case '30d':
				cutoffTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
				break;
			case 'all':
				return data; // Return all data
			case 'custom':
				// Custom date range filtering
				if (!customDateFrom && !customDateTo) {
					// No custom dates set, show all data
					return data;
				}

				const fromDate = customDateFrom ? new Date(customDateFrom) : new Date(0); // Start of epoch if not set
				const toDate = customDateTo ? new Date(customDateTo) : now; // Current time if not set

				// Add one day to toDate to include the entire end date
				toDate.setHours(23, 59, 59, 999);

				return data.filter((point) => {
					const pointDate = new Date(point.timestamp);
					return pointDate >= fromDate && pointDate <= toDate;
				});
			default:
				cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default to 24h
		}

		// Filter data points after the cutoff time
		return data.filter((point) => new Date(point.timestamp) >= cutoffTime);
	});

	/** Calculate Y-axis range */
	const yRange = $derived.by(() => {
		if (!filteredData || filteredData.length === 0) {
			return { min: 0, max: 1 };
		}

		const tokens = filteredData.map((d) => d.tokens);
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
		if (!filteredData || filteredData.length === 0) return '';

		const points = filteredData.map((point, index) => {
			const x = padding + (index / (filteredData.length - 1 || 1)) * (viewBoxWidth - 2 * padding);
			const y = scaleY(point.tokens);
			return { x, y };
		});

		let path = `M ${points[0].x},${points[0].y}`;

		if (smoothCurves) {
			// Smooth curve using cubic bezier
			for (let i = 1; i < points.length; i++) {
				const prev = points[i - 1];
				const curr = points[i];
				const cpX1 = prev.x + (curr.x - prev.x) / 3;
				const cpY1 = prev.y;
				const cpX2 = prev.x + (2 * (curr.x - prev.x)) / 3;
				const cpY2 = curr.y;
				path += ` C ${cpX1},${cpY1} ${cpX2},${cpY2} ${curr.x},${curr.y}`;
			}
		} else {
			// Straight lines
			for (let i = 1; i < points.length; i++) {
				path += ` L ${points[i].x},${points[i].y}`;
			}
		}

		return path;
	});

	/** Calculate color for a specific data point based on relative position in range */
	function getColorForValue(tokens: number): string {
		if (internalColorMode === 'static') {
			return staticColor;
		}

		if (!filteredData || filteredData.length === 0) return 'hsl(var(--p))'; // Primary color

		// Use relative thresholds based on actual data range
		const allTokens = filteredData.map((d) => d.tokens);
		const min = Math.min(...allTokens);
		const max = Math.max(...allTokens);
		const range = max - min;

		// Calculate percentile position (0-100)
		const percentile = range > 0 ? ((tokens - min) / range) * 100 : 50;

		// Theme-based color gradient using DaisyUI color classes
		if (percentile < 25) return 'hsl(var(--su))'; // Success (green) - bottom 25%
		if (percentile < 50) return 'hsl(var(--in))'; // Info (blue) - 25-50%
		if (percentile < 75) return 'hsl(var(--wa))'; // Warning (orange) - 50-75%
		return 'hsl(var(--er))'; // Error (red) - top 25%
	}

	/** Calculate line color based on average usage */
	const lineColor = $derived.by(() => {
		if (!filteredData || filteredData.length === 0) return 'hsl(var(--p))'; // Primary color
		const avgTokens = filteredData.reduce((sum, d) => sum + d.tokens, 0) / filteredData.length;
		return getColorForValue(avgTokens);
	});

	/** Hovered data point */
	const hoveredPoint = $derived.by(() => {
		if (hoveredIndex === null || !filteredData) return null;
		return filteredData[hoveredIndex];
	});

	/** Time range label for badge based on selected timeRange */
	const timeRangeLabel = $derived(() => {
		switch (timeRange) {
			case '1h':
				return '1hr';
			case '24h':
				return '24hr';
			case '7d':
				return '7d';
			case '30d':
				return '30d';
			case 'all':
				return 'All';
			case 'custom':
				// Show abbreviated custom range if both dates are set
				if (customDateFrom && customDateTo) {
					const from = new Date(customDateFrom);
					const to = new Date(customDateTo);
					return `${from.getMonth() + 1}/${from.getDate()} - ${to.getMonth() + 1}/${to.getDate()}`;
				}
				return 'Custom';
			default:
				return '24hr';
		}
	});

	/** Chart icon SVG path for badge */
	const chartIconPath = $derived(() => {
		switch (chartType) {
			case 'line':
				return 'M2 12 L5 8 L8 10 L14 4';
			case 'bars':
				return 'M2 14v-4h2v4zm4 0V8h2v6zm4 0V10h2v4zm4 0V6h2v8z';
			case 'area':
				return 'M2 14 L2 12 L5 8 L8 10 L14 4 L14 14 Z';
			case 'dots':
				return 'M2 12h.01M5 8h.01M8 10h.01M11 6h.01M14 4h.01';
			default:
				return 'M2 12 L5 8 L8 10 L14 4';
		}
	});

	// ============================================================================
	// Event Handlers
	// ============================================================================

	/**
	 * Handle mouse move over SVG to show tooltip
	 */
	function handleMouseMove(event: MouseEvent) {
		if (!showTooltip || !filteredData || filteredData.length === 0 || !svgElement) return;

		// Get mouse position relative to SVG
		const rect = svgElement.getBoundingClientRect();
		const mouseX = event.clientX - rect.left;

		// Calculate which data point is closest
		const index = Math.round(((mouseX / rect.width) * (filteredData.length - 1)));
		const clampedIndex = Math.max(0, Math.min(filteredData.length - 1, index));

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

	/**
	 * Handle custom date range button click
	 */
	function handleCustomRangeClick() {
		if (timeRange === 'custom') {
			// If already in custom mode, toggle the date picker visibility
			showCustomDatePicker = !showCustomDatePicker;
		} else {
			// Switch to custom mode and show date picker
			timeRange = 'custom';
			showCustomDatePicker = true;
		}
	}

	/**
	 * Apply custom date range (validates and updates timeRange)
	 */
	function applyCustomRange() {
		if (!customDateFrom || !customDateTo) {
			// Invalid: need both dates
			return;
		}

		const from = new Date(customDateFrom);
		const to = new Date(customDateTo);

		if (from > to) {
			// Invalid: from date must be before to date
			// Swap them automatically
			[customDateFrom, customDateTo] = [customDateTo, customDateFrom];
		}

		// Close date picker after applying
		showCustomDatePicker = false;
	}
</script>

<div
	class="sparkline-container"
	style="width: {typeof width === 'number' ? width + 'px' : width};"
	onmouseenter={() => showStyleToolbar && (showControls = true)}
	onmouseleave={() => (showControls = false)}
	role="group"
	aria-label="Interactive sparkline chart"
>
	<!-- Expanded Controls Panel (Hover State) -->
	{#if showStyleToolbar && showControls}
		<div
			class="sparkline-controls-panel"
			transition:slide={{ duration: 200 }}
		>
			<div class="p-2 bg-base-200 rounded-lg shadow-lg border border-base-300 space-y-3">
				<!-- Chart Type Section -->
				<div>
					<div class="text-xs font-semibold mb-1.5 text-base-content/70">Chart Type</div>
					<div class="flex items-center gap-1">
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
							title="Bar chart"
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
							title="Area chart"
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
				</div>

				<!-- Time Range Section -->
				<div>
					<div class="text-xs font-semibold mb-1.5 text-base-content/70">Time Range</div>
					<div class="flex items-center gap-1 flex-wrap">
						<button
							class="btn btn-xs {timeRange === '1h' ? 'btn-primary' : 'btn-ghost'}"
							onclick={() => {
								timeRange = '1h';
								showCustomDatePicker = false;
							}}
							title="Last 1 hour"
						>
							1hr
						</button>
						<button
							class="btn btn-xs {timeRange === '24h' ? 'btn-primary' : 'btn-ghost'}"
							onclick={() => {
								timeRange = '24h';
								showCustomDatePicker = false;
							}}
							title="Last 24 hours"
						>
							24hr
						</button>
						<button
							class="btn btn-xs {timeRange === '7d' ? 'btn-primary' : 'btn-ghost'}"
							onclick={() => {
								timeRange = '7d';
								showCustomDatePicker = false;
							}}
							title="Last 7 days"
						>
							7d
						</button>
						<button
							class="btn btn-xs {timeRange === '30d' ? 'btn-primary' : 'btn-ghost'}"
							onclick={() => {
								timeRange = '30d';
								showCustomDatePicker = false;
							}}
							title="Last 30 days"
						>
							30d
						</button>
						<button
							class="btn btn-xs {timeRange === 'all' ? 'btn-primary' : 'btn-ghost'}"
							onclick={() => {
								timeRange = 'all';
								showCustomDatePicker = false;
							}}
							title="All time"
						>
							All
						</button>
						<button
									class="btn btn-xs {timeRange === 'custom' ? 'btn-primary' : 'btn-ghost'}"
									onclick={handleCustomRangeClick}
									title="Custom date range"
								>
									Custom
								</button>
							</div>

							<!-- Custom Date Range Picker -->
							{#if showCustomDatePicker}
								<div class="mt-2 p-2 bg-base-100 rounded-md border border-base-300 space-y-2" transition:slide={{ duration: 150 }}>
									<div class="grid grid-cols-2 gap-2">
										<!-- From Date -->
										<div class="form-control">
											<label class="label py-0">
												<span class="label-text text-xs">From</span>
											</label>
											<input
												type="date"
												class="input input-xs input-bordered w-full"
												bind:value={customDateFrom}
												placeholder="Start date"
											/>
										</div>

										<!-- To Date -->
										<div class="form-control">
											<label class="label py-0">
												<span class="label-text text-xs">To</span>
											</label>
											<input
												type="date"
												class="input input-xs input-bordered w-full"
												bind:value={customDateTo}
												placeholder="End date"
											/>
										</div>
									</div>

									<!-- Apply Button -->
									<button
										class="btn btn-xs btn-primary w-full"
										onclick={applyCustomRange}
										disabled={!customDateFrom || !customDateTo}
									>
										Apply Range
									</button>
								</div>
							{/if}
						</div>

						<!-- Options Section -->
						<div>
							<div class="text-xs font-semibold mb-1.5 text-base-content/70">Options</div>
							<div class="space-y-1">
								<!-- Show Grid Toggle -->
								<label class="label cursor-pointer py-1 justify-between">
									<span class="label-text text-xs">Show grid</span>
									<input
										type="checkbox"
										class="checkbox checkbox-xs"
										bind:checked={internalShowGrid}
									/>
								</label>

								<!-- Smooth Curves Toggle -->
								<label class="label cursor-pointer py-1 justify-between">
									<span class="label-text text-xs">Smooth curves</span>
									<input
										type="checkbox"
										class="checkbox checkbox-xs"
										bind:checked={smoothCurves}
									/>
								</label>

								<!-- Color Mode Toggle -->
								<label class="label cursor-pointer py-1 justify-between">
									<span class="label-text text-xs">Color mode</span>
									<div class="flex items-center gap-1">
										<button
											class="btn btn-xs {internalColorMode === 'usage' ? 'btn-primary' : 'btn-ghost'}"
											onclick={() => (internalColorMode = 'usage')}
											title="Usage-based threshold colors"
										>
											Usage
										</button>
										<button
											class="btn btn-xs {internalColorMode === 'static' ? 'btn-primary' : 'btn-ghost'}"
											onclick={() => (internalColorMode = 'static')}
											title="Single static color"
										>
											Static
										</button>
									</div>
								</label>
							</div>
						</div>
			</div>
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
		{#if internalShowGrid}
			<!-- Horizontal grid lines (5 lines for better visibility) -->
			{#each [0.2, 0.4, 0.5, 0.6, 0.8] as ratio}
				<line
					x1={padding}
					y1={viewBoxHeight * ratio}
					x2={viewBoxWidth - padding}
					y2={viewBoxHeight * ratio}
					stroke="currentColor"
					opacity={ratio === 0.5 ? 0.15 : 0.08}
					stroke-width="0.5"
					stroke-dasharray={ratio === 0.5 ? '0' : '2,2'}
				/>
			{/each}
			<!-- Vertical grid lines (4 lines) -->
			{#each [0.25, 0.5, 0.75] as ratio}
				<line
					x1={viewBoxWidth * ratio}
					y1={padding}
					x2={viewBoxWidth * ratio}
					y2={viewBoxHeight - padding}
					stroke="currentColor"
					opacity="0.06"
					stroke-width="0.5"
					stroke-dasharray="2,2"
				/>
			{/each}
		{/if}

		<!-- Chart rendering -->
		{#if filteredData && filteredData.length > 0}
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
				{#each filteredData as point, index}
					{@const x = padding + (index / (filteredData.length - 1 || 1)) * (viewBoxWidth - 2 * padding)}
					{@const y = scaleY(point.tokens)}
					{@const barWidth = (viewBoxWidth - 2 * padding) / filteredData.length * 0.8}
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
				{@const points = filteredData.map((point, index) => ({
					x: padding + (index / (filteredData.length - 1 || 1)) * (viewBoxWidth - 2 * padding),
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
				<!-- Dot plot (small squares to avoid aspect ratio stretch) -->
				{#each filteredData as point, index}
					{@const x = padding + (index / (filteredData.length - 1 || 1)) * (viewBoxWidth - 2 * padding)}
					{@const y = scaleY(point.tokens)}
					{@const color = getColorForValue(point.tokens)}
					<rect
						x={x - 1.25}
						y={y - 1.25}
						width="2.5"
						height="2.5"
						fill={color}
						opacity="1"
						rx="0.5"
						style="transition: fill 0.3s ease, y 0.3s ease;"
					/>
				{/each}
			{/if}

			<!-- Hover indicator -->
			{#if hoveredIndex !== null}
				{@const point = filteredData[hoveredIndex]}
				{@const x = padding + (hoveredIndex / (filteredData.length - 1 || 1)) * (viewBoxWidth - 2 * padding)}
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

	.sparkline-controls-panel {
		position: absolute;
		right: 0;
		top: 0;
		z-index: 50;
	}

	svg {
		display: block;
		cursor: crosshair;
	}

	.sparkline-tooltip {
		position: fixed;
		background: hsl(var(--b1));
		border: 1px solid hsl(var(--bc) / 0.2);
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
		border-top-color: hsl(var(--b1));
	}
</style>
