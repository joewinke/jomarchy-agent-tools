/**
 * Beads SQLite Query Layer
 *
 * Provides functions to query Beads task databases across multiple projects.
 * Scans ~/code/PROJECT/.beads/ for project databases and returns normalized task data.
 */

import Database from 'better-sqlite3';
import { readdirSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

/**
 * Get all projects that have Beads databases
 * @returns {Array<{name: string, path: string, dbPath: string}>} List of projects
 */
export function getProjects() {
  const codeDir = join(homedir(), 'code');

  if (!existsSync(codeDir)) {
    return [];
  }

  const projects = [];

  try {
    const entries = readdirSync(codeDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const projectPath = join(codeDir, entry.name);
        const beadsDir = join(projectPath, '.beads');
        const dbPath = join(beadsDir, 'beads.db');

        if (existsSync(dbPath)) {
          projects.push({
            name: entry.name,
            path: projectPath,
            dbPath: dbPath
          });
        }
      }
    }
  } catch (error) {
    console.error('Error scanning projects:', error);
    return [];
  }

  return projects;
}

/**
 * Get all tasks from all projects
 * @param {Object} options - Query options
 * @param {string} [options.status] - Filter by status (open, closed, etc.)
 * @param {number} [options.priority] - Filter by priority (0-4)
 * @param {string} [options.projectName] - Filter by specific project
 * @returns {Array<Object>} List of tasks with project information
 */
export function getTasks(options = {}) {
  const { status, priority, projectName } = options;
  const projects = getProjects();

  if (projectName) {
    const filtered = projects.filter(p => p.name === projectName);
    if (filtered.length === 0) {
      return [];
    }
  }

  const allTasks = [];

  for (const project of projects) {
    if (projectName && project.name !== projectName) {
      continue;
    }

    try {
      const db = new Database(project.dbPath, { readonly: true });

      // Build query with optional filters
      let query = `
        SELECT
          i.*,
          (SELECT GROUP_CONCAT(label, ',') FROM labels WHERE issue_id = i.id) as labels
        FROM issues i
        WHERE 1=1
      `;
      const params = [];

      if (status !== undefined) {
        query += ' AND i.status = ?';
        params.push(status);
      }

      if (priority !== undefined) {
        query += ' AND i.priority = ?';
        params.push(priority);
      }

      query += ' ORDER BY i.priority ASC, i.created_at DESC';

      const stmt = db.prepare(query);
      const tasks = stmt.all(...params);

      // Add project information and parse labels
      for (const task of tasks) {
        task.project = project.name;
        task.project_path = project.path;

        // Parse labels from comma-separated string to array
        if (task.labels) {
          task.labels = task.labels.split(',').filter(Boolean);
        } else {
          task.labels = [];
        }

        // Load dependencies for this task
        const dependencies = db.prepare(`
          SELECT d.depends_on_id, d.type, i.title, i.status, i.priority
          FROM dependencies d
          LEFT JOIN issues i ON d.depends_on_id = i.id
          WHERE d.issue_id = ?
        `).all(task.id);

        task.depends_on = dependencies.map(dep => ({
          id: dep.depends_on_id,
          type: dep.type,
          title: dep.title,
          status: dep.status,
          priority: dep.priority
        }));

        // Load dependents (tasks that depend on this one)
        const dependents = db.prepare(`
          SELECT d.issue_id, d.type, i.title, i.status, i.priority
          FROM dependencies d
          LEFT JOIN issues i ON d.issue_id = i.id
          WHERE d.depends_on_id = ?
        `).all(task.id);

        task.blocked_by = dependents.map(dep => ({
          id: dep.issue_id,
          type: dep.type,
          title: dep.title,
          status: dep.status,
          priority: dep.priority
        }));

        allTasks.push(task);
      }

      db.close();
    } catch (error) {
      console.error(`Error querying project ${project.name}:`, error);
    }
  }

  // Sort by priority (P0 first) then by created_at
  allTasks.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return allTasks;
}

/**
 * Get a specific task by ID
 * @param {string} taskId - The task ID to retrieve
 * @returns {Object|null} Task object with full details including dependencies, or null if not found
 */
export function getTaskById(taskId) {
  const projects = getProjects();

  for (const project of projects) {
    try {
      const db = new Database(project.dbPath, { readonly: true });

      // Get the main task
      const task = db.prepare(`
        SELECT
          i.*,
          (SELECT GROUP_CONCAT(label, ',') FROM labels WHERE issue_id = i.id) as labels
        FROM issues i
        WHERE i.id = ?
      `).get(taskId);

      if (task) {
        // Add project information
        task.project = project.name;
        task.project_path = project.path;

        // Parse labels
        if (task.labels) {
          task.labels = task.labels.split(',').filter(Boolean);
        } else {
          task.labels = [];
        }

        // Get dependencies (tasks this task depends on)
        const dependencies = db.prepare(`
          SELECT d.depends_on_id, d.type, i.title, i.status, i.priority
          FROM dependencies d
          LEFT JOIN issues i ON d.depends_on_id = i.id
          WHERE d.issue_id = ?
        `).all(taskId);

        task.depends_on = dependencies.map(dep => ({
          id: dep.depends_on_id,
          type: dep.type,
          title: dep.title,
          status: dep.status,
          priority: dep.priority
        }));

        // Get dependents (tasks that depend on this task)
        const dependents = db.prepare(`
          SELECT d.issue_id, d.type, i.title, i.status, i.priority
          FROM dependencies d
          LEFT JOIN issues i ON d.issue_id = i.id
          WHERE d.depends_on_id = ?
        `).all(taskId);

        task.dependents = dependents.map(dep => ({
          id: dep.issue_id,
          type: dep.type,
          title: dep.title,
          status: dep.status,
          priority: dep.priority
        }));

        // Get comments
        const comments = db.prepare(`
          SELECT id, author, text, created_at
          FROM comments
          WHERE issue_id = ?
          ORDER BY created_at ASC
        `).all(taskId);

        task.comments = comments;

        db.close();
        return task;
      }

      db.close();
    } catch (error) {
      console.error(`Error querying task ${taskId} in project ${project.name}:`, error);
    }
  }

  return null;
}

/**
 * Get tasks that are ready to work on (no blocking dependencies)
 * @returns {Array<Object>} List of ready tasks across all projects
 */
export function getReadyTasks() {
  const allTasks = getTasks({ status: 'open' });
  const readyTasks = [];

  for (const task of allTasks) {
    // Get full task details to check dependencies
    const fullTask = getTaskById(task.id);

    if (fullTask && fullTask.depends_on) {
      // Check if all dependencies are closed
      const hasBlockers = fullTask.depends_on.some(dep => dep.status !== 'closed');

      if (!hasBlockers) {
        readyTasks.push(fullTask);
      }
    } else {
      // No dependencies, task is ready
      readyTasks.push(task);
    }
  }

  return readyTasks;
}

export default {
  getProjects,
  getTasks,
  getTaskById,
  getReadyTasks
};
