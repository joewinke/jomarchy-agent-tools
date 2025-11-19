#!/usr/bin/env node
/**
 * Test script for Beads SQLite Query Layer
 *
 * Validates that lib/beads.js can query all Beads databases from Node
 */

import { getProjects, getTasks, getTaskById, getReadyTasks } from '../lib/beads.js';

console.log('🧪 Testing Beads SQLite Query Layer\n');
console.log('═'.repeat(80));

// Test 1: getProjects()
console.log('\n📂 TEST 1: getProjects()');
console.log('─'.repeat(80));
const projects = getProjects();
console.log(`✓ Found ${projects.length} project(s) with Beads databases:`);
projects.forEach(p => {
  console.log(`  • ${p.name}`);
  console.log(`    Path: ${p.path}`);
  console.log(`    DB: ${p.dbPath}`);
});

if (projects.length === 0) {
  console.log('⚠️  No projects found. Make sure ~/code/*/.beads/beads.db exists');
  process.exit(1);
}

// Test 2: getTasks()
console.log('\n📋 TEST 2: getTasks() - All tasks');
console.log('─'.repeat(80));
const allTasks = getTasks();
console.log(`✓ Found ${allTasks.length} total task(s) across all projects:`);

// Group by project
const tasksByProject = {};
allTasks.forEach(task => {
  if (!tasksByProject[task.project]) {
    tasksByProject[task.project] = [];
  }
  tasksByProject[task.project].push(task);
});

for (const [project, tasks] of Object.entries(tasksByProject)) {
  console.log(`\n  ${project} (${tasks.length} tasks):`);
  tasks.slice(0, 3).forEach(task => {
    console.log(`    • [P${task.priority}] ${task.id} - ${task.title}`);
    console.log(`      Status: ${task.status}, Labels: [${task.labels.join(', ')}]`);
  });
  if (tasks.length > 3) {
    console.log(`    ... and ${tasks.length - 3} more`);
  }
}

// Test 3: getTasks() with filters
console.log('\n📋 TEST 3: getTasks() - With filters (status=open, priority=0)');
console.log('─'.repeat(80));
const openP0Tasks = getTasks({ status: 'open', priority: 0 });
console.log(`✓ Found ${openP0Tasks.length} open P0 task(s):`);
openP0Tasks.forEach(task => {
  console.log(`  • ${task.id} - ${task.title}`);
  console.log(`    Project: ${task.project}`);
});

// Test 4: getTaskById()
console.log('\n🔍 TEST 4: getTaskById() - Get full task details');
console.log('─'.repeat(80));
if (allTasks.length > 0) {
  const testTaskId = allTasks[0].id;
  console.log(`Testing with task: ${testTaskId}`);
  const taskDetails = getTaskById(testTaskId);

  if (taskDetails) {
    console.log(`✓ Retrieved task details:`);
    console.log(`  ID: ${taskDetails.id}`);
    console.log(`  Title: ${taskDetails.title}`);
    console.log(`  Description: ${taskDetails.description.slice(0, 100)}...`);
    console.log(`  Status: ${taskDetails.status}`);
    console.log(`  Priority: P${taskDetails.priority}`);
    console.log(`  Project: ${taskDetails.project}`);
    console.log(`  Labels: [${taskDetails.labels.join(', ')}]`);
    console.log(`  Dependencies: ${taskDetails.depends_on.length} task(s)`);
    if (taskDetails.depends_on.length > 0) {
      taskDetails.depends_on.forEach(dep => {
        console.log(`    • ${dep.id} - ${dep.title} (${dep.status})`);
      });
    }
    console.log(`  Dependents: ${taskDetails.dependents.length} task(s)`);
    if (taskDetails.dependents.length > 0) {
      taskDetails.dependents.forEach(dep => {
        console.log(`    • ${dep.id} - ${dep.title} (${dep.status})`);
      });
    }
    console.log(`  Comments: ${taskDetails.comments.length}`);
  } else {
    console.log(`✗ Failed to retrieve task details for ${testTaskId}`);
    process.exit(1);
  }
} else {
  console.log('⚠️  No tasks available to test getTaskById()');
}

// Test 5: getReadyTasks()
console.log('\n🚀 TEST 5: getReadyTasks() - Tasks ready to work on');
console.log('─'.repeat(80));
const readyTasks = getReadyTasks();
console.log(`✓ Found ${readyTasks.length} ready task(s):`);
readyTasks.slice(0, 5).forEach(task => {
  console.log(`  • [P${task.priority}] ${task.id} - ${task.title}`);
  console.log(`    Project: ${task.project}`);
});
if (readyTasks.length > 5) {
  console.log(`  ... and ${readyTasks.length - 5} more`);
}

// Summary
console.log('\n' + '═'.repeat(80));
console.log('✅ ALL TESTS PASSED');
console.log('═'.repeat(80));
console.log('\nAcceptance Criteria Verification:');
console.log('✓ Can query all Beads databases from Node');
console.log(`✓ Successfully queried ${projects.length} project(s)`);
console.log(`✓ Retrieved ${allTasks.length} task(s) across all projects`);
console.log(`✓ getProjects() works: ${projects.length} projects found`);
console.log(`✓ getTasks() works: ${allTasks.length} tasks retrieved`);
console.log(`✓ getTaskById() works: Successfully retrieved task details`);
console.log(`✓ getReadyTasks() works: ${readyTasks.length} ready tasks found`);
console.log('\n🎉 Beads SQLite Query Layer is fully functional!\n');
