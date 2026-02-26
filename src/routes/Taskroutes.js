// src/routes/taskRoutes.js
// COMPLETE IMPLEMENTATION - All Task Management Routes

const express = require('express');
const router  = express.Router();

const {
  getAllTasks,
  getTaskById,
  getTasksByEmployee,
  createTask,
  updateTask,
  deleteTask,
  submitTaskProgress,
  getTaskSubmissions,
  verifySubmission,
  deleteSubmission,
  getTaskAnalytics,
  getEmployeeTaskStats,
  lockTask,
  getTeamPerformance,
} = require('../controllers/taskController');

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: Specific routes MUST be registered before parameterised routes
// to prevent Express from matching e.g. /employee/:id as /submissions/:id
// ─────────────────────────────────────────────────────────────────────────────

// Team performance (employer dashboard)
router.get('/team/performance', getTeamPerformance);

// Submission routes (no taskId in path)
router.patch('/submissions/:submissionId/verify', verifySubmission);
router.delete('/submissions/:submissionId',        deleteSubmission);

// Employee-specific routes
router.get('/employee/:employeeId/stats', getEmployeeTaskStats);
router.get('/employee/:employeeId',       getTasksByEmployee);

// Main task CRUD
router.get('/',    getAllTasks);
router.post('/',   createTask);

router.get('/:id',    getTaskById);
router.put('/:id',    updateTask);
router.delete('/:id', deleteTask);

// Lock task
router.patch('/:id/lock', lockTask);

// Task-level submission routes
router.post('/:taskId/submit',       submitTaskProgress);
router.get('/:taskId/submissions',   getTaskSubmissions);
router.get('/:taskId/analytics',     getTaskAnalytics);

module.exports = router;