/**
 * Agents Store
 *
 * Reactive Svelte 5 store that polls the /api/agents endpoint
 * for real-time agent coordination data.
 *
 * Usage:
 * ```svelte
 * <script lang="ts">
 *   import { agents } from '$lib/stores/agents.svelte';
 *
 *   // Access reactive state
 *   const agentList = $derived(agents.agents);
 *   const tasks = $derived(agents.tasks);
 * </script>
 * ```
 */

export interface AgentActivity {
	ts: string;
	agent: string;
	type: 'command' | 'prompt' | 'tool' | 'status';
	preview?: string;
	content?: string;
	cmd?: string;
	task?: string;
	tool?: string;
	file?: string;
}

export interface Agent {
	id: number;
	name: string;
	program: string;
	model: string;
	task_description: string;
	last_active_ts: string;
	reservation_count: number;
	task_count: number;
	open_tasks: number;
	in_progress_tasks: number;
	active: boolean;
	activities?: AgentActivity[];
	current_activity?: AgentActivity | null;
}

export interface Reservation {
	id: number;
	path_pattern: string;
	exclusive: number;
	reason: string;
	created_ts: string;
	expires_ts: string;
	released_ts: string | null;
	agent_name: string;
	project_path: string;
}

export interface Task {
	id: string;
	title: string;
	description: string;
	status: string;
	priority: number;
	issue_type: string;
	project: string;
	assignee?: string;
	labels: string[];
	depends_on?: Array<{ id: string; title: string; status: string }>;
	blocked_by?: Array<{ id: string; title: string; status: string }>;
}

export interface AgentsData {
	agents: Agent[];
	reservations: Reservation[];
	reservations_by_agent: Record<string, Reservation[]>;
	tasks: Task[];
	unassigned_tasks: Task[];
	task_stats: {
		total: number;
		open: number;
		in_progress: number;
		blocked: number;
		closed: number;
		by_priority: {
			p0: number;
			p1: number;
			p2: number;
			p3: number;
			p4: number;
		};
	};
	tasks_with_deps_count: number;
	tasks_with_deps: Task[];
	timestamp: string;
	meta: {
		poll_interval_ms: number;
		data_sources: string[];
		cache_ttl_ms: number;
	};
}

class AgentsStore {
	data = $state<AgentsData>({
		agents: [],
		reservations: [],
		reservations_by_agent: {},
		tasks: [],
		unassigned_tasks: [],
		task_stats: {
			total: 0,
			open: 0,
			in_progress: 0,
			blocked: 0,
			closed: 0,
			by_priority: { p0: 0, p1: 0, p2: 0, p3: 0, p4: 0 }
		},
		tasks_with_deps_count: 0,
		tasks_with_deps: [],
		timestamp: new Date().toISOString(),
		meta: {
			poll_interval_ms: 3000,
			data_sources: [],
			cache_ttl_ms: 2000
		}
	});

	loading = $state(false);
	error = $state<string | null>(null);
	private pollInterval: ReturnType<typeof setInterval> | null = null;

	// Derived state for convenient access
	get agents() {
		return this.data.agents;
	}

	get reservations() {
		return this.data.reservations;
	}

	get tasks() {
		return this.data.tasks;
	}

	get unassignedTasks() {
		return this.data.unassigned_tasks;
	}

	get taskStats() {
		return this.data.task_stats;
	}

	// Helper to compute agent status (matches AgentCard.svelte logic)
	private getAgentStatus(agent: Agent): 'live' | 'working' | 'active' | 'idle' | 'offline' {
		const hasActiveLocks = agent.reservation_count > 0;
		const hasInProgressTask = agent.in_progress_tasks > 0;

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
		// Agent is responsive but not actively working
		if (timeSinceActive < 60000) {
			return 'live';
		}

		// Priority 3: ACTIVE - Recent activity (< 10 minutes)
		if (timeSinceActive < 600000) {
			return 'active';
		}

		// Priority 4: IDLE - Within 1 hour
		if (timeSinceActive < 3600000) {
			return 'idle';
		}

		// Priority 5: OFFLINE
		return 'offline';
	}

	get liveAgents() {
		return this.data.agents.filter(a => this.getAgentStatus(a) === 'live');
	}

	get workingAgents() {
		return this.data.agents.filter(a => this.getAgentStatus(a) === 'working');
	}

	get activeAgents() {
		return this.data.agents.filter(a => this.getAgentStatus(a) === 'active');
	}

	get idleAgents() {
		return this.data.agents.filter(a => this.getAgentStatus(a) === 'idle');
	}

	get offlineAgents() {
		return this.data.agents.filter(a => this.getAgentStatus(a) === 'offline');
	}

	get availableAgents() {
		// Live, active, or idle agents (can take work)
		return this.data.agents.filter(a => {
			const status = this.getAgentStatus(a);
			return status === 'live' || status === 'active' || status === 'idle';
		});
	}

	/**
	 * Fetch fresh data from the API
	 */
	async fetch(options?: { project?: string; agent?: string }) {
		try {
			this.loading = true;
			this.error = null;

			const params = new URLSearchParams();
			if (options?.project) params.set('project', options.project);
			if (options?.agent) params.set('agent', options.agent);

			const url = `/api/agents?full=true${params.toString() ? `&${params}` : ''}`;
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const newData = await response.json();

			// Only update if we received valid data
			if (newData.agents || newData.tasks) {
				this.data = newData;
				this.error = null;
			}
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Unknown error occurred';
			console.error('Failed to fetch agent data:', err);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Start polling the API at the recommended interval
	 */
	startPolling(options?: { project?: string; agent?: string }) {
		// Initial fetch
		this.fetch(options);

		// Set up polling interval using the API's recommended interval
		const pollInterval = this.data.meta.poll_interval_ms || 3000;

		this.pollInterval = setInterval(() => {
			this.fetch(options);
		}, pollInterval);

		console.log(`Started polling agent data every ${pollInterval}ms`);
	}

	/**
	 * Stop polling
	 */
	stopPolling() {
		if (this.pollInterval) {
			clearInterval(this.pollInterval);
			this.pollInterval = null;
			console.log('Stopped polling agent data');
		}
	}

	/**
	 * Cleanup method for component unmount
	 */
	destroy() {
		this.stopPolling();
	}
}

// Export singleton instance
export const agents = new AgentsStore();
