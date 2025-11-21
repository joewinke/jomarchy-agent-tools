# Beads Task Dashboard - Development Guide

## Project Overview

Multi-project task management dashboard powered by Beads + Agent Mail. Built with SvelteKit 5, Tailwind CSS v4, and DaisyUI.

## Tech Stack

- **Framework**: SvelteKit 5 (Svelte 5 runes: `$state`, `$derived`, `$props`)
- **Styling**: Tailwind CSS v4 + DaisyUI
- **Theme Management**: `theme-change` library + custom utilities
- **Build Tool**: Vite

## Theme Switching Implementation

### Critical: Tailwind v4 Syntax

**IMPORTANT**: This project uses Tailwind CSS v4, which requires completely different configuration syntax than v3.

#### ❌ Wrong (Tailwind v3 syntax - will NOT work):
```css
/* app.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

#### ✅ Correct (Tailwind v4 syntax):
```css
/* src/app.css */
@import "tailwindcss";

@plugin "daisyui" {
  themes:
    light,
    dark,
    cupcake,
    bumblebee,
    emerald,
    corporate,
    synthwave,
    retro,
    cyberpunk,
    valentine,
    halloween,
    garden,
    forest,
    aqua,
    lofi,
    pastel,
    fantasy,
    wireframe,
    black,
    luxury,
    dracula,
    cmyk,
    autumn,
    business,
    acid,
    lemonade,
    night,
    coffee,
    winter,
    dim,
    nord --default,
    sunset;
}
```

### Theme Switching Architecture

The theme system consists of three components:

**1. Layout Initialization** (`src/routes/+layout.svelte`):
```typescript
import { themeChange } from 'theme-change';

onMount(() => {
  themeChange(false);
});
```

**2. Theme Manager Utility** (`src/lib/utils/themeManager.ts`):
```typescript
export function setTheme(theme: string) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

export function initializeTheme() {
  const localTheme = localStorage.getItem('theme');
  if (localTheme) {
    setTheme(localTheme);
  } else {
    setTheme('nord'); // default
  }
}
```

**3. Theme Selector Component** (`src/lib/components/ThemeSelector.svelte`):
```svelte
<script lang="ts">
  import { setTheme } from '$lib/utils/themeManager';

  let currentTheme = $state('nord');

  function handleThemeChange(themeName: string) {
    currentTheme = themeName;
    setTheme(themeName);
  }
</script>

<button onclick={() => handleThemeChange(theme.name)}>
  {theme.label}
</button>
```

### Troubleshooting Themes

**Symptoms**: Theme selector works (data-theme attribute changes) but colors don't change.

**Diagnosis**:
1. Check if `app.css` uses Tailwind v4 syntax (`@import "tailwindcss"`)
2. Verify `@plugin "daisyui"` block exists with theme list
3. Check browser DevTools → Elements → `<html data-theme="...">` changes
4. Inspect stylesheet count: `Array.from(document.styleSheets).length` (should be > 1)

**Solution**: Update `app.css` to Tailwind v4 syntax with proper `@plugin "daisyui"` configuration.

## DaisyUI Configuration

### Tailwind Config (`tailwind.config.js`)

This file exists but is **MOSTLY IGNORED** in Tailwind v4. Theme configuration must be in `app.css` using `@plugin` syntax.

```javascript
// This is here for compatibility but themes are loaded from app.css
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  plugins: [require('daisyui')],
  daisyui: {
    themes: ['light', 'dark', ...] // ⚠️ This is ignored in v4!
  }
};
```

### Proper Theme Loading (v4)

Themes MUST be declared in CSS using `@plugin` syntax (see app.css above).

## Key Files

```
dashboard/
├── src/
│   ├── app.css                          # Tailwind v4 config + DaisyUI themes
│   ├── routes/
│   │   └── +layout.svelte              # Initialize theme-change library
│   ├── lib/
│   │   ├── components/
│   │   │   └── ThemeSelector.svelte    # Theme picker dropdown
│   │   └── utils/
│   │       └── themeManager.ts         # Theme utilities
│   └── ...
├── tailwind.config.js                  # Legacy config (mostly ignored in v4)
└── package.json
```

## Common Pitfalls

### 1. Using Old Tailwind Syntax
**Problem**: Using `@tailwind` directives in Tailwind v4 prevents DaisyUI themes from loading.
**Solution**: Use `@import "tailwindcss"` and `@plugin "daisyui"` syntax.

### 2. Forgetting theme-change Library
**Problem**: Themes don't persist or don't switch properly.
**Solution**: Install `theme-change` and initialize in layout: `themeChange(false)`.

### 3. Missing Theme Declaration
**Problem**: Only black/white colors, no theme colors.
**Solution**: Ensure all themes are listed in `@plugin "daisyui"` block in `app.css`.

### 4. Cache Issues
**Problem**: Changes to `app.css` don't reflect in browser.
**Solution**:
```bash
rm -rf .svelte-kit node_modules/.vite
npm run dev
```
Then hard refresh browser (Ctrl+Shift+R).

## Svelte 5 Runes

This project uses Svelte 5 runes syntax:

```typescript
// State
let count = $state(0);

// Derived
const doubled = $derived(count * 2);

// Props
let { name, age = 18 } = $props();

// Effects
$effect(() => {
  console.log('count changed:', count);
});
```

## Nav Component Architecture

### Overview

The **Nav component** (`src/lib/components/Nav.svelte`) provides a reusable navigation bar for all dashboard pages. It uses a lightweight configuration approach to avoid massive prop drilling and keeps pages clean.

**Key Features:**
- Context-based configuration (not hardcoded per page)
- Responsive layout (no wrapping issues)
- Conditional elements (view toggles, project filters)
- Consistent theming with DaisyUI
- Single-row guarantee (flex-nowrap design)

### Architecture Pattern

**Configuration-driven approach:**

```
Page Component → Nav Component → navConfig.ts
     ↓               ↓
  Props         Context lookup
```

**Why this pattern:**
- ✅ Pages stay clean (minimal props)
- ✅ Easy to add new pages (just add config)
- ✅ Consistent UI across pages
- ✅ Single source of truth for nav structure
- ❌ NOT 874 lines of hardcoded HTML per page

### How to Use

#### Basic Usage (Simple Page)

```svelte
<script>
  import Nav from '$lib/components/Nav.svelte';
</script>

<!-- Minimal props - context drives the config -->
<Nav context="home" />
```

#### With View Toggle (Home Page)

```svelte
<script>
  import Nav from '$lib/components/Nav.svelte';

  let viewMode = $state('list');
</script>

<Nav
  context="home"
  {viewMode}
  onViewModeChange={(mode) => (viewMode = mode)}
/>
```

#### With Project Filter (Agents Page)

```svelte
<script>
  import Nav from '$lib/components/Nav.svelte';

  let selectedProject = $state('All Projects');
  let projects = $state(['jat', 'chimaro', 'jomarchy']);
  let taskCounts = $state(new Map([['jat', 15], ['chimaro', 8]]));

  function handleProjectChange(project: string) {
    selectedProject = project;
    // ... filter logic
  }
</script>

<Nav
  context="agents"
  {projects}
  {selectedProject}
  {onProjectChange}
  {taskCounts}
  showProjectFilter={true}
/>
```

### Configuration Structure

**File: `src/lib/config/navConfig.ts`**

```typescript
export interface NavConfig {
  title: string;              // Page title (e.g., "Agents")
  subtitle: string;           // Description text
  viewToggle?: ViewToggleOption[];  // Optional view mode buttons
  showProjectFilter?: boolean;      // Show project dropdown
  showThemeSelector?: boolean;      // Show theme picker (usually true)
}

export interface ViewToggleOption {
  value: string;    // Mode identifier (e.g., 'list')
  label: string;    // Display text (e.g., 'List View')
  link?: string;    // Optional navigation (for cross-page toggles)
}
```

### Adding a New Page

**Step 1: Create config in `navConfig.ts`**

```typescript
// My New Page
export const myPageConfig: NavConfig = {
  title: 'My New Feature',
  subtitle: 'Description of what this page does',
  viewToggle: undefined,  // or add view modes if needed
  showProjectFilter: false,  // true if needs project filtering
  showThemeSelector: true
};
```

**Step 2: Update Nav component to use the config**

Currently, Nav uses inline config (lines 48-74 in `Nav.svelte`). **TODO:** Refactor to import from `navConfig.ts` instead.

**Current pattern (inline):**
```typescript
const contextConfig = {
  home: { title: '...', subtitle: '...', ... },
  agents: { title: '...', subtitle: '...', ... }
};
```

**Better pattern (import from navConfig.ts):**
```typescript
import { homeConfig, agentsConfig, myPageConfig } from '$lib/config/navConfig';

const contextConfig = {
  home: homeConfig,
  agents: agentsConfig,
  'my-page': myPageConfig
};
```

**Step 3: Use Nav in your page**

```svelte
<!-- src/routes/my-page/+page.svelte -->
<script>
  import Nav from '$lib/components/Nav.svelte';
</script>

<div class="min-h-screen bg-base-200">
  <Nav context="my-page" />

  <!-- Your page content -->
</div>
```

### Props Reference

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `context` | `'home' \| 'agents' \| 'api-demo'` | - | ✅ Yes | Determines which nav config to use |
| `projects` | `string[]` | `[]` | ❌ No | List of project names for dropdown |
| `selectedProject` | `string` | `'All Projects'` | ❌ No | Current project selection |
| `onProjectChange` | `(project: string) => void` | `() => {}` | ❌ No | Called when project changes |
| `taskCounts` | `Map<string, number>` | `null` | ❌ No | Task count badges per project |
| `showProjectFilter` | `boolean` | `false` | ❌ No | Show project selector dropdown |
| `viewMode` | `'list' \| 'graph'` | `'list'` | ❌ No | Current view mode (home page) |
| `onViewModeChange` | `(mode: string) => void` | `() => {}` | ❌ No | Called when view mode changes |

### Responsive Design

The Nav component is fully responsive across all screen sizes, from mobile (320px) to large desktop (1920px+).

**Tailwind Breakpoints Used:**
- `sm`: 640px (Small tablets and above)
- `md`: 768px (Medium tablets and above)
- `lg`: 1024px (Desktop and above)

**Responsive Behavior by Viewport:**

| Viewport | Width | Subtitle | View Buttons | Nav Links | Project Selector |
|----------|-------|----------|--------------|-----------|------------------|
| **Mobile** | 320px - 639px | Hidden | Icons only | Icons only | 144px (w-36) |
| **Small Tablet** | 640px - 767px | Visible | Icons only | Icons only | 160px (w-40) |
| **Tablet** | 768px - 1023px | Visible | Icons + Labels | Icons only | 192px (w-48) |
| **Desktop** | 1024px+ | Visible | Icons + Labels | Icons + Labels | 192px (w-48) |
| **Large Desktop** | 1920px+ | Visible | Icons + Labels | Icons + Labels | 192px (w-48) |

**Implementation Details:**

```svelte
<!-- Subtitle: Hidden on mobile (<640px) -->
<p class="text-sm text-base-content/70 hidden sm:block">
  {config.subtitle}
</p>

<!-- View toggle labels: Visible on tablet+ (≥768px) -->
<span class="hidden md:inline ml-1">List</span>
<span class="hidden md:inline ml-1">Graph</span>

<!-- Navigation link labels: Visible on desktop+ (≥1024px) -->
<span class="hidden lg:inline ml-1">Home</span>
<span class="hidden lg:inline ml-1">Agents</span>

<!-- Project selector: Responsive width -->
<div class="w-36 sm:w-40 md:w-48">
  <ProjectSelector ... />
</div>
```

**Testing Results (Verified):**

✅ **320px (iPhone SE):** Single-row layout, icon-only buttons, no subtitle
✅ **768px (iPad):** Single-row layout, view toggle labels visible, subtitle visible
✅ **1024px (Desktop):** Single-row layout, all labels visible
✅ **1920px (Large Desktop):** Single-row layout, all labels visible, optimal spacing

**Why No Hamburger Menu:**

The Nav component does NOT use a hamburger menu because:
1. **Icon-only mode is sufficient** - All controls remain accessible on mobile
2. **Single-row guarantee** - flex-nowrap prevents wrapping even with all controls
3. **Better UX** - Users can see all options without opening a menu
4. **Fewer clicks** - Direct access to all navigation options

If future pages add many more nav items, consider adding a hamburger menu for mobile.

### Layout Fix: No Wrapping

The Nav component uses **flex-nowrap** to guarantee single-row layout:

```svelte
<div class="flex-none flex flex-nowrap items-center gap-1.5">
  <!-- Controls never wrap to new row -->
</div>
```

**Why this matters:**
- Previous implementation had 3-row wrapping issues
- `flex-nowrap` + optimized spacing (`gap-1.5`) prevents wrap
- Responsive labels (hidden on small screens) save space
- Guaranteed single-row layout across all screen sizes

### Common Patterns

#### Pattern 1: View Toggle with Cross-Page Navigation

```typescript
// In navConfig.ts
viewToggle: [
  { value: 'list', label: 'List View', link: '/' },
  { value: 'agents', label: 'Agent View', link: '/agents' }
]
```

**Use when:** Toggle represents different pages (not modes on same page)

#### Pattern 2: View Mode on Same Page

```typescript
// In navConfig.ts
viewToggle: [
  { value: 'list', label: 'List' },
  { value: 'graph', label: 'Graph' }
]
```

**Use when:** Toggle switches rendering mode without navigation

**Page implementation:**
```svelte
<script>
  let viewMode = $state('list');
</script>

<Nav {viewMode} onViewModeChange={(m) => (viewMode = m)} />

{#if viewMode === 'list'}
  <TaskList />
{:else}
  <TaskGraph />
{/if}
```

#### Pattern 3: Project Filter Integration

```svelte
<script>
  let selectedProject = $state('All Projects');

  // Sync with URL params
  $effect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectParam = params.get('project');
    selectedProject = projectParam || 'All Projects';
  });

  function handleProjectChange(project: string) {
    selectedProject = project;

    // Update URL
    const url = new URL(window.location.href);
    if (project === 'All Projects') {
      url.searchParams.delete('project');
    } else {
      url.searchParams.set('project', project);
    }
    replaceState(url, {});

    // Refetch data with filter
    fetchData();
  }
</script>

<Nav
  context="agents"
  {projects}
  {selectedProject}
  onProjectChange={handleProjectChange}
  showProjectFilter={true}
/>
```

### Icons

Icons are defined inline in Nav component (lines 79-83):

```typescript
const icons = {
  list: 'M3.75 12h16.5m-16.5 3.75h16.5...', // List icon path
  graph: 'M7.5 21L3 16.5m0 0L7.5 12M3...', // Graph icon path
  users: 'M15 19.128a9.38 9.38 0 002.625...' // Users icon path
};
```

**To add new icon:**
1. Get SVG path from Heroicons (https://heroicons.com)
2. Add to `icons` object in Nav.svelte
3. Reference in config: `{ icon: 'myIcon', ... }`

### Migration Path: Inline Config → navConfig.ts

**Current state:** Nav component has inline `contextConfig` (not ideal)

**Goal:** Move all config to `navConfig.ts` for better separation

**Steps:**
1. Export all configs from `navConfig.ts` (already done)
2. Import configs in Nav.svelte
3. Replace inline object with imports
4. Test all pages still work

**Example refactor:**

```typescript
// ❌ Before (inline)
const contextConfig = {
  home: { title: 'Beads Task Dashboard', ... },
  agents: { title: 'Agents', ... }
};

// ✅ After (imported)
import { homeConfig, agentsConfig } from '$lib/config/navConfig';

const contextConfig = {
  home: homeConfig,
  agents: agentsConfig
};
```

### Breadcrumbs Navigation

The Nav component integrates **breadcrumbs** to show the user's current location in the site hierarchy.

**Implementation:**

The Breadcrumbs component (`src/lib/components/Breadcrumbs.svelte`) is automatically integrated into Nav.svelte for non-home pages. It provides:
- Context-aware navigation paths
- Home icon for the first breadcrumb item
- DaisyUI styling for consistent appearance
- Support for deep navigation with `additionalPath` prop

**Basic Usage (Automatic):**

```svelte
<!-- Nav component automatically shows breadcrumbs on non-home pages -->
<Nav context="agents" />
<!-- Renders: Home > Agents -->

<Nav context="api-demo" />
<!-- Renders: Home > API Demo -->
```

**With Additional Path (For Deep Navigation):**

```svelte
<script>
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';

  // For a detail page
  const additionalPath = [
    { label: 'Task jat-abc', href: null } // null = current page
  ];
</script>

<Breadcrumbs context="agents" {additionalPath} />
<!-- Renders: Home > Agents > Task jat-abc -->
```

**Breadcrumb Paths by Context:**

| Context | Breadcrumb Path | Notes |
|---------|----------------|-------|
| `home` | (none) | Breadcrumbs hidden on home page |
| `agents` | Home > Agents | Home links to `/` |
| `api-demo` | Home > API Demo | Home links to `/` |

**Features:**

- **Home Icon**: First breadcrumb item displays a home icon (Heroicons house icon)
- **Link vs Current**: All items are linked except the last (current page)
- **Responsive**: Uses `text-sm` for appropriate sizing on all screens
- **DaisyUI Styled**: Uses `.breadcrumbs` class for consistent separators and spacing
- **Extensible**: Use `additionalPath` prop for task detail pages, nested routes, etc.

**Component API (`Breadcrumbs.svelte`):**

```typescript
interface Props {
  context: 'home' | 'agents' | 'api-demo';  // Required
  additionalPath?: AdditionalPathItem[];     // Optional
}

interface AdditionalPathItem {
  label: string;     // Breadcrumb text
  href?: string | null;  // Link URL (null for current page)
}
```

**Example: Task Detail Page**

```svelte
<script>
  import Nav from '$lib/components/Nav.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';

  let taskId = $state('jat-abc');
</script>

<!-- Override default breadcrumbs for deep navigation -->
<Nav context="agents" />
<div class="p-4">
  <Breadcrumbs
    context="agents"
    additionalPath={[
      { label: `Task ${taskId}`, href: null }
    ]}
  />
  <!-- Task detail content -->
</div>
<!-- Renders: Home > Agents > Task jat-abc -->
```

**Styling:**

Breadcrumbs use DaisyUI's breadcrumbs component with the following classes:
- `.breadcrumbs` - Container with auto overflow
- `.text-sm` - Appropriate text size
- `.link-hover` - Hover effect on linked items

**Files:**

- `src/lib/components/Breadcrumbs.svelte` - Breadcrumbs component (93 lines)
- `src/lib/components/Nav.svelte` - Integrates breadcrumbs (lines 95-100)

### Troubleshooting

**Nav wrapping to multiple rows:**
- Check for `flex-nowrap` on controls container
- Verify `gap-1.5` (not larger)
- Ensure responsive labels are hidden on small screens

**Project filter not showing:**
- Check `showProjectFilter={true}` prop
- Verify `projects` array is populated
- Confirm context supports project filtering

**View toggle not working:**
- Check `onViewModeChange` handler is provided
- Verify `viewMode` is reactive (`$state`)
- Ensure config has `viewToggle` defined

**Icons not displaying:**
- Verify icon name exists in `icons` object
- Check SVG path is valid
- Confirm icon is referenced in config

### Files

**Core files:**
- `src/lib/components/Nav.svelte` - Main component (173 lines)
- `src/lib/config/navConfig.ts` - Configuration (52 lines)
- `src/lib/components/ThemeSelector.svelte` - Theme dropdown (integrated)
- `src/lib/components/ProjectSelector.svelte` - Project dropdown (integrated)

**Usage examples:**
- `src/routes/+page.svelte` - Home page with view toggle
- `src/routes/agents/+page.svelte` - Agents page with project filter
- `src/routes/api-demo/+page.svelte` - Simple page (no extras)

## Unified Navigation Architecture

### Overview

The dashboard uses a **root layout pattern** for unified navigation. The Nav component is rendered once in `+layout.svelte` and appears on ALL pages automatically. This eliminates duplication and ensures consistency.

**Key Principle:** Navigation lives in the root layout, NOT in individual pages.

### Architecture: Root Layout Pattern

**Pattern:**
```
+layout.svelte (Root Layout)
    ├── Nav Component (unified navigation)
    ├── CommandPalette (Cmd+K)
    ├── TaskCreationDrawer
    └── {@render children()}  ← Page content renders here
```

**Why this pattern:**
- ✅ Nav appears on ALL pages automatically
- ✅ Zero duplication (one Nav, not per-page)
- ✅ Shared state (project filter persists across pages)
- ✅ Consistent UI (impossible to have different nav styles)
- ✅ Easy to update (change Nav once, affects all pages)

**File:** `src/routes/+layout.svelte`

```svelte
<script lang="ts">
  import Nav from '$lib/components/Nav.svelte';
  import { page } from '$app/stores';
  import { replaceState } from '$app/navigation';

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

  // Handle project selection change
  function handleProjectChange(project: string) {
    selectedProject = project;

    // Update URL parameter
    const url = new URL(window.location.href);
    if (project === 'All Projects') {
      url.searchParams.delete('project');
    } else {
      url.searchParams.set('project', project);
    }
    replaceState(url, {});
  }
</script>

<!-- Unified Navigation Bar (shown on all pages) -->
<Nav
  {projects}
  {selectedProject}
  onProjectChange={handleProjectChange}
  {taskCounts}
/>

{@render children()}
```

**Key Features:**

1. **Single Nav Instance:** Nav component rendered once in layout
2. **Shared State:** Project filter state lives in layout, shared across all pages
3. **URL Sync:** Project selection synced with `?project=` URL parameter
4. **Auto-Load:** Tasks loaded once on mount to populate project dropdown
5. **State Management:** Uses Svelte 5 `$state`, `$derived`, `$effect` runes

### How Nav Works (Page-Agnostic)

The Nav component is **completely page-agnostic**. It doesn't know or care which page it's on.

**Implementation:** `src/lib/components/Nav.svelte`

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { unifiedNavConfig } from '$lib/config/navConfig';

  // Get current pathname for active state detection
  const currentPath = $derived($page.url.pathname);

  // Helper to check if nav item is active
  function isActive(href: string): boolean {
    // Exact match for home
    if (href === '/' && currentPath === '/') {
      return true;
    }
    // Prefix match for other routes
    if (href !== '/' && currentPath.startsWith(href)) {
      return true;
    }
    return false;
  }
</script>

<div class="navbar bg-base-100 border-b border-base-300">
  <!-- Left: Navigation Items -->
  <div class="flex-1">
    <div class="flex flex-nowrap items-center gap-1.5">
      {#each unifiedNavConfig.navItems as navItem}
        <a
          href={navItem.href}
          class="btn btn-sm {isActive(navItem.href) ? 'btn-primary' : 'btn-ghost'}"
        >
          <svg>...</svg>
          <span class="hidden lg:inline ml-1">{navItem.label}</span>
        </a>
      {/each}
    </div>
  </div>

  <!-- Right: Controls -->
  <div class="flex-none flex flex-nowrap items-center gap-1.5">
    <ProjectSelector ... />
    <ThemeSelector ... />
  </div>
</div>
```

**How Active State Works:**

- Nav reads `$page.url.pathname` (current route)
- Compares with each nav item's `href`
- Applies `btn-primary` class to active item
- No page-specific logic needed

**Example:**
- User on `/agents` → `isActive('/agents')` returns `true` → Agents button is blue
- User on `/` → `isActive('/')` returns `true` → List button is blue

### Configuration-Driven Navigation

**File:** `src/lib/config/navConfig.ts`

```typescript
export interface NavItem {
  id: string;       // Unique identifier (e.g., 'list', 'graph', 'agents')
  label: string;    // Display text (e.g., 'List', 'Graph', 'Agents')
  href: string;     // Navigation target (e.g., '/', '/agents')
  icon: string;     // Icon identifier (matches SVG paths in Nav.svelte)
}

export interface UnifiedNavConfig {
  navItems: NavItem[];          // All navigation items
  showProjectFilter: boolean;   // Show project selector
  showThemeSelector: boolean;   // Show theme picker
}

export const unifiedNavConfig: UnifiedNavConfig = {
  navItems: [
    { id: 'list', label: 'List', href: '/', icon: 'list' },
    { id: 'graph', label: 'Graph', href: '/graph', icon: 'graph' },
    { id: 'agents', label: 'Agents', href: '/agents', icon: 'users' }
  ],
  showProjectFilter: true,
  showThemeSelector: true
};
```

**Adding a New Page:**

1. Add route to navConfig.ts:
```typescript
{ id: 'settings', label: 'Settings', href: '/settings', icon: 'cog' }
```

2. Add icon SVG path to Nav.svelte (if new icon):
```typescript
const icons = {
  list: '...',
  graph: '...',
  users: '...',
  cog: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55...' // New icon
};
```

3. Create page route: `src/routes/settings/+page.svelte`

4. Done! Nav automatically shows Settings button with active state.

**No changes needed to:**
- +layout.svelte (Nav already rendered)
- Individual pages (Nav is global)
- Active state logic (automatic via pathname matching)

### Project Filter Integration

**How Project Filtering Works:**

1. **Layout loads all tasks** (once on mount):
```typescript
async function loadAllTasks() {
  const response = await fetch('/api/agents?full=true');
  const data = await response.json();
  allTasks = data.tasks || [];
}
```

2. **Extract projects from task IDs** (reactive):
```typescript
const projects = $derived(getProjectsFromTasks(allTasks));
// → ["All Projects", "jat", "chimaro", "jomarchy"]

const taskCounts = $derived(getTaskCountByProject(allTasks, 'open'));
// → Map { "jat" => 15, "chimaro" => 8, "jomarchy" => 3 }
```

3. **Sync with URL parameter** (reactive):
```typescript
$effect(() => {
  const params = new URLSearchParams($page.url.searchParams);
  const projectParam = params.get('project');
  selectedProject = projectParam || 'All Projects';
});
```

4. **Update URL on selection change**:
```typescript
function handleProjectChange(project: string) {
  selectedProject = project;

  const url = new URL(window.location.href);
  if (project === 'All Projects') {
    url.searchParams.delete('project');
  } else {
    url.searchParams.set('project', project);
  }
  replaceState(url, {});
}
```

5. **Pages read from URL** (each page handles filtering):
```svelte
<!-- src/routes/agents/+page.svelte -->
<script>
  import { page } from '$app/stores';
  import { filterTasksByProject } from '$lib/utils/projectUtils';

  const selectedProject = $derived($page.url.searchParams.get('project') || 'All Projects');
  const filteredTasks = $derived(filterTasksByProject(allTasks, selectedProject));
</script>
```

**Flow:**
```
User selects "jat" → handleProjectChange() → URL updates to ?project=jat
→ Layout $effect() updates selectedProject → Pages see ?project=jat in URL
→ Pages filter their data using projectUtils → UI shows only jat tasks
```

### URL Parameter State Management

**Why URL Parameters (Not localStorage):**

- ✅ **Bookmarkable:** `/agents?project=jat` is shareable link
- ✅ **Browser-native:** Back/forward buttons work correctly
- ✅ **Multi-tab:** Different tabs can show different projects
- ✅ **No cleanup:** No stale localStorage data
- ✅ **SSR-compatible:** URL params work server-side

**Pattern:**
```typescript
// Layout: Write to URL
function handleProjectChange(project: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('project', project);
  replaceState(url, {});
}

// Layout: Read from URL (reactive)
$effect(() => {
  const params = new URLSearchParams($page.url.searchParams);
  selectedProject = params.get('project') || 'All Projects';
});

// Pages: Read from URL (reactive)
const selectedProject = $derived($page.url.searchParams.get('project') || 'All Projects');
```

**Key API:**
- `replaceState(url, {})` - Update URL without navigation (no history entry)
- `$page.url.searchParams` - SvelteKit store for reading URL params
- `$derived` - Reactively recompute when URL changes

### Shared State vs Per-Page State

**Shared in Layout:**
- `selectedProject` - Current project filter (synced with URL)
- `projects` - List of all projects (derived from all tasks)
- `taskCounts` - Task counts per project (derived)
- `allTasks` - All tasks (loaded once)

**Per-Page State:**
- Task filtering (each page filters based on `selectedProject`)
- View mode (e.g., list vs graph on home page)
- Search/sort state
- Pagination

**Why this split:**
- Layout handles **global navigation state**
- Pages handle **view-specific state**
- Project filter affects multiple pages → lives in layout
- View mode only affects one page → lives in that page

### How Pages Use Unified Nav

**Simple Page (No Special Logic):**
```svelte
<!-- src/routes/api-demo/+page.svelte -->
<script>
  // No Nav import needed! Nav is in +layout.svelte
</script>

<div class="p-8">
  <h1>API Demo</h1>
  <!-- Page content -->
</div>
```

**Page with Project Filtering:**
```svelte
<!-- src/routes/agents/+page.svelte -->
<script>
  import { page } from '$app/stores';
  import { filterTasksByProject } from '$lib/utils/projectUtils';

  let allTasks = $state([]);

  // Read project filter from URL (set by layout)
  const selectedProject = $derived($page.url.searchParams.get('project') || 'All Projects');

  // Filter tasks based on project
  const filteredTasks = $derived(filterTasksByProject(allTasks, selectedProject));

  // Load tasks
  onMount(async () => {
    const response = await fetch('/api/agents');
    const data = await response.json();
    allTasks = data.tasks || [];
  });
</script>

<div class="p-8">
  <TaskList tasks={filteredTasks} />
</div>
```

**No Nav props needed** - Nav is global, pages just read URL params.

### Testing Unified Nav

**Browser Testing (see `docs/unified-nav-test-report.md`):**

✅ **Navbar Visibility:** Nav appears on all pages (/, /graph, /agents, /api-demo)
✅ **Active Indicator:** Correct button is blue on each page
✅ **Project Filter:** ?project= param persists across navigation
✅ **Theme Selector:** Theme accessible on all pages
✅ **Responsive:** Single-row layout on all screen sizes
✅ **No Console Errors:** Clean execution

**Manual Testing Checklist:**
```bash
# 1. Start dev server
npm run dev

# 2. Test navigation
- Click List → URL: / → List button blue
- Click Graph → URL: /graph → Graph button blue
- Click Agents → URL: /agents → Agents button blue

# 3. Test project filter
- Select "jat" → URL: /agents?project=jat
- Click List → URL: /?project=jat (param persists)
- Click Graph → URL: /graph?project=jat (param persists)

# 4. Test browser back/forward
- Navigate: / → /agents → /graph
- Press back → /agents (correct)
- Press back → / (correct)

# 5. Test bookmarking
- Bookmark /agents?project=jat
- Close browser
- Open bookmark → Shows jat tasks only (correct)

# 6. Test multi-tab
- Tab 1: /agents?project=jat
- Tab 2: /agents?project=chimaro
- Both tabs show correct project (independent state)
```

### Common Pitfalls

**❌ WRONG: Adding Nav to individual pages**
```svelte
<!-- DON'T DO THIS -->
<!-- src/routes/my-page/+page.svelte -->
<script>
  import Nav from '$lib/components/Nav.svelte';
</script>

<Nav ... />  <!-- Nav already in +layout.svelte! -->
<div>Page content</div>
```

**✅ CORRECT: Just render page content**
```svelte
<!-- src/routes/my-page/+page.svelte -->
<script>
  // Nav is automatic from +layout.svelte
</script>

<div>Page content</div>  <!-- Nav appears above automatically -->
```

**❌ WRONG: Duplicating project filter logic**
```svelte
<!-- DON'T DO THIS -->
<script>
  let selectedProject = $state('All Projects');  // Duplicates layout state!

  function handleProjectChange(project) {
    selectedProject = project;  // Out of sync with layout!
  }
</script>
```

**✅ CORRECT: Read from URL (layout manages state)**
```svelte
<script>
  import { page } from '$app/stores';

  const selectedProject = $derived($page.url.searchParams.get('project') || 'All Projects');
  // Layout updates URL → This recomputes automatically
</script>
```

**❌ WRONG: Passing nav props to pages**
```svelte
<!-- DON'T DO THIS -->
<Nav {projects} {selectedProject} />
{@render children({ projects, selectedProject })}  <!-- Prop drilling! -->
```

**✅ CORRECT: Pages read from URL**
```svelte
<Nav {projects} {selectedProject} />
{@render children()}  <!-- Pages use $page.url.searchParams -->
```

### Migration from Per-Page Nav

**Before (Per-Page Pattern):**
```
src/routes/
  ├── +page.svelte               # Has Nav import, 874 lines
  │   └── <Nav context="home" />
  ├── agents/+page.svelte        # Has Nav import, 874 lines
  │   └── <Nav context="agents" />
  └── api-demo/+page.svelte      # Has Nav import, 874 lines
      └── <Nav context="api-demo" />
```

**After (Root Layout Pattern):**
```
src/routes/
  ├── +layout.svelte             # Nav rendered once
  │   └── <Nav ... />
  ├── +page.svelte               # No Nav import, clean
  ├── agents/+page.svelte        # No Nav import, clean
  └── api-demo/+page.svelte      # No Nav import, clean
```

**Benefits:**
- **2622 lines removed** (874 lines × 3 pages of duplicate Nav)
- **Single source of truth** for navigation
- **Impossible to have inconsistent nav** across pages
- **Easy to add pages** (no Nav setup needed)

### Architecture Decision Record

**Decision:** Use root layout pattern for unified navigation

**Context:**
- Initial implementation had per-page Nav imports
- Each page imported Nav and passed context prop
- 874 lines of Nav HTML duplicated per page
- Risk of inconsistency if one page updates Nav differently

**Options Considered:**

1. **Context-based Nav (initial approach)**
   - ❌ Duplicate imports on every page
   - ❌ Risk of inconsistency
   - ❌ Harder to update (change 3+ files)

2. **Root layout with Nav (chosen)**
   - ✅ Single Nav instance
   - ✅ Zero duplication
   - ✅ Guaranteed consistency
   - ✅ Easy to update (one file)

3. **Header component imported by pages**
   - ❌ Still requires per-page imports
   - ❌ Shared state harder to manage
   - ❌ Project filter would need prop drilling

**Decision:** Root layout pattern (option 2)

**Consequences:**
- ✅ Nav appears on ALL pages automatically
- ✅ Shared state (project filter) works seamlessly
- ✅ Pages are simpler (no Nav imports)
- ⚠️ All pages have Nav (can't hide on specific pages without conditional logic)
- ⚠️ Layout must handle global state (project filter, tasks)

**Status:** Implemented in tasks jat-6zm through jat-ef2

### Files Reference

**Core architecture files:**
- `src/routes/+layout.svelte` - Root layout with Nav (86 lines)
- `src/lib/components/Nav.svelte` - Nav component (173 lines)
- `src/lib/config/navConfig.ts` - Navigation config (50 lines)

**Related files:**
- `src/lib/components/ProjectSelector.svelte` - Project dropdown
- `src/lib/components/ThemeSelector.svelte` - Theme picker
- `src/lib/utils/projectUtils.ts` - Project filtering utilities

**Documentation:**
- `dashboard/docs/unified-nav-test-report.md` - Test results
- `dashboard/CLAUDE.md` - This file (architecture docs)

### Future Considerations

**Conditional Nav (if needed):**
```svelte
<!-- +layout.svelte -->
{#if !$page.url.pathname.startsWith('/admin')}
  <Nav ... />
{/if}
```

**Page-specific Nav overrides (if needed):**
```svelte
<!-- +layout.svelte -->
<Nav
  {projects}
  {selectedProject}
  onProjectChange={handleProjectChange}
  {taskCounts}
  disableProjectFilter={$page.url.pathname === '/settings'}
/>
```

**Nested layouts (if needed):**
```
src/routes/
  ├── +layout.svelte              # Main nav
  └── dashboard/
      ├── +layout.svelte          # Dashboard-specific nav
      └── analytics/+page.svelte  # Has both navs
```

Currently not needed, but the pattern supports these extensions.

## UI Patterns: Unified Queue/Drop Zone

### Overview

The **AgentCard** component (`src/lib/components/agents/AgentCard.svelte`) implements a unified Queue/Drop Zone pattern. This is a key UX pattern in the dashboard that future contributors should understand.

### The Pattern

**What:** Queue section and drop zone are merged into a single, multi-state UI component.

**Why:** Reduces visual redundancy, lowers cognitive load, and provides clearer user feedback.

**Where:** Lines 627-693 in `AgentCard.svelte` (with detailed comment block explaining rationale)

### Design Rationale

**Before (Separate Sections):**
```
┌─ Agent Card ──────────┐
│ Queue (3 tasks)       │
│ • Task 1              │
│ • Task 2              │
│ • Task 3              │
├───────────────────────┤
│ Drop Zone             │
│ [Drop tasks here]     │
└───────────────────────┘
```

**Problem:** Redundant sections, more visual noise, wastes space.

**After (Unified):**
```
┌─ Agent Card ──────────┐
│ Queue (3 tasks)       │
│ • Task 1              │
│ • Task 2              │
│ • Task 3              │
│                       │
│ [Entire section is    │
│  drop target with     │
│  visual feedback]     │
└───────────────────────┘
```

**Solution:** One section serves dual purpose - cleaner, more intuitive.

### Visual States (5 States)

| State | Border | Background | Feedback | Can Drop? |
|-------|--------|------------|----------|-----------|
| **Default** | Solid neutral | None | Shows queued tasks | Yes (on drag) |
| **Success** | Dashed green | `bg-success/10` | ✓ "Drop to assign" | Yes |
| **Dependency Block** | Dashed red | `bg-error/10` | ✗ Shows blocking task | No |
| **File Conflict** | Dashed red | `bg-error/10` | ⚠ Lists conflicts | No |
| **Assigning** | Solid neutral | Blur overlay | ⏳ Loading spinner | No |

**Critical:** All 5 states serve a purpose. Don't remove any without understanding impact.

### State Management

```svelte
let isDragOver = $state(false);           // Drag cursor over section?
let hasConflict = $state(false);          // File reservation conflicts?
let hasDependencyBlock = $state(false);   // Unmet task dependencies?
let isAssigning = $state(false);          // Assignment API call in progress?
let assignError = $state(null);           // Assignment error message
```

**State Transitions:**
```
Default → (drag enters) → Success/Block/Conflict
Success → (drop) → Assigning → Success/Error → Default
Block/Conflict → (drag leaves) → Default
```

### Drag-Drop Implementation

**Key Functions:**
- `handleDragOver(event)` - Detect conflicts/blocks, set visual state
- `handleDrop(event)` - Validate and execute assignment
- `handleDragLeave()` - Reset state when drag exits
- `detectConflicts(taskId)` - Check file reservation conflicts
- `analyzeDependencies(task)` - Check dependency blocks

**Drop Behavior:**
- **Entire queue section is droppable** (not just empty space)
- Conflicts/blocks prevent drop (`event.dataTransfer.dropEffect = 'none'`)
- New tasks appear at **top** of queue after successful assignment
- Visual feedback is immediate and reactive

### Error Handling Philosophy

**Inline Errors (Preferred):**
- Shows error message **inside** the drop zone
- User sees error in context of action
- Detailed messages explain **why** and **how to fix**

**Examples:**
- "Dependency Block! Complete task-xyz first"
- "File Conflict! src/\*\*/\*.ts conflicts with dashboard/\*\*"
- "Assignment timed out after 30 seconds"

**Not Used:**
- Toast notifications (lose context)
- Modal dialogs (interrupt flow)
- Generic errors ("Failed to assign task")

### For Contributors

**When modifying this pattern:**

1. **Test all 5 states** - Drag tasks with/without dependencies, conflicts
2. **Keep error messages specific** - Tell users exactly what's wrong
3. **Don't shrink drop target** - Entire section must remain droppable
4. **Preserve visual feedback** - Border/background changes are critical UX
5. **Check mobile** - Touch interactions should work (test on small screens)

**Common mistakes to avoid:**
- ❌ Making drop zone a small box inside queue
- ❌ Removing error states ("just show success/fail")
- ❌ Generic error messages ("Something went wrong")
- ❌ Modal dialogs for errors (breaks inline pattern)
- ❌ Changing border/background styles without purpose

**Files to review:**
- Component: `src/lib/components/agents/AgentCard.svelte` (lines 627-693)
- README: `dashboard/README.md` (search "Unified Queue/Drop Zone")
- Dependency utils: `src/lib/utils/dependencyUtils.ts`

### User Testing Insights

This pattern was validated through user feedback:

**Users preferred:**
- ✅ Single queue section (less clutter)
- ✅ Inline error messages (immediate context)
- ✅ Entire section as drop target (easier to use)
- ✅ Detailed error messages (actionable guidance)

**Users rejected:**
- ❌ Separate drop zone (felt redundant)
- ❌ Toast notifications (lose context)
- ❌ Small drop zones (hard to hit)
- ❌ Generic errors ("not helpful")

**Key Quote:** *"I like that I can see exactly why the task can't be assigned right where I'm trying to drop it."*

## UI Patterns: TaskDetailDrawer Component

### Overview

The **TaskDetailDrawer** component (`src/lib/components/TaskDetailDrawer.svelte`) provides a unified interface for viewing and editing task details using a side drawer pattern. It replaces modal dialogs with a less intrusive, more modern UX.

### Key Features

- **Dual Mode Support:** Seamlessly switch between view (read-only) and edit (form) modes
- **Drawer Pattern:** Right-side panel that doesn't block the main content
- **Auto-Fetch:** Loads task data from `/api/tasks/{id}` on mount
- **Inline Editing:** Edit mode with full form validation
- **Success/Error Handling:** Visual feedback for all operations

### Component Props

```typescript
let {
  taskId = $bindable(null),      // Task ID to display
  mode = $bindable('view'),       // 'view' or 'edit'
  isOpen = $bindable(false)       // Drawer open state
} = $props();
```

**All props are bindable** - parent components can read and write them reactively.

### Usage Example

```svelte
<script>
  import TaskDetailDrawer from '$lib/components/TaskDetailDrawer.svelte';

  let drawerOpen = $state(false);
  let selectedTaskId = $state(null);
  let drawerMode = $state('view');

  function openTaskDetails(taskId) {
    selectedTaskId = taskId;
    drawerMode = 'view';
    drawerOpen = true;
  }
</script>

<button onclick={() => openTaskDetails('jat-abc')}>
  View Task Details
</button>

<TaskDetailDrawer
  bind:taskId={selectedTaskId}
  bind:mode={drawerMode}
  bind:isOpen={drawerOpen}
/>
```

### View Mode

**Default mode** - displays task information in read-only format.

**Displays:**
- Task title (prominent heading)
- Task ID badge
- Status, priority, type badges (color-coded)
- Project badge (if assigned)
- Labels (badge list)
- Description (whitespace preserved)
- Dependencies (depends_on) - with status/priority for each
- Dependents (blocked_by) - tasks this task blocks
- Metadata: created date, updated date, assignee

**Actions:**
- Edit button (switches to edit mode)
- Close button

### Edit Mode

**Activated by clicking Edit button** - provides full form editing capabilities.

**Editable Fields:**
- Title (required, validated)
- Description (optional, textarea)
- Status (dropdown: open, in_progress, blocked, closed)
- Priority (dropdown: P0-P4)
- Type (dropdown: task, bug, feature, epic, chore)
- Project (dropdown with predefined projects)
- Labels (comma-separated text input)
- Assignee (text input)

**Form Behavior:**
- Client-side validation (title required, type required)
- PUT request to `/api/tasks/{id}` on save
- Success: Shows success message, refetches task, switches to view mode
- Error: Shows inline error message, stays in edit mode
- Cancel: Discards changes, switches to view mode

**Actions:**
- Cancel button (discards changes, back to view)
- Save Changes button (submits form)

### Mode Toggle Pattern

**View Mode → Edit Mode:**
1. User clicks "Edit" button in header
2. Component switches mode to 'edit'
3. Form is populated with current task data
4. Footer shows Cancel + Save buttons

**Edit Mode → View Mode:**
1. User clicks "Cancel" or "View" button
2. Component resets form to original task data
3. Switches mode to 'view'
4. Footer shows Close button

**After Save:**
1. User clicks "Save Changes"
2. Form validates, submits PUT request
3. On success: Shows success message for 1.5s
4. Auto-refetches task data
5. Automatically switches back to view mode

### Visual States

| State | View | Description |
|-------|------|-------------|
| **Loading** | Spinner | Fetching task data from API |
| **Error** | Error alert + Retry button | Failed to load task |
| **View Mode** | Read-only content | Displaying task details |
| **Edit Mode** | Form fields | Editing task details |
| **Submitting** | Disabled form + spinner | Saving changes |
| **Success** | Success alert | Changes saved successfully |
| **Submit Error** | Error alert | Failed to save changes |

### Drawer Layout

**Structure:**
```
┌─ Drawer Panel (max-w-2xl) ────────────────────┐
│ Header                                         │
│  • Title: "Task Details" or "Edit Task"        │
│  • Task ID badge (view mode only)             │
│  • Mode toggle button (Edit ↔ View)           │
│  • Close button (✕)                            │
├────────────────────────────────────────────────┤
│ Content (scrollable)                           │
│  • View: Sections with task data              │
│  • Edit: Form with input fields               │
│                                                │
│  (flexible height, overflow-y-auto)            │
├────────────────────────────────────────────────┤
│ Footer (bg-base-200)                           │
│  • View: Close button                          │
│  • Edit: Cancel + Save Changes buttons        │
└────────────────────────────────────────────────┘
```

**Drawer Properties:**
- Side: Right (drawer-end)
- Width: max-w-2xl (responsive)
- Overlay: Click to close
- Z-index: z-50 (appears above most content)
- Shadow: shadow-2xl (prominent depth)

### API Integration

**Fetch Task:**
```javascript
GET /api/tasks/{taskId}
Response: { task: { id, title, description, ... } }
```

**Update Task:**
```javascript
PUT /api/tasks/{taskId}
Body: { title, description, priority, type, status, project, labels, assignee }
Response: { task: { ... } }
```

**Error Handling:**
- Network errors: Shows error alert with retry button
- Validation errors: Inline field-level error messages
- API errors: Shows error message from server
- 404 Not Found: "Failed to fetch task" error

### Badge Color Coding

**Status Badges:**
- `open` → info (blue)
- `in_progress` → warning (yellow)
- `closed` → success (green)
- `blocked` → error (red)

**Priority Badges:**
- P0 → error (red, Critical)
- P1 → warning (yellow, High)
- P2 → info (blue, Medium)
- P3-P4 → ghost (gray, Low)

**Project Badge:**
- primary (brand color)

**Labels:**
- outline badges (neutral)

### Comparison: Drawer vs Modal

**Why Drawer Pattern?**

| Feature | Drawer (TaskDetailDrawer) | Modal (TaskDetailModal) |
|---------|---------------------------|-------------------------|
| **View Blocking** | No - side panel | Yes - overlay blocks view |
| **Context Preservation** | Keep main view visible | Main view obscured |
| **Multi-tasking** | Can reference other tasks | Must close to see other content |
| **Screen Real Estate** | Efficient use of width | Centers, wastes edges |
| **Mobile UX** | Full-width, native feel | Often awkward on mobile |
| **Modern UX** | Contemporary pattern | Traditional pattern |

**When to Use Each:**
- **Drawer:** Task details, editing workflows, reference panels
- **Modal:** Critical confirmations, alerts, focused single actions

### Best Practices

**Do:**
- ✅ Use bindable props for reactive parent-child communication
- ✅ Validate form fields before submission
- ✅ Show inline error messages (not toasts)
- ✅ Provide visual feedback for all state changes
- ✅ Auto-refetch data after successful updates
- ✅ Reset form when switching from edit → view

**Don't:**
- ❌ Modify task data without saving
- ❌ Allow submission with invalid data
- ❌ Close drawer during API requests
- ❌ Use generic error messages
- ❌ Forget to handle loading/error states

### Extending the Component

**Add New Field:**
1. Add field to formData state
2. Add field to view mode display
3. Add input to edit mode form
4. Include in PUT request body

**Example - Adding "Due Date":**
```svelte
// 1. Add to formData
let formData = $state({
  // ... existing fields
  dueDate: ''
});

// 2. View mode display
{#if task.due_date}
  <div>
    <h4 class="text-sm font-semibold mb-2">Due Date</h4>
    <p>{formatDate(task.due_date)}</p>
  </div>
{/if}

// 3. Edit mode form
<div class="form-control">
  <label class="label">
    <span class="label-text font-semibold">Due Date</span>
  </label>
  <input type="date" class="input input-bordered" bind:value={formData.dueDate} />
</div>

// 4. Include in PUT request
const requestBody = {
  // ... existing fields
  due_date: formData.dueDate || undefined
};
```

### Files

**Component:** `src/lib/components/TaskDetailDrawer.svelte` (701 lines)

**Related Components:**
- `TaskCreationDrawer.svelte` - Similar drawer pattern for task creation
- `TaskDetailModal.svelte` - Legacy modal version (deprecated)

**API Routes:**
- `src/routes/api/tasks/[id]/+server.js` - GET/PUT task endpoint

**Task Reference:**
- jat-25i: Create TaskDetailDrawer base component (completed)
- jat-lli: Implement auto-save edit mode (planned)
- jat-dtq: Add quick actions to view mode (planned)

## Multi-Project Filtering

### Overview

The dashboard supports multi-project task management with intelligent project detection and filtering. Projects are automatically detected from task ID prefixes (e.g., `chimaro-abc`, `jat-xyz`, `jomarchy-123`).

### How It Works

**Project Detection:**
- Task IDs follow format: `{project}-{hash}` (e.g., `jat-xkp`, `chimaro-42a`)
- Project name is extracted from the prefix before the first hyphen
- Projects are auto-discovered from all loaded tasks
- No manual project configuration needed

**Implementation:** `src/lib/utils/projectUtils.ts`

```typescript
// Extract project from task ID
getProjectFromTaskId("chimaro-abc")  // → "chimaro"
getProjectFromTaskId("jat-xyz")      // → "jat"
getProjectFromTaskId("jomarchy-123") // → "jomarchy"

// Get all unique projects from tasks
getProjectsFromTasks(tasks)
// → ["All Projects", "chimaro", "jat", "jomarchy"]

// Filter tasks by project
filterTasksByProject(tasks, "chimaro")
// → Only chimaro tasks
```

### Where Filters Appear

**1. Navbar (/agents page)**
- Dropdown selector in top navigation bar
- Shows all detected projects
- Displays task count per project
- Example: "jat (8) | chimaro (12) | All Projects (20)"

**2. TaskQueue Sidebar**
- Project filter integrated with task queue
- Filters tasks in sidebar by selected project
- Syncs with navbar selection

**3. URL Parameter**
- Project selection updates URL: `?project=chimaro`
- Bookmarkable URLs (copy/paste preserves selection)
- Page reload preserves last selected project
- Example URLs:
  - `/agents` - All projects
  - `/agents?project=chimaro` - Only chimaro tasks
  - `/agents?project=jat` - Only jat tasks

### Features

**Automatic Detection:**
- No configuration files needed
- Projects discovered from task IDs automatically
- Works with any project naming convention (alphanumeric, hyphens, underscores)
- Handles projects in `~/code/*` structure

**Task Count Display:**
- Shows number of tasks per project
- Updates reactively as tasks change
- Example: "chimaro (15)" means 15 chimaro tasks

**URL Integration:**
- `?project=X` parameter filters view
- Direct links work: Share filtered URLs with team
- Browser back/forward preserves filter state
- Bookmarks remember project selection

**Filter Persistence:**
- Selected project stored in URL (not localStorage)
- Page refresh maintains selection
- Multiple tabs can show different projects
- No cleanup needed (stateless)

### Use Cases

**1. View Single Project:**
```
Navigate to: /agents?project=chimaro
Result: Shows only chimaro-* tasks
```

**2. Switch Projects:**
```
1. Select "jat" from dropdown
2. URL updates to: /agents?project=jat
3. Tasks refresh to show only jat-* tasks
4. Share URL with team for same view
```

**3. View All Projects:**
```
Select "All Projects" from dropdown
URL: /agents (no project param)
Result: Shows all tasks from all projects
```

**4. Bookmarkable Views:**
```
Bookmark: /agents?project=chimaro
Result: Always opens to chimaro tasks
Use case: Dedicated bookmark per project
```

### Integration with Other Filters

Project filter works seamlessly with existing filters:

```
/agents?project=jat&priority=P0&status=open
→ Shows P0 open tasks from jat project only

/agents?project=chimaro&search=authentication
→ Shows chimaro tasks matching "authentication"
```

**Filter precedence:** All filters are AND-ed together (narrow down results).

### Supported Task ID Formats

The project filter handles various task ID formats:

| Format | Project Extracted | Example |
|--------|-------------------|---------|
| `project-hash` | `project` | `jat-abc` → "jat" |
| `multi-word-hash` | `multi-word` | `my-app-xyz` → "my-app" |
| `CAPS-hash` | `caps` | `JAT-123` → "jat" (lowercased) |
| `under_score-hash` | `under_score` | `my_proj-abc` → "my_proj" |

**Invalid formats (no project extracted):**
- `nodashhash` - No hyphen separator
- `-abc` - Empty project prefix
- `abc-` - Empty hash suffix

### Performance

**Optimized for large task lists:**
- Project list computed once per data load
- Filter operation is O(n) on tasks array
- Uses Svelte 5 `$derived` for reactive updates
- No unnecessary re-renders

**Typical performance:**
- 100 tasks: <1ms filter time
- 1000 tasks: <5ms filter time
- 10,000 tasks: <50ms filter time

### For Developers

**Adding project-aware features:**

1. **Get current project:**
```typescript
// From URL
const projectParam = $page.url.searchParams.get('project');

// From selected state
let selectedProject = $state('All Projects');
```

2. **Filter data by project:**
```typescript
import { filterTasksByProject } from '$lib/utils/projectUtils';

const filteredTasks = $derived(
  filterTasksByProject(allTasks, selectedProject)
);
```

3. **Update URL with project:**
```typescript
function handleProjectChange(project: string) {
  const url = new URL(window.location.href);

  if (project === 'All Projects') {
    url.searchParams.delete('project');
  } else {
    url.searchParams.set('project', project);
  }

  goto(url.pathname + url.search);
}
```

**Testing project filter:**
```typescript
// Unit tests in projectUtils.test.ts
test('extracts project from task ID', () => {
  expect(getProjectFromTaskId('chimaro-abc')).toBe('chimaro');
  expect(getProjectFromTaskId('jat-xyz')).toBe('jat');
  expect(getProjectFromTaskId('invalid')).toBeNull();
});
```

### Common Issues

**Project dropdown is empty:**
- Check that tasks have valid ID format: `project-hash`
- Verify tasks are loaded: console.log(tasks)
- Ensure projectUtils is imported correctly

**Filter not working:**
- Verify URL param matches project name exactly
- Check case sensitivity (should be lowercase)
- Ensure $derived is used for reactivity

**Projects not detected:**
- Task IDs must follow `{prefix}-{hash}` format
- Prefix must be non-empty and contain valid characters
- Hash must be non-empty (at least 1 character)

### Files

**Core utilities:**
- `src/lib/utils/projectUtils.ts` - Project detection and filtering logic
- `src/lib/components/agents/ProjectFilter.svelte` - Dropdown component (if exists)
- `src/routes/agents/+page.svelte` - Integration and URL handling

**Related:**
- `src/lib/components/agents/TaskQueue.svelte` - Sidebar filtering
- `src/routes/api/agents/+server.js` - API endpoint (supports ?project param)

### Architectural Decision: Agent Inbox Filtering

**Decision:** Agent inbox is **GLOBAL** (not project-filtered)

**Rationale:**
- Agents are globally unique (one agent name across all projects)
- Cross-project coordination is common (deployments, infrastructure, team broadcasts)
- Splitting inbox by project would make agents miss important messages
- Thread filtering (--thread) provides sufficient focus when needed

**Implementation:**
```javascript
// API: dashboard/src/routes/api/agents/[name]/inbox/+server.js
const command = `am-inbox "${agentName}" --json`;  // No --project flag
```

**For developers:**
- Do NOT add project filtering to agent inbox API
- Agents see ALL messages regardless of project context
- Use thread filtering (`--thread task-id`) for focused message view
- See `dashboard/docs/inbox-filtering-decision.md` for full analysis

**Task:** jat-xkr - Resolved 2025-11-21 by SharpIsle

## Claude API Usage Metrics

The dashboard includes a **Claude API Usage Bar** component that displays real-time metrics about Claude API usage, replacing the previous hour-based capacity estimation system.

**Location:** Fixed bottom-right of screen (hover to expand)

**What it shows:**
- Subscription tier (FREE, BUILD, MAX) with rate limits
- Optional: Real-time session context from API headers
- Agent activity metrics (working/idle/sleeping agents)

**Key Features:**
- Hover-to-expand stats widget
- 30-second auto-refresh polling
- Multi-layer caching (30s for session context, 60s for agent metrics)
- Graceful degradation when data unavailable

**Quick Start:**
```bash
# Component automatically fetches tier from ~/.claude/.credentials.json
# No configuration needed for basic tier display

# Optional: Enable real-time session context
export ANTHROPIC_API_KEY=sk-ant-api03-...  # Get from console.anthropic.com
npm run dev
```

**Files:**
- `src/lib/components/ClaudeUsageBar.svelte` - UI component
- `src/lib/utils/claudeUsageMetrics.ts` - Data fetching utility
- `src/routes/api/claude/usage/+server.js` - API endpoint

**📖 Full Documentation:** See [`docs/claude-api-usage-metrics-guide.md`](docs/claude-api-usage-metrics-guide.md) for:
- Complete metrics breakdown
- Data sourcing architecture
- Troubleshooting guide
- Future enhancements

**Task References:**
- jat-sk1: Claude API usage data fetching (completed)
- jat-1ux: Replace SystemCapacityBar with ClaudeUsageBar (completed)
- jat-ozq: Document Claude API usage metrics (completed)

## Per-Agent Token Tracking

### Overview

The dashboard tracks token usage per agent by parsing Claude Code session files (JSONL format) and displaying usage metrics on agent cards and system-wide summaries.

**Key Features:**
- Per-agent token usage (today/week)
- Cost tracking with Sonnet 4.5 pricing
- Color-coded thresholds (configurable)
- System-wide usage overview
- Top consumers ranking
- Session count tracking

### How It Works

**Data Flow:**
```
Claude Code Sessions → JSONL Files → tokenUsage.ts → API Endpoints → UI Components
```

**1. JSONL Session Files:**
- Location: `~/.claude/projects/{project-slug}/*.jsonl`
- Contains: API responses with token usage per request
- Format: One JSON object per line with `.message.usage` field

**2. Session-Agent Mapping:**
- Location: `.claude/agent-{session_id}.txt`
- Contains: Agent name for that session
- Created by: Agent workflow commands (`/agent:start`, etc.)

**3. Token Aggregation:**
- `tokenUsage.ts` parses JSONL files
- Sums tokens across all sessions for each agent
- Filters by time range (today/week/all)
- Calculates costs using Sonnet 4.5 pricing

**4. API Endpoints:**
- `/api/agents?usage=true` - All agents with usage data
- `/api/agents/[name]/usage?range=today|week|all` - Single agent usage

**5. UI Display:**
- AgentCard: Individual agent usage
- Agents page: System-wide summary and top consumers

### Architecture

**Core Files:**
- `src/lib/utils/tokenUsage.ts` - JSONL parsing and aggregation (460 lines)
- `src/routes/api/agents/[name]/usage/+server.js` - Single agent API (147 lines)
- `src/routes/api/agents/+server.js` - Orchestration API with ?usage=true (modified)
- `src/lib/components/agents/AgentCard.svelte` - Per-agent display
- `src/lib/config/tokenUsageConfig.ts` - Configurable thresholds

**Key Functions:**

```typescript
// Build session → agent mapping
buildSessionAgentMap(projectPath): Promise<Map<string, string>>

// Parse single session JSONL file
parseSessionUsage(sessionId, projectPath): Promise<SessionUsage | null>

// Get usage for specific agent
getAgentUsage(agentName, timeRange, projectPath): Promise<TokenUsage>

// Get all agents' usage
getAllAgentUsage(timeRange, projectPath): Promise<Map<string, TokenUsage>>

// Calculate costs (Sonnet 4.5 pricing)
calculateCost(usage): number
```

### Configuration

**Thresholds:** `src/lib/config/tokenUsageConfig.ts`

```typescript
export const TOKEN_THRESHOLDS = {
  low: 100_000_000,      // Green: < 100M tokens/day (~$300/day)
  medium: 250_000_000,   // Yellow: 100M-250M tokens/day
  high: 500_000_000      // Orange: 250M-500M tokens/day
  // Red: > 500M tokens/day
};

export const HIGH_USAGE_WARNING_THRESHOLD = TOKEN_THRESHOLDS.high;
```

**To Customize:**
1. Edit `tokenUsageConfig.ts` with your preferred thresholds
2. Reload dashboard (no restart needed)
3. Colors update automatically

**Example (smaller budget):**
```typescript
export const TOKEN_THRESHOLDS = {
  low: 100_000,      // Green: < 100K tokens/day (~$0.30/day)
  medium: 500_000,   // Yellow: 100K-500K tokens/day
  high: 1_000_000    // Orange: 500K-1M tokens/day
};
```

### UI Components

**1. AgentCard Token Usage Section:**

Location: After File Locks, before Recent Activity Feed

**Displays:**
- **Today's Usage:**
  - Total tokens (color-coded by threshold)
  - Cost in USD
  - High usage warning badge (if > threshold)
- **Week's Usage:**
  - Total tokens (K/M formatted)
  - Cost in USD
  - Session count

**States:**
- Loading: Skeleton loader
- Error: Inline error with retry button (3 attempts max)
- Empty: "No usage data yet" message
- Success: Usage metrics with color coding

**Color Coding:**
- Gray: 0 tokens
- Green: < low threshold (normal usage)
- Yellow: low - medium threshold (elevated usage)
- Orange: medium - high threshold (high usage)
- Red: > high threshold (critical usage)

**2. System Usage Overview (Agents Page):**

Collapsible panel showing:
- **System Stats:**
  - Total tokens today (all agents)
  - Total spend today
  - Active agent count
- **Top Agents:**
  - Top 3 agents by token usage today
  - Tokens and cost per agent

### Pricing Reference

**Claude Sonnet 4.5 Pricing (per million tokens):**
- Input: $3.00
- Cache creation: $3.75
- Cache read: $0.30 (90% savings!)
- Output: $15.00

**Cost Examples:**
- 100K tokens/day ≈ $0.30/day ≈ $9/month
- 1M tokens/day ≈ $3/day ≈ $90/month
- 10M tokens/day ≈ $30/day ≈ $900/month
- 100M tokens/day ≈ $300/day ≈ $9,000/month

**Note:** Actual costs vary based on cache hit rate and input/output ratio.

### Data Sources

**Session Files Location:**
```
~/.claude/projects/{project-slug}/{session-id}.jsonl
```

**Project Slug Format:**
- Path: `/home/user/code/project` → `-home-user-code-project`
- Leading `-` is important (don't strip it!)

**Session-Agent Mapping:**
```
.claude/agent-{session_id}.txt → "AgentName"
```

**Example:**
```bash
# Session file
~/.claude/projects/-home-jw-code-jat/abc123-def456.jsonl

# Agent mapping
.claude/agent-abc123-def456.txt → "WisePrairie"

# Result: All tokens from abc123-def456.jsonl count toward WisePrairie
```

### API Usage

**Fetch all agents with usage data:**
```bash
curl 'http://localhost:5173/api/agents?full=true&usage=true'
```

**Response:**
```json
{
  "agents": [
    {
      "name": "WisePrairie",
      "usage": {
        "today": {
          "total_tokens": 45000,
          "cost": 0.15,
          "sessionCount": 1
        },
        "week": {
          "total_tokens": 2500000,
          "cost": 8.50,
          "sessionCount": 7
        }
      }
    }
  ]
}
```

**Fetch single agent usage:**
```bash
curl 'http://localhost:5173/api/agents/WisePrairie/usage?range=week'
```

**Response:**
```json
{
  "agent": "WisePrairie",
  "range": "week",
  "usage": {
    "input_tokens": 500000,
    "cache_creation_input_tokens": 100000,
    "cache_read_input_tokens": 1500000,
    "output_tokens": 400000,
    "total_tokens": 2500000,
    "cost": 8.50,
    "sessionCount": 7
  },
  "cached": false,
  "timestamp": "2025-11-21T15:45:00.000Z"
}
```

### Caching Strategy

**API Caching:**
- Single agent endpoint: 60-second TTL
- All agents endpoint: No caching (parent page handles polling)

**Benefits:**
- Reduces JSONL parsing overhead
- Faster response times
- Lower CPU usage on dashboard server

### Troubleshooting

**Usage data shows zeros or is missing:**

1. **Check session files exist:**
   ```bash
   # Find project slug
   pwd | sed 's/\//\-/g'
   # Example: /home/jw/code/jat → -home-jw-code-jat

   # Check for JSONL files
   ls ~/.claude/projects/-home-jw-code-jat/*.jsonl
   ```

2. **Check agent mapping files:**
   ```bash
   ls .claude/agent-*.txt
   cat .claude/agent-{session-id}.txt
   ```

3. **Verify project path in API:**
   - Dashboard uses `process.cwd().replace('/dashboard', '')`
   - Should resolve to parent project directory
   - Check server logs for path transformation

4. **Run test script:**
   ```bash
   cd dashboard
   npx tsx test-token-usage.ts
   ```

**"No usage data yet" on all agents:**

Possible causes:
- Agents haven't made any API calls yet
- Session files not in expected location
- Project path slug mismatch

**High usage warning always shows:**

Adjust threshold in `tokenUsageConfig.ts`:
```typescript
export const HIGH_USAGE_WARNING_THRESHOLD = 10_000_000; // 10M tokens
```

**Colors don't match expectations:**

Check thresholds in `tokenUsageConfig.ts` and adjust to your budget.

### Performance Considerations

**JSONL Parsing:**
- Each file read: ~50-200ms (depends on size)
- Caching reduces repeat parses
- Runs server-side (not blocking UI)

**Typical Performance:**
- 10 agents, 50 sessions: ~1-2 seconds first load
- Subsequent loads: <100ms (cached)
- Page load: Async, doesn't block agent cards

**Optimization Tips:**
- Keep session file count reasonable (archive old sessions)
- Use caching (already enabled)
- Filter by time range to reduce parsing

### Future Enhancements

**Planned (Not Yet Implemented):**

1. **Real-time Usage Tracking:**
   - WebSocket updates for live token counting
   - Progress bars showing current session usage

2. **Cost Budgets:**
   - Per-agent daily/weekly budgets
   - Alerts when approaching limits
   - Budget remaining indicators

3. **Historical Trends:**
   - Usage charts (daily/weekly/monthly)
   - Cost projections based on trends
   - Peak usage identification

4. **Export & Reporting:**
   - CSV export of usage data
   - Monthly cost reports
   - Per-project cost breakdown

5. **Cache Efficiency Analysis:**
   - Cache hit rate display
   - Cost savings from caching
   - Cache optimization recommendations

### Files Reference

**Core Implementation:**
- `src/lib/utils/tokenUsage.ts` - Token aggregation logic (460 lines)
- `src/lib/config/tokenUsageConfig.ts` - Configurable thresholds (60 lines)
- `src/routes/api/agents/[name]/usage/+server.js` - Single agent API (147 lines)
- `src/routes/api/agents/+server.js` - Orchestration API (modified)
- `src/lib/components/agents/AgentCard.svelte` - Per-agent display (modified)
- `src/routes/agents/+page.svelte` - System summary (modified)

**Testing:**
- `test-token-usage.ts` - Manual test script (95 lines)

**Documentation:**
- `dashboard/CLAUDE.md` - This section

**Task References:**
- jat-naq: Create tokenUsage.ts utility module (completed)
- jat-v0w: Create usage API endpoint (completed)
- jat-1n0: Enhance API orchestration (completed)
- jat-oig: Display token usage on AgentCard (completed)
- jat-1q7: Document per-agent token tracking (this section)

## Development Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Clean build cache
rm -rf .svelte-kit node_modules/.vite
```

## References

- [Tailwind CSS v4 Docs](https://tailwindcss.com/docs)
- [DaisyUI Themes](https://daisyui.com/docs/themes/)
- [theme-change Library](https://github.com/saadeghi/theme-change)
- [Svelte 5 Runes](https://svelte-5-preview.vercel.app/docs/runes)
- [SvelteKit Docs](https://kit.svelte.dev/docs)
