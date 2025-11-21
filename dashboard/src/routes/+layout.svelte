<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { themeChange } from 'theme-change';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import TaskCreationDrawer from '$lib/components/TaskCreationDrawer.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import ClaudeUsageBar from '$lib/components/ClaudeUsageBar.svelte';
	import { getProjectsFromTasks, getTaskCountByProject } from '$lib/utils/projectUtils';

	let { children } = $props();

	// Shared project state for entire app
	let selectedProject = $state('All Projects');
	let allTasks = $state([]);

	// Derived project data
	const projects = $derived(getProjectsFromTasks(allTasks));
	const taskCounts = $derived(getTaskCountByProject(allTasks, 'open'));

	// Sync selected project from URL parameter
	$effect(() => {
		const params = new URLSearchParams($page.url.searchParams);
		const projectParam = params.get('project');
		selectedProject = projectParam || 'All Projects';
	});

	// Initialize theme-change and load all tasks
	onMount(async () => {
		themeChange(false);
		await loadAllTasks();
	});

	// Fetch all tasks to populate project dropdown
	async function loadAllTasks() {
		try {
			const response = await fetch('/api/agents?full=true');
			const data = await response.json();
			allTasks = data.tasks || [];
		} catch (error) {
			console.error('Failed to load tasks:', error);
			allTasks = [];
		}
	}

	// Handle project selection change
	function handleProjectChange(project: string) {
		console.log('🟡 [Layout] handleProjectChange called');
		console.log('  → Project:', project);
		console.log('  → Current URL:', window.location.href);

		selectedProject = project;

		// Update URL parameter
		const url = new URL(window.location.href);
		if (project === 'All Projects') {
			url.searchParams.delete('project');
		} else {
			url.searchParams.set('project', project);
		}

		console.log('  → New URL:', url.toString());
		goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
		console.log('  ✓ goto called');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Global Command Palette (Cmd+K / Ctrl+K) -->
<CommandPalette />

<!-- Task Creation Drawer (opens from command palette) -->
<TaskCreationDrawer />

<!-- Unified Navigation Bar (shown on all pages) -->
<Nav
	{projects}
	{selectedProject}
	onProjectChange={handleProjectChange}
	{taskCounts}
/>

{@render children()}

<!-- Claude Usage Bar (fixed bottom) -->
<ClaudeUsageBar />
