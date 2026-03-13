// src/routes/performanceRoutes.js
// Performance Management Routes

const express = require('express');
const router = express.Router();

const {
  getDailyActivities,
  upsertDailyActivity,
  getMonthlyPerformance,
  generateMonthlyPerformance,
  addPerformanceRemarks,
  lockMonthlyPerformance,
  bulkLockMonthlyPerformance,
  getTeamPerformanceSummary,
  getCompanyPerformance
} = require('../controllers/performanceController');

// ============================================
// DAILY ACTIVITY ROUTES
// ============================================

router.get('/employees/:employeeId/daily-activities', getDailyActivities);
router.post('/daily-activities', upsertDailyActivity);

// ============================================
// MONTHLY PERFORMANCE ROUTES
// ============================================

router.get('/employees/:employeeId/monthly-performance', getMonthlyPerformance);
router.post('/monthly-performance/generate', generateMonthlyPerformance);
router.put('/monthly-performance/:id/remarks', addPerformanceRemarks);
router.put('/monthly-performance/:id/lock', lockMonthlyPerformance);
router.post('/monthly-performance/bulk-lock', bulkLockMonthlyPerformance);

// ============================================
// DASHBOARD ROUTES
// ============================================

router.get('/team/performance-summary', getTeamPerformanceSummary);
router.get('/company/performance', getCompanyPerformance);

module.exports = router;
