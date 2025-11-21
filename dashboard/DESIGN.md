# ClaudeUsageBar Component Design

**Task:** jat-m60
**Priority:** P1
**Designer:** LightPeak
**Date:** 2025-11-21
**Status:** Design Specification

## Executive Summary

ClaudeUsageBar is a fixed-bottom status bar that replaces SystemCapacityBar to display Claude API usage metrics and agent status. It provides real-time visibility into weekly quota consumption, cost tracking, and agent coordination state.

**Key Features:**
- Weekly quota usage with color-coded thresholds
- Cost tracking (daily and weekly)
- Agent status overview ([X working] [Y idle])
- Real-time updates via rate limit headers
- Compact single-row layout
- Responsive tooltips with detailed breakdowns

## 1. Component Props Interface

```typescript
interface ClaudeUsageBarProps {
  // Session context (real-time from rate limit headers)
  sessionContext: SessionContext;

  // Weekly quota data (historical from Cost Report API)
  weeklyQuota: WeeklyQuotaData;

  // Agent statistics (from Agent Mail)
  agentStats: AgentStats;
}

interface SessionContext {
  requestsUsed: number;          // Current session requests made
  requestsLimit: number;          // Per-minute request limit
  tokensUsed: number;             // Current session tokens used
  tokensLimit: number;            // Per-minute token limit
  requestsReset?: Date;           // When request quota resets
  tokensReset?: Date;             // When token quota resets
}

interface WeeklyQuotaData {
  tokensUsed: number;             // Weekly tokens consumed
  tokensLimit: number;            // Weekly token limit
  costUsd: number;                // Weekly cost in USD
  costLimit: number;              // Weekly cost budget in USD
  periodStart: Date;              // Week start date
  periodEnd: Date;                // Week end date
  estimatedEndOfWeekCost?: number;  // Projected cost if trend continues
}

interface AgentStats {
  total: number;                  // Total registered agents
  working: number;                // Agents with in_progress tasks
  idle: number;                   // Agents with no tasks
  offline: number;                // Agents inactive >24h
  lastUpdate: Date;               // When stats were last fetched
}
```

**Prop Defaults:**
```typescript
const defaultProps = {
  sessionContext: {
    requestsUsed: 0,
    requestsLimit: 100,
    tokensUsed: 0,
    tokensLimit: 100000
  },
  weeklyQuota: {
    tokensUsed: 0,
    tokensLimit: 1000000,
    costUsd: 0,
    costLimit: 100,
    periodStart: new Date(),
    periodEnd: new Date()
  },
  agentStats: {
    total: 0,
    working: 0,
    idle: 0,
    offline: 0,
    lastUpdate: new Date()
  }
};
```

## 2. Visual Layout Design

### 2.1 Overall Structure

```
┌─ Fixed Bottom Bar (single row, full width) ───────────────────────────────────┐
│                                                                                │
│  [Weekly Quota: 65%] [Cost: $45.23/$100] [Daily: $6.80] [Agents: 3W 2I 1OFF] │
│   └─ Green bar      └─ Yellow indicator   └─ White text  └─ Status badges    │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Layout Breakdown:**
- **Fixed position:** `fixed bottom-0 left-0 right-0 z-50`
- **Height:** `h-12` (48px)
- **Background:** `bg-base-100` with `border-t border-base-300`
- **Padding:** `px-4 py-2`
- **Display:** `flex items-center justify-between gap-4`

### 2.2 Section Layout (Left to Right)

**Section 1: Weekly Quota (35% width)**
```
┌─ Weekly Quota ────────────┐
│ 65% used                  │
│ ████████░░░░░ (green bar) │
│ 650K / 1M tokens          │
└───────────────────────────┘
```

**Section 2: Cost Tracking (30% width)**
```
┌─ Cost Tracking ───────────┐
│ $45.23 / $100 (45%)       │
│ Daily: $6.80 (+12%)       │
└───────────────────────────┘
```

**Section 3: Session Stats (15% width)**
```
┌─ Session (if hovering) ───┐
│ 45 / 100 requests         │
│ 15K / 100K tokens         │
└───────────────────────────┘
```

**Section 4: Agent Status (20% width)**
```
┌─ Agents ──────────────────┐
│ [3 working] [2 idle] [1 offline] │
└───────────────────────────┘
```

### 2.3 Responsive Behavior

**Desktop (≥1024px):**
- All sections visible
- Full text labels
- Detailed metrics

**Tablet (768px - 1023px):**
- All sections visible
- Abbreviated labels ("Wkly:", "Cost:", "Agents:")
- Shortened text

**Mobile (<768px):**
- Hide session stats section
- Show only: Weekly quota + Cost + Agents
- Icon-only badges for agents

## 3. Color Coding Thresholds

### 3.1 Weekly Quota Bar

| Usage | Color | DaisyUI Class | Meaning |
|-------|-------|---------------|---------|
| 0-60% | Green | `bg-success` | Healthy usage |
| 60-80% | Yellow | `bg-warning` | Moderate usage |
| 80-95% | Orange | `bg-orange-500` | High usage |
| 95-100% | Red | `bg-error` | Critical/exhausted |

**Bar Implementation:**
```svelte
<div class="flex-1 h-2 bg-base-300 rounded-full overflow-hidden">
  <div
    class="h-full {getQuotaColor(percentage)} transition-all duration-300"
    style="width: {percentage}%"
  ></div>
</div>
```

### 3.2 Cost Indicator

| Cost % | Color | DaisyUI Class | Icon |
|--------|-------|---------------|------|
| 0-50% | Green | `text-success` | 💵 |
| 50-80% | Yellow | `text-warning` | 💰 |
| 80-100% | Red | `text-error` | 🚨 |

**Text Implementation:**
```svelte
<span class="{getCostColor(costPercentage)}">
  ${costUsd.toFixed(2)} / ${costLimit}
</span>
```

### 3.3 Agent Status Badges

| Status | Color | DaisyUI Class | Label |
|--------|-------|---------------|-------|
| Working | Primary | `badge-primary` | `{count} working` |
| Idle | Ghost | `badge-ghost` | `{count} idle` |
| Offline | Error (dim) | `badge-error badge-outline` | `{count} offline` |

**Badge Implementation:**
```svelte
<div class="flex gap-1">
  {#if agentStats.working > 0}
    <span class="badge badge-sm badge-primary">{agentStats.working} working</span>
  {/if}
  {#if agentStats.idle > 0}
    <span class="badge badge-sm badge-ghost">{agentStats.idle} idle</span>
  {/if}
  {#if agentStats.offline > 0}
    <span class="badge badge-sm badge-error badge-outline">{agentStats.offline} offline</span>
  {/if}
</div>
```

## 4. Tooltip Content Structure

### 4.1 Weekly Quota Tooltip

**Trigger:** Hover over weekly quota section

**Content:**
```
┌─ Weekly Quota Details ────────────────┐
│ Period: Nov 14 - Nov 21, 2025         │
│                                       │
│ Usage:                                │
│ • Tokens: 650,000 / 1,000,000 (65%)  │
│ • Cost: $45.23 / $100 (45.2%)        │
│                                       │
│ Daily Average:                        │
│ • Tokens: 92,857 per day             │
│ • Cost: $6.46 per day                │
│                                       │
│ Projected End-of-Week:                │
│ • Total cost: $64.30 (estimate)      │
│ • Remaining budget: $35.70           │
│                                       │
│ Session Context (last 1 min):         │
│ • Requests: 45 / 100                 │
│ • Tokens: 15,234 / 100,000           │
│ • Resets in: 32 seconds              │
└───────────────────────────────────────┘
```

**Implementation:**
```svelte
<div class="tooltip tooltip-top" data-tip={weeklyQuotaTooltip()}>
  <div class="flex items-center gap-2">
    <!-- Weekly quota bar content -->
  </div>
</div>
```

### 4.2 Cost Tooltip

**Trigger:** Hover over cost section

**Content:**
```
┌─ Cost Breakdown ──────────────────────┐
│ Weekly Total: $45.23 / $100 (45.2%)   │
│                                       │
│ By Model:                             │
│ • Sonnet 4.5: $38.40 (85%)           │
│ • Opus 3.5: $5.83 (13%)              │
│ • Haiku 3.5: $1.00 (2%)              │
│                                       │
│ Daily Trend:                          │
│ • Today: $6.80 (+12% from avg)       │
│ • Yesterday: $7.20                    │
│ • Avg: $6.46 per day                 │
│                                       │
│ Estimated weekly cost: $64.30         │
└───────────────────────────────────────┘
```

### 4.3 Agent Status Tooltip

**Trigger:** Hover over agent badges

**Content:**
```
┌─ Agent Overview ──────────────────────┐
│ Total Agents: 6                       │
│                                       │
│ Working (3):                          │
│ • FreeMarsh - jat-m60 (45 min)       │
│ • PaleStar - jat-sk1 (12 min)        │
│ • StrongShore - jat-ef2 (8 min)      │
│                                       │
│ Idle (2):                             │
│ • GreatLake (last active: 2h ago)    │
│ • BrightCove (last active: 6h ago)   │
│                                       │
│ Offline (1):                          │
│ • RichPrairie (last seen: 2d ago)    │
│                                       │
│ Last updated: 2 minutes ago           │
└───────────────────────────────────────┘
```

**Tooltip Styling:**
```svelte
<div
  class="tooltip tooltip-top max-w-sm"
  data-tip={agentTooltipContent()}
>
  <!-- Agent badges -->
</div>
```

## 5. API Integration Points

### 5.1 Session Context (Real-Time)

**Source:** Rate limit headers from Claude API responses

**Update Frequency:** Every API request (real-time)

**Header Mapping:**
```typescript
interface RateLimitHeaders {
  'anthropic-ratelimit-requests-limit': string;      // "1000"
  'anthropic-ratelimit-requests-remaining': string;  // "955"
  'anthropic-ratelimit-requests-reset': string;      // "2024-01-01T00:01:00Z"
  'anthropic-ratelimit-tokens-limit': string;        // "500000"
  'anthropic-ratelimit-tokens-remaining': string;    // "485000"
  'anthropic-ratelimit-tokens-reset': string;        // "2024-01-01T00:01:00Z"
}

function parseSessionContext(headers: RateLimitHeaders): SessionContext {
  return {
    requestsLimit: parseInt(headers['anthropic-ratelimit-requests-limit']),
    requestsUsed: parseInt(headers['anthropic-ratelimit-requests-limit']) -
                  parseInt(headers['anthropic-ratelimit-requests-remaining']),
    tokensLimit: parseInt(headers['anthropic-ratelimit-tokens-limit']),
    tokensUsed: parseInt(headers['anthropic-ratelimit-tokens-limit']) -
                parseInt(headers['anthropic-ratelimit-tokens-remaining']),
    requestsReset: new Date(headers['anthropic-ratelimit-requests-reset']),
    tokensReset: new Date(headers['anthropic-ratelimit-tokens-reset'])
  };
}
```

**Implementation Note:**
Store latest session context in component state. Update after each Claude API call (interceptor pattern).

### 5.2 Weekly Quota (Historical)

**Source:** Cost Report API (Anthropic)

**Update Frequency:** Every 5 minutes (polling)

**API Endpoint:**
```
POST https://api.anthropic.com/v1/organization/cost_report
Authorization: x-api-key: <admin-key>
Content-Type: application/json

{
  "start_date": "2025-11-14",
  "end_date": "2025-11-21"
}
```

**Response Parsing:**
```typescript
interface CostReportResponse {
  daily_costs: {
    date: string;           // "2025-11-14"
    cost_usd: number;       // 6.80
    token_count?: number;   // Optional (may not be returned)
  }[];
}

function parseWeeklyQuota(response: CostReportResponse): WeeklyQuotaData {
  const totalCost = response.daily_costs.reduce((sum, day) => sum + day.cost_usd, 0);

  // Token estimation (if not provided)
  const estimatedTokens = totalCost * 20000; // ~20K tokens per dollar (rough avg)

  return {
    tokensUsed: estimatedTokens,
    tokensLimit: 1000000,  // Config value
    costUsd: totalCost,
    costLimit: 100,        // Config value
    periodStart: new Date(response.daily_costs[0].date),
    periodEnd: new Date(response.daily_costs[response.daily_costs.length - 1].date)
  };
}
```

**Polling Implementation:**
```typescript
$effect(() => {
  const fetchWeeklyQuota = async () => {
    const response = await fetch('/api/claude/weekly-quota');
    const data = await response.json();
    weeklyQuota = data;
  };

  fetchWeeklyQuota();
  const interval = setInterval(fetchWeeklyQuota, 5 * 60 * 1000); // 5 min

  return () => clearInterval(interval);
});
```

### 5.3 Agent Stats (Agent Mail)

**Source:** Agent Mail database queries

**Update Frequency:** Every 30 seconds (polling)

**Query Logic:**
```bash
# Get working agents (have in_progress tasks)
bd list --json | jq '[.[] | select(.status == "in_progress")] | map(.assignee) | unique | length'

# Get idle agents (no in_progress tasks, active in last 24h)
am-agents | grep -v "working" | wc -l

# Get offline agents (inactive >24h)
am-agents | awk '$3 > 24 {print $1}' | wc -l
```

**API Endpoint:**
```
GET /api/agents/stats

Response:
{
  "total": 6,
  "working": 3,
  "idle": 2,
  "offline": 1,
  "lastUpdate": "2025-11-21T12:34:56Z"
}
```

**Component Integration:**
```typescript
$effect(() => {
  const fetchAgentStats = async () => {
    const response = await fetch('/api/agents/stats');
    const data = await response.json();
    agentStats = data;
  };

  fetchAgentStats();
  const interval = setInterval(fetchAgentStats, 30 * 1000); // 30 sec

  return () => clearInterval(interval);
});
```

## 6. Implementation Notes

### 6.1 Component Structure

**File Location:** `dashboard/src/lib/components/ClaudeUsageBar.svelte`

**Dependencies:**
- DaisyUI (badges, tooltips)
- Svelte 5 runes ($state, $derived, $effect)
- Date-fns (date formatting)

**Estimated LOC:** ~300 lines
- Props interface: 40 lines
- Color threshold logic: 60 lines
- Tooltip content builders: 80 lines
- Layout/styling: 80 lines
- API polling effects: 40 lines

### 6.2 State Management

```typescript
// Component state
let weeklyQuota = $state<WeeklyQuotaData>(defaultWeeklyQuota);
let sessionContext = $state<SessionContext>(defaultSessionContext);
let agentStats = $state<AgentStats>(defaultAgentStats);

// Derived values
const weeklyPercentage = $derived((weeklyQuota.tokensUsed / weeklyQuota.tokensLimit) * 100);
const costPercentage = $derived((weeklyQuota.costUsd / weeklyQuota.costLimit) * 100);
const dailyAvgCost = $derived(weeklyQuota.costUsd / 7);
const estimatedWeeklyTotal = $derived(dailyAvgCost * 7);

// Color classes
const quotaColor = $derived(getQuotaColor(weeklyPercentage));
const costColor = $derived(getCostColor(costPercentage));
```

### 6.3 Helper Functions

**Color Threshold Logic:**
```typescript
function getQuotaColor(percentage: number): string {
  if (percentage < 60) return 'bg-success';
  if (percentage < 80) return 'bg-warning';
  if (percentage < 95) return 'bg-orange-500';
  return 'bg-error';
}

function getCostColor(percentage: number): string {
  if (percentage < 50) return 'text-success';
  if (percentage < 80) return 'text-warning';
  return 'text-error';
}
```

**Tooltip Builders:**
```typescript
function buildWeeklyQuotaTooltip(): string {
  return `
    Period: ${formatDate(weeklyQuota.periodStart)} - ${formatDate(weeklyQuota.periodEnd)}

    Usage:
    • Tokens: ${formatNumber(weeklyQuota.tokensUsed)} / ${formatNumber(weeklyQuota.tokensLimit)} (${weeklyPercentage.toFixed(1)}%)
    • Cost: $${weeklyQuota.costUsd.toFixed(2)} / $${weeklyQuota.costLimit} (${costPercentage.toFixed(1)}%)

    Daily Average:
    • Tokens: ${formatNumber(dailyAvgTokens)} per day
    • Cost: $${dailyAvgCost.toFixed(2)} per day

    Projected End-of-Week:
    • Total cost: $${estimatedWeeklyTotal.toFixed(2)}
  `;
}
```

### 6.4 Performance Considerations

**Polling Intervals:**
- Weekly quota: 5 minutes (API rate limit consideration)
- Agent stats: 30 seconds (frequent updates needed)
- Session context: Real-time (updated on every API call)

**Optimization Strategies:**
- Debounce tooltip content generation
- Cache formatted strings (date, numbers)
- Use $derived for computed values (reactive)
- Lazy-load tooltips (only build on hover)

### 6.5 Error Handling

**API Failures:**
- Show last known values with stale indicator
- Tooltip shows error message: "⚠️ Data may be outdated (last updated: 10 min ago)"
- Retry with exponential backoff

**Missing Data:**
- Use default/fallback values
- Hide sections with missing critical data
- Show placeholder: "-- / --" for unavailable metrics

**Rate Limit Exhaustion:**
- Show red indicator with error icon
- Tooltip explains: "🚨 Weekly quota exhausted! Wait until ${resetDate} or upgrade plan."

## 7. Testing Strategy

### 7.1 Unit Tests

**Test Cases:**
1. Color threshold logic (60%, 80%, 95%, 100%)
2. Tooltip content generation (with various data)
3. Percentage calculations (tokens, cost)
4. Date formatting (period display)
5. Badge rendering (working, idle, offline counts)

**Example Test:**
```typescript
import { expect, test } from 'vitest';
import { getQuotaColor } from './ClaudeUsageBar.svelte';

test('quota color thresholds', () => {
  expect(getQuotaColor(50)).toBe('bg-success');
  expect(getQuotaColor(65)).toBe('bg-warning');
  expect(getQuotaColor(85)).toBe('bg-orange-500');
  expect(getQuotaColor(97)).toBe('bg-error');
});
```

### 7.2 Integration Tests

**Test Scenarios:**
1. Polling updates (mock fetch, verify state changes)
2. Tooltip hover behavior (show/hide)
3. Responsive layout (mobile, tablet, desktop)
4. API error handling (failed fetch, retry logic)
5. Missing props (fallback to defaults)

### 7.3 Visual Testing

**Manual Checks:**
1. Color transitions (smooth 300ms animation)
2. Tooltip positioning (stays on screen, no overflow)
3. Badge wrapping (handles long agent names)
4. Layout on narrow screens (<768px)
5. Dark mode compatibility (all DaisyUI themes)

## 8. Migration from SystemCapacityBar

### 8.1 Replacement Strategy

**Step 1: Create ClaudeUsageBar component**
- Implement full design spec
- Add unit tests
- Verify all features work

**Step 2: Update +layout.svelte**
```svelte
<!-- Before -->
<SystemCapacityBar {agents} {tasks} />

<!-- After -->
<ClaudeUsageBar
  {sessionContext}
  {weeklyQuota}
  {agentStats}
/>
```

**Step 3: Add API endpoints**
- `/api/claude/weekly-quota` - Cost Report API proxy
- `/api/agents/stats` - Agent statistics aggregation

**Step 4: Remove SystemCapacityBar**
- Delete `src/lib/components/agents/SystemCapacityBar.svelte`
- Remove imports from all pages
- Update git history (document replacement reason)

### 8.2 Feature Parity Checklist

| SystemCapacityBar Feature | ClaudeUsageBar Equivalent | Status |
|---------------------------|---------------------------|--------|
| Agent capacity bar | Agent status badges | ✅ Improved |
| System load percentage | Weekly quota percentage | ✅ More relevant |
| Agent breakdown | Tooltip with agent details | ✅ Enhanced |
| Fixed bottom position | Fixed bottom position | ✅ Same |
| Color-coded status | Color-coded thresholds | ✅ Same |
| Hover details | Hover tooltips | ✅ More detailed |

**New Features (not in SystemCapacityBar):**
- Real-time cost tracking
- Session context (rate limits)
- Projected weekly cost
- Daily cost trends
- Per-model cost breakdown

### 8.3 Backward Compatibility

**Breaking Changes:**
- Component props are completely different
- No agent/task props (uses separate data sources)
- Layout structure changed (new sections)

**Migration Impact:**
- **Low:** Only used in +layout.svelte (single location)
- **No user data migration:** All data fetched fresh from APIs
- **No database changes:** Pure UI component replacement

## 9. Future Enhancements

**Potential additions (out of scope for jat-m60):**

1. **Clickable sections** - Navigate to detailed cost report page
2. **Alert thresholds** - User-configurable warnings (e.g., notify at 80%)
3. **Historical graph** - 7-day cost trend chart (tooltip expansion)
4. **Export data** - Download weekly report as CSV/JSON
5. **Custom budgets** - Per-project or per-agent cost limits
6. **Prediction accuracy** - Track estimated vs actual weekly cost
7. **Per-model breakdown** - Toggle to show Sonnet/Opus/Haiku usage separately

**Implementation notes:**
- Keep component focused on status display
- Extract complex features to separate pages (cost report dashboard)
- Maintain performance (avoid heavy computations in bar)

## 10. Design Decisions & Rationale

### Why replace SystemCapacityBar?

**Problem:** SystemCapacityBar focuses on agent capacity, but doesn't show API usage limits.

**Solution:** ClaudeUsageBar shows what matters most:
- How much weekly quota is left
- How much money is being spent
- Which agents are working

**User benefit:** Avoid quota exhaustion, track costs, coordinate agents.

### Why fixed bottom bar?

**Alternative considered:** Top bar, sidebar, floating widget

**Decision:** Bottom bar maximizes visibility without blocking content.

**Rationale:**
- Always visible (no scrolling needed)
- Out of the way (bottom edge is low-priority visual area)
- Matches dashboard conventions (status bars go at bottom)

### Why color-coded thresholds?

**Alternative considered:** Always same color, numeric indicators only

**Decision:** Visual color feedback is faster to interpret.

**Rationale:**
- Green = good, Yellow = caution, Red = danger (universal conventions)
- Users can glance and assess status instantly
- Color + numbers = redundant encoding (accessibility)

### Why separate session context?

**Alternative considered:** Only show weekly data

**Decision:** Session context helps debug rate limit errors.

**Rationale:**
- Quota exhaustion happens at two levels (session and weekly)
- Session limits reset every minute (useful for burst operations)
- Developers need this data for troubleshooting API errors

## 11. Acceptance Criteria

**This design is complete when:**

- [x] Props interface is fully specified (TypeScript)
- [x] Visual layout is documented with measurements
- [x] Color thresholds are defined with exact values
- [x] Tooltip content is specified for all sections
- [x] API integration points are documented
- [x] Implementation notes guide development
- [x] Testing strategy is defined
- [x] Migration path from SystemCapacityBar is clear

**Next steps:**
1. Review this design with stakeholders
2. Create jat-fpr task: Implement ClaudeUsageBar component
3. Create jat-sk1 task: Build API endpoints for data fetching
4. Schedule migration after both tasks complete

---

**Designer notes:**

This design balances information density with readability. The single-row layout keeps the bar compact, while tooltips provide deep details on demand. Color coding follows universal conventions (red = bad, green = good) for instant interpretation.

API integration is designed for efficiency: session context updates in real-time (free), weekly quota polls every 5 minutes (API rate limit consideration), and agent stats poll every 30 seconds (fast enough for coordination).

The component is future-proof: prop interface supports additional metrics (e.g., per-model breakdown), layout accommodates new sections (flexbox with gaps), and tooltip structure allows rich content (lists, tables, charts).

Ready for implementation in jat-fpr.
