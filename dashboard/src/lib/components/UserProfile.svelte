<script lang="ts">
	/**
	 * UserProfile Component
	 *
	 * Placeholder user profile dropdown for Nav component.
	 * Shows avatar with user info (no menu items - placeholder links removed).
	 * Uses DaisyUI dropdown component.
	 *
	 * Note: This is a placeholder component. No authentication system implemented yet.
	 * Replace with real user data when auth is added.
	 */

	// Placeholder user data
	const user = {
		name: 'Agent User',
		initials: 'AU',
		email: 'agent@example.com'
	};

	// User icon SVG path
	const userIcon =
		'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z';
</script>

<div class="dropdown dropdown-end">
	<!-- Avatar Button -->
	<button
		tabindex="0"
		class="btn btn-ghost btn-circle avatar"
		aria-label="User profile menu"
	>
		<div class="w-8 rounded-full bg-base-300 flex items-center justify-center">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="w-5 h-5 text-base-content/70"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d={userIcon} />
			</svg>
		</div>
	</button>

	<!-- Dropdown Menu -->
	<ul
		tabindex="0"
		class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300"
	>
		<!-- User Info -->
		<li class="menu-title">
			<span class="text-base-content font-semibold">{user.name}</span>
			<span class="text-xs text-base-content/60">{user.email}</span>
		</li>
	</ul>
</div>
