// validation/leaveValidation.js
// Comprehensive validation for leave requests

const { body, param, validationResult } = require('express-validator');

// Validation rules for creating leave
exports.validateCreateLeave = [
  body('empId')
    .notEmpty().withMessage('Employee ID is required')
    .isInt({ min: 1 }).withMessage('Employee ID must be a positive integer'),
  
  body('type')
    .notEmpty().withMessage('Leave type is required')
    .isIn(['Casual', 'Sick', 'Earned', 'Maternity', 'Paternity', 'Bereavement', 'Paid', 'Unpaid', 'HalfDay'])
    .withMessage('Invalid leave type'),
  
  body('from')
    .notEmpty().withMessage('Start date is required')
    .isISO8601().withMessage('Invalid start date format')
    .custom((value) => {
      const date = new Date(value);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (date < now) {
        throw new Error('Start date cannot be in the past');
      }
      return true;
    }),
  
  body('to')
    .optional()
    .isISO8601().withMessage('Invalid end date format')
    .custom((value, { req }) => {
      if (value && !req.body.isHalfDay) {
        const from = new Date(req.body.from);
        const to = new Date(value);
        if (to < from) {
          throw new Error('End date must be after start date');
        }
        
        // Check maximum duration (e.g., 30 days)
        const daysDiff = Math.ceil((to - from) / (1000 * 60 * 60 * 24));
        if (daysDiff > 30) {
          throw new Error('Leave duration cannot exceed 30 days');
        }
      }
      return true;
    }),
  
  body('reason')
    .notEmpty().withMessage('Reason is required')
    .isLength({ min: 10, max: 500 }).withMessage('Reason must be between 10 and 500 characters')
    .trim(),
  
  body('isHalfDay')
    .optional()
    .isBoolean().withMessage('isHalfDay must be a boolean'),
  
  body('contactDuringLeave')
    .optional()
    .matches(/^[0-9+\-\s()]+$/).withMessage('Invalid phone number format')
    .isLength({ max: 20 }).withMessage('Contact number too long'),
  
  // Custom validation
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }))
      });
    }
    next();
  }
];

// Validation for updating leave status
exports.validateUpdateStatus = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid leave ID'),
  
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['pending', 'approved', 'rejected']).withMessage('Invalid status'),
  
  body('managerNotes')
    .optional()
    .isLength({ max: 1000 }).withMessage('Manager notes too long')
    .trim(),
  
  body('approvedBy')
    .optional()
    .isLength({ max: 100 }).withMessage('Approver name too long')
    .trim(),
  
  body('rejectionReason')
    .if(body('status').equals('rejected'))
    .notEmpty().withMessage('Rejection reason is required when rejecting')
    .isLength({ max: 500 }).withMessage('Rejection reason too long'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }))
      });
    }
    next();
  }
];

// Business logic validation
exports.validateLeaveBusinessRules = async (req, res, next) => {
  try {
    const { empId, from, to, type, isHalfDay } = req.body;
    const prisma = require('../lib/prisma');
    
    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(empId) },
      select: { 
        id: true, 
        joinDate: true,
        isActive: true 
      }
    });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
    
    if (!employee.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create leave for inactive employee'
      });
    }
    
    // Check minimum advance notice (e.g., 1 day)
    const MIN_NOTICE_DAYS = 1;
    const fromDate = new Date(from);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const daysInAdvance = Math.ceil((fromDate - now) / (1000 * 60 * 60 * 24));
    
    if (daysInAdvance < MIN_NOTICE_DAYS) {
      return res.status(400).json({
        success: false,
        message: `Leave must be applied at least ${MIN_NOTICE_DAYS} day(s) in advance`
      });
    }
    
    // Check maximum advance booking (e.g., 90 days)
    const MAX_ADVANCE_DAYS = 90;
    if (daysInAdvance > MAX_ADVANCE_DAYS) {
      return res.status(400).json({
        success: false,
        message: `Cannot book leave more than ${MAX_ADVANCE_DAYS} days in advance`
      });
    }
    
    // Check for overlapping leaves
    const toDate = isHalfDay ? fromDate : new Date(to);
    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        empId: parseInt(empId),
        status: { in: ['pending', 'approved'] },
        OR: [
          {
            AND: [
              { from: { lte: toDate } },
              { to: { gte: fromDate } }
            ]
          }
        ]
      },
      select: {
        id: true,
        from: true,
        to: true,
        status: true,
        type: true
      }
    });
    
    if (overlapping) {
      return res.status(400).json({
        success: false,
        message: 'You already have a leave request for this period',
        overlapping: {
          id: overlapping.id,
          from: overlapping.from,
          to: overlapping.to,
          status: overlapping.status,
          type: overlapping.type
        }
      });
    }
    
    // Check if applying for leave on a weekend (optional business rule)
    const dayOfWeek = fromDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // You might want to warn or block weekend leaves
      console.log(`⚠️ Leave application includes weekend: ${from}`);
    }
    
    next();
  } catch (error) {
    console.error('❌ Business validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error validating leave request',
      error: error.message
    });
  }
};

// Rate limiting validation (prevent spam)
exports.rateLimitLeaveCreation = async (req, res, next) => {
  try {
    const { empId } = req.body;
    const prisma = require('../lib/prisma');
    
    // Check how many leaves created in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentLeaves = await prisma.leaveRequest.count({
      where: {
        empId: parseInt(empId),
        createdAt: { gte: oneHourAgo }
      }
    });
    
    const MAX_LEAVES_PER_HOUR = 5;
    if (recentLeaves >= MAX_LEAVES_PER_HOUR) {
      return res.status(429).json({
        success: false,
        message: `Too many leave requests. Maximum ${MAX_LEAVES_PER_HOUR} per hour allowed.`
      });
    }
    
    next();
  } catch (error) {
    console.error('❌ Rate limit check error:', error);
    next(); // Don't block on rate limit errors
  }
};