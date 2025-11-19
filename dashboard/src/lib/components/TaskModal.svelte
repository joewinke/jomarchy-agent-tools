<script>
	/**
	 * TaskModal Component
	 * Displays full task details including dependencies, dependency graph, and Agent Mail messages
	 */

	// Props
	let { task = $bindable(null), onClose = () => {} } = $props();

	// State
	let messages = $state([]);
	let loadingMessages = $state(false);
	let isEditing = $state(false);
	let editedTask = $state(null);
	let isSaving = $state(false);

	// Priority labels
	const priorityLabels = {
		0: 'P0 (Critical)',
		1: 'P1 (High)',
		2: 'P2 (Medium)',
		3: 'P3 (Low)',
		4: 'P4 (Lowest)'
	};

	// Fetch Agent Mail messages when task changes
	$effect(() => {
		if (task?.id) {
			fetchMessages(task.id);
		} else {
			messages = [];
		}
	});

	// Fetch Agent Mail messages for this task's thread
	async function fetchMessages(taskId) {
		loadingMessages = true;
		try {
			const response = await fetch(`/api/messages/${taskId}`);
			if (!response.ok) throw new Error('Failed to fetch messages');
			const data = await response.json();
			messages = data.messages || [];
		} catch (error) {
			console.error('Error fetching messages:', error);
			messages = [];
		} finally {
			loadingMessages = false;
		}
	}

	// Close modal on escape key
	function handleKeydown(event) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	// Close modal on backdrop click
	function handleBackdropClick(event) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	// Enable edit mode
	function startEditing() {
		isEditing = true;
		editedTask = { ...task };
	}

	// Cancel editing
	function cancelEditing() {
		isEditing = false;
		editedTask = null;
	}

	// Save task changes
	async function saveTask() {
		if (!editedTask) return;

		isSaving = true;
		try {
			const response = await fetch(`/api/tasks/${task.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(editedTask)
			});

			if (!response.ok) throw new Error('Failed to save task');

			const data = await response.json();
			task = data.task; // Update the bound task
			isEditing = false;
			editedTask = null;
		} catch (error) {
			console.error('Error saving task:', error);
			alert('Failed to save task. Please try again.');
		} finally {
			isSaving = false;
		}
	}

	// Format timestamp
	function formatTimestamp(timestamp) {
		return new Date(timestamp).toLocaleString();
	}
</script>

{#if task}
	<div class="modal modal-open" onclick={handleBackdropClick} onkeydown={handleKeydown} role="dialog">
		<div class="modal-box max-w-4xl">
			<div class="flex justify-between items-start mb-4">
				{#if isEditing}
					<input
						type="text"
						class="input input-bordered w-full max-w-2xl text-xl font-bold"
						bind:value={editedTask.title}
					/>
				{:else}
					<h2 class="text-2xl font-bold text-base-content">{task.title}</h2>
				{/if}
				<div class="flex gap-2">
					{#if isEditing}
						<button
							class="btn btn-sm btn-success"
							onclick={saveTask}
							disabled={isSaving}
						>
							{isSaving ? 'Saving...' : 'Save'}
						</button>
						<button
							class="btn btn-sm btn-ghost"
							onclick={cancelEditing}
							disabled={isSaving}
						>
							Cancel
						</button>
					{:else}
						<button
							class="btn btn-sm btn-primary"
							onclick={startEditing}
						>
							Edit
						</button>
					{/if}
					<button
						class="btn btn-sm btn-circle btn-ghost"
						onclick={onClose}
						aria-label="Close modal"
					>
						✕
					</button>
				</div>
			</div>

			<div class="space-y-4">
				<div class="flex flex-wrap gap-2 p-3 bg-base-200 rounded-lg">
					<div class="badge badge-outline">
						<span class="font-semibold mr-1">ID:</span>
						{task.id}
					</div>
					<div class="badge badge-outline">
						<span class="font-semibold mr-1">Project:</span>
						{task.project}
					</div>
					{#if isEditing}
						<div class="form-control">
							<select class="select select-sm select-bordered" bind:value={editedTask.priority}>
								<option value={0}>P0 (Critical)</option>
								<option value={1}>P1 (High)</option>
								<option value={2}>P2 (Medium)</option>
								<option value={3}>P3 (Low)</option>
								<option value={4}>P4 (Lowest)</option>
							</select>
						</div>
						<div class="form-control">
							<select class="select select-sm select-bordered" bind:value={editedTask.status}>
								<option value="open">Open</option>
								<option value="closed">Closed</option>
							</select>
						</div>
					{:else}
						<div class="badge badge-outline">
							<span class="font-semibold mr-1">Priority:</span>
							{priorityLabels[task.priority] || `P${task.priority}`}
						</div>
						<div class="badge {task.status === 'open' ? 'badge-primary' : 'badge-success'}">
							{task.status}
						</div>
					{/if}
					{#if task.issue_type}
						<div class="badge badge-outline">
							<span class="font-semibold mr-1">Type:</span>
							{task.issue_type}
						</div>
					{/if}
				</div>

				{#if task.description || isEditing}
					<div>
						<h3 class="text-lg font-semibold text-base-content mb-2">Description</h3>
						{#if isEditing}
							<textarea
								class="textarea textarea-bordered w-full h-32"
								bind:value={editedTask.description}
								placeholder="Enter task description..."
							></textarea>
						{:else}
							<p class="text-sm text-base-content/80 whitespace-pre-wrap leading-relaxed">
								{task.description}
							</p>
						{/if}
					</div>
					<div class="divider"></div>
				{/if}

				{#if task.acceptance_criteria}
					<div>
						<h3 class="text-lg font-semibold text-base-content mb-2">Acceptance Criteria</h3>
						<p class="text-sm text-base-content/80 whitespace-pre-wrap leading-relaxed">
							{task.acceptance_criteria}
						</p>
					</div>
					<div class="divider"></div>
				{/if}

				{#if task.labels && task.labels.length > 0}
					<div>
						<h3 class="text-lg font-semibold text-base-content mb-2">Labels</h3>
						<div class="flex flex-wrap gap-2">
							{#each task.labels as label}
								<span class="badge badge-ghost">{label}</span>
							{/each}
						</div>
					</div>
					<div class="divider"></div>
				{/if}

				{#if task.dependencies && task.dependencies.length > 0}
					<div>
						<h3 class="text-lg font-semibold text-base-content mb-2">Dependencies</h3>
						<div class="alert alert-info">
							<div>
								<p class="text-sm font-medium mb-2">This task depends on:</p>
								<pre class="text-xs font-mono overflow-x-auto">{task.id}
{#each task.dependencies as dep, i}
{i === task.dependencies.length - 1 ? '└──' : '├──'} {dep}
{/each}</pre>
							</div>
						</div>
					</div>
					<div class="divider"></div>
				{/if}

				{#if task.enables && task.enables.length > 0}
					<div>
						<h3 class="text-lg font-semibold text-base-content mb-2">Enables</h3>
						<div class="alert alert-success">
							<div>
								<p class="text-sm font-medium mb-2">Completing this task will enable:</p>
								<ul class="list-disc list-inside text-sm space-y-1">
									{#each task.enables as enabled}
										<li class="font-mono">{enabled}</li>
									{/each}
								</ul>
							</div>
						</div>
					</div>
					<div class="divider"></div>
				{/if}

				<!-- Agent Mail Messages -->
				<div>
					<h3 class="text-lg font-semibold text-base-content mb-2">
						Agent Mail Thread
						{#if messages.length > 0}
							<span class="badge badge-primary badge-sm ml-2">{messages.length}</span>
						{/if}
					</h3>

					{#if loadingMessages}
						<div class="flex justify-center p-4">
							<span class="loading loading-spinner loading-sm"></span>
						</div>
					{:else if messages.length > 0}
						<div class="space-y-2 max-h-96 overflow-y-auto">
							{#each messages as message}
								<div class="alert alert-info p-3">
									<div class="w-full">
										<div class="flex items-center justify-between mb-2">
											<div class="flex items-center gap-2">
												<span class="badge badge-ghost badge-sm">{message.from_agent}</span>
												{#if message.importance === 'high'}
													<span class="badge badge-error badge-sm">High Priority</span>
												{:else if message.importance === 'urgent'}
													<span class="badge badge-warning badge-sm">Urgent</span>
												{/if}
											</div>
											<span class="text-xs text-base-content/60">
												{formatTimestamp(message.sent_ts)}
											</span>
										</div>
										<p class="text-sm font-semibold mb-1">{message.subject}</p>
										<p class="text-sm text-base-content/80 whitespace-pre-wrap line-clamp-3">
											{message.body}
										</p>
										{#if message.read_ts}
											<div class="text-xs text-base-content/60 mt-1">
												✓ Read {formatTimestamp(message.read_ts)}
												{#if message.ack_ts}
													• Acknowledged {formatTimestamp(message.ack_ts)}
												{/if}
											</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="alert">
							<span class="text-sm">No Agent Mail messages for this task yet</span>
						</div>
					{/if}
				</div>
				<div class="divider"></div>

				<div>
					<h3 class="text-lg font-semibold text-base-content mb-2">Timestamps</h3>
					<div class="bg-base-200 p-3 rounded-lg space-y-2">
						<div class="flex gap-2 text-sm">
							<span class="font-semibold text-base-content/70">Created:</span>
							<span class="text-base-content">{new Date(task.created_at).toLocaleString()}</span>
						</div>
						<div class="flex gap-2 text-sm">
							<span class="font-semibold text-base-content/70">Updated:</span>
							<span class="text-base-content">{new Date(task.updated_at).toLocaleString()}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
