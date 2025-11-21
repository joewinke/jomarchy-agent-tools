<script lang="ts">
	/**
	 * TaskCreationDrawer Component
	 * DaisyUI drawer for creating new tasks from command palette
	 *
	 * Features:
	 * - Side panel drawer (doesn't block view)
	 * - Form validation for required fields
	 * - POST to /api/tasks endpoint
	 * - Success/error handling with visual feedback
	 */

	import { goto } from '$app/navigation';
	import { isTaskDrawerOpen } from '$lib/stores/drawerStore';

	// Reactive state from store
	let isOpen = $state(false);

	// Subscribe to store
	$effect(() => {
		const unsubscribe = isTaskDrawerOpen.subscribe(value => {
			isOpen = value;
		});
		return unsubscribe;
	});

	// Form state
	let formData = $state({
		title: '',
		description: '',
		priority: 1,
		type: 'task',
		project: '',
		labels: '',
		dependencies: ''
	});

	// UI state
	let isSubmitting = $state(false);
	let validationErrors = $state({});
	let submitError = $state(null);
	let successMessage = $state(null);

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

	// Projects list (could be fetched from API in future)
	const projectOptions = ['jat', 'chimaro', 'jomarchy'];

	// Validate form
	function validateForm() {
		const errors = {};

		if (!formData.title.trim()) {
			errors.title = 'Title is required';
		}

		if (!formData.type) {
			errors.type = 'Type is required';
		}

		validationErrors = errors;
		return Object.keys(errors).length === 0;
	}

	// Handle form submission
	async function handleSubmit(e: Event) {
		e.preventDefault();

		// Reset previous errors
		submitError = null;
		successMessage = null;

		// Validate form
		if (!validateForm()) {
			return;
		}

		isSubmitting = true;

		try {
			// Parse labels and dependencies
			const labels = formData.labels
				.split(',')
				.map((l) => l.trim())
				.filter((l) => l.length > 0);

			const dependencies = formData.dependencies
				.split(',')
				.map((d) => d.trim())
				.filter((d) => d.length > 0);

			// Prepare request body
			const requestBody = {
				title: formData.title.trim(),
				description: formData.description.trim() || undefined,
				priority: formData.priority,
				type: formData.type,
				project: formData.project.trim() || undefined,
				labels: labels.length > 0 ? labels : undefined,
				deps: dependencies.length > 0 ? dependencies : undefined
			};

			// POST to API endpoint
			const response = await fetch('/api/tasks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to create task');
			}

			const data = await response.json();

			// Success!
			successMessage = `Task ${data.task.id} created successfully!`;

			// Reset form and close drawer after showing success message
			setTimeout(() => {
				resetForm();
				isTaskDrawerOpen.set(false);
				successMessage = null;
			}, 1500);
		} catch (error) {
			console.error('Error creating task:', error);
			submitError = error.message || 'Failed to create task. Please try again.';
		} finally {
			isSubmitting = false;
		}
	}

	// Reset form to initial state
	function resetForm() {
		formData = {
			title: '',
			description: '',
			priority: 1,
			type: 'task',
			project: '',
			labels: '',
			dependencies: ''
		};
		validationErrors = {};
		submitError = null;
		successMessage = null;
	}

	// Handle drawer close
	function handleClose() {
		if (!isSubmitting) {
			resetForm();
			isTaskDrawerOpen.set(false);
		}
	}

	// Handle cancel button
	function handleCancel() {
		if (!isSubmitting) {
			resetForm();
			isTaskDrawerOpen.set(false);
		}
	}
</script>

<!-- Drawer Overlay -->
{#if isOpen}
	<div class="fixed inset-0 z-50">
		<!-- Backdrop -->
		<div
			class="absolute inset-0 bg-black/50 transition-opacity"
			onclick={handleClose}
			role="button"
			tabindex="-1"
			aria-label="Close drawer"
		></div>

		<!-- Drawer Panel -->
		<div class="absolute right-0 top-0 bottom-0 bg-base-100 w-full max-w-2xl flex flex-col shadow-2xl animate-slide-in-right">
			<!-- Header -->
			<div class="flex items-center justify-between p-6 border-b border-base-300">
				<div>
					<h2 class="text-2xl font-bold text-base-content">Create New Task</h2>
					<p class="text-sm text-base-content/70 mt-1">
						Fill in the details below to create a new task
					</p>
				</div>
				<button
					class="btn btn-sm btn-circle btn-ghost"
					onclick={handleClose}
					disabled={isSubmitting}
					aria-label="Close drawer"
				>
					✕
				</button>
			</div>

			<!-- Form -->
			<form onsubmit={handleSubmit} class="flex-1 overflow-y-auto p-6">
				<div class="space-y-6">
					<!-- Title (Required) -->
					<div class="form-control">
						<label class="label" for="task-title">
							<span class="label-text font-semibold">
								Title
								<span class="text-error">*</span>
							</span>
						</label>
						<input
							id="task-title"
							type="text"
							placeholder="Enter task title..."
							class="input input-bordered w-full {validationErrors.title
								? 'input-error'
								: ''}"
							bind:value={formData.title}
							disabled={isSubmitting}
							required
						/>
						{#if validationErrors.title}
							<label class="label">
								<span class="label-text-alt text-error">{validationErrors.title}</span>
							</label>
						{/if}
					</div>

					<!-- Description (Optional) -->
					<div class="form-control">
						<label class="label" for="task-description">
							<span class="label-text font-semibold">Description</span>
						</label>
						<textarea
							id="task-description"
							placeholder="Enter task description (optional)..."
							class="textarea textarea-bordered w-full h-32"
							bind:value={formData.description}
							disabled={isSubmitting}
						></textarea>
						<label class="label">
							<span class="label-text-alt text-base-content/60">
								Supports markdown formatting
							</span>
						</label>
					</div>

					<!-- Priority & Type Row -->
					<div class="grid grid-cols-2 gap-4">
						<!-- Priority (Required) -->
						<div class="form-control">
							<label class="label" for="task-priority">
								<span class="label-text font-semibold">
									Priority
									<span class="text-error">*</span>
								</span>
							</label>
							<select
								id="task-priority"
								class="select select-bordered w-full"
								bind:value={formData.priority}
								disabled={isSubmitting}
								required
							>
								{#each priorityOptions as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>

						<!-- Type (Required) -->
						<div class="form-control">
							<label class="label" for="task-type">
								<span class="label-text font-semibold">
									Type
									<span class="text-error">*</span>
								</span>
							</label>
							<select
								id="task-type"
								class="select select-bordered w-full {validationErrors.type
									? 'select-error'
									: ''}"
								bind:value={formData.type}
								disabled={isSubmitting}
								required
							>
								{#each typeOptions as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
							{#if validationErrors.type}
								<label class="label">
									<span class="label-text-alt text-error">{validationErrors.type}</span>
								</label>
							{/if}
						</div>
					</div>

					<!-- Project (Optional) -->
					<div class="form-control">
						<label class="label" for="task-project">
							<span class="label-text font-semibold">Project</span>
						</label>
						<select
							id="task-project"
							class="select select-bordered w-full"
							bind:value={formData.project}
							disabled={isSubmitting}
						>
							<option value="">Select project (optional)</option>
							{#each projectOptions as project}
								<option value={project}>{project}</option>
							{/each}
						</select>
						<label class="label">
							<span class="label-text-alt text-base-content/60">
								Leave empty for auto-assignment
							</span>
						</label>
					</div>

					<!-- Labels (Optional) -->
					<div class="form-control">
						<label class="label" for="task-labels">
							<span class="label-text font-semibold">Labels</span>
						</label>
						<input
							id="task-labels"
							type="text"
							placeholder="e.g., frontend, urgent, bug-fix"
							class="input input-bordered w-full"
							bind:value={formData.labels}
							disabled={isSubmitting}
						/>
						<label class="label">
							<span class="label-text-alt text-base-content/60">
								Comma-separated list of labels
							</span>
						</label>
					</div>

					<!-- Dependencies (Optional) -->
					<div class="form-control">
						<label class="label" for="task-dependencies">
							<span class="label-text font-semibold">Dependencies</span>
						</label>
						<input
							id="task-dependencies"
							type="text"
							placeholder="e.g., jat-abc, jat-xyz"
							class="input input-bordered w-full"
							bind:value={formData.dependencies}
							disabled={isSubmitting}
						/>
						<label class="label">
							<span class="label-text-alt text-base-content/60">
								Comma-separated list of task IDs this task depends on
							</span>
						</label>
					</div>

					<!-- Error Message -->
					{#if submitError}
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
							<span>{submitError}</span>
						</div>
					{/if}

					<!-- Success Message -->
					{#if successMessage}
						<div class="alert alert-success">
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
									d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<span>{successMessage}</span>
						</div>
					{/if}
				</div>
			</form>

			<!-- Footer Actions -->
			<div class="p-6 border-t border-base-300 bg-base-200">
				<div class="flex justify-end gap-3">
					<button
						type="button"
						class="btn btn-ghost"
						onclick={handleCancel}
						disabled={isSubmitting}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="btn btn-primary"
						onclick={handleSubmit}
						disabled={isSubmitting}
					>
						{#if isSubmitting}
							<span class="loading loading-spinner loading-sm"></span>
							Creating...
						{:else}
							Create Task
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes slide-in-right {
		from {
			transform: translateX(100%);
		}
		to {
			transform: translateX(0);
		}
	}

	.animate-slide-in-right {
		animation: slide-in-right 0.3s ease-out;
	}
</style>
