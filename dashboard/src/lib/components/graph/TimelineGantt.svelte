<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { getProjectColor } from '$lib/utils/projectColors';

	// Props
	let { tasks = [], onNodeClick = null } = $props();

	// State
	let svgElement = $state(null);
	let width = $state(1200);
	let height = $state(600);
	let margin = { top: 40, right: 150, bottom: 60, left: 200 };

	// Status color mapping (DaisyUI-compatible)
	const statusColors = {
		open: '#3b82f6',      // blue
		in_progress: '#f59e0b', // amber
		closed: '#10b981',     // green
		blocked: '#ef4444'     // red
	};

	// Priority color mapping for timeline bars
	const priorityColors = {
		0: '#dc2626',  // P0 - red
		1: '#f59e0b',  // P1 - amber
		2: '#3b82f6',  // P2 - blue
		3: '#10b981',  // P3 - green
		99: '#6b7280' // default - gray
	};

	function buildTimeline() {
		if (!svgElement) return;

		// Clear previous timeline
		d3.select(svgElement).selectAll('*').remove();

		// Return if no tasks to display
		if (!tasks || tasks.length === 0) {
			// Show empty state message
			d3.select(svgElement)
				.append('text')
				.attr('x', width / 2)
				.attr('y', height / 2)
				.attr('text-anchor', 'middle')
				.attr('class', 'text-base-content/50')
				.text('No tasks to display');
			return;
		}

		// Parse task dates (use created_at/updated_at as proxies)
		const tasksWithDates = tasks.map(task => {
			// Use created_at as start date, updated_at as end date (or create end date if closed)
			const startDate = task.created_at ? new Date(task.created_at) : new Date();
			const endDate = task.updated_at
				? new Date(task.updated_at)
				: task.status === 'closed'
				? new Date()
				: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // +7 days if open

			return {
				...task,
				startDate,
				endDate,
				duration: (endDate - startDate) / (1000 * 60 * 60 * 24) // days
			};
		});

		// Sort tasks by start date
		tasksWithDates.sort((a, b) => a.startDate - b.startDate);

		// Create SVG
		const svg = d3
			.select(svgElement)
			.attr('width', width)
			.attr('height', height)
			.attr('viewBox', `0 0 ${width} ${height}`)
			.attr('class', 'bg-base-100');

		const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

		const innerWidth = width - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;

		// X-axis: Date scale
		const xExtent = d3.extent(
			tasksWithDates.flatMap(d => [d.startDate, d.endDate])
		);
		const xScale = d3
			.scaleTime()
			.domain(xExtent)
			.range([0, innerWidth]);

		// Y-axis: Task scale (categorical)
		const yScale = d3
			.scaleBand()
			.domain(tasksWithDates.map(d => d.id))
			.range([0, innerHeight])
			.padding(0.2);

		// Add X-axis
		g.append('g')
			.attr('transform', `translate(0,${innerHeight})`)
			.call(d3.axisBottom(xScale).ticks(8))
			.attr('class', 'text-base-content/70');

		// Add Y-axis
		g.append('g')
			.call(
				d3.axisLeft(yScale).tickFormat((taskId) => {
					const task = tasksWithDates.find(t => t.id === taskId);
					return task ? `${task.id}: ${task.title.slice(0, 30)}...` : taskId;
				})
			)
			.attr('class', 'text-base-content/70');

		// Add grid lines
		g.append('g')
			.attr('class', 'grid')
			.attr('opacity', 0.1)
			.call(d3.axisBottom(xScale).tickSize(innerHeight).tickFormat(''));

		// Add timeline bars
		const bars = g
			.selectAll('.task-bar')
			.data(tasksWithDates)
			.join('g')
			.attr('class', 'task-bar cursor-pointer')
			.attr('transform', d => `translate(${xScale(d.startDate)},${yScale(d.id)})`);

		// Background bar (full duration)
		bars
			.append('rect')
			.attr('width', d => Math.max(5, xScale(d.endDate) - xScale(d.startDate)))
			.attr('height', yScale.bandwidth())
			.attr('fill', d => priorityColors[d.priority ?? 99])
			.attr('stroke', d => getProjectColor(d.id))
			.attr('stroke-width', 2)
			.attr('opacity', 0.6)
			.attr('rx', 4);

		// Status indicator (left border)
		bars
			.append('rect')
			.attr('width', 6)
			.attr('height', yScale.bandwidth())
			.attr('fill', d => statusColors[d.status || 'open'])
			.attr('rx', 4);

		// Task labels (inside bars)
		bars
			.append('text')
			.attr('x', 10)
			.attr('y', yScale.bandwidth() / 2)
			.attr('dy', '0.35em')
			.attr('class', 'text-sm fill-base-content')
			.text(d => `P${d.priority ?? ''} ${d.title.slice(0, 20)}...`);

		// Add click interaction
		bars.on('click', function (event, d) {
			if (onNodeClick) {
				onNodeClick(d.id);
			}
		});

		// Add hover interaction
		bars
			.on('mouseenter', function () {
				d3.select(this).select('rect').attr('opacity', 1);
			})
			.on('mouseleave', function () {
				d3.select(this).select('rect').attr('opacity', 0.6);
			});

		// Add title (chart header)
		svg
			.append('text')
			.attr('x', width / 2)
			.attr('y', 20)
			.attr('text-anchor', 'middle')
			.attr('class', 'text-lg font-bold fill-base-content')
			.text('Task Timeline / Gantt Chart');

		// Add legend
		const legend = svg
			.append('g')
			.attr('transform', `translate(${width - 140}, 50)`);

		const legendItems = [
			{ label: 'Open', color: statusColors.open },
			{ label: 'In Progress', color: statusColors.in_progress },
			{ label: 'Blocked', color: statusColors.blocked },
			{ label: 'Closed', color: statusColors.closed }
		];

		legendItems.forEach((item, i) => {
			const legendRow = legend
				.append('g')
				.attr('transform', `translate(0, ${i * 25})`);

			legendRow
				.append('rect')
				.attr('width', 16)
				.attr('height', 16)
				.attr('fill', item.color)
				.attr('rx', 2);

			legendRow
				.append('text')
				.attr('x', 24)
				.attr('y', 12)
				.attr('class', 'text-sm fill-base-content')
				.text(item.label);
		});
	}

	// Rebuild timeline when tasks change
	$effect(() => {
		if (tasks) {
			buildTimeline();
		}
	});

	onMount(() => {
		buildTimeline();

		// Rebuild on window resize
		window.addEventListener('resize', () => {
			width = svgElement?.parentElement?.clientWidth || 1200;
			buildTimeline();
		});
	});
</script>

<div class="w-full bg-base-100 rounded-lg p-4 shadow">
	<svg bind:this={svgElement}></svg>
</div>

<style>
	:global(.grid line) {
		stroke: currentColor;
	}
</style>
