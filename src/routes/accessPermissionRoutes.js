// src/routes/accessPermissionRoutes.js

const express = require('express');
const router = express.Router();
const {
  getEmployeePermissions,
  grantPermission,
  revokePermission,
  updateEmployeePermissions
} = require('../controllers/accessPermissionController');

// GET permissions for an employee
router.get('/employee/:employeeId', getEmployeePermissions);

// POST grant a single permission
router.post('/', grantPermission);

// PUT bulk update all permissions for an employee
router.put('/employee/:employeeId', updateEmployeePermissions);

// DELETE revoke a permission by ID
router.delete('/:id', revokePermission);

module.exports = router;