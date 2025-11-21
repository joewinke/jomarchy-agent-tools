/**
 * Test script for tokenUsage.ts module
 *
 * Run with: npx tsx test-token-usage.ts
 */

import {
	buildSessionAgentMap,
	parseSessionUsage,
	getAgentUsage,
	getAllAgentUsage,
	calculateCost,
	getSystemTotalUsage,
	getAllSessionIds
} from './src/lib/utils/tokenUsage';

async function test() {
	console.log('🧪 Testing tokenUsage.ts module\n');

	// Test 1: Build session-agent map
	console.log('1️⃣  Building session-agent map...');
	const sessionAgentMap = await buildSessionAgentMap();
	console.log(`   Found ${sessionAgentMap.size} session-agent mappings`);
	if (sessionAgentMap.size > 0) {
		const [firstSession, firstAgent] = Array.from(sessionAgentMap.entries())[0];
		console.log(`   Example: ${firstSession.substring(0, 8)}... → ${firstAgent}`);
	}
	console.log('');

	// Test 2: Get all session IDs
	console.log('2️⃣  Getting all session IDs...');
	const sessionIds = await getAllSessionIds();
	console.log(`   Found ${sessionIds.length} JSONL session files`);
	if (sessionIds.length > 0) {
		console.log(`   Example: ${sessionIds[0].substring(0, 8)}...`);
	}
	console.log('');

	// Test 3: Parse a single session
	if (sessionIds.length > 0) {
		console.log('3️⃣  Parsing single session usage...');
		const sessionUsage = await parseSessionUsage(sessionIds[0]);
		if (sessionUsage) {
			console.log(`   Session: ${sessionUsage.sessionId.substring(0, 8)}...`);
			console.log(`   Input tokens: ${sessionUsage.tokens.input.toLocaleString()}`);
			console.log(`   Cache creation: ${sessionUsage.tokens.cache_creation.toLocaleString()}`);
			console.log(`   Cache read: ${sessionUsage.tokens.cache_read.toLocaleString()}`);
			console.log(`   Output tokens: ${sessionUsage.tokens.output.toLocaleString()}`);
			console.log(`   Total: ${sessionUsage.tokens.total.toLocaleString()}`);
			console.log(`   Cost: $${sessionUsage.cost.toFixed(2)}`);
		}
		console.log('');
	}

	// Test 4: Get agent usage
	if (sessionAgentMap.size > 0) {
		const firstAgent = Array.from(sessionAgentMap.values())[0];
		console.log(`4️⃣  Getting usage for agent: ${firstAgent}`);

		const agentUsageToday = await getAgentUsage(firstAgent, 'today');
		console.log(`   Today: ${agentUsageToday.total_tokens.toLocaleString()} tokens, $${agentUsageToday.cost.toFixed(2)}, ${agentUsageToday.sessionCount} sessions`);

		const agentUsageWeek = await getAgentUsage(firstAgent, 'week');
		console.log(`   Week: ${agentUsageWeek.total_tokens.toLocaleString()} tokens, $${agentUsageWeek.cost.toFixed(2)}, ${agentUsageWeek.sessionCount} sessions`);

		const agentUsageAll = await getAgentUsage(firstAgent, 'all');
		console.log(`   All time: ${agentUsageAll.total_tokens.toLocaleString()} tokens, $${agentUsageAll.cost.toFixed(2)}, ${agentUsageAll.sessionCount} sessions`);
		console.log('');
	}

	// Test 5: Get all agent usage
	console.log('5️⃣  Getting system-wide usage...');
	const allAgents = await getAllAgentUsage('all');
	console.log(`   Total agents: ${allAgents.size}`);
	console.log('   Top 3 consumers:');

	const sorted = Array.from(allAgents.entries()).sort((a, b) => b[1].total_tokens - a[1].total_tokens);
	for (let i = 0; i < Math.min(3, sorted.length); i++) {
		const [name, usage] = sorted[i];
		console.log(`   ${i + 1}. ${name}: ${usage.total_tokens.toLocaleString()} tokens ($${usage.cost.toFixed(2)})`);
	}
	console.log('');

	// Test 6: System total
	console.log('6️⃣  Getting system total...');
	const systemTotal = await getSystemTotalUsage('all');
	console.log(`   Total tokens: ${systemTotal.total_tokens.toLocaleString()}`);
	console.log(`   Total cost: $${systemTotal.cost.toFixed(2)}`);
	console.log(`   Total sessions: ${systemTotal.sessionCount}`);
	console.log('');

	console.log('✅ All tests completed!');
}

test().catch((error) => {
	console.error('❌ Test failed:', error);
	process.exit(1);
});
