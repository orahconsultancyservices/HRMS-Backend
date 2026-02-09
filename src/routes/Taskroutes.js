// src/routes/taskRoutes.js

const express = require('express');
const router = express.Router();

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
  getEmployeeTaskStats
} = require('../controllers/taskController');

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: Task management APIs
 */

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: Get all tasks
 *     tags: [Tasks]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, daily, weekly, monthly]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, active, completed, overdue]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [all, applications, interviews, assessments]
 *       - in: query
 *         name: assignedTo
 *         schema:
 *           type: integer
 *       - in: query
 *         name: assignedBy
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of tasks
 */
router.get('/', getAllTasks);

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - type
 *               - category
 *               - target
 *               - unit
 *               - deadline
 *               - assignedToId
 *               - assignedById
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [daily, weekly, monthly]
 *               category:
 *                 type: string
 *                 enum: [applications, interviews, assessments]
 *               target:
 *                 type: integer
 *               unit:
 *                 type: string
 *               deadline:
 *                 type: string
 *                 format: date
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *               assignedToId:
 *                 type: integer
 *               assignedById:
 *                 type: integer
 *               notes:
 *                 type: string
 *               recurring:
 *                 type: boolean
 *               recurrence:
 *                 type: string
 *                 enum: [daily, weekly, monthly]
 *     responses:
 *       201:
 *         description: Task created successfully
 */
router.post('/', createTask);

/**
 * @swagger
 * /api/tasks/{id}:
 *   get:
 *     summary: Get task by ID
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Task details
 */
router.get('/:id', getTaskById);

/**
 * @swagger
 * /api/tasks/{id}:
 *   put:
 *     summary: Update task
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Task updated successfully
 */
router.put('/:id', updateTask);

/**
 * @swagger
 * /api/tasks/{id}:
 *   delete:
 *     summary: Delete task
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Task deleted successfully
 */
router.delete('/:id', deleteTask);

/**
 * @swagger
 * /api/tasks/employee/{employeeId}:
 *   get:
 *     summary: Get tasks by employee
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Employee tasks
 */
router.get('/employee/:employeeId', getTasksByEmployee);

/**
 * @swagger
 * /api/tasks/employee/{employeeId}/stats:
 *   get:
 *     summary: Get employee task statistics
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Employee task statistics
 */
router.get('/employee/:employeeId/stats', getEmployeeTaskStats);

/**
 * @swagger
 * /api/tasks/{taskId}/submit:
 *   post:
 *     summary: Submit task progress
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - employeeId
 *               - count
 *             properties:
 *               employeeId:
 *                 type: integer
 *               count:
 *                 type: integer
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Progress submitted successfully
 */
router.post('/:taskId/submit', submitTaskProgress);

/**
 * @swagger
 * /api/tasks/{taskId}/submissions:
 *   get:
 *     summary: Get task submissions
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: verified
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Task submissions
 */
router.get('/:taskId/submissions', getTaskSubmissions);

/**
 * @swagger
 * /api/tasks/{taskId}/analytics:
 *   get:
 *     summary: Get task analytics
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Task analytics
 */
router.get('/:taskId/analytics', getTaskAnalytics);

/**
 * @swagger
 * /api/tasks/submissions/{submissionId}/verify:
 *   patch:
 *     summary: Verify task submission
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               verifiedBy:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Submission verified successfully
 */
router.patch('/submissions/:submissionId/verify', verifySubmission);

/**
 * @swagger
 * /api/tasks/submissions/{submissionId}:
 *   delete:
 *     summary: Delete task submission
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Submission deleted successfully
 */
router.delete('/submissions/:submissionId', deleteSubmission);

module.exports = router;