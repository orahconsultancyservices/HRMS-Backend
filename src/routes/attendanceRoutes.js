// src/routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();

const {
  getAllAttendance,
  getAttendanceById,
  getEmployeeAttendance,
  clockIn,
  clockOut,
  getTodayStatus,
  markAttendance,
  deleteAttendance,
  bulkMarkAttendance,
  getAttendanceStats,
  startBreak,
  endBreak,
  getEmployeeBreaks
} = require('../controllers/attendanceController');

/**
 * @swagger
 * tags:
 *   name: Attendance
 *   description: Employee attendance management APIs
 */

/**
 * @swagger
 * /api/attendance:
 *   get:
 *     summary: Get all attendance records
 *     tags: [Attendance]
 *     parameters:
 *       - in: query
 *         name: employeeId
 *         schema:
 *           type: string
 *         description: Filter by employee ID
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [present, absent, late, half_day, on_leave]
 *         description: Filter by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Records per page
 */
router.get('/', getAllAttendance);

/**
 * @swagger
 * /api/attendance/stats:
 *   get:
 *     summary: Get attendance statistics
 *     tags: [Attendance]
 */
router.get('/stats', getAttendanceStats);

/**
 * @swagger
 * /api/attendance/{id}:
 *   get:
 *     summary: Get attendance by ID
 *     tags: [Attendance]
 */
router.get('/:id', getAttendanceById);

/**
 * @swagger
 * /api/attendance/employee/{employeeId}:
 *   get:
 *     summary: Get employee's attendance
 *     tags: [Attendance]
 */
router.get('/employee/:employeeId', getEmployeeAttendance);

/**
 * @swagger
 * /api/attendance/employee/{employeeId}/today:
 *   get:
 *     summary: Get today's attendance status
 *     tags: [Attendance]
 */
router.get('/employee/:employeeId/today', getTodayStatus);

/**
 * @swagger
 * /api/attendance/employee/{employeeId}/clock-in:
 *   post:
 *     summary: Clock in for the day
 *     tags: [Attendance]
 */
router.post('/employee/:employeeId/clock-in', clockIn);

/**
 * @swagger
 * /api/attendance/employee/{employeeId}/clock-out:
 *   post:
 *     summary: Clock out for the day
 *     tags: [Attendance]
 */
router.post('/employee/:employeeId/clock-out', clockOut);

/**
 * @swagger
 * /api/attendance/mark:
 *   post:
 *     summary: Mark attendance manually (admin)
 *     tags: [Attendance]
 */
router.post('/mark', markAttendance);

/**
 * @swagger
 * /api/attendance/bulk:
 *   post:
 *     summary: Bulk mark attendance (admin)
 *     tags: [Attendance]
 */
router.post('/bulk', bulkMarkAttendance);

/**
 * @swagger
 * /api/attendance/{id}:
 *   delete:
 *     summary: Delete attendance record
 *     tags: [Attendance]
 */
router.delete('/:id', deleteAttendance);

// Break management routes
router.post('/employee/:employeeId/break/start', startBreak);
router.post('/employee/:employeeId/break/:breakId/end', endBreak);
router.get('/employee/:employeeId/breaks', getEmployeeBreaks);

module.exports = router;