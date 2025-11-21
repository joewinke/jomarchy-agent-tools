/**
 * Token Usage Tracking Utility
 *
 * Parses Claude Code JSONL session files to aggregate token usage and costs.
 * Data sources:
 * - JSONL files: ~/.claude/projects/{project}/{session-id}.jsonl
 * - Session-agent mapping: .claude/agent-{session_id}.txt
 *
 * Pricing: Claude Sonnet 4.5
 * - Input: $3.00 per million tokens
 * - Cache creation: $3.75 per million tokens
 * - Cache read: $0.30 per million tokens
 * - Output: $15.00 per million tokens
 */

import { readdir, readFile } from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Types
// ============================================================================

export interface TokenUsage {
	input_tokens: number;
	cache_creation_input_tokens: number;
	cache_read_input_tokens: number;
	output_tokens: number;
	total_tokens: number;
	cost: number;
	sessionCount: number;
}

export interface SessionUsage {
	sessionId: string;
	agentName: string | null;
	timestamp: string;
	tokens: {
		input: number;
		cache_creation: number;
		cache_read: number;
		output: number;
		total: number;
	};
	cost: number;
}

export interface JSONLEntry {
	type?: string;
	message?: {
		usage?: {
			input_tokens?: number;
			cache_creation_input_tokens?: number;
			cache_read_input_tokens?: number;
			output_tokens?: number;
		};
	};
	timestamp?: string;
}

export type TimeRange = 'today' | 'week' | 'all';

// ============================================================================
// Constants
// ============================================================================

// Claude Sonnet 4.5 Pricing (per million tokens)
const PRICING = {
	input: 3.0,
	cache_creation: 3.75,
	cache_read: 0.30,
	output: 15.0
} as const;

// ============================================================================
// Session-Agent Mapping
// ============================================================================

/**
 * Build a map of session IDs to agent names by reading .claude/agent-*.txt files.
 *
 * @param projectPath - Path to project root (defaults to cwd)
 * @returns Map<sessionId, agentName>
 */
export async function buildSessionAgentMap(
	projectPath: string = process.cwd()
): Promise<Map<string, string>> {
	const sessionAgentMap = new Map<string, string>();
	const claudeDir = path.join(projectPath, '.claude');

	try {
		// Read all files in .claude directory
		const files = await readdir(claudeDir);

		// Filter for agent-*.txt files
		const agentFiles = files.filter((file) => file.startsWith('agent-') && file.endsWith('.txt'));

		// Read each agent file and extract session ID
		for (const file of agentFiles) {
			const sessionId = file.replace('agent-', '').replace('.txt', '');
			const filePath = path.join(claudeDir, file);

			try {
				const agentName = (await readFile(filePath, 'utf-8')).trim();
				if (agentName) {
					sessionAgentMap.set(sessionId, agentName);
				}
			} catch (error) {
				// Skip files that can't be read
				console.warn(`Could not read agent file: ${file}`, error);
			}
		}
	} catch (error) {
		// If .claude directory doesn't exist, return empty map
		console.warn('Could not read .claude directory', error);
	}

	return sessionAgentMap;
}

// ============================================================================
// JSONL Parsing
// ============================================================================

/**
 * Parse a single JSONL session file and extract token usage data.
 *
 * @param sessionId - Session ID (filename without extension)
 * @param projectPath - Path to project root
 * @returns SessionUsage object or null if file not found/parse error
 */
export async function parseSessionUsage(
	sessionId: string,
	projectPath: string = process.cwd()
): Promise<SessionUsage | null> {
	const homeDir = os.homedir();
	// Convert project path to format used by Claude Code: /home/user/path -> -home-user-path
	const projectSlug = projectPath.replace(/\//g, '-').replace(/^-/, '');
	const jsonlPath = path.join(homeDir, '.claude', 'projects', projectSlug, `${sessionId}.jsonl`);

	try {
		const content = await readFile(jsonlPath, 'utf-8');
		const lines = content.split('\n').filter((line) => line.trim());

		let totalInput = 0;
		let totalCacheCreation = 0;
		let totalCacheRead = 0;
		let totalOutput = 0;
		let lastTimestamp = '';

		// Parse each JSONL line
		for (const line of lines) {
			try {
				const entry: JSONLEntry = JSON.parse(line);

				// Look for messages with usage data
				if (entry.message?.usage) {
					const usage = entry.message.usage;
					totalInput += usage.input_tokens || 0;
					totalCacheCreation += usage.cache_creation_input_tokens || 0;
					totalCacheRead += usage.cache_read_input_tokens || 0;
					totalOutput += usage.output_tokens || 0;

					// Track most recent timestamp
					if (entry.timestamp) {
						lastTimestamp = entry.timestamp;
					}
				}
			} catch (parseError) {
				// Skip malformed JSON lines
				console.warn(`Could not parse JSONL line in ${sessionId}:`, parseError);
			}
		}

		const totalTokens = totalInput + totalCacheCreation + totalCacheRead + totalOutput;
		const cost = calculateCost({
			input_tokens: totalInput,
			cache_creation_input_tokens: totalCacheCreation,
			cache_read_input_tokens: totalCacheRead,
			output_tokens: totalOutput,
			total_tokens: totalTokens,
			cost: 0,
			sessionCount: 1
		});

		return {
			sessionId,
			agentName: null, // Will be populated by caller using session-agent map
			timestamp: lastTimestamp,
			tokens: {
				input: totalInput,
				cache_creation: totalCacheCreation,
				cache_read: totalCacheRead,
				output: totalOutput,
				total: totalTokens
			},
			cost
		};
	} catch (error) {
		// File not found or read error
		console.warn(`Could not read JSONL file for session ${sessionId}:`, error);
		return null;
	}
}

// ============================================================================
// Cost Calculation
// ============================================================================

/**
 * Calculate cost based on token usage and Claude Sonnet 4.5 pricing.
 *
 * @param usage - Token usage object
 * @returns Cost in USD
 */
export function calculateCost(usage: TokenUsage): number {
	const inputCost = (usage.input_tokens / 1_000_000) * PRICING.input;
	const cacheCreationCost = (usage.cache_creation_input_tokens / 1_000_000) * PRICING.cache_creation;
	const cacheReadCost = (usage.cache_read_input_tokens / 1_000_000) * PRICING.cache_read;
	const outputCost = (usage.output_tokens / 1_000_000) * PRICING.output;

	return inputCost + cacheCreationCost + cacheReadCost + outputCost;
}

// ============================================================================
// Date Range Filtering
// ============================================================================

/**
 * Filter sessions by time range.
 *
 * @param sessions - Array of session usage data
 * @param range - Time range filter
 * @returns Filtered sessions
 */
function filterByTimeRange(sessions: SessionUsage[], range: TimeRange): SessionUsage[] {
	if (range === 'all') {
		return sessions;
	}

	const now = new Date();
	let cutoffDate: Date;

	if (range === 'today') {
		// Start of today (midnight)
		cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	} else {
		// Last 7 days
		cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	}

	return sessions.filter((session) => {
		if (!session.timestamp) return false;
		const sessionDate = new Date(session.timestamp);
		return sessionDate >= cutoffDate;
	});
}

// ============================================================================
// Aggregation
// ============================================================================

/**
 * Aggregate usage for a specific agent.
 *
 * @param agentName - Agent name
 * @param timeRange - Time range filter (default: 'all')
 * @param projectPath - Path to project root
 * @returns Aggregated token usage for the agent
 */
export async function getAgentUsage(
	agentName: string,
	timeRange: TimeRange = 'all',
	projectPath: string = process.cwd()
): Promise<TokenUsage> {
	// Build session-agent map
	const sessionAgentMap = await buildSessionAgentMap(projectPath);

	// Find sessions for this agent
	const agentSessions: string[] = [];
	for (const [sessionId, name] of sessionAgentMap.entries()) {
		if (name === agentName) {
			agentSessions.push(sessionId);
		}
	}

	// Parse usage for each session
	const sessions: SessionUsage[] = [];
	for (const sessionId of agentSessions) {
		const usage = await parseSessionUsage(sessionId, projectPath);
		if (usage) {
			usage.agentName = agentName;
			sessions.push(usage);
		}
	}

	// Filter by time range
	const filteredSessions = filterByTimeRange(sessions, timeRange);

	// Aggregate totals
	let totalInput = 0;
	let totalCacheCreation = 0;
	let totalCacheRead = 0;
	let totalOutput = 0;

	for (const session of filteredSessions) {
		totalInput += session.tokens.input;
		totalCacheCreation += session.tokens.cache_creation;
		totalCacheRead += session.tokens.cache_read;
		totalOutput += session.tokens.output;
	}

	const totalTokens = totalInput + totalCacheCreation + totalCacheRead + totalOutput;
	const cost = calculateCost({
		input_tokens: totalInput,
		cache_creation_input_tokens: totalCacheCreation,
		cache_read_input_tokens: totalCacheRead,
		output_tokens: totalOutput,
		total_tokens: totalTokens,
		cost: 0,
		sessionCount: filteredSessions.length
	});

	return {
		input_tokens: totalInput,
		cache_creation_input_tokens: totalCacheCreation,
		cache_read_input_tokens: totalCacheRead,
		output_tokens: totalOutput,
		total_tokens: totalTokens,
		cost,
		sessionCount: filteredSessions.length
	};
}

/**
 * Get system-wide token usage for all agents.
 *
 * @param timeRange - Time range filter (default: 'all')
 * @param projectPath - Path to project root
 * @returns Map of agent names to their token usage
 */
export async function getAllAgentUsage(
	timeRange: TimeRange = 'all',
	projectPath: string = process.cwd()
): Promise<Map<string, TokenUsage>> {
	// Build session-agent map
	const sessionAgentMap = await buildSessionAgentMap(projectPath);

	// Get unique agent names
	const agentNames = new Set(sessionAgentMap.values());

	// Get usage for each agent
	const usageMap = new Map<string, TokenUsage>();
	for (const agentName of agentNames) {
		const usage = await getAgentUsage(agentName, timeRange, projectPath);
		usageMap.set(agentName, usage);
	}

	return usageMap;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all available session IDs for a project.
 *
 * @param projectPath - Path to project root
 * @returns Array of session IDs
 */
export async function getAllSessionIds(projectPath: string = process.cwd()): Promise<string[]> {
	const homeDir = os.homedir();
	const projectSlug = projectPath.replace(/\//g, '-').replace(/^-/, '');
	const projectsDir = path.join(homeDir, '.claude', 'projects', projectSlug);

	try {
		const files = await readdir(projectsDir);
		return files.filter((file) => file.endsWith('.jsonl')).map((file) => file.replace('.jsonl', ''));
	} catch (error) {
		console.warn('Could not read projects directory:', error);
		return [];
	}
}

/**
 * Get total system-wide token usage across all agents.
 *
 * @param timeRange - Time range filter (default: 'all')
 * @param projectPath - Path to project root
 * @returns Total token usage
 */
export async function getSystemTotalUsage(
	timeRange: TimeRange = 'all',
	projectPath: string = process.cwd()
): Promise<TokenUsage> {
	const allAgentUsage = await getAllAgentUsage(timeRange, projectPath);

	let totalInput = 0;
	let totalCacheCreation = 0;
	let totalCacheRead = 0;
	let totalOutput = 0;
	let totalSessions = 0;

	for (const usage of allAgentUsage.values()) {
		totalInput += usage.input_tokens;
		totalCacheCreation += usage.cache_creation_input_tokens;
		totalCacheRead += usage.cache_read_input_tokens;
		totalOutput += usage.output_tokens;
		totalSessions += usage.sessionCount;
	}

	const totalTokens = totalInput + totalCacheCreation + totalCacheRead + totalOutput;
	const cost = calculateCost({
		input_tokens: totalInput,
		cache_creation_input_tokens: totalCacheCreation,
		cache_read_input_tokens: totalCacheRead,
		output_tokens: totalOutput,
		total_tokens: totalTokens,
		cost: 0,
		sessionCount: totalSessions
	});

	return {
		input_tokens: totalInput,
		cache_creation_input_tokens: totalCacheCreation,
		cache_read_input_tokens: totalCacheRead,
		output_tokens: totalOutput,
		total_tokens: totalTokens,
		cost,
		sessionCount: totalSessions
	};
}
