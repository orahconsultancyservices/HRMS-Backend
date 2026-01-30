// src/controllers/leaveController.js

const { PrismaClient } = require('@prisma/client');
const prisma = require("../lib/prisma");

const paidLeaveService = require('../services/paidLeaveService');

// Get all leave requests
exports.getAllLeaves = async (req, res, next) => {
  try {
    const { status, empId, from, to } = req.query;

    const where = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (empId) {
      where.empId = parseInt(empId);
    }

    if (from || to) {
      where.from = {};
      if (from) where.from.gte = new Date(from);
      if (to) where.from.lte = new Date(to);
    }

    const leaves = await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            department: true,
            position: true
          }
        }
      },
      orderBy: { appliedDate: 'desc' }
    });

    res.status(200).json({
      success: true,
      count: leaves.length,
      data: leaves
    });
  } catch (error) {
    next(error);
  }
};

// Get leave request by ID
exports.getLeaveById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const leave = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(id) },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            department: true,
            position: true,
            email: true,
            phone: true
          }
        }
      }
    });

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    res.status(200).json({
      success: true,
      data: leave
    });
  } catch (error) {
    next(error);
  }
};

// Get leaves by employee ID
exports.getLeavesByEmployee = async (req, res, next) => {
  try {
    const { empId } = req.params;

    console.log('📥 Fetching leaves for employee:', empId);

    let numericEmpId;

    // Handle both numeric ID and employee code
    if (!isNaN(parseInt(empId))) {
      numericEmpId = parseInt(empId);
    } else {
      // It's an employee code, find the numeric ID
      const employee = await prisma.employee.findUnique({
        where: { employeeId: empId.toString() },
        select: { id: true }
      });

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      numericEmpId = employee.id;
      console.log(`✅ Converted employee code ${empId} to numeric ID: ${numericEmpId}`);
    }

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        empId: numericEmpId
      },
      orderBy: {
        appliedDate: 'desc'
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    console.log(`✅ Found ${leaves.length} leaves for employee ${empId}`);

    res.status(200).json({
      success: true,
      count: leaves.length,
      data: leaves
    });

  } catch (error) {
    console.error('❌ Error in getLeavesByEmployee:', error);
    next(error);
  }
};
// Create leave request
exports.createLeave = async (req, res, next) => {
  try {
    const {
      empId,
      type,
      from,
      to,
      reason,
      contactDuringLeave,
      addressDuringLeave,
      isHalfDay = false // Make sure this is properly extracted
    } = req.body;

    console.log('Received leave request data:', {
      empId,
      type,
      from,
      to,
      isHalfDay,
      reason
    });
    // Validate required fields
    if (!empId || !type || !from || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(empId) },
      include: { leaveBalance: true }
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Calculate days based on half day or full day
    let days = 0;
    const fromDate = new Date(from);
    let toDate;

    if (isHalfDay) {
      days = 0.5;
      toDate = fromDate; // Same day for half day
    } else {
      toDate = new Date(to || from);
      const timeDiff = toDate.getTime() - fromDate.getTime();
      days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;

      // Ensure at least 1 day
      if (days < 1) days = 1;
    }

    console.log(`📅 Date range: ${fromDate.toDateString()} to ${toDate.toDateString()}, Days: ${days}`);

    if (days <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date range'
      });
    }

    // Handle different leave types
    let isPaid = false;
    let paidDays = 0;

    if (type === 'Paid' || type === 'Unpaid') {
      // Check paid leave availability
      const paidLeaveCheck = await paidLeaveService.canBePaidLeave(
        parseInt(empId),
        days,
        prisma
      );

      if (type === 'Paid') {
        if (!paidLeaveCheck.canBePaid && paidLeaveCheck.paidDays === 0) {
          return res.status(400).json({
            success: false,
            message: 'No paid leaves available. Please apply for unpaid leave.'
          });
        }
        isPaid = true;
        paidDays = paidLeaveCheck.paidDays;
      } else {
        // Unpaid leave
        isPaid = false;
        paidDays = 0;
      }
    } else {
      // Regular leave types (Casual, Sick, etc.)
      const leaveType = type.toLowerCase();
      const currentBalance = employee.leaveBalance[leaveType];

      if (currentBalance < days) {
        return res.status(400).json({
          success: false,
          message: `Insufficient ${type} leave balance. Available: ${currentBalance} days, Requested: ${days} days`
        });
      }
      isPaid = true; // Regular leaves are paid
      paidDays = days;
    }

    // Create leave request
    const leave = await prisma.leaveRequest.create({
      data: {
        empId: parseInt(empId),
        type,
        from: fromDate,
        to: toDate,
        days,
        reason,
        contactDuringLeave,
        addressDuringLeave,
        status: 'pending',
        isHalfDay,
        isPaid,
        paidDays
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            department: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Leave request created successfully',
      data: leave
    });
  } catch (error) {
    next(error);
  }
};
// Update leave request
exports.updateLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Check if leave exists
    const existingLeave = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingLeave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Recalculate days if dates are updated
    if (updateData.from || updateData.to) {
      const fromDate = updateData.from ? new Date(updateData.from) : existingLeave.from;
      const toDate = updateData.to ? new Date(updateData.to) : existingLeave.to;
      updateData.days = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;

      if (updateData.from) updateData.from = fromDate;
      if (updateData.to) updateData.to = toDate;
    }

    const leave = await prisma.leaveRequest.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            department: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Leave request updated successfully',
      data: leave
    });
  } catch (error) {
    next(error);
  }
};

exports.getPaidLeaveBalance = async (req, res, next) => {
  try {
    const { empId } = req.params;

    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(empId) },
      select: { joinDate: true, firstName: true, lastName: true }
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Calculate earned paid leaves (whole numbers - complete months)
    const earnedPaidLeaves = paidLeaveService.calculateEarnedPaidLeaves(employee.joinDate);

    // Get consumed paid leaves (includes half days as 0.5)
    const consumedPaidLeaves = await prisma.leaveRequest.aggregate({
      where: {
        empId: parseInt(empId),
        isPaid: true,
        status: 'approved'
      },
      _sum: {
        paidDays: true
      }
    });

    // Keep decimal values for half days
    const consumed = consumedPaidLeaves._sum.paidDays || 0;
    const earned = earnedPaidLeaves; // Whole number
    const available = Math.max(0, earned - consumed); // Can be decimal (e.g., 0.5)

    console.log(`📊 Paid Leave Balance for Employee ${empId}:`, {
      joinDate: employee.joinDate,
      earned,
      consumed,
      available
    });

    res.status(200).json({
      success: true,
      data: {
        earned: earned,      // Whole number (1, 2, 3...)
        consumed: consumed,   // Can be decimal (0.5, 1, 1.5...)
        available: available  // Can be decimal (0.5, 1, 1.5...)
      }
    });
  } catch (error) {
    console.error('Error in getPaidLeaveBalance:', error);
    next(error);
  }
};

// Update leave status (approve/reject)
exports.updateLeaveStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, managerNotes, approvedBy, rejectionReason } = req.body;

    if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be: approved, rejected, or pending'
      });
    }

    // Get leave request
    const leave = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(id) },
      include: {
        employee: {
          include: { leaveBalance: true }
        }
      }
    });

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // If approving, deduct from leave balance
    if (status === 'approved' && leave.status !== 'approved') {
      const leaveType = leave.type.toLowerCase();
      const currentBalance = leave.employee.leaveBalance[leaveType];

      if (currentBalance < leave.days) {
        return res.status(400).json({
          success: false,
          message: `Insufficient leave balance`
        });
      }

      // Update leave balance
      await prisma.leaveBalance.update({
        where: { employeeId: leave.empId },
        data: {
          [leaveType]: currentBalance - leave.days
        }
      });
    }

    // If rejecting an approved leave, restore balance
    if (status === 'rejected' && leave.status === 'approved') {
      const leaveType = leave.type.toLowerCase();
      const currentBalance = leave.employee.leaveBalance[leaveType];

      await prisma.leaveBalance.update({
        where: { employeeId: leave.empId },
        data: {
          [leaveType]: currentBalance + leave.days
        }
      });
    }

    // Update leave status
    const updatedLeave = await prisma.leaveRequest.update({
      where: { id: parseInt(id) },
      data: {
        status,
        managerNotes,
        approvedBy: status === 'approved' ? approvedBy : null,
        approvedDate: status === 'approved' ? new Date() : null,
        rejectionReason: status === 'rejected' ? rejectionReason : null
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            department: true,
            email: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: `Leave request ${status} successfully`,
      data: updatedLeave
    });
  } catch (error) {
    next(error);
  }
};

// Delete leave request
exports.deleteLeave = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingLeave = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingLeave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // If approved leave is being deleted, restore balance
    if (existingLeave.status === 'approved') {
      const employee = await prisma.employee.findUnique({
        where: { id: existingLeave.empId },
        include: { leaveBalance: true }
      });

      const leaveType = existingLeave.type.toLowerCase();
      const currentBalance = employee.leaveBalance[leaveType];

      await prisma.leaveBalance.update({
        where: { employeeId: existingLeave.empId },
        data: {
          [leaveType]: currentBalance + existingLeave.days
        }
      });
    }

    await prisma.leaveRequest.delete({
      where: { id: parseInt(id) }
    });

    res.status(200).json({
      success: true,
      message: 'Leave request deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get leave statistics
exports.getLeaveStatistics = async (req, res, next) => {
  try {
    const { empId } = req.query;

    const where = empId ? { empId: parseInt(empId) } : {};

    const totalLeaves = await prisma.leaveRequest.count({ where });
    const pendingLeaves = await prisma.leaveRequest.count({ where: { ...where, status: 'pending' } });
    const approvedLeaves = await prisma.leaveRequest.count({ where: { ...where, status: 'approved' } });
    const rejectedLeaves = await prisma.leaveRequest.count({ where: { ...where, status: 'rejected' } });

    // Get leave type breakdown
    const leavesByType = await prisma.leaveRequest.groupBy({
      by: ['type'],
      where,
      _count: { type: true },
      _sum: { days: true }
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalLeaves,
        pending: pendingLeaves,
        approved: approvedLeaves,
        rejected: rejectedLeaves,
        byType: leavesByType
      }
    });
  } catch (error) {
    next(error);
  }
};