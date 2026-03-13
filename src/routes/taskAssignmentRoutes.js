// src/routes/taskAssignmentRoutes.js
// Enhanced Task Assignment Routes

const express = require('express');
const router = express.Router();

const {
  getEmployeeDefaultKPIs,
  createTasksFromDefaults,
  adjustTaskTarget,
  getTeamTasks,
  createBatchTasks
} = require('../controllers/taskAssignmentController');

// ============================================
// ROLE-BASED TASK ASSIGNMENT ROUTES
// ============================================

router.get('/employees/:employeeId/default-kpis', getEmployeeDefaultKPIs);
router.post('/tasks/create-from-defaults', createTasksFromDefaults);
router.post('/tasks/create-batch', createBatchTasks);

// ============================================
// TEAM LEAD AUTHORITY ROUTES
// ============================================

router.put('/tasks/:taskId/adjust-target', adjustTaskTarget);
router.get('/team/tasks', getTeamTasks);

module.exports = router;
