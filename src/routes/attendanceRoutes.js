// src/routes/attendanceRoutes.js - UPDATED WITH ALL EMPLOYEES EXPORT
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
  getEmployeeBreaks,
  updateAttendance
} = require('../controllers/attendanceController');

// Import export controller
const {
  exportAllEmployeesMonthly
} = require('../controllers/attendanceExportController');

/**
 * @swagger
 * tags:
 *   name: Attendance
 *   description: Employee attendance management APIs
 */

// NEW: Export all employees monthly attendance
router.get('/export/monthly', exportAllEmployeesMonthly);

/**
 * @swagger
 * /api/attendance:
 *   get:
 *     summary: Get all attendance records
 *     tags: [Attendance]
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
 * /api/attendance/{id}:
 *   put:
 *     summary: Update attendance record (edit clock in/out times)
 *     tags: [Attendance]
 */
router.put('/:id', updateAttendance);

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