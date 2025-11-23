<script lang="ts">
	/**
	 * TaskDetailDrawer Component
	 * DaisyUI drawer for viewing/editing task details
	 *
	 * Features:
	 * - Side panel drawer (doesn't block view)
	 * - Dual mode: view and edit
	 * - Auto-save edit mode (debounced 500ms)
	 * - Fetches task data on mount
	 * - Mode toggle button
	 * - Optimistic updates with rollback
	 * - Keyboard shortcuts (Esc, E, M, Cmd/Ctrl+Enter, A, ?)
	 */

	import { tick, onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	// Props
	let { taskId = $bindable(null), mode = $bindable('view'), isOpen = $bindable(false) } = $props();

	// Task data state
	let task = $state(null);
	let originalTask = $state(null); // Track original task to prevent infinite save loops
	let loading = $state(false);
	let error = $state(null);

	// Task history state
	let taskHistory = $state(null);
	let historyLoading = $state(false);
	let historyError = $state(null);

	// Edit mode state
	let formData = $state({
		title: '',
		description: '',
		priority: 1,
		type: 'task',
		status: 'open',
		project: '',
		labels: '',
		assignee: ''
	});

	// Auto-save state
	let isSaving = $state(false);
	let saveError = $state(null);
	let lastSaved = $state<Date | null>(null);
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	let isUpdatingFromServer = $state(false); // Flag to prevent effect loops during server updates

	// UI state
	let validationErrors = $state({});
	let toastMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let showHelp = $state(false);

	// Status badge colors
	const statusColors = {
		open: 'badge-info',
		in_progress: 'badge-warning',
		closed: 'badge-success',
		blocked: 'badge-error'
	};

	// Priority badge colors
	const priorityColors = {
		0: 'badge-error', // P0 - Critical
		1: 'badge-warning', // P1 - High
		2: 'badge-info', // P2 - Medium
		3: 'badge-ghost', // P3 - Low
		4: 'badge-ghost' // P4 - Lowest
	};

	// Available options
	const priorityOptions = [
		{ value: 0, label: 'P0 (Critical)' },
		{ value: 1, label: 'P1 (High)' },
		{ value: 2, label: 'P2 (Medium)' },
		{ value: 3, label: 'P3 (Low)' },
		{ value: 4, label: 'P4 (Lowest)' }
	];

	const typeOptions = [
		{ value: 'task', label: 'Task' },
		{ value: 'bug', label: 'Bug' },
		{ value: 'feature', label: 'Feature' },
		{ value: 'epic', label: 'Epic' },
		{ value: 'chore', label: 'Chore' }
	];

	const statusOptions = [
		{ value: 'open', label: 'Open' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'blocked', label: 'Blocked' },
		{ value: 'closed', label: 'Closed' }
	];

	const projectOptions = ['jat', 'chimaro', 'jomarchy'];

	// Fetch task details
	async function fetchTask(id: string) {
		if (!id) return;

		loading = true;
		error = null;

		try {
			const response = await fetch(`/api/tasks/${id}`);
			if (!response.ok) {
				throw new Error(`Failed to fetch task: ${response.statusText}`);
			}
			const data = await response.json();
			task = data.task;

			// Populate form data for edit mode WITH DEFAULTS
			formData = {
				title: task.title || '',
				description: task.description || '',
				priority: task.priority ?? 1,
				type: task.type || 'task',
				status: task.status || 'open',
				project: task.project || '',
				labels: task.labels ? task.labels.join(', ') : '',
				assignee: task.assignee || ''
			};

			// Store original with SAME DEFAULTS as formData to prevent false change detection
			originalTask = { ...formData };

			// Fetch task history in parallel
			fetchTaskHistory(id);
		} catch (err: any) {
			error = err.message;
			console.error('Error fetching task:', err);
		} finally {
			loading = false;
		}
	}

	// Fetch task history
	async function fetchTaskHistory(id: string) {
		if (!id) return;

		historyLoading = true;
		historyError = null;

		try {
			const response = await fetch(`/api/tasks/${id}/history`);
			if (!response.ok) {
				throw new Error(`Failed to fetch task history: ${response.statusText}`);
			}
			const data = await response.json();
			taskHistory = data;
		} catch (err: any) {
			historyError = err.message;
			console.error('Error fetching task history:', err);
		} finally {
			historyLoading = false;
		}
	}

	// Watch for taskId changes
	$effect(() => {
		if (taskId && isOpen) {
			fetchTask(taskId);
		}
	});

	// Format date
	function formatDate(dateString: string | null) {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleString();
	}

	// Show toast notification
	function showToast(type: 'success' | 'error', text: string) {
		toastMessage = { type, text };
		setTimeout(() => {
			toastMessage = null;
		}, 3000); // Hide after 3 seconds
	}

	// Debounced auto-save function
	async function autoSave(field: string, value: any) {
		console.log(`[AutoSave] Called for field="${field}", value=`, value);
		console.log(`[AutoSave] Current state: isSaving=${isSaving}, isUpdatingFromServer=${isUpdatingFromServer}, mode=${mode}`);
		console.log(`[AutoSave] formData.${field}=`, formData[field], `originalTask.${field}=`, originalTask?.[field]);

		// Clear any pending save
		if (saveTimeout) {
			console.log('[AutoSave] Clearing previous timeout');
			clearTimeout(saveTimeout);
		}

		// Debounce for 500ms
		saveTimeout = setTimeout(async () => {
			console.log(`[AutoSave] Executing save for field="${field}" after debounce`);
			isSaving = true;
			isUpdatingFromServer = true; // Prevent effects from triggering
			saveError = null;

			// Create backup of current task for rollback
			const taskBackup = { ...task };

			try {
				// Optimistic update - update UI immediately
				if (task) {
					console.log(`[AutoSave] Optimistic update: task.${field} = ${value}`);
					task = { ...task, [field]: value };
				}

				// Prepare PATCH request body (only the changed field)
				const updateData: any = {};
				updateData[field] = value;

				console.log('[AutoSave] Making PATCH request:', updateData);
				// Make PATCH request
				const response = await fetch(`/api/tasks/${taskId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(updateData)
				});

				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(errorData.message || 'Failed to save');
				}

				const data = await response.json();

				console.log('[AutoSave] Server response received, updating task');
				// Update task with server response
				task = data.task;

				// Update formData to match saved values (prevents further auto-saves)
				formData = {
					title: task.title || '',
					description: task.description || '',
					priority: task.priority ?? 1,
					type: task.type || 'task',
					status: task.status || 'open',
					project: task.project || '',
					labels: task.labels ? task.labels.join(', ') : '',
					assignee: task.assignee || ''
				};

				// Update originalTask to match saved state (breaks the loop)
				originalTask = { ...formData };

				lastSaved = new Date();

				// Show success toast
				showToast('success', '✓ Saved');
				console.log('[AutoSave] Save completed successfully');

			} catch (error: any) {
				console.error('[AutoSave] Error:', error);

				// Rollback on error
				task = taskBackup;
				saveError = error.message;

				// Show error toast
				showToast('error', `✗ ${error.message}`);
			} finally {
				console.log('[AutoSave] Cleanup: setting isSaving=false, isUpdatingFromServer=false');
				isSaving = false;
				isUpdatingFromServer = false;
			}
		}, 500);
	}

	// Toggle between view and edit modes
	function toggleMode() {
		// Clear any pending save when toggling modes
		if (saveTimeout) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}

		if (mode === 'view') {
			mode = 'edit';
		} else {
			mode = 'view';
			// Reset form data to task data when switching back to view
			if (task) {
				formData = {
					title: task.title || '',
					description: task.description || '',
					priority: task.priority ?? 1,
					type: task.type || 'task',
					status: task.status || 'open',
					project: task.project || '',
					labels: task.labels ? task.labels.join(', ') : '',
					assignee: task.assignee || ''
				};
			}
		}
	}

	// Delete task with confirmation
	async function handleDelete() {
		if (!task || !taskId) return;

		// Confirm deletion
		const confirmed = confirm(
			`Are you sure you want to delete task "${task.title}"?\n\nThis action cannot be undone.`
		);

		if (!confirmed) return;

		isUpdatingFromServer = true;

		try {
			const response = await fetch(`/api/tasks/${taskId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				// Parse error response to get specific error message
				const errorData = await response.json();
				const errorMessage = errorData.message || 'Failed to delete task';
				throw new Error(errorMessage);
			}

			// Show success message
			showToast('success', '✓ Task deleted');

			// Close drawer after short delay
			setTimeout(() => {
				handleClose();
				// Trigger page reload to update task list
				window.location.reload();
			}, 500);
		} catch (error: any) {
			console.error('Delete error:', error);
			showToast('error', `✗ ${error.message}`);
		} finally {
			isUpdatingFromServer = false;
		}
	}

	// Auto-save watchers for each field (only in edit mode)
	// Only trigger when formData actually changes from user interaction
	// IMPORTANT: Don't compare against task.field because autoSave updates task,
	// which would trigger this effect again, creating an infinite loop
	$effect(() => {
		console.log(`[Effect:title] Triggered. mode=${mode}, originalTask exists=${!!originalTask}, isUpdatingFromServer=${isUpdatingFromServer}, isSaving=${isSaving}`);
		if (mode === 'edit' && originalTask && !isUpdatingFromServer) {
			const changed = formData.title !== originalTask.title;
			console.log(`[Effect:title] changed=${changed}, formData.title="${formData.title}", originalTask.title="${originalTask.title}"`);
			if (changed && !isSaving) {
				console.log('[Effect:title] Triggering auto-save');
				autoSave('title', formData.title);
			}
		}
	});

	$effect(() => {
		if (mode === 'edit' && originalTask && !isUpdatingFromServer) {
			const changed = formData.description !== originalTask.description;
			if (changed && !isSaving) {
				autoSave('description', formData.description);
			}
		}
	});

	$effect(() => {
		if (mode === 'edit' && originalTask && !isUpdatingFromServer) {
			const changed = formData.priority !== originalTask.priority;
			if (changed && !isSaving) {
				autoSave('priority', formData.priority);
			}
		}
	});

	$effect(() => {
		if (mode === 'edit' && originalTask && !isUpdatingFromServer) {
			const changed = formData.type !== originalTask.type;
			if (changed && !isSaving) {
				autoSave('type', formData.type);
			}
		}
	});

	$effect(() => {
		if (mode === 'edit' && originalTask && !isUpdatingFromServer) {
			const changed = formData.status !== originalTask.status;
			if (changed && !isSaving) {
				autoSave('status', formData.status);
			}
		}
	});

	$effect(() => {
		if (mode === 'edit' && originalTask && !isUpdatingFromServer) {
			const changed = formData.project !== originalTask.project;
			if (changed && !isSaving) {
				autoSave('project', formData.project);
			}
		}
	});

	$effect(() => {
		if (mode === 'edit' && originalTask && !isUpdatingFromServer) {
			const changed = formData.assignee !== originalTask.assignee;
			if (changed && !isSaving) {
				autoSave('assignee', formData.assignee);
			}
		}
	});

	// Keyboard shortcut handler
	function handleKeyDown(event: KeyboardEvent) {
		// Only handle shortcuts when drawer is open
		if (!isOpen) return;

		// Ignore keyboard shortcuts when typing in inputs
		const target = event.target as HTMLElement;
		const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

		// Escape: Close drawer (always works, even in inputs)
		if (event.key === 'Escape') {
			event.preventDefault();
			handleClose();
			return;
		}

		// Don't handle other shortcuts when typing
		if (isTyping) return;

		// ?: Toggle help panel
		if (event.key === '?' && !event.shiftKey) {
			event.preventDefault();
			showHelp = !showHelp;
			return;
		}

		// E: Toggle edit mode
		if (event.key === 'e' || event.key === 'E') {
			if (!loading && !error && task) {
				event.preventDefault();
				toggleMode();
			}
			return;
		}

		// M: Mark complete (close task)
		if (event.key === 'm' || event.key === 'M') {
			if (!loading && !error && task && mode === 'view') {
				event.preventDefault();
				markComplete();
			}
			return;
		}

		// A: Assign to me
		if (event.key === 'a' || event.key === 'A') {
			if (!loading && !error && task && mode === 'edit') {
				event.preventDefault();
				assignToMe();
			}
			return;
		}

		// Cmd/Ctrl+Enter: Save in edit mode
		if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
			if (mode === 'edit' && !isSaving) {
				event.preventDefault();
				toggleMode(); // This will save and switch to view mode
			}
			return;
		}
	}

	// Mark task as complete
	async function markComplete() {
		if (!task || isSaving) return;

		isSaving = true;
		saveError = null;

		try {
			const response = await fetch(`/api/tasks/${taskId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: 'closed' })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to close task');
			}

			const data = await response.json();
			task = data.task;
			originalTask = { ...data.task };

			showToast('success', '✓ Task marked as complete');
		} catch (error: any) {
			console.error('Mark complete error:', error);
			saveError = error.message;
			showToast('error', `✗ ${error.message}`);
		} finally {
			isSaving = false;
		}
	}

	// Assign task to current user
	function assignToMe() {
		if (!task) return;

		// Get current username from environment (placeholder for now)
		// In production, this would come from auth context
		const currentUser = 'me'; // TODO: Get from auth context

		formData.assignee = currentUser;

		// Auto-save will handle the update
		autoSave('assignee', currentUser);
	}

	// Handle drawer close
	function handleClose() {
		// Clear any pending save
		if (saveTimeout) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}

		if (!isSaving) {
			isOpen = false;
			// Reset to view mode on close
			mode = 'view';
			task = null;
			originalTask = null;
			error = null;
			saveError = null;
			toastMessage = null;
			lastSaved = null;
			showHelp = false;
		}
	}

	// Setup keyboard listener on mount
	onMount(() => {
		if (browser) {
			window.addEventListener('keydown', handleKeyDown);
		}
	});

	// Cleanup on destroy
	onDestroy(() => {
		if (browser) {
			window.removeEventListener('keydown', handleKeyDown);
		}
	});
</script>

<!-- DaisyUI Drawer -->
<div class="drawer drawer-end z-50">
	<input id="task-detail-drawer" type="checkbox" class="drawer-toggle" bind:checked={isOpen} />

	<!-- Drawer side -->
	<div class="drawer-side">
		<label
			aria-label="close sidebar"
			class="drawer-overlay"
			onclick={handleClose}
		></label>

		<!-- Drawer Panel -->
		<div class="bg-base-100 min-h-full w-full max-w-2xl flex flex-col shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between p-6 border-b border-base-300">
				<div class="flex-1">
					<div class="flex items-center gap-3">
						<h2 class="text-2xl font-bold text-base-content">
							{mode === 'view' ? 'Task Details' : 'Edit Task'}
						</h2>
						{#if task && mode === 'view'}
							<span class="badge badge-lg badge-outline">{task.id}</span>
						{/if}
					</div>
					<p class="text-sm text-base-content/70 mt-1">
						{#if mode === 'view'}
							Viewing task details
						{:else if isSaving}
							<span class="loading loading-spinner loading-xs"></span>
							Saving...
						{:else if lastSaved}
							✓ Saved {new Date().getTime() - lastSaved.getTime() < 60000
								? 'just now'
								: 'at ' + lastSaved.toLocaleTimeString()}
						{:else}
							Changes save automatically
						{/if}
					</p>
				</div>
				<div class="flex items-center gap-2">
					<!-- Mode toggle button -->
					{#if !loading && !error && task}
						<div class="tooltip tooltip-bottom" data-tip="{mode === 'view' ? 'Edit (E)' : 'View (E)'}">
							<button
								class="btn btn-sm btn-circle {mode === 'edit' ? 'btn-ghost' : 'btn-primary'}"
								onclick={toggleMode}
								disabled={isSaving}
								aria-label="{mode === 'view' ? 'Edit task (E)' : 'View task (E)'}"
							>
								{#if mode === 'view'}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-4 w-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
										/>
									</svg>
								{:else}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-4 w-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
										/>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
										/>
									</svg>
								{/if}
							</button>
						</div>

						<!-- Delete button -->
						<div class="tooltip tooltip-bottom" data-tip="Delete task (Del)">
							<button
								class="btn btn-sm btn-circle btn-ghost text-error hover:btn-error"
								onclick={handleDelete}
								disabled={isSaving}
								aria-label="Delete task (Del)"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									/>
								</svg>
							</button>
						</div>
					{/if}
					<!-- Help button -->
					<div class="tooltip tooltip-bottom" data-tip="Show shortcuts (?)">
						<button
							class="btn btn-sm btn-circle btn-ghost"
							onclick={() => (showHelp = !showHelp)}
							aria-label="Show keyboard shortcuts (?)"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						</button>
					</div>
					<!-- Close button -->
					<div class="tooltip tooltip-bottom" data-tip="Close (Esc)">
						<button
							class="btn btn-sm btn-circle btn-ghost"
							onclick={handleClose}
							disabled={isSaving}
							aria-label="Close drawer (Esc)"
						>
							✕
						</button>
					</div>
				</div>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-6">
				{#if loading}
					<!-- Loading state -->
					<div class="flex items-center justify-center py-12">
						<span class="loading loading-spinner loading-lg"></span>
					</div>
				{:else if error}
					<!-- Error state -->
					<div class="alert alert-error">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="stroke-current shrink-0 h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span>{error}</span>
					</div>
					<div class="mt-4">
						<button class="btn btn-primary" onclick={() => fetchTask(taskId)}>
							Retry
						</button>
					</div>
				{:else if task && mode === 'view'}
					<!-- View Mode -->
					<div class="space-y-6">
						<!-- Title -->
						<div>
							<h3 class="text-xl font-bold text-base-content mb-3">{task.title}</h3>
						</div>

						<!-- Badges -->
						<div class="flex flex-wrap gap-2">
							<div class="badge {statusColors[task.status] || 'badge-ghost'}">
								{task.status || 'unknown'}
							</div>
							<div class="badge {priorityColors[task.priority] || 'badge-ghost'}">
								P{task.priority ?? '?'}
							</div>
							<div class="badge badge-outline">{task.type || 'task'}</div>
							{#if task.project}
								<div class="badge badge-primary">{task.project}</div>
							{/if}
						</div>

						<!-- Labels -->
						{#if task.labels && task.labels.length > 0}
							<div>
								<h4 class="text-sm font-semibold mb-2 text-base-content/70">Labels</h4>
								<div class="flex flex-wrap gap-2">
									{#each task.labels as label}
										<span class="badge badge-sm badge-outline">{label}</span>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Description -->
						{#if task.description}
							<div>
								<h4 class="text-sm font-semibold mb-2 text-base-content/70">Description</h4>
								<p class="text-sm whitespace-pre-wrap text-base-content">{task.description}</p>
							</div>
						{/if}

						<!-- Dependencies -->
						{#if task.depends_on && task.depends_on.length > 0}
							<div>
								<h4 class="text-sm font-semibold mb-2 text-base-content/70">Depends On</h4>
								<div class="space-y-2">
									{#each task.depends_on as dep}
										<div class="flex items-center gap-2 text-sm p-2 bg-base-200 rounded">
											<span class="badge badge-sm {statusColors[dep.status] || 'badge-ghost'}">
												{dep.status || 'unknown'}
											</span>
											<span class="badge badge-sm {priorityColors[dep.priority] || 'badge-ghost'}">
												P{dep.priority ?? '?'}
											</span>
											<span class="font-mono text-xs">{dep.id}</span>
											<span class="flex-1">{dep.title || 'Untitled'}</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Blocks (dependents) -->
						{#if task.blocked_by && task.blocked_by.length > 0}
							<div>
								<h4 class="text-sm font-semibold mb-2 text-base-content/70">Blocks</h4>
								<div class="space-y-2">
									{#each task.blocked_by as dep}
										<div class="flex items-center gap-2 text-sm p-2 bg-base-200 rounded">
											<span class="badge badge-sm {statusColors[dep.status] || 'badge-ghost'}">
												{dep.status || 'unknown'}
											</span>
											<span class="badge badge-sm {priorityColors[dep.priority] || 'badge-ghost'}">
												P{dep.priority ?? '?'}
											</span>
											<span class="font-mono text-xs">{dep.id}</span>
											<span class="flex-1">{dep.title || 'Untitled'}</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Metadata -->
						<div class="border-t border-base-300 pt-4">
							<h4 class="text-sm font-semibold mb-3 text-base-content/70">Metadata</h4>
							<div class="text-xs text-base-content/60 space-y-2">
								<div class="flex justify-between">
									<strong>Created:</strong>
									<span>{formatDate(task.created_at)}</span>
								</div>
								<div class="flex justify-between">
									<strong>Updated:</strong>
									<span>{formatDate(task.updated_at)}</span>
								</div>
								{#if task.assignee}
									<div class="flex justify-between">
										<strong>Assignee:</strong>
										<span>{task.assignee}</span>
									</div>
								{/if}
							</div>
						</div>

						<!-- Task Events (Beads) -->
						<div class="border-t border-base-300 pt-4">
							<h4 class="text-sm font-semibold mb-3 text-base-content/70 flex items-center gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-4 w-4 text-info"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
									/>
								</svg>
								Task Events
								{#if taskHistory}
									<span class="badge badge-xs badge-info">{taskHistory.count.beads_events}</span>
								{/if}
							</h4>

							{#if historyLoading}
								<!-- Loading state -->
								<div class="flex items-center justify-center py-6">
									<span class="loading loading-spinner loading-sm"></span>
									<span class="ml-2 text-xs">Loading events...</span>
								</div>
							{:else if historyError}
								<!-- Error state -->
								<div class="alert alert-warning py-2">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="stroke-current shrink-0 h-4 w-4"
										fill="none"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
										/>
									</svg>
									<span class="text-xs">{historyError}</span>
								</div>
							{:else if taskHistory && taskHistory.timeline}
								{#if taskHistory.timeline.filter(e => e.type === 'beads_event').length > 0}
									<!-- Beads events display -->
									<div class="space-y-3 max-h-64 overflow-y-auto">
										{#each taskHistory.timeline.filter(e => e.type === 'beads_event') as event}
											<div class="flex gap-3 text-xs p-3 rounded bg-info/10 border border-info/30">
												<!-- Icon -->
												<div class="flex-shrink-0">
													<svg
														xmlns="http://www.w3.org/2000/svg"
														class="h-4 w-4 text-info"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
														/>
													</svg>
												</div>

												<!-- Content -->
												<div class="flex-1 min-w-0">
													<!-- Event description -->
													<div class="font-semibold text-base-content">
														{event.description}
													</div>

													<!-- Timestamp -->
													<div class="text-base-content/60 mt-1">
														{formatDate(event.timestamp)}
													</div>

													<!-- Metadata badges -->
													<div class="mt-2 flex flex-wrap gap-1">
														{#if event.metadata.status}
															<span class="badge badge-xs {statusColors[event.metadata.status]}">
																{event.metadata.status}
															</span>
														{/if}
														{#if event.metadata.priority !== undefined}
															<span
																class="badge badge-xs {priorityColors[event.metadata.priority]}"
															>
																P{event.metadata.priority}
															</span>
														{/if}
														{#if event.metadata.type}
															<span class="badge badge-xs badge-outline">
																{event.metadata.type}
															</span>
														{/if}
														{#if event.metadata.assignee}
															<span class="badge badge-xs badge-ghost">
																@{event.metadata.assignee}
															</span>
														{/if}
													</div>
												</div>
											</div>
										{/each}
									</div>
								{:else}
									<!-- Empty state -->
									<div class="text-xs text-base-content/60 py-4 text-center">
										No task events yet
									</div>
								{/if}
							{/if}
						</div>

						<!-- Coordination Messages (Agent Mail) -->
						<div class="border-t border-base-300 pt-4">
							<h4 class="text-sm font-semibold mb-3 text-base-content/70 flex items-center gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-4 w-4 text-warning"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
									/>
								</svg>
								Coordination Messages
								{#if taskHistory}
									<span class="badge badge-xs badge-warning">{taskHistory.count.agent_mail}</span>
								{/if}
							</h4>

							{#if historyLoading}
								<!-- Loading state -->
								<div class="flex items-center justify-center py-6">
									<span class="loading loading-spinner loading-sm"></span>
									<span class="ml-2 text-xs">Loading messages...</span>
								</div>
							{:else if historyError}
								<!-- Error state -->
								<div class="alert alert-warning py-2">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="stroke-current shrink-0 h-4 w-4"
										fill="none"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
										/>
									</svg>
									<span class="text-xs">{historyError}</span>
								</div>
							{:else if taskHistory && taskHistory.timeline}
								{#if taskHistory.timeline.filter(e => e.type === 'agent_mail').length > 0}
									<!-- Agent Mail messages display -->
									<div class="space-y-3 max-h-64 overflow-y-auto">
										{#each taskHistory.timeline.filter(e => e.type === 'agent_mail') as event}
											<div class="flex gap-3 text-xs p-3 rounded bg-warning/10 border border-warning/30">
												<!-- Icon -->
												<div class="flex-shrink-0">
													<svg
														xmlns="http://www.w3.org/2000/svg"
														class="h-4 w-4 text-warning"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
														/>
													</svg>
												</div>

												<!-- Content -->
												<div class="flex-1 min-w-0">
													<!-- Event description -->
													<div class="font-semibold text-base-content">
														{event.description}
													</div>

													<!-- Timestamp -->
													<div class="text-base-content/60 mt-1">
														{formatDate(event.timestamp)}
													</div>

													<!-- Agent Mail metadata -->
													<div class="mt-2 space-y-1">
														{#if event.metadata.from_agent}
															<div class="text-base-content/70">
																<strong>From:</strong>
																{event.metadata.from_agent}
															</div>
														{/if}
														{#if event.metadata.body}
															<div class="text-base-content/80 whitespace-pre-wrap max-h-24 overflow-y-auto text-xs bg-base-100 p-2 rounded">
																{event.metadata.body}
															</div>
														{/if}
														<div class="flex gap-1">
															{#if event.metadata.importance === 'urgent'}
																<span class="badge badge-xs badge-error">urgent</span>
															{/if}
															{#if event.metadata.ack_required}
																<span class="badge badge-xs badge-warning">ack required</span>
															{/if}
														</div>
													</div>
												</div>
											</div>
										{/each}
									</div>
								{:else}
									<!-- Empty state -->
									<div class="text-xs text-base-content/60 py-4 text-center">
										No coordination messages yet
									</div>
								{/if}
							{/if}
						</div>
					</div>
				{:else if mode === 'edit'}
					<!-- Edit Mode - Auto-save (no form submission needed) -->
					<div class="space-y-6">
						<!-- Title (Required) -->
						<div class="form-control">
							<label class="label" for="edit-task-title">
								<span class="label-text font-semibold">
									Title
									<span class="text-error">*</span>
								</span>
							</label>
							<input
								id="edit-task-title"
								type="text"
								placeholder="Enter task title..."
								class="input input-bordered w-full {validationErrors.title ? 'input-error' : ''}"
								bind:value={formData.title}
								disabled={isSaving}
							/>
							{#if validationErrors.title}
								<label class="label">
									<span class="label-text-alt text-error">{validationErrors.title}</span>
								</label>
							{/if}
						</div>

						<!-- Description -->
						<div class="form-control">
							<label class="label" for="edit-task-description">
								<span class="label-text font-semibold">Description</span>
							</label>
							<textarea
								id="edit-task-description"
								placeholder="Enter task description..."
								class="textarea textarea-bordered w-full h-32"
								bind:value={formData.description}
								disabled={isSaving}
							></textarea>
						</div>

						<!-- Status, Priority, Type Row -->
						<div class="grid grid-cols-3 gap-4">
							<!-- Status -->
							<div class="form-control">
								<label class="label" for="edit-task-status">
									<span class="label-text font-semibold">Status</span>
								</label>
								<select
									id="edit-task-status"
									class="select select-bordered w-full"
									bind:value={formData.status}
									disabled={isSaving}
								>
									{#each statusOptions as option}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
							</div>

							<!-- Priority -->
							<div class="form-control">
								<label class="label" for="edit-task-priority">
									<span class="label-text font-semibold">Priority</span>
								</label>
								<select
									id="edit-task-priority"
									class="select select-bordered w-full"
									bind:value={formData.priority}
									disabled={isSaving}
								>
									{#each priorityOptions as option}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
							</div>

							<!-- Type -->
							<div class="form-control">
								<label class="label" for="edit-task-type">
									<span class="label-text font-semibold">Type</span>
								</label>
								<select
									id="edit-task-type"
									class="select select-bordered w-full"
									bind:value={formData.type}
									disabled={isSaving}
								>
									{#each typeOptions as option}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
							</div>
						</div>

						<!-- Project -->
						<div class="form-control">
							<label class="label" for="edit-task-project">
								<span class="label-text font-semibold">Project</span>
							</label>
							<select
								id="edit-task-project"
								class="select select-bordered w-full"
								bind:value={formData.project}
								disabled={isSaving}
							>
								<option value="">No project</option>
								{#each projectOptions as project}
									<option value={project}>{project}</option>
								{/each}
							</select>
						</div>

						<!-- Labels -->
						<div class="form-control">
							<label class="label" for="edit-task-labels">
								<span class="label-text font-semibold">Labels</span>
							</label>
							<input
								id="edit-task-labels"
								type="text"
								placeholder="e.g., frontend, urgent, bug-fix"
								class="input input-bordered w-full"
								bind:value={formData.labels}
								disabled={isSaving}
							/>
							<label class="label">
								<span class="label-text-alt text-base-content/60">
									Comma-separated list of labels
								</span>
							</label>
						</div>

						<!-- Assignee -->
						<div class="form-control">
							<label class="label" for="edit-task-assignee">
								<span class="label-text font-semibold">Assignee</span>
							</label>
							<input
								id="edit-task-assignee"
								type="text"
								placeholder="Enter assignee name..."
								class="input input-bordered w-full"
								bind:value={formData.assignee}
								disabled={isSaving}
							/>
						</div>
					</div>
				{/if}

				<!-- Keyboard Shortcuts Help Panel -->
				{#if showHelp}
					<div class="mt-6 p-4 bg-base-200 border border-base-300 rounded-lg">
						<h4 class="text-sm font-semibold mb-3 text-base-content flex items-center gap-2">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
								/>
							</svg>
							Keyboard Shortcuts
						</h4>
						<div class="space-y-2 text-sm">
							<!-- General -->
							<div>
								<div class="text-xs font-semibold text-base-content/70 mb-1">General</div>
								<div class="flex justify-between items-center py-1">
									<span>Close drawer</span>
									<kbd class="kbd kbd-sm">Esc</kbd>
								</div>
								<div class="flex justify-between items-center py-1">
									<span>Show/hide shortcuts</span>
									<kbd class="kbd kbd-sm">?</kbd>
								</div>
							</div>

							<!-- View Mode -->
							{#if mode === 'view'}
								<div class="divider my-2"></div>
								<div>
									<div class="text-xs font-semibold text-base-content/70 mb-1">View Mode</div>
									<div class="flex justify-between items-center py-1">
										<span>Enter edit mode</span>
										<kbd class="kbd kbd-sm">E</kbd>
									</div>
									<div class="flex justify-between items-center py-1">
										<span>Mark task complete</span>
										<kbd class="kbd kbd-sm">M</kbd>
									</div>
								</div>
							{/if}

							<!-- Edit Mode -->
							{#if mode === 'edit'}
								<div class="divider my-2"></div>
								<div>
									<div class="text-xs font-semibold text-base-content/70 mb-1">Edit Mode</div>
									<div class="flex justify-between items-center py-1">
										<span>Return to view mode</span>
										<kbd class="kbd kbd-sm">E</kbd>
									</div>
									<div class="flex justify-between items-center py-1">
										<span>Save and exit edit mode</span>
										<span class="flex gap-1">
											<kbd class="kbd kbd-sm">Cmd</kbd>
											<span>+</span>
											<kbd class="kbd kbd-sm">Enter</kbd>
										</span>
									</div>
									<div class="flex justify-between items-center py-1">
										<span>Assign to me</span>
										<kbd class="kbd kbd-sm">A</kbd>
									</div>
								</div>
							{/if}

							<!-- Tip -->
							<div class="divider my-2"></div>
							<div class="alert alert-info py-2 text-xs">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									class="stroke-current shrink-0 w-4 h-4"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									></path>
								</svg>
								<span>Shortcuts don't work while typing in form fields</span>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Footer Actions -->
			{#if !loading && !error && task}
				<div class="p-6 border-t border-base-300 bg-base-200">
					<div class="flex justify-end gap-3">
						<button type="button" class="btn btn-ghost" onclick={handleClose}>
							Close
						</button>
						{#if mode === 'edit'}
							<button type="button" class="btn btn-primary" onclick={toggleMode} disabled={isSaving}>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
									/>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
									/>
								</svg>
								View Mode
							</button>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Toast Notification (Fixed position, bottom-right) -->
	{#if toastMessage}
		<div class="toast toast-end toast-bottom z-[60]">
			<div class="alert {toastMessage.type === 'success' ? 'alert-success' : 'alert-error'}">
				<span>{toastMessage.text}</span>
			</div>
		</div>
	{/if}
</div>
