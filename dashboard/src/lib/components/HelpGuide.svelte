<script lang="ts">
	/**
	 * HelpGuide.svelte
	 *
	 * Comprehensive help documentation modal for the Beads Task Dashboard.
	 * Documents the drawer sidebar navigation pattern and all dashboard features.
	 */

	let {
		isOpen = $bindable(false)
	} = $props();

	function closeModal() {
		isOpen = false;
	}
</script>

<!-- Help Modal -->
{#if isOpen}
	<div class="modal modal-open">
		<div class="modal-box max-w-4xl max-h-[90vh] overflow-y-auto">
			<!-- Header -->
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold">Dashboard Help Guide</h2>
				<button
					class="btn btn-sm btn-circle btn-ghost"
					onclick={closeModal}
					aria-label="Close help"
				>
					✕
				</button>
			</div>

			<!-- Content -->
			<div class="space-y-8">

				<!-- Getting Started -->
				<section>
					<h3 class="text-xl font-semibold mb-3 flex items-center gap-2">
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
						</svg>
						Getting Started
					</h3>
					<div class="space-y-2 text-sm">
						<p>Welcome to the Beads Task Dashboard! This dashboard helps you manage tasks across multiple projects with powerful filtering, visualization, and agent coordination features.</p>
						<p class="font-semibold mt-3">Key Features:</p>
						<ul class="list-disc list-inside space-y-1 ml-2">
							<li><strong>Drawer Sidebar Navigation:</strong> Quick access to all 5 main views</li>
							<li><strong>Multi-Project Support:</strong> Filter and manage tasks from multiple projects</li>
							<li><strong>Agent Coordination:</strong> Track agent activity, task assignments, and workload</li>
							<li><strong>Visual Task Management:</strong> Multiple view modes (List, Dependency, Timeline, Kanban)</li>
							<li><strong>Real-Time Updates:</strong> Live task status and agent activity tracking</li>
						</ul>
					</div>
				</section>

				<!-- Drawer Sidebar Navigation -->
				<section>
					<h3 class="text-xl font-semibold mb-3 flex items-center gap-2">
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
						</svg>
						Sidebar Navigation
					</h3>
					<div class="space-y-3 text-sm">
						<p>The dashboard uses a <strong>drawer sidebar pattern</strong> for navigation. The sidebar is always visible on desktop and can be toggled on mobile devices.</p>

						<div class="bg-base-200 p-3 rounded-lg">
							<p class="font-semibold mb-2">Sidebar Features:</p>
							<ul class="list-disc list-inside space-y-1 ml-2">
								<li><strong>Collapse/Expand:</strong> Toggle between icon-only and full-label modes</li>
								<li><strong>Tooltips:</strong> Hover over icons in collapsed mode to see route names</li>
								<li><strong>Active Indicator:</strong> Current route is highlighted with primary color</li>
								<li><strong>Mobile Overlay:</strong> On small screens, sidebar appears as an overlay drawer</li>
							</ul>
						</div>

						<p class="font-semibold mt-3">Available Routes:</p>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
							<div class="bg-base-200 p-2 rounded">
								<strong>📋 List View</strong> (/)
								<p class="text-xs mt-1">Traditional task list with filtering and sorting</p>
							</div>
							<div class="bg-base-200 p-2 rounded">
								<strong>🔗 Dependency</strong> (/dependency)
								<p class="text-xs mt-1">Visualize task dependencies and relationships</p>
							</div>
							<div class="bg-base-200 p-2 rounded">
								<strong>📅 Timeline</strong> (/timeline)
								<p class="text-xs mt-1">View tasks on a chronological timeline</p>
							</div>
							<div class="bg-base-200 p-2 rounded">
								<strong>📊 Kanban</strong> (/kanban)
								<p class="text-xs mt-1">Kanban board view by task status</p>
							</div>
							<div class="bg-base-200 p-2 rounded">
								<strong>👥 Agents</strong> (/agents)
								<p class="text-xs mt-1">Monitor agent activity and task assignments</p>
							</div>
						</div>
					</div>
				</section>

				<!-- Navigation Tips -->
				<section>
					<h3 class="text-xl font-semibold mb-3 flex items-center gap-2">
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
						</svg>
						Navigation Tips
					</h3>
					<div class="space-y-2 text-sm">
						<div class="bg-base-200 p-3 rounded-lg">
							<p class="font-semibold mb-2">Desktop Navigation:</p>
							<ul class="list-disc list-inside space-y-1 ml-2">
								<li>Click sidebar icons to navigate between views</li>
								<li>Toggle collapse/expand using the hamburger button</li>
								<li>Use breadcrumbs (if available) to track your location</li>
								<li>Active route is highlighted in primary color</li>
							</ul>
						</div>

						<div class="bg-base-200 p-3 rounded-lg">
							<p class="font-semibold mb-2">Mobile Navigation:</p>
							<ul class="list-disc list-inside space-y-1 ml-2">
								<li>Tap hamburger icon (top-left) to open sidebar overlay</li>
								<li>Tap a route to navigate (sidebar auto-closes)</li>
								<li>Tap outside sidebar to close without navigating</li>
							</ul>
						</div>
					</div>
				</section>

				<!-- Keyboard Shortcuts -->
				<section>
					<h3 class="text-xl font-semibold mb-3 flex items-center gap-2">
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
						</svg>
						Keyboard Shortcuts
					</h3>
					<div class="space-y-2 text-sm">
						<div class="overflow-x-auto">
							<table class="table table-sm">
								<thead>
									<tr>
										<th>Shortcut</th>
										<th>Action</th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td><kbd class="kbd kbd-sm">Cmd</kbd> + <kbd class="kbd kbd-sm">K</kbd></td>
										<td>Open Command Palette (quick navigation)</td>
									</tr>
									<tr>
										<td><kbd class="kbd kbd-sm">Cmd</kbd> + <kbd class="kbd kbd-sm">N</kbd></td>
										<td>Create new task</td>
									</tr>
									<tr>
										<td><kbd class="kbd kbd-sm">Cmd</kbd> + <kbd class="kbd kbd-sm">/</kbd></td>
										<td>Toggle sidebar collapse/expand</td>
									</tr>
									<tr>
										<td><kbd class="kbd kbd-sm">Esc</kbd></td>
										<td>Close open modals/drawers</td>
									</tr>
									<tr>
										<td><kbd class="kbd kbd-sm">?</kbd></td>
										<td>Show this help guide</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				</section>

				<!-- Project Filtering -->
				<section>
					<h3 class="text-xl font-semibold mb-3 flex items-center gap-2">
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
						</svg>
						Project Filtering
					</h3>
					<div class="space-y-2 text-sm">
						<p>The dashboard supports multi-project task management. Use the <strong>Project Selector</strong> in the top navigation bar to filter tasks by project.</p>

						<div class="bg-base-200 p-3 rounded-lg">
							<p class="font-semibold mb-2">How It Works:</p>
							<ul class="list-disc list-inside space-y-1 ml-2">
								<li>Projects are auto-detected from task ID prefixes (e.g., <code>jat-abc</code>, <code>chimaro-xyz</code>)</li>
								<li>Select a project to filter all views to that project's tasks</li>
								<li>Select "All Projects" to see tasks from all projects</li>
								<li>Project selection persists across navigation and page reloads</li>
								<li>Task counts are shown per project in the dropdown</li>
							</ul>
						</div>
					</div>
				</section>

				<!-- View Modes -->
				<section>
					<h3 class="text-xl font-semibold mb-3 flex items-center gap-2">
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
						</svg>
						View Modes Explained
					</h3>
					<div class="space-y-3 text-sm">
						<div>
							<p class="font-semibold">📋 List View</p>
							<p class="ml-4 mt-1">Traditional table-based task list with sorting, filtering, and search. Best for: Quickly scanning many tasks, detailed task information at a glance.</p>
						</div>
						<div>
							<p class="font-semibold">🔗 Dependency View</p>
							<p class="ml-4 mt-1">Visualizes task relationships and dependencies. Shows which tasks block others and identifies critical paths. Best for: Understanding task order, planning work sequences.</p>
						</div>
						<div>
							<p class="font-semibold">📅 Timeline View</p>
							<p class="ml-4 mt-1">Chronological view of tasks showing when they were created and updated. Best for: Tracking project progress over time, identifying stale tasks.</p>
						</div>
						<div>
							<p class="font-semibold">📊 Kanban View</p>
							<p class="ml-4 mt-1">Board-style view organized by task status (Open, In Progress, Blocked, Closed). Drag-and-drop task status updates. Best for: Visual workflow management, team standup discussions.</p>
						</div>
						<div>
							<p class="font-semibold">👥 Agents View</p>
							<p class="ml-4 mt-1">Monitor agent activity, view agent task assignments, track workload distribution, and drag-and-drop task assignment. Best for: Multi-agent coordination, workload balancing.</p>
						</div>
					</div>
				</section>

				<!-- Agent Features -->
				<section>
					<h3 class="text-xl font-semibold mb-3 flex items-center gap-2">
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
						</svg>
						Agent Coordination Features
					</h3>
					<div class="space-y-2 text-sm">
						<p>The Agents view provides powerful multi-agent coordination features:</p>

						<div class="bg-base-200 p-3 rounded-lg">
							<p class="font-semibold mb-2">Agent Cards Show:</p>
							<ul class="list-disc list-inside space-y-1 ml-2">
								<li><strong>Status:</strong> Working, idle, or sleeping</li>
								<li><strong>Current Task:</strong> What the agent is currently working on</li>
								<li><strong>Task Queue:</strong> Upcoming tasks assigned to the agent</li>
								<li><strong>File Locks:</strong> Which files the agent has reserved</li>
								<li><strong>Activity Feed:</strong> Recent agent actions and updates</li>
								<li><strong>Token Usage:</strong> API usage and cost tracking (today/week)</li>
							</ul>
						</div>

						<div class="bg-base-200 p-3 rounded-lg">
							<p class="font-semibold mb-2">Drag-and-Drop Task Assignment:</p>
							<ul class="list-disc list-inside space-y-1 ml-2">
								<li>Drag tasks from the task queue to agent cards to assign</li>
								<li>Dependency validation prevents assigning blocked tasks</li>
								<li>File conflict detection warns of reservation conflicts</li>
								<li>Visual feedback shows assignment status (success/error)</li>
							</ul>
						</div>
					</div>
				</section>

				<!-- Common Tasks -->
				<section>
					<h3 class="text-xl font-semibold mb-3 flex items-center gap-2">
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
						</svg>
						Common Tasks
					</h3>
					<div class="space-y-2 text-sm">
						<div class="collapse collapse-arrow bg-base-200">
							<input type="checkbox" />
							<div class="collapse-title font-semibold">
								How do I create a new task?
							</div>
							<div class="collapse-content">
								<p>Use one of these methods:</p>
								<ul class="list-disc list-inside mt-2 space-y-1">
									<li>Press <kbd class="kbd kbd-sm">Cmd</kbd> + <kbd class="kbd kbd-sm">N</kbd></li>
									<li>Click the "Create Task" button in the top navigation bar</li>
									<li>Use Command Palette (<kbd class="kbd kbd-sm">Cmd</kbd> + <kbd class="kbd kbd-sm">K</kbd>) → "Create Task"</li>
								</ul>
							</div>
						</div>

						<div class="collapse collapse-arrow bg-base-200">
							<input type="checkbox" />
							<div class="collapse-title font-semibold">
								How do I filter tasks by project?
							</div>
							<div class="collapse-content">
								<p>Use the Project Selector in the top navigation bar. Click the dropdown and select your project. The selection persists across page navigation and reloads.</p>
							</div>
						</div>

						<div class="collapse collapse-arrow bg-base-200">
							<input type="checkbox" />
							<div class="collapse-title font-semibold">
								How do I assign a task to an agent?
							</div>
							<div class="collapse-content">
								<p>Two methods:</p>
								<ul class="list-disc list-inside mt-2 space-y-1">
									<li><strong>Drag-and-drop:</strong> Go to Agents view, drag task from queue to agent card</li>
									<li><strong>Manual:</strong> Edit task details and change the "Assignee" field</li>
								</ul>
							</div>
						</div>

						<div class="collapse collapse-arrow bg-base-200">
							<input type="checkbox" />
							<div class="collapse-title font-semibold">
								How do I switch between different view modes?
							</div>
							<div class="collapse-content">
								<p>Use the drawer sidebar on the left. Click any of the 5 navigation items:</p>
								<ul class="list-disc list-inside mt-2 space-y-1">
									<li>List (/) - Traditional task list</li>
									<li>Dependency (/dependency) - Dependency graph</li>
									<li>Timeline (/timeline) - Chronological view</li>
									<li>Kanban (/kanban) - Status board</li>
									<li>Agents (/agents) - Agent activity</li>
								</ul>
							</div>
						</div>
					</div>
				</section>

				<!-- Troubleshooting -->
				<section>
					<h3 class="text-xl font-semibold mb-3 flex items-center gap-2">
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
						</svg>
						Troubleshooting
					</h3>
					<div class="space-y-2 text-sm">
						<div class="alert alert-info">
							<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<div>
								<p class="font-semibold">Dashboard not loading?</p>
								<p class="text-xs mt-1">Check that the dev server is running: <code>npm run dev</code></p>
							</div>
						</div>

						<div class="alert alert-info">
							<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<div>
								<p class="font-semibold">Tasks not showing?</p>
								<p class="text-xs mt-1">Check your project filter. Try selecting "All Projects" to see all tasks.</p>
							</div>
						</div>

						<div class="alert alert-info">
							<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<div>
								<p class="font-semibold">Agent status not updating?</p>
								<p class="text-xs mt-1">The dashboard polls every 30 seconds. Wait a moment or refresh the page manually.</p>
							</div>
						</div>
					</div>
				</section>

			</div>

			<!-- Footer -->
			<div class="modal-action">
				<button class="btn btn-primary" onclick={closeModal}>
					Got it, thanks!
				</button>
			</div>
		</div>
	</div>
{/if}
