// src/controllers/taskController.js
// COMPLETE IMPLEMENTATION - Full KPI Task Management Controller

const prisma = require("../lib/prisma");
const { getAccessibleDepartments } = require('../utils/departmentAccess');

// ============================================
// GET ALL TASKS
// ============================================
exports.getAllTasks = async (req, res, next) => {
  try {
    const { type, status, category, assignedTo, assignedBy, search, month, year } = req.query;

        // ── NEW: dept-scoped filtering via x-user header ──────────────────
    const reqUser = req.user; // populated by extractUser middleware
    const where = {};

    const scopedDepartments = getAccessibleDepartments(reqUser);
    if (scopedDepartments !== null) {
      if (reqUser?.role === 'employee') {
        // Employee sees only tasks assigned to themselves
        where.assignedToId = reqUser.id;
      } else if (reqUser?.role === 'teamlead') {
        // Team lead: direct reports + themselves (catches admin-assigned tasks to the TL)
        // Also adds any extra department/team access permissions granted by admin
        const conditions = [
          { reportTo: reqUser.id }, // direct reports
          { id: reqUser.id },       // team lead themselves
        ];
        for (const perm of (reqUser.accessPermissions || [])) {
          if (perm.targetType === 'department') {
            conditions.push({ department: perm.targetName });
          } else if (perm.targetType === 'team') {
            conditions.push({ reportTo: perm.targetId });
          }
        }
        const scopedEmployees = await prisma.employee.findMany({
          where: { OR: conditions, isActive: true },
          select: { id: true }
        });
        where.assignedToId = { in: scopedEmployees.map((e) => e.id) };
      } else {
        // Manager / HR fall-through: scope by accessible departments
        const scopedEmployees = await prisma.employee.findMany({
          where: { department: { in: scopedDepartments }, isActive: true },
          select: { id: true }
        });
        where.assignedToId = { in: scopedEmployees.map((employee) => employee.id) };
      }
    }
    if (type && type !== 'all')       where.type     = type;
    if (status && status !== 'all')   where.status   = status;
    if (category && category !== 'all') where.category = category;
    if (assignedTo)  where.assignedToId = parseInt(assignedTo);
    if (assignedBy)  where.assignedById = parseInt(assignedBy);
    if (search) {
      where.OR = [
        { title:       { contains: search } },
        { description: { contains: search } }
      ];
    }

    // ── Month / Year filter — scope tasks whose deadline falls in the period ──
    if (month && year) {
      const m = parseInt(month);
      const y = parseInt(year);
      const startOfMonth = new Date(y, m - 1, 1, 0, 0, 0, 0);
      const endOfMonth   = new Date(y, m,     0, 23, 59, 59, 999); // day 0 of next month = last day of this month
      where.deadline = { gte: startOfMonth, lte: endOfMonth };
    }
    
    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignedTo: {
          select: {
            id: true, firstName: true, lastName: true,
            employeeId: true, email: true, department: true,
            position: true, avatar: true
          }
        },
        assignedBy: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        },
        submissions: {
          include: {
            employee: {
              select: { id: true, firstName: true, lastName: true, employeeId: true }
            }
          },
          orderBy: { date: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.status(200).json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    next(error);
  }
};

// ============================================
// GET TASK BY ID
// ============================================
exports.getTaskById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const task = await prisma.task.findUnique({
      where: { id: parseInt(id) },
      include: {
        assignedTo: {
          select: {
            id: true, firstName: true, lastName: true,
            employeeId: true, email: true, department: true,
            position: true, avatar: true
          }
        },
        assignedBy: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        },
        submissions: {
          include: {
            employee: {
              select: { id: true, firstName: true, lastName: true, employeeId: true }
            }
          },
          orderBy: { date: 'desc' }
        }
      }
    });
    
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const scopedDepartments = getAccessibleDepartments(req.user);
    if (scopedDepartments !== null) {
      if (req.user?.role === 'employee' && task.assignedToId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'You can only view your own tasks' });
      }
      if (req.user?.role !== 'employee' && !scopedDepartments.includes(task.assignedTo.department)) {
        return res.status(403).json({ success: false, message: 'No access to this department task' });
      }
    }
    
    res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

// ============================================
// GET TASKS BY EMPLOYEE
// ============================================
exports.getTasksByEmployee = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { type, status } = req.query;
    
    const where = { assignedToId: parseInt(employeeId) };
    if (type && type !== 'all')     where.type   = type;
    if (status && status !== 'all') where.status = status;
    
    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignedBy: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        },
        submissions: {
          where:    { employeeId: parseInt(employeeId) },
          orderBy:  { date: 'desc' }
        }
      },
      orderBy: { deadline: 'asc' }
    });
    
    res.status(200).json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    next(error);
  }
};

// ============================================
// CREATE TASK
// ============================================
exports.createTask = async (req, res, next) => {
  try {
    const {
      title, description, type, category, target, unit,
      deadline, priority, assignedToId, assignedById,
      notes, recurring, recurrence
    } = req.body;
    
    // Validate required fields
    if (!title || !type || !category || !target || !unit || !deadline || !assignedToId || !assignedById) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: title, type, category, target, unit, deadline, assignedToId, assignedById'
      });
    }

    // Validate target is positive
    const parsedTarget = parseInt(target);
    if (isNaN(parsedTarget) || parsedTarget <= 0) {
      return res.status(400).json({ success: false, message: 'Target must be a positive integer' });
    }

    // Validate assignedToId
    const parsedAssignedToId = parseInt(assignedToId);
    if (isNaN(parsedAssignedToId)) {
      return res.status(400).json({ success: false, message: 'assignedToId must be a valid integer' });
    }

    // Validate assignedById
    const parsedAssignedById = parseInt(assignedById);
    if (isNaN(parsedAssignedById)) {
      return res.status(400).json({ success: false, message: 'assignedById must be a valid integer' });
    }

    // Validate type
    const validTypes = ['daily', 'weekly', 'monthly'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: `Type must be one of: ${validTypes.join(', ')}` });
    }

    // Validate category
    const validCategories = ['applications', 'interviews', 'assessments', 'calls', 'meetings', 'closures', 'screenings', 'submissions', 'placements'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ success: false, message: `Category must be one of: ${validCategories.join(', ')}` });
    }
    
    // Check if assigned employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: parsedAssignedToId }
    });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Assigned employee not found' });
    }

    // Check assigner exists
    const assigner = await prisma.employee.findUnique({
      where: { id: parsedAssignedById }
    });
    if (!assigner) {
      return res.status(404).json({ success: false, message: 'Assigning user not found' });
    }
    
    // Create task
    const task = await prisma.task.create({
      data: {
        title:         title.trim(),
        description:   description || '',
        type,
        category,
        target:        parsedTarget,
        unit:          unit.trim(),
        deadline:      new Date(deadline),
        priority:      priority || 'medium',
        assignedToId:  parsedAssignedToId,
        assignedById:  parsedAssignedById,
        notes:         notes || '',
        recurring:     recurring || false,
        recurrence:    recurring ? (recurrence || null) : null,
      },
      include: {
        assignedTo: {
          select: {
            id: true, firstName: true, lastName: true,
            employeeId: true, email: true, department: true,
            position: true, avatar: true
          }
        },
        assignedBy: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        }
      }
    });
    
    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task
    });
  } catch (error) {
    console.error('❌ createTask error:', error);
    next(error);
  }
};

// ============================================
// UPDATE TASK
// ============================================
exports.updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    const existingTask = await prisma.task.findUnique({ where: { id: parseInt(id) } });
    if (!existingTask) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Prevent editing if locked
    if (existingTask.isLocked) {
      return res.status(403).json({ success: false, message: 'This task is locked and cannot be modified' });
    }
    
    // Convert data types
    if (updateData.target)       updateData.target       = parseInt(updateData.target);
    if (updateData.achieved)     updateData.achieved     = parseInt(updateData.achieved);
    if (updateData.assignedToId) updateData.assignedToId = parseInt(updateData.assignedToId);
    if (updateData.deadline)     updateData.deadline     = new Date(updateData.deadline);

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    const task = await prisma.task.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        assignedTo: {
          select: {
            id: true, firstName: true, lastName: true,
            employeeId: true, email: true, department: true,
            position: true, avatar: true
          }
        },
        assignedBy: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        },
        submissions: {
          include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } } },
          orderBy: { date: 'desc' }
        }
      }
    });
    
    res.status(200).json({ success: true, message: 'Task updated successfully', data: task });
  } catch (error) {
    next(error);
  }
};

// ============================================
// DELETE TASK
// ============================================
exports.deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Only employer/admin and manager roles can delete tasks — team leads cannot
    const allowedRoles = ['employer', 'admin', 'manager'];
    if (req.user && req.user.role && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only employers and managers can delete tasks'
      });
    }

    const existingTask = await prisma.task.findUnique({ where: { id: parseInt(id) } });
    if (!existingTask) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (existingTask.isLocked) {
      return res.status(403).json({ success: false, message: 'Cannot delete a locked task' });
    }
    
    // Delete submissions first (cascade should handle this, but explicit is safer)
    await prisma.taskSubmission.deleteMany({ where: { taskId: parseInt(id) } });
    await prisma.task.delete({ where: { id: parseInt(id) } });
    
    res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ============================================
// SUBMIT TASK PROGRESS
// ============================================
exports.submitTaskProgress = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { employeeId, count, notes } = req.body;
    
    if (!employeeId || !count) {
      return res.status(400).json({ success: false, message: 'Please provide employeeId and count' });
    }

    const parsedCount = parseInt(count);
    if (isNaN(parsedCount) || parsedCount <= 0) {
      return res.status(400).json({ success: false, message: 'Count must be a positive integer' });
    }
    
    const task = await prisma.task.findUnique({ where: { id: parseInt(taskId) } });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Check assignment
    if (task.assignedToId !== parseInt(employeeId)) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this task' });
    }

    // Check if task is locked (past dates)
    if (task.isLocked) {
      return res.status(403).json({ success: false, message: 'This task is locked. Past data cannot be modified.' });
    }

    // For daily tasks: check if already submitted today
    if (task.type === 'daily') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todaySubmission = await prisma.taskSubmission.findFirst({
        where: {
          taskId:     parseInt(taskId),
          employeeId: parseInt(employeeId),
          date:       { gte: today, lt: tomorrow }
        }
      });

      // Allow multiple submissions per day - just add them up
      // (Don't block, just record)
    }
    
    // Create submission
    const submission = await prisma.taskSubmission.create({
      data: {
        taskId:     parseInt(taskId),
        employeeId: parseInt(employeeId),
        count:      parsedCount,
        notes:      notes || '',
        date:       new Date(),
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        }
      }
    });
    
    // Update task achieved count
    const newAchieved = Math.min(task.achieved + parsedCount, task.target);
    const newStatus   = newAchieved >= task.target ? 'completed' : task.status;
    
    const updatedTask = await prisma.task.update({
      where: { id: parseInt(taskId) },
      data:  { achieved: newAchieved, status: newStatus }
    });
    
    res.status(201).json({
      success: true,
      message: 'Progress submitted successfully',
      data: { submission, task: updatedTask }
    });
  } catch (error) {
    console.error('❌ submitTaskProgress error:', error);
    next(error);
  }
};

// ============================================
// GET TASK SUBMISSIONS
// ============================================
exports.getTaskSubmissions = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { verified } = req.query;
    
    const where = { taskId: parseInt(taskId) };
    if (verified !== undefined) where.verified = verified === 'true';
    
    const submissions = await prisma.taskSubmission.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true, firstName: true, lastName: true,
            employeeId: true, email: true, department: true, position: true
          }
        },
        task: {
          select: { id: true, title: true, type: true, category: true }
        }
      },
      orderBy: { date: 'desc' }
    });
    
    res.status(200).json({ success: true, count: submissions.length, data: submissions });
  } catch (error) {
    next(error);
  }
};

// ============================================
// VERIFY SUBMISSION
// ============================================
exports.verifySubmission = async (req, res, next) => {
  try {
    const { submissionId } = req.params;
    const { verifiedBy } = req.body;
    
    const existing = await prisma.taskSubmission.findUnique({ where: { id: parseInt(submissionId) } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }
    
    const submission = await prisma.taskSubmission.update({
      where: { id: parseInt(submissionId) },
      data: {
        verified:   true,
        verifiedBy: verifiedBy ? parseInt(verifiedBy) : null,
        verifiedAt: new Date()
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        }
      }
    });
    
    res.status(200).json({ success: true, message: 'Submission verified successfully', data: submission });
  } catch (error) {
    next(error);
  }
};

// ============================================
// DELETE SUBMISSION
// ============================================
exports.deleteSubmission = async (req, res, next) => {
  try {
    const { submissionId } = req.params;
    
    const submission = await prisma.taskSubmission.findUnique({
      where:   { id: parseInt(submissionId) },
      include: { task: true }
    });
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    // Check if task is locked
    if (submission.task.isLocked) {
      return res.status(403).json({ success: false, message: 'Cannot delete submission for a locked task' });
    }
    
    await prisma.taskSubmission.delete({ where: { id: parseInt(submissionId) } });
    
    // Update task achieved count
    const newAchieved = Math.max(submission.task.achieved - submission.count, 0);
    const newStatus   = newAchieved < submission.task.target ? 'active' : submission.task.status;
    
    await prisma.task.update({
      where: { id: submission.taskId },
      data:  { achieved: newAchieved, status: newStatus }
    });
    
    res.status(200).json({ success: true, message: 'Submission deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ============================================
// GET TASK ANALYTICS
// ============================================
exports.getTaskAnalytics = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { startDate, endDate } = req.query;
    
    const task = await prisma.task.findUnique({ where: { id: parseInt(taskId) } });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    
    const where = { taskId: parseInt(taskId) };
    if (startDate && endDate) {
      where.date = { gte: new Date(startDate), lte: new Date(endDate) };
    }
    
    const submissions = await prisma.taskSubmission.findMany({
      where,
      orderBy: { date: 'asc' }
    });
    
    const totalSubmitted = submissions.reduce((sum, s) => sum + s.count, 0);
    const avgDaily       = submissions.length > 0 ? totalSubmitted / submissions.length : 0;
    const peakSubmission = submissions.reduce(
      (max, s) => s.count > max.count ? s : max,
      { count: 0, date: new Date() }
    );
    
    res.status(200).json({
      success: true,
      data: {
        task: { id: task.id, title: task.title, type: task.type, target: task.target, achieved: task.achieved },
        submissions,
        analytics: {
          totalSubmitted,
          avgDaily,
          peakSubmission: { count: peakSubmission.count, date: peakSubmission.date },
          completionRate: task.target > 0 ? (task.achieved / task.target) * 100 : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// GET EMPLOYEE TASK STATISTICS
// ============================================
exports.getEmployeeTaskStats = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    
    const tasks = await prisma.task.findMany({
      where:   { assignedToId: parseInt(employeeId) },
      include: {
        submissions: { where: { employeeId: parseInt(employeeId) } }
      }
    });
    
    const totalTasks        = tasks.length;
    const activeTasks       = tasks.filter(t => t.status === 'active').length;
    const completedTasks    = tasks.filter(t => t.status === 'completed').length;
    const overdueTasks      = tasks.filter(t => t.status === 'overdue').length;
    const totalTarget       = tasks.reduce((sum, t) => sum + t.target, 0);
    const totalAchieved     = tasks.reduce((sum, t) => sum + t.achieved, 0);
    const completionRate    = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;
    const totalSubmissions  = tasks.reduce((sum, t) => sum + t.submissions.length, 0);
    const verifiedSubs      = tasks.reduce((sum, t) => sum + t.submissions.filter(s => s.verified).length, 0);

    // Category breakdown
    const categoryBreakdown = tasks.reduce((acc, t) => {
      if (!acc[t.category]) acc[t.category] = { target: 0, achieved: 0, count: 0 };
      acc[t.category].target   += t.target;
      acc[t.category].achieved += t.achieved;
      acc[t.category].count++;
      return acc;
    }, {});
    
    res.status(200).json({
      success: true,
      data: {
        totalTasks, activeTasks, completedTasks, overdueTasks,
        completionRate: completionRate.toFixed(2),
        totalSubmissions, verifiedSubmissions: verifiedSubs,
        categoryBreakdown,
        tasks
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// LOCK TASK (Admin only - month-end)
// ============================================
exports.lockTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { lockedBy } = req.body;

    const task = await prisma.task.findUnique({ where: { id: parseInt(id) } });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const updatedTask = await prisma.task.update({
      where: { id: parseInt(id) },
      data: {
        isLocked: true,
        lockDate: new Date(),
      }
    });

    res.status(200).json({ success: true, message: 'Task locked successfully', data: updatedTask });
  } catch (error) {
    next(error);
  }
};

// ============================================
// GET TEAM PERFORMANCE (for employer dashboard)
// ============================================
exports.getTeamPerformance = async (req, res, next) => {
  try {
    const { month, year, department } = req.query;
    const scopedDepartments = getAccessibleDepartments(req.user);
    const employeeWhere = { isActive: true };
    if (department) {
      employeeWhere.department = department;
    } else if (scopedDepartments !== null) {
      if (req.user?.role === 'employee') {
        employeeWhere.id = req.user.id;
      } else {
        employeeWhere.department = { in: scopedDepartments };
      }
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      select: { id: true, firstName: true, lastName: true, employeeId: true, department: true, position: true }
    });

    const performanceData = await Promise.all(
      employees.map(async (emp) => {
        const taskWhere = { assignedToId: emp.id };

        // Filter by month/year if provided
        if (month && year) {
          const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
          const endDate   = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
          taskWhere.deadline = { gte: startDate, lte: endDate };
        }

        const tasks = await prisma.task.findMany({
          where:   taskWhere,
          include: { submissions: { where: { employeeId: emp.id } } }
        });

        const totalTarget   = tasks.reduce((s, t) => s + t.target, 0);
        const totalAchieved = tasks.reduce((s, t) => s + t.achieved, 0);
        const completion    = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

        return {
          employee: {
            id: emp.id,
            name: `${emp.firstName} ${emp.lastName}`,
            empId: emp.employeeId,
            department: emp.department,
            position: emp.position,
          },
          totalTasks:        tasks.length,
          activeTasks:       tasks.filter(t => t.status === 'active').length,
          completedTasks:    tasks.filter(t => t.status === 'completed').length,
          overdueTasks:      tasks.filter(t => t.status === 'overdue').length,
          totalTarget,
          totalAchieved,
          completionRate:    Math.round(completion),
          totalSubmissions:  tasks.reduce((s, t) => s + t.submissions.length, 0),
        };
      })
    );

    res.status(200).json({ success: true, data: performanceData });
  } catch (error) {
    next(error);
  }
};