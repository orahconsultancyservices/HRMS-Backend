// src/routes/departmentRoutes.js
// Mounted at /api/departments — paths here are relative (no extra /departments prefix)

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
// DESIGNATION & KPI ROUTES (before /:id)
// ============================================

router.get('/designations', getAllDesignations);
router.get('/designations/:designationId/kpis', getDefaultKPIs);
router.get('/designations/:id', getDesignationById);
router.post('/designations', createDesignation);
router.put('/designations/:id', updateDesignation);

router.post('/kpis', createDefaultKPI);
router.put('/kpis/:id', updateDefaultKPI);
router.delete('/kpis/:id', deleteDefaultKPI);

// ============================================
// DEPARTMENT ROUTES
// ============================================

router.get('/', getAllDepartments);
router.post('/', createDepartment);
router.get('/:id', getDepartmentById);
router.put('/:id', updateDepartment);

module.exports = router;
