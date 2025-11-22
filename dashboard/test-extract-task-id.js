/**
 * Test script for extractTaskId() function
 * Tests the regex pattern used in AgentCard.svelte to extract task IDs from activity previews
 */

// Copy of extractTaskId function from AgentCard.svelte
function extractTaskId(preview) {
  if (!preview) return null;

  // Match task ID pattern: [project-xxx] or just project-xxx
  const match = preview.match(/\[?([a-z0-9_-]+-[a-z0-9]{3})\]?/i);
  return match ? match[1] : null;
}

// Test cases
const testCases = [
  // Valid formats (should extract task ID)
  { input: '[jat-abc] Completed: Update agents page', expected: 'jat-abc', category: 'Standard bracket format' },
  { input: '[jat-0ol] Starting work on activities API', expected: 'jat-0ol', category: 'Numeric in hash' },
  { input: '[chimaro-xyz] Bug fix in auth flow', expected: 'chimaro-xyz', category: 'Different project' },
  { input: '[jomarchy-123] Implement feature X', expected: 'jomarchy-123', category: 'All numeric hash' },
  { input: 'Starting jat-abc without brackets', expected: 'jat-abc', category: 'No brackets' },
  { input: 'Completed task jat-def successfully', expected: 'jat-def', category: 'Mid-text' },
  { input: '[JAT-ABC] Uppercase test', expected: 'JAT-ABC', category: 'Uppercase (case-insensitive)' },

  // Invalid formats (should return null)
  { input: 'Generic message without task ID', expected: null, category: 'No task ID' },
  { input: 'Task completed successfully', expected: null, category: 'No task ID pattern' },
  { input: '[invalid] Wrong format', expected: null, category: 'Invalid format' },
  { input: '[jat] Missing hash', expected: null, category: 'Missing hash' },
  { input: '[jat-] Empty hash', expected: null, category: 'Empty hash' },
  { input: '[-abc] Missing project', expected: null, category: 'Missing project' },
  { input: '', expected: null, category: 'Empty string' },
  { input: null, expected: null, category: 'Null input' },
  { input: undefined, expected: null, category: 'Undefined input' },
];

// Run tests
console.log('╔══════════════════════════════════════════════════════════════════════════╗');
console.log('║                  extractTaskId() Function Test Results                  ║');
console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const result = extractTaskId(test.input);
  const success = result === test.expected;

  if (success) {
    passed++;
    console.log(`✅ Test ${index + 1}: ${test.category}`);
    console.log(`   Input: "${test.input}"`);
    console.log(`   Result: ${result === null ? 'null' : `"${result}"`}`);
  } else {
    failed++;
    console.log(`❌ Test ${index + 1}: ${test.category}`);
    console.log(`   Input: "${test.input}"`);
    console.log(`   Expected: ${test.expected === null ? 'null' : `"${test.expected}"`}`);
    console.log(`   Got: ${result === null ? 'null' : `"${result}"`}`);
  }
  console.log('');
});

console.log('─'.repeat(78));
console.log(`\n📊 Test Summary:`);
console.log(`   Total: ${testCases.length}`);
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%\n`);

// Exit with error code if any tests failed
process.exit(failed > 0 ? 1 : 0);
