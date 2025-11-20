<script>
	let { agent, tasks = [], reservations = [], onTaskAssign = () => {}, draggedTaskId = null } = $props();

	let isDragOver = $state(false);
	let isAssigning = $state(false);
	let hasConflict = $state(false);
	let conflictReasons = $state([]);
	let showDeleteModal = $state(false);
	let isDeleting = $state(false);

	// Quick actions menu state
	let showQuickActions = $state(false);
	let quickActionsX = $state(0);
	let quickActionsY = $state(0);
	let quickActionsLoading = $state(null); // Track which action is loading
	let showInboxModal = $state(false);
	let inboxMessages = $state([]);
	let showReservationsModal = $state(false);
	let reservationsList = $state([]);
	let showSendMessageModal = $state(false);
	let messageSubject = $state('');
	let messageBody = $state('');
	let showClearQueueModal = $state(false);
	let showUnassignModal = $state(false);

	// Compute agent status using $derived
	// States: working (has in-progress tasks OR locks matching assigned task) > active (recent activity or locks) > idle (within 1h) > offline (>1h)
	const agentStatus = $derived(() => {
		// Priority 1a: Has in-progress tasks
		if (agent.in_progress_tasks > 0) {
			return 'working';
		}

		// Priority 1b: Has file locks with reason matching an assigned task ID (agent is actively working)
		const agentTaskLocks = agentLocks().filter(lock => {
			const reason = lock.reason || '';
			// Check if lock reason matches any task assigned to this agent
			return tasks.some(t =>
				t.assignee === agent.name &&
				(t.status === 'open' || t.status === 'in_progress') &&
				reason.includes(t.id)
			);
		});
		if (agentTaskLocks.length > 0) {
			return 'working';
		}

		// Priority 2: Recently active or holding locks
		const hasActiveLocks = agent.reservation_count > 0; // unexpired locks
		if (agent.last_active_ts) {
			const isoTimestamp = agent.last_active_ts.includes('T')
				? agent.last_active_ts
				: agent.last_active_ts.replace(' ', 'T') + 'Z';
			const lastActivity = new Date(isoTimestamp);
			const timeSinceActive = Date.now() - lastActivity.getTime();

			// Active: within 5 minutes OR has locks within 1 hour
			if (timeSinceActive < 300000) { // 5 minutes
				return 'active';
			}
			if (hasActiveLocks && timeSinceActive < 3600000) { // has locks, within hour
				return 'active';
			}

			// Idle: within 1 hour
			if (timeSinceActive < 3600000) { // 1 hour
				return 'idle';
			}
		}

		// Offline: over 1 hour or never active
		return 'offline';
	});

	// Get status badge class
	function getStatusBadge(status) {
		switch (status) {
			case 'working':
				return 'badge-info'; // Blue - actively coding
			case 'active':
				return 'badge-success'; // Green - ready and engaged
			case 'idle':
				return 'badge-ghost'; // Gray - available but quiet
			case 'blocked':
				return 'badge-warning'; // Yellow - paused
			case 'offline':
				return 'badge-error'; // Red - disconnected
			default:
				return 'badge-ghost';
		}
	}

	// Get status icon
	function getStatusIcon(status) {
		switch (status) {
			case 'working':
				return '⚙'; // Actively coding (gear will spin)
			case 'active':
				return '✓'; // Ready and engaged
			case 'idle':
				return '○'; // Available but quiet
			case 'blocked':
				return '⏸'; // Paused
			case 'offline':
				return '⏹'; // Disconnected
			default:
				return '?';
		}
	}

	// Compute current task (in-progress tasks assigned to this agent)
	const currentTask = $derived(() => {
		const inProgressTasks = tasks.filter(
			(t) => t.assignee === agent.name && t.status === 'in_progress'
		);
		return inProgressTasks.length > 0 ? inProgressTasks[0] : null;
	});

	// Compute queued tasks (open tasks assigned to this agent)
	const queuedTasks = $derived(() => {
		return tasks.filter((t) => t.assignee === agent.name && t.status === 'open');
	});

	// Compute file locks held by this agent
	const agentLocks = $derived(() => {
		return reservations.filter(
			(r) =>
				(r.agent_name === agent.name || r.agent === agent.name) &&
				(!r.released_ts) &&
				new Date(r.expires_ts) > new Date()
		);
	});

	// Compute task capacity (simple load indicator based on task count)
	const MAX_TASKS = 10; // Maximum recommended tasks per agent
	const taskCapacity = $derived(() => {
		const totalActiveTasks = (agent.in_progress_tasks || 0) + (agent.open_tasks || 0);
		const percentage = Math.min((totalActiveTasks / MAX_TASKS) * 100, 100);
		return {
			total: totalActiveTasks,
			max: MAX_TASKS,
			percentage,
			status: percentage < 50 ? 'good' : percentage < 80 ? 'moderate' : 'high'
		};
	});

	// Format last activity time
	function formatLastActivity(timestamp) {
		if (!timestamp) return 'Never';
		// Database timestamps are in UTC but without 'Z' suffix
		// Append 'Z' to parse as UTC, or replace space with 'T' and add 'Z'
		const isoTimestamp = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T') + 'Z';
		const date = new Date(isoTimestamp);
		const now = new Date();
		const diffMs = now - date;
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		return `${diffDays}d ago`;
	}

	// Calculate progress for current task (simple estimation based on time)
	function getTaskProgress(task) {
		if (!task) return 0;

		// Simple heuristic: if task has been in progress, show 30-70% random progress
		// In a real system, this would come from task metadata
		const created = new Date(task.created_at || task.updated_at);
		const now = new Date();
		const elapsed = now - created;
		const oneHour = 3600000;

		// Show progress based on time elapsed (0-70% over first 2 hours)
		const progress = Math.min((elapsed / (oneHour * 2)) * 70, 70);
		return Math.floor(progress);
	}

	// Handle drop event
	async function handleDrop(event) {
		event.preventDefault();
		isDragOver = false;

		// Prevent drop if there's a conflict
		if (hasConflict) {
			console.warn('Cannot assign task: file reservation conflict');
			hasConflict = false;
			conflictReasons = [];
			return;
		}

		const taskId = event.dataTransfer.getData('text/plain');
		if (!taskId) return;

		// Show loading state
		isAssigning = true;

		try {
			// Call parent callback to assign task
			await onTaskAssign(taskId, agent.name);
		} catch (error) {
			console.error('Failed to assign task:', error);
			// TODO: Show error toast/notification
		} finally {
			isAssigning = false;
		}
	}

	// Infer file patterns from task based on labels and description
	function inferFilePatterns(task) {
		if (!task) return [];

		const patterns = [];

		// Extract glob patterns from description (e.g., "src/**/*.ts")
		const descriptionPatterns = task.description?.match(/[\w-]+\/\*\*?\/\*\.\w+/g) || [];
		patterns.push(...descriptionPatterns);

		// Infer from labels (common patterns)
		const labelPatternMap = {
			dashboard: ['dashboard/**/*'],
			frontend: ['dashboard/**/*', 'frontend/**/*'],
			backend: ['backend/**/*', 'server/**/*', 'api/**/*'],
			browser: ['browser/**/*', 'tools/browser-*.js'],
			'agent-mail': ['agent-mail/**/*'],
			database: ['database/**/*'],
			monitoring: ['monitoring/**/*'],
			development: ['development/**/*']
		};

		task.labels?.forEach((label) => {
			if (labelPatternMap[label]) {
				patterns.push(...labelPatternMap[label]);
			}
		});

		return [...new Set(patterns)]; // Remove duplicates
	}

	// Check if two glob patterns conflict (simple overlap detection)
	function patternsConflict(pattern1, pattern2) {
		// Simple heuristic: check if patterns share a common prefix
		// In a real system, use a proper glob matching library
		const normalize = (p) => p.replace(/\*/g, '').replace(/\//g, '');
		const p1 = normalize(pattern1);
		const p2 = normalize(pattern2);

		// Check if one pattern is a substring of the other
		return p1.includes(p2) || p2.includes(p1) || p1 === p2;
	}

	// Detect conflicts between task and agent's reservations
	function detectConflicts(taskId) {
		if (!taskId) return { hasConflict: false, reasons: [] };

		// Find the task
		const task = tasks.find((t) => t.id === taskId);
		if (!task) return { hasConflict: false, reasons: [] };

		// Infer file patterns needed by the task
		const taskPatterns = inferFilePatterns(task);
		if (taskPatterns.length === 0) {
			// No patterns means no conflicts
			return { hasConflict: false, reasons: [] };
		}

		// Get agent's active reservations
		const agentReservations = agentLocks();
		if (agentReservations.length === 0) {
			return { hasConflict: false, reasons: [] };
		}

		// Check for conflicts
		const conflicts = [];
		for (const reservation of agentReservations) {
			const reservedPattern = reservation.file_pattern || reservation.pattern;
			for (const taskPattern of taskPatterns) {
				if (patternsConflict(taskPattern, reservedPattern)) {
					conflicts.push({
						taskPattern,
						reservedPattern,
						reservation
					});
				}
			}
		}

		return {
			hasConflict: conflicts.length > 0,
			reasons: conflicts.map((c) => `${c.taskPattern} conflicts with ${c.reservedPattern}`)
		};
	}

	function handleDragOver(event) {
		event.preventDefault();
		isDragOver = true;

		// Check for conflicts with the dragged task
		const taskId = event.dataTransfer.getData('text/plain');
		const conflictResult = detectConflicts(taskId);
		hasConflict = conflictResult.hasConflict;
		conflictReasons = conflictResult.reasons;

		// Set drag effect based on conflict
		event.dataTransfer.dropEffect = hasConflict ? 'none' : 'move';
	}

	function handleDragLeave() {
		isDragOver = false;
		hasConflict = false;
		conflictReasons = [];
	}

	// Handle agent deletion
	async function handleDeleteAgent() {
		isDeleting = true;
		try {
			const response = await fetch(`/api/agents/${agent.name}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const error = await response.json();
				console.error('Failed to delete agent:', error);
				alert(`Failed to delete agent: ${error.message || 'Unknown error'}`);
				return;
			}

			// Success - close modal and refresh page
			showDeleteModal = false;
			window.location.reload();
		} catch (error) {
			console.error('Error deleting agent:', error);
			alert(`Error deleting agent: ${error.message}`);
		} finally {
			isDeleting = false;
		}
	}

	// Handle badge click for offline agents
	function handleBadgeClick() {
		if (agentStatus() === 'offline') {
			showDeleteModal = true;
		}
	}

	// Handle right-click to show quick actions menu
	function handleContextMenu(event) {
		event.preventDefault();
		quickActionsX = event.clientX;
		quickActionsY = event.clientY;
		showQuickActions = true;
	}

	// Close quick actions menu
	function closeQuickActions() {
		showQuickActions = false;
		quickActionsLoading = null;
	}

	// Quick Action: View agent's inbox
	async function viewInbox() {
		quickActionsLoading = 'inbox';
		try {
			const response = await fetch(`/api/agents/${agent.name}/inbox`);
			if (!response.ok) throw new Error('Failed to fetch inbox');
			const data = await response.json();
			inboxMessages = data.messages || [];
			showInboxModal = true;
		} catch (error) {
			console.error('Failed to view inbox:', error);
			alert(`Failed to view inbox: ${error.message}`);
		} finally {
			quickActionsLoading = null;
			closeQuickActions();
		}
	}

	// Quick Action: View file locks
	async function viewReservations() {
		quickActionsLoading = 'reservations';
		try {
			const response = await fetch(`/api/agents/${agent.name}/reservations`);
			if (!response.ok) throw new Error('Failed to fetch reservations');
			const data = await response.json();
			reservationsList = data.reservations || [];
			showReservationsModal = true;
		} catch (error) {
			console.error('Failed to view reservations:', error);
			alert(`Failed to view reservations: ${error.message}`);
		} finally {
			quickActionsLoading = null;
			closeQuickActions();
		}
	}

	// Quick Action: Send message
	function openSendMessage() {
		messageSubject = '';
		messageBody = '';
		showSendMessageModal = true;
		closeQuickActions();
	}

	async function sendMessage() {
		if (!messageSubject.trim() || !messageBody.trim()) {
			alert('Please fill in both subject and message');
			return;
		}

		try {
			const response = await fetch(`/api/agents/${agent.name}/message`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subject: messageSubject,
					body: messageBody
				})
			});

			if (!response.ok) throw new Error('Failed to send message');

			showSendMessageModal = false;
			alert('Message sent successfully!');
		} catch (error) {
			console.error('Failed to send message:', error);
			alert(`Failed to send message: ${error.message}`);
		}
	}

	// Quick Action: Clear agent's queue
	function confirmClearQueue() {
		showClearQueueModal = true;
		closeQuickActions();
	}

	async function clearQueue() {
		try {
			const response = await fetch(`/api/agents/${agent.name}/clear-queue`, {
				method: 'POST'
			});

			if (!response.ok) throw new Error('Failed to clear queue');

			showClearQueueModal = false;
			window.location.reload();
		} catch (error) {
			console.error('Failed to clear queue:', error);
			alert(`Failed to clear queue: ${error.message}`);
		}
	}

	// Quick Action: Unassign current task
	function confirmUnassignTask() {
		if (!currentTask()) {
			alert('No current task to unassign');
			closeQuickActions();
			return;
		}
		showUnassignModal = true;
		closeQuickActions();
	}

	async function unassignCurrentTask() {
		const task = currentTask();
		if (!task) return;

		try {
			const response = await fetch(`/api/agents/${agent.name}/unassign-task`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ taskId: task.id })
			});

			if (!response.ok) throw new Error('Failed to unassign task');

			showUnassignModal = false;
			window.location.reload();
		} catch (error) {
			console.error('Failed to unassign task:', error);
			alert(`Failed to unassign task: ${error.message}`);
		}
	}
</script>

<div
	class="card bg-base-100 border-2 transition-all relative {isDragOver && hasConflict ? 'border-error border-dashed bg-error/10 scale-105' : isDragOver ? 'border-success border-dashed bg-success/10 scale-105' : 'border-base-300 hover:border-primary'} {isAssigning ? 'opacity-50 pointer-events-none' : ''}"
	role="button"
	tabindex="0"
	ondrop={handleDrop}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	oncontextmenu={handleContextMenu}
>
	<div class="card-body p-4">
		<!-- Agent Header -->
		<div class="flex items-start justify-between gap-2 mb-3">
			<div class="flex-1 min-w-0">
				<h3 class="font-semibold text-base text-base-content truncate" title={agent.name}>
					{agent.name || 'Unknown Agent'}
				</h3>
				<p class="text-xs text-base-content/50 font-mono truncate">
					{agent.program || 'claude-code'} • {agent.model || 'unknown'}
				</p>
				<p class="text-xs text-base-content/40 mt-0.5">
					Last active: {formatLastActivity(agent.last_active_ts)}
				</p>
			</div>
			<button
				class="badge badge-sm {getStatusBadge(agentStatus())} {agentStatus() === 'offline' ? 'cursor-pointer hover:badge-error hover:scale-110 transition-all' : 'cursor-default'}"
				onclick={handleBadgeClick}
				disabled={agentStatus() !== 'offline'}
				title={agentStatus() === 'offline' ? 'Click to delete agent' : ''}
			>
				<span class={agentStatus() === 'working' ? 'inline-block animate-spin' : ''}>
					{getStatusIcon(agentStatus())}
				</span>
				{agentStatus().charAt(0).toUpperCase() + agentStatus().slice(1)}
			</button>
		</div>

		<!-- Current Task -->
		<div class="mb-3">
			<div class="text-xs font-medium text-base-content/70 mb-1">Current Task:</div>
			{#if currentTask()}
				<div class="bg-base-200 rounded p-2">
					<div class="flex items-center gap-2 mb-1">
						<span class="text-xs font-mono text-base-content/50">{currentTask().id}</span>
						<div class="flex-1 w-full bg-base-300 rounded-full h-1.5">
							<div class="bg-primary h-1.5 rounded-full transition-all" style="width: {getTaskProgress(currentTask())}%"></div>
						</div>
						<span class="text-xs text-base-content/50 font-medium">{getTaskProgress(currentTask())}%</span>
					</div>
					<p class="text-xs text-base-content truncate" title={currentTask().title}>
						{currentTask().title}
					</p>
				</div>
			{:else}
				<div class="bg-base-200 rounded p-2 text-center">
					<p class="text-xs text-base-content/50 italic">No active task</p>
				</div>
			{/if}
		</div>

		<!-- Queued Tasks -->
		<div class="mb-3">
			<div class="text-xs font-medium text-base-content/70 mb-1">
				Queue ({queuedTasks().length}):
			</div>
			{#if queuedTasks().length > 0}
				<div class="space-y-1">
					{#each queuedTasks().slice(0, 3) as task}
						<div class="bg-base-200 rounded px-2 py-1">
							<p class="text-xs text-base-content truncate" title={task.title}>
								• {task.title}
							</p>
						</div>
					{/each}
					{#if queuedTasks().length > 3}
						<div class="text-xs text-base-content/50 text-center">
							+{queuedTasks().length - 3} more
						</div>
					{/if}
				</div>
			{:else}
				<div class="bg-base-200 rounded p-2 text-center">
					<p class="text-xs text-base-content/50 italic">No queued tasks</p>
				</div>
			{/if}
		</div>

		<!-- File Locks -->
		<div>
			<div class="text-xs font-medium text-base-content/70 mb-1">
				File Locks ({agentLocks().length}):
			</div>
			{#if agentLocks().length > 0}
				<div class="space-y-1">
					{#each agentLocks().slice(0, 2) as lock}
						<div class="bg-warning/10 rounded px-2 py-1">
							<p class="text-xs text-warning truncate" title={lock.file_pattern || lock.pattern}>
								🔒 {lock.file_pattern || lock.pattern}
							</p>
						</div>
					{/each}
					{#if agentLocks().length > 2}
						<div class="text-xs text-base-content/50 text-center">
							+{agentLocks().length - 2} more
						</div>
					{/if}
				</div>
			{:else}
				<div class="bg-base-200 rounded p-2 text-center">
					<p class="text-xs text-base-content/50 italic">No file locks</p>
				</div>
			{/if}
		</div>

		<!-- Capacity Indicator -->
		<div class="mb-3">
			<div class="text-xs font-medium text-base-content/70 mb-1">
				Capacity: {taskCapacity().total}/{taskCapacity().max} tasks
			</div>
			<div class="flex items-center gap-2">
				<div class="flex-1 bg-base-300 rounded-full h-2">
					<div
						class="h-2 rounded-full transition-all {taskCapacity().status === 'good' ? 'bg-success' : taskCapacity().status === 'moderate' ? 'bg-warning' : 'bg-error'}"
						style="width: {taskCapacity().percentage}%"
					></div>
				</div>
				<span class="text-xs font-medium {taskCapacity().status === 'good' ? 'text-success' : taskCapacity().status === 'moderate' ? 'text-warning' : 'text-error'}">
					{Math.round(taskCapacity().percentage)}%
				</span>
			</div>
		</div>

		<!-- Drop Zone Indicator -->
		<div class="mt-3 pt-3 border-t border-base-300 text-center">
			{#if isAssigning}
				<div class="flex items-center justify-center gap-2">
					<span class="loading loading-spinner loading-xs"></span>
					<p class="text-xs text-base-content/70">Assigning task...</p>
				</div>
			{:else if isDragOver && hasConflict}
				<div class="space-y-1">
					<p class="text-xs text-error font-medium flex items-center justify-center gap-1">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
						</svg>
						File Conflict!
					</p>
					<div class="text-xs text-error/80 max-h-20 overflow-y-auto">
						{#each conflictReasons as reason}
							<p class="truncate" title={reason}>• {reason}</p>
						{/each}
					</div>
				</div>
			{:else if isDragOver}
				<p class="text-xs text-success font-medium flex items-center justify-center gap-1">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					Drop to assign to {agent.name}
				</p>
			{:else}
				<p class="text-xs text-base-content/50">Drop task here to assign</p>
			{/if}
		</div>
	</div>
</div>

<!-- Delete Agent Confirmation Modal -->
{#if showDeleteModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg mb-4">Delete Agent?</h3>
			<div class="space-y-3">
				<p class="text-base-content/80">
					Are you sure you want to delete <strong class="text-error">{agent.name}</strong>?
				</p>
				<div class="bg-base-200 rounded p-3 space-y-2 text-sm">
					<p class="text-base-content/70">
						<strong>Agent:</strong> {agent.name}
					</p>
					<p class="text-base-content/70">
						<strong>Last active:</strong> {formatLastActivity(agent.last_active_ts)}
					</p>
					<p class="text-base-content/70">
						<strong>Status:</strong> Offline (inactive for over 1 hour)
					</p>
				</div>
				<div class="alert alert-warning">
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
					<div class="text-xs">
						<p class="font-semibold">This action cannot be undone.</p>
						<p>Messages and task history will be preserved.</p>
						<p>Active reservations will be released.</p>
					</div>
				</div>
			</div>
			<div class="modal-action">
				<button
					class="btn btn-ghost"
					onclick={() => { showDeleteModal = false; }}
					disabled={isDeleting}
				>
					Cancel
				</button>
				<button
					class="btn btn-error"
					onclick={handleDeleteAgent}
					disabled={isDeleting}
				>
					{#if isDeleting}
						<span class="loading loading-spinner loading-sm"></span>
						Deleting...
					{:else}
						Delete Agent
					{/if}
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => { if (!isDeleting) showDeleteModal = false; }}></div>
	</div>
{/if}

<!-- Quick Actions Context Menu -->
{#if showQuickActions}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50" onclick={closeQuickActions}>
		<div
			class="absolute bg-base-100 border border-base-300 rounded-lg shadow-xl py-2 min-w-[200px]"
			style="left: {quickActionsX}px; top: {quickActionsY}px;"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="px-3 py-2 text-xs font-semibold text-base-content/50 border-b border-base-300">
				Quick Actions: {agent.name}
			</div>

			<button
				class="w-full px-3 py-2 text-left text-sm hover:bg-base-200 transition-colors flex items-center gap-2"
				onclick={viewInbox}
				disabled={quickActionsLoading === 'inbox'}
			>
				{#if quickActionsLoading === 'inbox'}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					<span>📬</span>
				{/if}
				View Inbox
			</button>

			<button
				class="w-full px-3 py-2 text-left text-sm hover:bg-base-200 transition-colors flex items-center gap-2"
				onclick={viewReservations}
				disabled={quickActionsLoading === 'reservations'}
			>
				{#if quickActionsLoading === 'reservations'}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					<span>🔒</span>
				{/if}
				View File Locks
			</button>

			<button
				class="w-full px-3 py-2 text-left text-sm hover:bg-base-200 transition-colors flex items-center gap-2"
				onclick={openSendMessage}
			>
				<span>✉️</span>
				Send Message
			</button>

			<div class="border-t border-base-300 my-1"></div>

			<button
				class="w-full px-3 py-2 text-left text-sm hover:bg-error hover:text-error-content transition-colors flex items-center gap-2"
				onclick={confirmClearQueue}
			>
				<span>🗑️</span>
				Clear Agent's Queue
			</button>

			<button
				class="w-full px-3 py-2 text-left text-sm hover:bg-warning hover:text-warning-content transition-colors flex items-center gap-2"
				onclick={confirmUnassignTask}
				disabled={!currentTask()}
			>
				<span>⏸️</span>
				Unassign Current Task
			</button>
		</div>
	</div>
{/if}

<!-- Inbox Modal -->
{#if showInboxModal}
	<div class="modal modal-open">
		<div class="modal-box max-w-2xl">
			<h3 class="font-bold text-lg mb-4">📬 Inbox: {agent.name}</h3>
			{#if inboxMessages.length === 0}
				<p class="text-base-content/50">No messages in inbox</p>
			{:else}
				<div class="space-y-2 max-h-96 overflow-y-auto">
					{#each inboxMessages as message}
						<div class="bg-base-200 p-3 rounded">
							<div class="flex justify-between items-start mb-1">
								<span class="font-semibold text-sm">{message.subject}</span>
								<span class="text-xs text-base-content/50">{message.timestamp}</span>
							</div>
							<p class="text-xs text-base-content/70">From: {message.from}</p>
							<p class="text-sm mt-2">{message.body}</p>
						</div>
					{/each}
				</div>
			{/if}
			<div class="modal-action">
				<button class="btn" onclick={() => { showInboxModal = false; }}>Close</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => { showInboxModal = false; }}></div>
	</div>
{/if}

<!-- Reservations Modal -->
{#if showReservationsModal}
	<div class="modal modal-open">
		<div class="modal-box max-w-2xl">
			<h3 class="font-bold text-lg mb-4">🔒 File Locks: {agent.name}</h3>
			{#if reservationsList.length === 0}
				<p class="text-base-content/50">No active file locks</p>
			{:else}
				<div class="space-y-2 max-h-96 overflow-y-auto">
					{#each reservationsList as lock}
						<div class="bg-warning/10 p-3 rounded">
							<div class="flex justify-between items-start mb-1">
								<span class="font-mono text-sm font-semibold">{lock.pattern}</span>
								<span class="badge badge-sm {lock.exclusive ? 'badge-error' : 'badge-warning'}">
									{lock.exclusive ? 'Exclusive' : 'Shared'}
								</span>
							</div>
							<p class="text-xs text-base-content/70">Reason: {lock.reason || 'N/A'}</p>
							<p class="text-xs text-base-content/50">Expires: {lock.expires_ts}</p>
						</div>
					{/each}
				</div>
			{/if}
			<div class="modal-action">
				<button class="btn" onclick={() => { showReservationsModal = false; }}>Close</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => { showReservationsModal = false; }}></div>
	</div>
{/if}

<!-- Send Message Modal -->
{#if showSendMessageModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg mb-4">✉️ Send Message to {agent.name}</h3>
			<div class="space-y-4">
				<div class="form-control">
					<label class="label">
						<span class="label-text">Subject</span>
					</label>
					<input
						type="text"
						bind:value={messageSubject}
						placeholder="Message subject"
						class="input input-bordered"
					/>
				</div>
				<div class="form-control">
					<label class="label">
						<span class="label-text">Message</span>
					</label>
					<textarea
						bind:value={messageBody}
						placeholder="Your message..."
						class="textarea textarea-bordered h-32"
					></textarea>
				</div>
			</div>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => { showSendMessageModal = false; }}>Cancel</button>
				<button class="btn btn-primary" onclick={sendMessage}>Send</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => { showSendMessageModal = false; }}></div>
	</div>
{/if}

<!-- Clear Queue Confirmation Modal -->
{#if showClearQueueModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg mb-4">Clear Agent's Queue?</h3>
			<div class="space-y-3">
				<p class="text-base-content/80">
					This will unassign all open tasks from <strong class="text-error">{agent.name}</strong>.
				</p>
				<div class="alert alert-warning">
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
					<span>This action cannot be undone. Tasks will return to the unassigned pool.</span>
				</div>
			</div>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => { showClearQueueModal = false; }}>Cancel</button>
				<button class="btn btn-error" onclick={clearQueue}>Clear Queue</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => { showClearQueueModal = false; }}></div>
	</div>
{/if}

<!-- Unassign Task Confirmation Modal -->
{#if showUnassignModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg mb-4">Unassign Current Task?</h3>
			{#if currentTask()}
				<div class="space-y-3">
					<p class="text-base-content/80">
						Unassign task <strong class="text-warning">{currentTask().id}</strong> from {agent.name}?
					</p>
					<div class="bg-base-200 rounded p-3">
						<p class="text-sm font-semibold">{currentTask().title}</p>
						<p class="text-xs text-base-content/50 mt-1">{currentTask().id}</p>
					</div>
					<div class="alert alert-info">
						<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<span class="text-xs">Task will return to unassigned pool. Progress will be preserved.</span>
					</div>
				</div>
			{/if}
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => { showUnassignModal = false; }}>Cancel</button>
				<button class="btn btn-warning" onclick={unassignCurrentTask}>Unassign Task</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => { showUnassignModal = false; }}></div>
	</div>
{/if}
