<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { getProjectColor } from '$lib/utils/projectColors';

	// Props
	let { tasks = [], onNodeClick = null } = $props();

	// State
	let svgElement = $state(null);
	let width = $state(800);
	let height = $state(600);

	// Status color mapping (DaisyUI-compatible)
	const statusColors = {
		open: '#3b82f6',      // blue
		in_progress: '#f59e0b', // amber
		closed: '#10b981',     // green
		blocked: '#ef4444'     // red
	};

	// Priority stroke widths
	const priorityStroke = {
		0: 4,  // P0 - thickest
		1: 3,  // P1
		2: 2,  // P2
		3: 1,  // P3
		99: 1  // default
	};

	function buildGraph() {
		if (!svgElement) return;

		// Clear previous graph
		d3.select(svgElement).selectAll('*').remove();

		// Return if no tasks to display
		if (!tasks || tasks.length === 0) return;

		// Build nodes and links from tasks
		const nodes = tasks.map(task => ({
			id: task.id,
			title: task.title || task.id,
			status: task.status || 'open',
			priority: task.priority ?? 99,
			project: task.project || 'unknown'
		}));

		// Build links, but only for nodes that exist in the current filtered set
		const nodeIds = new Set(nodes.map(n => n.id));
		const links = [];
		tasks.forEach(task => {
			if (task.depends_on && Array.isArray(task.depends_on)) {
				task.depends_on.forEach(dep => {
					const sourceId = dep.id || dep.depends_on_id;
					// Only create link if both source and target nodes exist
					if (nodeIds.has(sourceId) && nodeIds.has(task.id)) {
						links.push({
							source: sourceId,
							target: task.id,
							type: dep.type || 'depends'
						});
					}
				});
			}
		});

		// Create SVG
		const svg = d3.select(svgElement)
			.attr('width', width)
			.attr('height', height)
			.attr('viewBox', `0 0 ${width} ${height}`)
			.attr('class', 'bg-base-100');

		// Add zoom behavior
		const g = svg.append('g');
		
		const zoom = d3.zoom()
			.scaleExtent([0.1, 4])
			.on('zoom', (event) => {
				g.attr('transform', event.transform);
			});

		svg.call(zoom);

		// Create force simulation
		const simulation = d3.forceSimulation(nodes)
			.force('link', d3.forceLink(links).id(d => d.id).distance(150))
			.force('charge', d3.forceManyBody().strength(-400))
			.force('center', d3.forceCenter(width / 2, height / 2))
			.force('collision', d3.forceCollide().radius(40));

		// Draw links
		const link = g.append('g')
			.selectAll('line')
			.data(links)
			.join('line')
			.attr('class', 'stroke-base-content/20')
			.attr('stroke-width', 2)
			.attr('marker-end', 'url(#arrowhead)');

		// Add arrow markers
		svg.append('defs').selectAll('marker')
			.data(['arrowhead'])
			.join('marker')
			.attr('id', 'arrowhead')
			.attr('viewBox', '0 -5 10 10')
			.attr('refX', 25)
			.attr('refY', 0)
			.attr('markerWidth', 6)
			.attr('markerHeight', 6)
			.attr('orient', 'auto')
			.append('path')
			.attr('d', 'M0,-5L10,0L0,5')
			.attr('class', 'fill-base-content/40');

		// Draw nodes
		const node = g.append('g')
			.selectAll('circle')
			.data(nodes)
			.join('circle')
			.attr('r', 20)
			.attr('fill', d => statusColors[d.status] || '#6b7280')
			.attr('stroke', d => getProjectColor(d.id))
			.attr('stroke-width', d => priorityStroke[d.priority] || 1)
			.attr('class', 'cursor-pointer hover:opacity-80 transition-opacity')
			.call(drag(simulation))
			.on('click', (event, d) => {
				event.stopPropagation();
				if (onNodeClick) {
					onNodeClick(d.id);
				}
			});

		// Add labels
		const label = g.append('g')
			.selectAll('text')
			.data(nodes)
			.join('text')
			.text(d => d.title.length > 30 ? d.title.substring(0, 27) + '...' : d.title)
			.attr('class', 'text-xs fill-base-content pointer-events-none')
			.attr('text-anchor', 'middle')
			.attr('dy', 35);

		// Add tooltips
		node.append('title')
			.text(d => `${d.id}\n${d.title}\nStatus: ${d.status}\nPriority: P${d.priority}`);

		// Update positions on simulation tick
		simulation.on('tick', () => {
			link
				.attr('x1', d => d.source.x)
				.attr('y1', d => d.source.y)
				.attr('x2', d => d.target.x)
				.attr('y2', d => d.target.y);

			node
				.attr('cx', d => d.x)
				.attr('cy', d => d.y);

			label
				.attr('x', d => d.x)
				.attr('y', d => d.y);
		});

		// Drag behavior
		function drag(simulation) {
			function dragstarted(event) {
				if (!event.active) simulation.alphaTarget(0.3).restart();
				event.subject.fx = event.subject.x;
				event.subject.fy = event.subject.y;
			}

			function dragged(event) {
				event.subject.fx = event.x;
				event.subject.fy = event.y;
			}

			function dragended(event) {
				if (!event.active) simulation.alphaTarget(0);
				event.subject.fx = null;
				event.subject.fy = null;
			}

			return d3.drag()
				.on('start', dragstarted)
				.on('drag', dragged)
				.on('end', dragended);
		}
	}

	// Rebuild graph when tasks change
	$effect(() => {
		buildGraph();
	});

	onMount(() => {
		// Handle window resize
		const handleResize = () => {
			const container = svgElement?.parentElement;
			if (container) {
				width = container.clientWidth;
				height = Math.max(600, window.innerHeight - 300);
				buildGraph();
			}
		};

		window.addEventListener('resize', handleResize);
		handleResize();

		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});
</script>

<div class="w-full h-full min-h-[600px] relative">
	<div class="absolute top-4 right-4 z-10 bg-base-100 p-4 rounded-lg border border-base-300 shadow">
		<h3 class="text-sm font-bold mb-2">Legend</h3>
		<div class="space-y-1 text-xs">
			<div class="flex items-center gap-2">
				<div class="w-4 h-4 rounded-full" style="background-color: {statusColors.open}"></div>
				<span>Open</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-4 h-4 rounded-full" style="background-color: {statusColors.in_progress}"></div>
				<span>In Progress</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-4 h-4 rounded-full" style="background-color: {statusColors.closed}"></div>
				<span>Closed</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-4 h-4 rounded-full" style="background-color: {statusColors.blocked}"></div>
				<span>Blocked</span>
			</div>
		</div>
		<div class="mt-3 pt-3 border-t border-base-300 space-y-1 text-xs">
			<p class="font-semibold">Border = Priority</p>
			<p>P0: Thick • P3: Thin</p>
		</div>
	</div>

	<svg bind:this={svgElement} class="w-full h-full"></svg>
</div>
