const express = require('express');
const router = express.Router();

const {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getLeaveBalance,
  updateLeaveBalance,
  getDepartments,
  getPositions,
  getEmployeeByCode
} = require('../controllers/employeeController');

/**
 * @swagger
 * tags:
 *   name: Employees
 *   description: Employee management APIs
 */

/**
 * @swagger
 * /api/employees:
 *   get:
 *     summary: Get all employees
 *     tags: [Employees]
 *     responses:
 *       200:
 *         description: List of employees
 */
router.get('/', getAllEmployees);

/**
 * @swagger
 * /api/employees/departments:
 *   get:
 *     summary: Get all departments
 *     tags: [Employees]
 */
router.get('/departments', getDepartments);

/**
 * @swagger
 * /api/employees/positions:
 *   get:
 *     summary: Get all positions
 *     tags: [Employees]
 */
router.get('/positions', getPositions);


/**
 * @swagger
 * /api/employees/{id}:
 *   get:
 *     summary: Get employee by ID
 *     tags: [Employees]
 */

/**
 * @swagger
 * /api/employees/code/{code}:
 *   get:
 *     summary: Get employee by employee code (EMP001)
 *     tags: [Employees]
 */
router.get('/code/:code', getEmployeeByCode);
router.get('/:id', getEmployeeById);

router.post('/', createEmployee);
router.put('/:id', updateEmployee);
router.delete('/:id', deleteEmployee);

// Leave balance routes
router.get('/:id/leave-balance', getLeaveBalance);
router.put('/:id/leave-balance', updateLeaveBalance);

module.exports = router;
