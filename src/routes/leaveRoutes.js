const express = require('express');
const router = express.Router();

const {
  getAllLeaves,
  getLeaveById,
  getLeavesByEmployee,
  createLeave,
  updateLeave,
  updateLeaveStatus,
  deleteLeave,
  getLeaveStatistics,
  getPaidLeaveBalance
} = require('../controllers/leaveController');

/**
 * @swagger
 * tags:
 *   name: Leaves
 *   description: Leave management APIs
 */

router.get('/', getAllLeaves);
router.get('/statistics', getLeaveStatistics);
router.get('/employee/:empId/paid-balance', getPaidLeaveBalance);
router.get('/employee/:empId', getLeavesByEmployee);
router.get('/:id', getLeaveById);
router.post('/', createLeave);
router.put('/:id', updateLeave);
router.patch('/:id/status', updateLeaveStatus);
router.delete('/:id', deleteLeave);

module.exports = router;
