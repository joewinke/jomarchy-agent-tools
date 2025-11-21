<script>
	import { onMount } from 'svelte';
	import { analyzeDependencies } from '$lib/utils/dependencyUtils';
	import { getTokenColorClass, HIGH_USAGE_WARNING_THRESHOLD } from '$lib/config/tokenUsageConfig';
	import Sparkline from '$lib/components/Sparkline.svelte';

	let { agent, tasks = [], allTasks = [], reservations = [], onTaskAssign = () => {}, draggedTaskId = null } = $props();

	let isDragOver = $state(false);
	let isAssigning = $state(false);
	let assignSuccess = $state(false);
	let assignError = $state(null);
	let hasConflict = $state(false);
	let conflictReasons = $state([]);
	let hasDependencyBlock = $state(false);
	let dependencyBlockReason = $state('');
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
	let showActivityHistory = $state(false);

	// Token usage state management
	let usageLoading = $state(false);
	let usageError = $state(null);
	let usageRetryCount = $state(0);

	// Sparkline state management
	let sparklineData = $state([]);
	let sparklineLoading = $state(false);
	let sparklineError = $state(null);
	let sparklineInterval = null;

	// Compute agent status using $derived
	// States: live (< 1m, truly responsive) > working (1-10m with task) > active (recent activity) > idle (within 1h) > offline (>1h)
	const agentStatus = $derived(() => {
		const hasActiveLocks = agent.reservation_count > 0;
		const hasInProgressTask = agent.in_progress_tasks > 0;

		// Calculate time since last activity
		let timeSinceActive = Infinity;
		if (agent.last_active_ts) {
			const isoTimestamp = agent.last_active_ts.includes('T')
				? agent.last_active_ts
				: agent.last_active_ts.replace(' ', 'T') + 'Z';
			const lastActivity = new Date(isoTimestamp);
			timeSinceActive = Date.now() - lastActivity.getTime();
		}

		// Priority 1: WORKING - Has active task or file locks
		// Agent has work in progress (takes priority over recency)
		if (hasInProgressTask || hasActiveLocks) {
			return 'working';
		}

		// Priority 2: LIVE - Very recent activity (< 1 minute) without active work
		// Agent is truly responsive right now but not actively working
		if (timeSinceActive < 60000) { // < 1 minute
			return 'live';
		}

		// Priority 3: ACTIVE - Recent activity (< 10 minutes) but no current work
		// OR has locks but not super recent
		if (timeSinceActive < 600000) { // < 10 minutes
			return 'active';
		}
		if (hasActiveLocks && timeSinceActive < 3600000) { // has locks, within hour
			return 'active';
		}

		// Priority 4: IDLE - Within 1 hour but not active
		if (timeSinceActive < 3600000) { // 1 hour
			return 'idle';
		}

		// Priority 5: OFFLINE - Over 1 hour or never active
		return 'offline';
	});

	// Get status badge class
	function getStatusBadge(status) {
		switch (status) {
			case 'live':
				return 'badge-success'; // Green - truly responsive (< 1m)
			case 'working':
				return 'badge-info'; // Blue - actively coding (1-10m)
			case 'active':
				return 'badge-accent'; // Purple/accent - recent activity
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
			case 'live':
				return '●'; // Solid dot - truly live/responsive
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

		// Prevent drop if there's a dependency block
		if (hasDependencyBlock) {
			console.warn('Cannot assign task: has unresolved dependencies');
			hasDependencyBlock = false;
			dependencyBlockReason = '';
			return;
		}

		// Prevent drop if there's a conflict
		if (hasConflict) {
			console.warn('Cannot assign task: file reservation conflict');
			hasConflict = false;
			conflictReasons = [];
			return;
		}

		const taskId = event.dataTransfer.getData('text/plain');
		if (!taskId) return;

		// Clear previous errors and show loading state
		assignError = null;
		isAssigning = true;

		try {
			// Call parent callback to assign task with timeout (30 seconds)
			const timeoutPromise = new Promise((_, reject) =>
				setTimeout(() => reject(new Error('Assignment timed out after 30 seconds')), 30000)
			);

			await Promise.race([
				onTaskAssign(taskId, agent.name),
				timeoutPromise
			]);

			// Success - show success animation!
			assignError = null;
			isAssigning = false;
			assignSuccess = true;

			// Auto-hide success animation after 2 seconds
			setTimeout(() => {
				assignSuccess = false;
			}, 2000);
		} catch (error) {
			console.error('Failed to assign task:', error);
			assignError = error.message || 'Failed to assign task';
			isAssigning = false;

			// Auto-clear error after 5 seconds
			setTimeout(() => {
				assignError = null;
			}, 5000);
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

		// Check for dependency blocks
		const taskId = event.dataTransfer.getData('text/plain');
		const task = tasks.find((t) => t.id === taskId);
		if (task) {
			const depStatus = analyzeDependencies(task);
			hasDependencyBlock = depStatus.hasBlockers;
			dependencyBlockReason = depStatus.blockingReason || '';
		}

		// Check for conflicts with the dragged task (only if not dependency-blocked)
		if (!hasDependencyBlock) {
			const conflictResult = detectConflicts(taskId);
			hasConflict = conflictResult.hasConflict;
			conflictReasons = conflictResult.reasons;
		}

		// Set drag effect based on blocks
		event.dataTransfer.dropEffect = hasDependencyBlock || hasConflict ? 'none' : 'move';
	}

	function handleDragLeave() {
		isDragOver = false;
		hasConflict = false;
		conflictReasons = [];
		hasDependencyBlock = false;
		dependencyBlockReason = '';
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

	// Format token count with K/M suffix
	function formatTokens(tokens) {
		if (tokens === 0) return '0';
		if (tokens < 1000) return tokens.toLocaleString();
		if (tokens < 1000000) return (tokens / 1000).toFixed(1) + 'K';
		return (tokens / 1000000).toFixed(2) + 'M';
	}

	// Format cost with $ prefix
	function formatCost(cost) {
		if (cost === 0) return '$0.00';
		return '$' + cost.toFixed(2);
	}

	// Fetch sparkline data for this agent
	async function fetchSparklineData() {
		try {
			sparklineLoading = true;
			sparklineError = null;

			const response = await fetch(`/api/agents/sparkline?range=24h&agent=${encodeURIComponent(agent.name)}`);

			if (!response.ok) {
				throw new Error(`Failed to fetch sparkline data: ${response.statusText}`);
			}

			const data = await response.json();
			sparklineData = data.data || [];

		} catch (error) {
			console.error('Error fetching sparkline data:', error);
			sparklineError = error.message;
			sparklineData = [];
		} finally {
			sparklineLoading = false;
		}
	}

	// Setup sparkline auto-refresh on mount
	onMount(() => {
		// Initial fetch
		fetchSparklineData();

		// Setup 30-second polling interval
		sparklineInterval = setInterval(fetchSparklineData, 30000);

		// Cleanup on unmount
		return () => {
			if (sparklineInterval) {
				clearInterval(sparklineInterval);
			}
		};
	});

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

	// Release a file reservation
	async function releaseReservation(lockId, pattern) {
		if (!confirm(`Release lock on ${pattern}?\n\nThis will allow other agents to modify these files.`)) {
			return;
		}

		try {
			const response = await fetch(`/api/agents/${agent.name}/reservations?id=${lockId}`, {
				method: 'DELETE'
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || 'Failed to release reservation');
			}

			// Refresh the reservations list
			const refreshResponse = await fetch(`/api/agents/${agent.name}/reservations`);
			const refreshData = await refreshResponse.json();
			reservationsList = refreshData.reservations || [];

			// Show success message
			alert(`✓ Released lock on ${pattern}`);

		} catch (error) {
			console.error('Failed to release reservation:', error);
			alert(`Failed to release reservation: ${error.message}`);
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

	// Retry fetching token usage (exponential backoff)
	async function retryFetchUsage() {
		if (usageRetryCount >= 3) {
			usageError = 'Max retry attempts reached (3). Please refresh the page.';
			return;
		}

		usageLoading = true;
		usageError = null;

		// Exponential backoff: 1s, 2s, 4s
		const delay = Math.pow(2, usageRetryCount) * 1000;
		await new Promise(resolve => setTimeout(resolve, delay));

		try {
			// Trigger parent page to refetch agent data
			// For now, just reload the page (could be improved with proper state management)
			window.location.reload();
		} catch (error) {
			usageError = error.message || 'Failed to fetch token usage';
			usageRetryCount++;
		} finally {
			usageLoading = false;
		}
	}

	// Check if usage data is stale (>5 minutes old)
	function isUsageStale() {
		if (!agent.usage || !agent.usage.lastUpdated) return false;

		const lastUpdated = new Date(agent.usage.lastUpdated);
		const now = new Date();
		const diffMs = now - lastUpdated;
		const diffMinutes = diffMs / 60000;

		return diffMinutes > 5;
	}
</script>

<div
	class="card bg-base-100 border-2 transition-all relative {isDragOver && hasConflict ? 'border-error border-dashed bg-error/10 scale-105' : isDragOver ? 'border-success border-dashed bg-success/10 scale-105' : assignSuccess ? 'border-success bg-success/5 animate-pulse' : 'border-base-300 hover:border-primary'} {isAssigning || assignSuccess ? 'pointer-events-none' : ''}"
	role="button"
	tabindex="0"
	ondrop={handleDrop}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	oncontextmenu={handleContextMenu}
>
	<!-- Loading Overlay -->
	{#if isAssigning}
		<div class="absolute inset-0 bg-base-300/80 backdrop-blur-sm rounded-lg z-50 flex items-center justify-center">
			<div class="text-center">
				<span class="loading loading-spinner loading-lg text-primary"></span>
				<p class="text-sm font-medium text-base-content mt-2">Assigning task...</p>
			</div>
		</div>
	{/if}

	<!-- Success Animation Overlay -->
	{#if assignSuccess}
		<div class="absolute inset-0 bg-success/20 backdrop-blur-sm rounded-lg z-50 flex items-center justify-center animate-in fade-in duration-300">
			<div class="text-center animate-in zoom-in duration-500">
				<!-- Large checkmark circle -->
				<div class="mx-auto w-20 h-20 bg-success rounded-full flex items-center justify-center mb-3 animate-bounce">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-success-content" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				</div>
				<p class="text-lg font-bold text-success">Task Assigned!</p>
				<p class="text-sm text-success-content/80 mt-1">Successfully added to queue</p>
			</div>
		</div>
	{/if}

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
				class="badge badge-sm {getStatusBadge(agentStatus())} {agentStatus() === 'offline' ? 'cursor-pointer hover:badge-error hover:scale-110 transition-all' : 'cursor-default'} {agentStatus() === 'live' ? 'animate-pulse' : ''}"
				onclick={handleBadgeClick}
				disabled={agentStatus() !== 'offline'}
				title={agentStatus() === 'offline' ? 'Click to delete agent' : agentStatus() === 'live' ? 'Responsive right now (< 1 minute)' : agentStatus() === 'working' ? 'Working recently (1-10 minutes)' : ''}
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
					<p class="text-xs text-base-content/50 italic">Drop task here to assign</p>
				</div>
			{/if}
		</div>

		{#if queuedTasks().length > 0}
		<!--
		╔════════════════════════════════════════════════════════════════════════════╗
		║ UNIFIED QUEUE / DROP ZONE PATTERN                                         ║
		╚════════════════════════════════════════════════════════════════════════════╝

		DESIGN DECISION: Queue and Drop Zone are merged into a single section

		WHY THIS PATTERN?
		• Reduces visual redundancy (one section instead of two)
		• Lowers cognitive load (clearer UX with less clutter)
		• Better space utilization on agent cards
		• Natural drop target (entire queue section is droppable)

		VISUAL STATES (5 states):

		1. DEFAULT (has queued tasks):
		   - Solid border (border-base-300)
		   - Shows list of queued tasks (up to 3 visible)
		   - "+N more" indicator if > 3 tasks

		2. DRAG OVER + SUCCESS:
		   - Dashed green border (border-success border-dashed)
		   - Green background tint (bg-success/10)
		   - Checkmark icon + "Drop to assign to {agent}" message
		   - Scale up effect (scale-105)

		3. DRAG OVER + DEPENDENCY BLOCK:
		   - Dashed red border (border-error border-dashed)
		   - Red background tint (bg-error/10)
		   - X icon + "Dependency Block!" header
		   - Shows specific blocking reason
		   - Drop is prevented (cursor: not-allowed)

		4. DRAG OVER + FILE CONFLICT:
		   - Dashed red border (border-error border-dashed)
		   - Red background tint (bg-error/10)
		   - Warning icon + "File Conflict!" header
		   - Lists conflicting file patterns
		   - Drop is prevented (cursor: not-allowed)

		5. ASSIGNING (loading):
		   - Loading spinner
		   - "Assigning task..." message
		   - Disabled pointer events during assignment

		DRAG-DROP INTERACTION:
		• Entire section is a drop target (not just empty space)
		• Parent card handles drop logic (lines 183-235)
		• Conflict detection runs on dragover (lines 322-344)
		• New tasks are added to top of queue after assignment
		• Visual feedback is immediate and clear

		USER PREFERENCES THAT INFORMED THIS DESIGN:
		• Users preferred cleaner, less busy interface
		• Separate drop zone felt redundant when queue exists
		• Visual feedback should be inline (not modal/toast)
		• Error messages should be detailed and actionable

		IMPLEMENTATION NOTES:
		• State management: isDragOver, hasConflict, hasDependencyBlock
		• Border and background change reactively based on drag state
		• Drop handler validates dependencies + conflicts before assignment
		• Entire section scales on hover for clear drop affordance
	-->
	<!-- Queued Tasks / Drop Zone (Unified) -->
		<div class="mb-3">
			<div class="text-xs font-medium text-base-content/70 mb-1">
				Queue ({queuedTasks().length}):
			</div>

				<div class="space-y-1">
					{#each queuedTasks().slice(0, 3) as task}
						<div class="bg-base-200 rounded px-2 py-1">
							<div class="flex items-center gap-2">
								<span class="text-xs font-mono text-base-content/50">{task.id}</span>
								<p class="text-xs text-base-content truncate flex-1" title={task.title}>
									{task.title}
								</p>
							</div>
						</div>
					{/each}
					{#if queuedTasks().length > 3}
						<div class="text-xs text-base-content/50 text-center">
							+{queuedTasks().length - 3} more
						</div>
					{/if}
				</div>

				<!-- Drag-over feedback when has tasks -->
				{#if isDragOver}
					<div class="mt-2 pt-2 border-t border-base-300 text-center">
						{#if isAssigning}
							<div class="flex items-center justify-center gap-2">
								<span class="loading loading-spinner loading-xs"></span>
								<p class="text-xs text-base-content/70">Assigning task...</p>
							</div>
						{:else if hasDependencyBlock}
							<div class="space-y-1">
								<p class="text-xs text-error font-medium flex items-center justify-center gap-1">
									<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
										<path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
									</svg>
									Dependency Block!
								</p>
								<div class="text-xs text-error/80">
									<p>🚫 {dependencyBlockReason}</p>
									<p class="mt-1 text-base-content/60">Complete blocking tasks first</p>
								</div>
							</div>
						{:else if hasConflict}
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
						{:else}
							<p class="text-xs text-success font-medium flex items-center justify-center gap-1">
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								Drop to assign to {agent.name}
							</p>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Assignment Error Alert -->
		{#if assignError}
			<div class="mb-3">
				<div class="alert alert-error text-xs py-2">
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-4 w-4" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span>{assignError}</span>
				</div>
			</div>
		{/if}

		<!-- File Locks -->
		<div>
			<div class="text-xs font-medium text-base-content/70 mb-1">
				File Locks ({agentLocks().length}):
			</div>
			{#if agentLocks().length > 0}
				<div class="space-y-1">
					{#each agentLocks().slice(0, 2) as lock}
						<div class="bg-warning/10 rounded px-2 py-1">
							<p class="text-xs text-warning truncate" title={lock.path_pattern}>
								🔒 {lock.path_pattern}
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

		<!-- Token Usage -->
		<div class="mb-3">
			<div class="flex items-center justify-between text-xs font-medium text-base-content/70 mb-1">
				<span>Token Usage:</span>
				{#if agent.usage && isUsageStale()}
					<button
						class="text-warning hover:text-warning-focus flex items-center gap-0.5"
						onclick={retryFetchUsage}
						title="Data is stale (>5 minutes old). Click to refresh."
					>
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3">
							<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
						</svg>
						<span class="text-[10px]">Refresh</span>
					</button>
				{/if}
			</div>

			{#if usageLoading}
				<!-- Loading State: Skeleton Loader -->
				<div class="space-y-1">
					<div class="skeleton h-16 w-full rounded"></div>
					<div class="skeleton h-16 w-full rounded"></div>
				</div>

			{:else if usageError}
				<!-- Error State: Inline Error with Retry -->
				<div class="bg-error/10 border border-error/30 rounded p-3">
					<div class="flex items-start gap-2">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-error shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
						<div class="flex-1">
							<p class="text-xs font-medium text-error">Failed to load usage data</p>
							<p class="text-xs text-error/70 mt-0.5">{usageError}</p>
							{#if usageRetryCount < 3}
								<button
									class="btn btn-xs btn-error btn-outline mt-2"
									onclick={retryFetchUsage}
								>
									Retry ({usageRetryCount}/3)
								</button>
							{/if}
						</div>
					</div>
				</div>

			{:else if !agent.usage || (agent.usage.today.total_tokens === 0 && agent.usage.week.total_tokens === 0)}
				<!-- Empty State: No Usage Data -->
				<div class="bg-base-200 rounded p-3 text-center">
					<p class="text-xs text-base-content/50">No usage data yet</p>
					<p class="text-xs text-base-content/40 mt-0.5">Agent hasn't made any API calls</p>
				</div>

			{:else}
				<!-- Success State: Show Usage Data -->
				<!-- Today's Usage -->
				<div class="bg-base-200 rounded px-2 py-1.5 mb-1">
					<div class="flex items-center justify-between text-xs mb-1">
						<span class="text-base-content/70">Today:</span>
						<span class="font-mono font-medium {getTokenColorClass(agent.usage.today.total_tokens)}">
							{formatTokens(agent.usage.today.total_tokens)}
						</span>
					</div>
					<div class="flex items-center justify-between text-xs">
						<span class="text-base-content/50">Cost:</span>
						<span class="font-mono text-base-content/70">
							{formatCost(agent.usage.today.cost)}
						</span>
					</div>
					{#if agent.usage.today.total_tokens > HIGH_USAGE_WARNING_THRESHOLD}
						<div class="mt-1 flex items-center gap-1">
							<span class="badge badge-error badge-xs">⚠ High Usage</span>
						</div>
					{/if}
				</div>

				<!-- Week's Usage (only show if different from today) -->
				{#if agent.usage.week.total_tokens !== agent.usage.today.total_tokens}
					<div class="bg-base-200 rounded px-2 py-1.5">
						<div class="flex items-center justify-between text-xs mb-1">
							<span class="text-base-content/70">This Week:</span>
							<span class="font-mono font-medium text-base-content">
								{formatTokens(agent.usage.week.total_tokens)}
							</span>
						</div>
						<div class="flex items-center justify-between text-xs">
							<span class="text-base-content/50">Cost:</span>
							<span class="font-mono text-base-content/70">
								{formatCost(agent.usage.week.cost)}
							</span>
						</div>
						{#if agent.usage.week.sessionCount > 0}
							<div class="flex items-center justify-between text-xs mt-1">
								<span class="text-base-content/50">Sessions:</span>
								<span class="text-base-content/70">
									{agent.usage.week.sessionCount}
								</span>
							</div>
						{/if}
					</div>
				{/if}
			{/if}
		</div>

		<!-- Token Usage Sparkline -->
		<div class="mb-3">
			<div class="text-xs font-medium text-base-content/70 mb-1">
				<span>Usage Trend (24h):</span>
			</div>

			{#if sparklineLoading && sparklineData.length === 0}
				<!-- Initial Loading State -->
				<div class="bg-base-200 rounded p-2 flex items-center justify-center">
					<div class="loading loading-spinner loading-xs text-primary"></div>
					<span class="text-xs text-base-content/50 ml-2">Loading...</span>
				</div>

			{:else if sparklineError && sparklineData.length === 0}
				<!-- Error State (only show if no data at all) -->
				<div class="bg-base-200 rounded p-2 text-center">
					<p class="text-xs text-base-content/50">Unable to load trend data</p>
				</div>

			{:else if sparklineData.length === 0}
				<!-- No Data State -->
				<div class="bg-base-200 rounded p-2 text-center">
					<p class="text-xs text-base-content/50">No trend data available</p>
				</div>

			{:else}
				<!-- Success State: Show Sparkline -->
				<div class="bg-base-200 rounded p-2">
					<Sparkline
						data={sparklineData}
						height={40}
						showTooltip={true}
						colorMode="usage"
					/>
				</div>
			{/if}
		</div>

		<!-- Recent Activity Feed -->
		<div class="mb-3">
			<div class="flex items-center justify-between text-xs font-medium text-base-content/70 mb-1">
				<span>Recent Activity:</span>
				{#if agent.activities && agent.activities.length > 1}
					<button
						class="text-primary hover:text-primary-focus"
						onclick={() => showActivityHistory = !showActivityHistory}
					>
						{showActivityHistory ? '▼' : '▶'} History
					</button>
				{/if}
			</div>
			<div class="bg-base-200 rounded px-2 py-1.5">
				{#if agent.current_activity}
					<!-- Show current activity from activity log -->
					<div class="flex items-center justify-between text-xs mb-1">
						<span class="text-base-content/70">Now:</span>
						<span class="font-medium text-success">
							{formatLastActivity(agent.current_activity.ts)}
						</span>
					</div>
					<div
						class="flex items-center gap-1 text-xs mt-1"
						class:text-success={agentStatus() === 'live'}
						class:text-info={agentStatus() === 'working'}
						class:text-base-content={agentStatus() !== 'live' && agentStatus() !== 'working'}
						title={agent.current_activity.content || agent.current_activity.preview}
					>
						{#if agentStatus() === 'live'}
							<span class="inline-block w-1.5 h-1.5 bg-success rounded-full animate-pulse"></span>
						{/if}
						<span class="font-semibold truncate">
							{agent.current_activity.preview || agent.current_activity.content || 'Active'}
						</span>
					</div>
				{:else}
					<!-- Fallback to generic status if no activity log -->
					<div class="flex items-center justify-between text-xs">
						<span class="text-base-content/70">Last seen:</span>
						<span class="font-medium {agentStatus() === 'live' ? 'text-success' : agentStatus() === 'working' ? 'text-info' : 'text-base-content/50'}">
							{formatLastActivity(agent.last_active_ts)}
						</span>
					</div>
					{#if agentStatus() === 'live'}
						<div class="flex items-center gap-1 text-xs text-success mt-1">
							<span class="inline-block w-1.5 h-1.5 bg-success rounded-full animate-pulse"></span>
							<span class="font-semibold">Responsive now</span>
						</div>
					{:else if agentStatus() === 'working'}
						<div class="text-xs text-info/70 mt-1">
							Working on task
						</div>
					{/if}
				{/if}

				<!-- Activity History (expandable) -->
				{#if showActivityHistory && agent.activities && agent.activities.length > 1}
					<div class="mt-2 pt-2 border-t border-base-300 space-y-1">
						{#each agent.activities.slice(1) as activity}
							<div
								class="text-xs text-base-content/60 flex items-start gap-1 hover:bg-base-300 rounded px-1 py-0.5 cursor-help"
								title={activity.content || activity.preview}
							>
								<span class="text-base-content/40 shrink-0">
									{new Date(activity.ts).toLocaleTimeString()}
								</span>
								<span class="truncate">
									{activity.preview || activity.content || activity.type}
								</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
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

			<div class="border-t border-base-300 my-1"></div>

			<button
				class="w-full px-3 py-2 text-left text-sm hover:bg-error hover:text-error-content transition-colors flex items-center gap-2"
				onclick={() => {
					showDeleteModal = true;
					closeQuickActions();
				}}
			>
				<span>🗑️</span>
				Delete Agent
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
								<div class="flex gap-2 items-center">
									<span class="badge badge-sm {lock.exclusive ? 'badge-error' : 'badge-warning'}">
										{lock.exclusive ? 'Exclusive' : 'Shared'}
									</span>
									<button
										class="btn btn-xs btn-error btn-outline"
										onclick={() => releaseReservation(lock.id, lock.pattern)}
										title="Release this lock"
									>
										Release
									</button>
								</div>
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
