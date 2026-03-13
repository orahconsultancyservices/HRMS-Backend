// src/routes/departmentRoutes.js
// Department & Designation Management Routes

const express = require('express');
const router = express.Router();

const {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  getAllDesignations,
  getDesignationById,
  createDesignation,
  updateDesignation,
  getDefaultKPIs,
  createDefaultKPI,
  updateDefaultKPI,
  deleteDefaultKPI
} = require('../controllers/departmentController');

// ============================================
// DEPARTMENT ROUTES
// ============================================

router.get('/departments', getAllDepartments);
router.get('/departments/:id', getDepartmentById);
router.post('/departments', createDepartment);
router.put('/departments/:id', updateDepartment);

// ============================================
// DESIGNATION ROUTES
// ============================================

router.get('/designations', getAllDesignations);
router.get('/designations/:id', getDesignationById);
router.post('/designations', createDesignation);
router.put('/designations/:id', updateDesignation);

// ============================================
// DEFAULT KPI ROUTES
// ============================================

router.get('/designations/:designationId/kpis', getDefaultKPIs);
router.post('/kpis', createDefaultKPI);
router.put('/kpis/:id', updateDefaultKPI);
router.delete('/kpis/:id', deleteDefaultKPI);

module.exports = router;
