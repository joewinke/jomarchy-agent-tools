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

	type VisualTheme = 'default' | 'lofi' | 'winamp' | 'nord';
	let visualTheme = $state<VisualTheme>('default');
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

	/** Theme-based styling configuration */
	const themeConfig = $derived.by(() => {
		const avgTokens = data?.length
			? data.reduce((sum, d) => sum + d.tokens, 0) / data.length
			: 0;
		const usageColorName = getUsageColor(avgTokens, 'today');

		// Base colors for usage levels
		const usageColors = {
			success: '#22c55e',
			info: '#3b82f6',
			warning: '#f59e0b',
			error: '#ef4444'
		};
		const baseColor = usageColors[usageColorName as keyof typeof usageColors] || '#3b82f6';

		switch (visualTheme) {
			case 'lofi':
				// Lofi aesthetic: pastel colors, soft glow, dreamy vibe
				return {
					strokeColor: '#ff6b9d', // Pink/coral
					strokeWidth: 2.5,
					opacity: 0.9,
					glow: true,
					glowColor: '#ff6b9d',
					glowBlur: 8,
					bgGradient: 'linear-gradient(180deg, rgba(255,107,157,0.1) 0%, rgba(189,147,249,0.05) 100%)'
				};

			case 'winamp':
				// Winamp equalizer: bright neon green, sharp, digital
				return {
					strokeColor: '#00ff00', // Classic Winamp green
					strokeWidth: 1.5,
					opacity: 1,
					glow: true,
					glowColor: '#00ff00',
					glowBlur: 6,
					bgGradient: 'linear-gradient(180deg, rgba(0,255,0,0.15) 0%, rgba(0,0,0,0.8) 100%)',
					pixelated: true
				};

			case 'nord':
				// Nord/Corporate: professional, muted, clean
				return {
					strokeColor: '#88c0d0', // Nord frost blue
					strokeWidth: 2,
					opacity: 0.85,
					glow: false,
					bgGradient: 'linear-gradient(180deg, rgba(136,192,208,0.08) 0%, rgba(76,86,106,0.05) 100%)'
				};

			default:
				// Default: usage-based color
				return {
					strokeColor: baseColor,
					strokeWidth: 2,
					opacity: 1,
					glow: false
				};
		}
	});

	const lineColor = $derived(themeConfig.strokeColor);

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
	<!-- Theme Toolbar -->
	{#if showStyleToolbar}
		<div class="sparkline-toolbar">
			<button
				class="btn btn-xs {visualTheme === 'default' ? 'btn-primary' : 'btn-ghost'}"
				onclick={() => (visualTheme = 'default')}
				title="Default (usage-based colors)"
			>
				<span class="text-[10px] font-medium">Auto</span>
			</button>
			<button
				class="btn btn-xs {visualTheme === 'lofi' ? 'btn-primary' : 'btn-ghost'}"
				onclick={() => (visualTheme = 'lofi')}
				title="Lofi (dreamy pastel)"
			>
				<span class="text-[10px] font-medium">Lofi</span>
			</button>
			<button
				class="btn btn-xs {visualTheme === 'winamp' ? 'btn-primary' : 'btn-ghost'}"
				onclick={() => (visualTheme = 'winamp')}
				title="Winamp (neon green)"
			>
				<span class="text-[10px] font-medium">Winamp</span>
			</button>
			<button
				class="btn btn-xs {visualTheme === 'nord' ? 'btn-primary' : 'btn-ghost'}"
				onclick={() => (visualTheme = 'nord')}
				title="Nord (corporate blue)"
			>
				<span class="text-[10px] font-medium">Nord</span>
			</button>
		</div>
	{/if}

	<svg
		bind:this={svgElement}
		viewBox="0 0 {viewBoxWidth} {viewBoxHeight}"
		preserveAspectRatio="none"
		style="height: {height}px; width: 100%; background: {themeConfig.bgGradient || 'transparent'}; border-radius: 0.375rem;"
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

		<!-- Sparkline path -->
		{#if data && data.length > 0}
			<!-- Glow effect (if theme supports it) -->
			{#if themeConfig.glow}
				<defs>
					<filter id="glow-{visualTheme}">
						<feGaussianBlur stdDeviation="{themeConfig.glowBlur}" result="coloredBlur" />
						<feMerge>
							<feMergeNode in="coloredBlur" />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>
				</defs>
			{/if}

			<!-- Line chart -->
			<path
				d={pathData}
				fill="none"
				stroke-width={themeConfig.strokeWidth}
				stroke-linecap="round"
				stroke-linejoin="round"
				opacity={themeConfig.opacity}
				style="stroke: {themeConfig.strokeColor}; transition: stroke 0.3s ease, d 0.3s ease, opacity 0.3s ease; {themeConfig.glow
					? `filter: url(#glow-${visualTheme}); drop-shadow(0 0 ${themeConfig.glowBlur}px ${themeConfig.glowColor});`
					: ''}"
			/>

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
