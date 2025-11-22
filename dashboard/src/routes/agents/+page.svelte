<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { replaceState } from '$app/navigation';
	import TaskQueue from '$lib/components/agents/TaskQueue.svelte';
	import AgentGrid from '$lib/components/agents/AgentGrid.svelte';
	import Sparkline from '$lib/components/Sparkline.svelte';
	import TaskDetailDrawer from '$lib/components/TaskDetailDrawer.svelte';
	import {
		getProjectsFromTasks,
		getTaskCountByProject
	} from '$lib/utils/projectUtils';

	let tasks = $state([]);
	let allTasks = $state([]);  // Unfiltered tasks for project list calculation
	let agents = $state([]);
	let reservations = $state([]);
	let unassignedTasks = $state([]);
	let taskStats = $state(null);
	let selectedProject = $state('All Projects');
	let sparklineData = $state([]);

	// Drawer state for TaskDetailDrawer
	let drawerOpen = $state(false);
	let selectedTaskId = $state(null);
	let drawerMode = $state('view');

	// Extract unique projects from ALL tasks (unfiltered)
	const projects = $derived(getProjectsFromTasks(allTasks));

	// Get task count per project from ALL tasks (only count 'open' tasks to match TaskQueue default)
	const taskCounts = $derived(getTaskCountByProject(allTasks, 'open'));

	// Handle project selection change
	function handleProjectChange(project: string) {
		selectedProject = project;

		// Update URL parameter using SvelteKit's replaceState
		const url = new URL(window.location.href);
		if (project === 'All Projects') {
			url.searchParams.delete('project');
		} else {
			url.searchParams.set('project', project);
		}
		replaceState(url, {});

		// Refetch data with new project filter
		fetchData();
	}

	// Sync selectedProject from URL params (REACTIVE using $page store)
	$effect(() => {
		const projectParam = $page.url.searchParams.get('project');
		if (projectParam && projectParam !== 'All Projects') {
			selectedProject = projectParam;
		} else {
			selectedProject = 'All Projects';
		}
	});

	// Refetch data whenever selectedProject changes (triggered by URL or dropdown)
	$effect(() => {
		// This effect depends on selectedProject, so it re-runs when it changes
		selectedProject; // Read selectedProject to create dependency
		fetchData();
	});

	// Fetch agent data from unified API
	async function fetchData() {
		try {
			// Build URL with project filter, token usage, and activities
			let url = '/api/agents?full=true&usage=true&activities=true';
			if (selectedProject && selectedProject !== 'All Projects') {
				url += `&project=${encodeURIComponent(selectedProject)}`;
			}

			const response = await fetch(url);
			const data = await response.json();

			if (data.error) {
				console.error('API error:', data.error);
				return;
			}

			// Update state with real data
			agents = data.agents || [];
			reservations = data.reservations || [];
			tasks = data.tasks || [];
			unassignedTasks = data.unassigned_tasks || [];
			taskStats = data.task_stats || null;

			// Update allTasks when viewing all projects (for dropdown options)
			if (selectedProject === 'All Projects') {
				allTasks = data.tasks || [];
			}
		} catch (error) {
			console.error('Failed to fetch agent data:', error);
		}
	}

	// Fetch sparkline data (system-wide, no agent filter)
	async function fetchSparklineData() {
		try {
			const response = await fetch('/api/agents/sparkline?range=24h');
			const result = await response.json();

			if (result.error) {
				console.error('Sparkline API error:', result.error);
				return;
			}

			// Update sparkline data
			sparklineData = result.data || [];
		} catch (error) {
			console.error('Failed to fetch sparkline data:', error);
		}
	}

	// Handle task assignment via drag-and-drop
	async function handleTaskAssign(taskId, agentName) {
		try {
			const response = await fetch('/api/agents', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ taskId, agentName })
			});

			const result = await response.json();

			if (!response.ok || result.error) {
				console.error('Failed to assign task:', result.error || result.message);
				throw new Error(result.message || 'Failed to assign task');
			}

			// Immediately refresh data to show updated assignment
			await fetchData();
		} catch (error) {
			console.error('Error assigning task:', error);
			throw error;
		}
	}

	// Handle task click from TaskQueue - open drawer
	function handleTaskClick(taskId) {
		selectedTaskId = taskId;
		drawerMode = 'view';
		drawerOpen = true;
	}

	// Auto-refresh data every 5 seconds using Svelte reactivity
	$effect(() => {
		const interval = setInterval(fetchData, 5000);
		return () => clearInterval(interval);
	});

	// Auto-refresh sparkline every 30 seconds
	$effect(() => {
		const interval = setInterval(fetchSparklineData, 30000);
		return () => clearInterval(interval);
	});

	// Refetch data when drawer closes (to update any changes)
	$effect(() => {
		if (!drawerOpen && selectedTaskId) {
			// Drawer just closed, refresh data
			fetchData();
		}
	});

	onMount(() => {
		fetchData();
		fetchSparklineData();
	});
</script>

<div class="min-h-screen bg-base-200">
	<!-- Main Content: Sidebar + Agent Grid -->
	<div class="flex h-[calc(100vh-theme(spacing.20))] pb-20">
		<!-- Left Sidebar: Task Queue -->
		<div class="w-100 border-r border-base-300 bg-base-100 flex flex-col">
			<TaskQueue
				tasks={unassignedTasks}
				{agents}
				{reservations}
				{selectedProject}
				ontaskclick={handleTaskClick}
			/>
		</div>

		<!-- Right Panel: Agent Grid -->
		<div class="flex-1 overflow-auto">
			<AgentGrid {agents} {tasks} {allTasks} {reservations} {sparklineData} onTaskAssign={handleTaskAssign} ontaskclick={handleTaskClick} />
		</div>
	</div>

	<!-- Task Detail Drawer -->
	<TaskDetailDrawer
		bind:taskId={selectedTaskId}
		bind:mode={drawerMode}
		bind:isOpen={drawerOpen}
	/>
</div>
