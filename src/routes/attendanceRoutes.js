// src/routes/attendanceRoutes.js - FIXED ROUTE ORDER
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
  exportAllEmployeesMonthly,
  exportMonthlyAttendance        // ← add this
} = require('../controllers/attendanceExportController');

// ============================================================
// IMPORTANT: Specific routes MUST come before generic /:id
// routes. Express matches in order — /:id would swallow
// /stats, /mark, /bulk, /export/monthly, and all /employee/*
// routes if placed first.
// ============================================================

// -- Export --
router.get('/export/monthly', exportAllEmployeesMonthly);

// -- Stats --
router.get('/stats', getAttendanceStats);

// -- Admin actions --
router.post('/mark', markAttendance);
router.post('/bulk', bulkMarkAttendance);

// -- Employee-scoped routes (ALL must be before /:id) --
router.get('/employee/:employeeId/today', getTodayStatus);
router.get('/employee/:employeeId/breaks', getEmployeeBreaks);
router.get('/employee/:employeeId/export/monthly', exportMonthlyAttendance);
router.get('/employee/:employeeId', getEmployeeAttendance);

router.post('/employee/:employeeId/clock-in', clockIn);
router.post('/employee/:employeeId/clock-out', clockOut);
router.post('/employee/:employeeId/break/start', startBreak);
router.post('/employee/:employeeId/break/:breakId/end', endBreak);

// -- Generic /:id routes (LAST — catches everything else) --
router.get('/', getAllAttendance);
router.get('/:id', getAttendanceById);
router.put('/:id', updateAttendance);
router.delete('/:id', deleteAttendance);

module.exports = router;