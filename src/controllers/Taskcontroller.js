// src/controllers/taskController.js

const prisma = require("../lib/prisma");

// ============================================
// GET ALL TASKS
// ============================================
exports.getAllTasks = async (req, res, next) => {
  try {
    const { type, status, category, assignedTo, assignedBy, search } = req.query;
    
    const where = {};
    
    if (type && type !== 'all') {
      where.type = type;
    }
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    if (category && category !== 'all') {
      where.category = category;
    }
    
    if (assignedTo) {
      where.assignedToId = parseInt(assignedTo);
    }
    
    if (assignedBy) {
      where.assignedById = parseInt(assignedBy);
    }
    
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } }
      ];
    }
    
    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            email: true,
            department: true,
            position: true,
            avatar: true
          }
        },
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        },
        submissions: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true
              }
            }
          },
          orderBy: { date: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    });
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
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            email: true,
            department: true,
            position: true,
            avatar: true
          }
        },
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        },
        submissions: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true
              }
            }
          },
          orderBy: { date: 'desc' }
        }
      }
    });
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: task
    });
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
    
    const where = {
      assignedToId: parseInt(employeeId)
    };
    
    if (type && type !== 'all') {
      where.type = type;
    }
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        },
        submissions: {
          where: {
            employeeId: parseInt(employeeId)
          },
          orderBy: { date: 'desc' }
        }
      },
      orderBy: { deadline: 'asc' }
    });
    
    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    });
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
      title,
      description,
      type,
      category,
      target,
      unit,
      deadline,
      priority,
      assignedToId,
      assignedById,
      notes,
      recurring,
      recurrence
    } = req.body;
    
    // Validate required fields
    if (!title || !type || !category || !target || !unit || !deadline || !assignedToId || !assignedById) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }
    
    // Check if assigned employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(assignedToId) }
    });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Assigned employee not found'
      });
    }
    
    // Create task
    const task = await prisma.task.create({
  data: {
    title,
    description,
    type,
    category,
    target,
    unit,
    deadline,
    priority,
    assignedToId,
    assignedById,
    notes,
    recurring,
    recurrence,
  },
  include: {
    assignedTo: true,
    assignedBy: true,
  }
});
    
    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task
    });
  } catch (error) {
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
    
    // Check if task exists
    const existingTask = await prisma.task.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existingTask) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Convert data types
    if (updateData.target) {
      updateData.target = parseInt(updateData.target);
    }
    if (updateData.achieved) {
      updateData.achieved = parseInt(updateData.achieved);
    }
    if (updateData.assignedToId) {
      updateData.assignedToId = parseInt(updateData.assignedToId);
    }
    if (updateData.deadline) {
      updateData.deadline = new Date(updateData.deadline);
    }
    
    // Update task
    const task = await prisma.task.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            email: true,
            department: true,
            position: true,
            avatar: true
          }
        },
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        },
        submissions: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true
              }
            }
          },
          orderBy: { date: 'desc' }
        }
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: task
    });
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
    
    // Check if task exists
    const existingTask = await prisma.task.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existingTask) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Delete task (cascade will handle submissions)
    await prisma.task.delete({
      where: { id: parseInt(id) }
    });
    
    res.status(200).json({
      success: true,
      message: 'Task deleted successfully'
    });
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
    
    // Validate
    if (!employeeId || !count) {
      return res.status(400).json({
        success: false,
        message: 'Please provide employeeId and count'
      });
    }
    
    // Check if task exists
    const task = await prisma.task.findUnique({
      where: { id: parseInt(taskId) }
    });
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Check if employee is assigned to this task
    if (task.assignedToId !== parseInt(employeeId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this task'
      });
    }
    
    // Create submission
    const submission = await prisma.taskSubmission.create({
      data: {
        taskId: parseInt(taskId),
        employeeId: parseInt(employeeId),
        count: parseInt(count),
        notes: notes || ''
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
    
    // Update task achieved count
    const newAchieved = Math.min(task.achieved + parseInt(count), task.target);
    const newStatus = newAchieved >= task.target ? 'completed' : task.status;
    
    const updatedTask = await prisma.task.update({
      where: { id: parseInt(taskId) },
      data: {
        achieved: newAchieved,
        status: newStatus
      }
    });
    
    res.status(201).json({
      success: true,
      message: 'Progress submitted successfully',
      data: {
        submission,
        task: updatedTask
      }
    });
  } catch (error) {
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
    
    const where = {
      taskId: parseInt(taskId)
    };
    
    if (verified !== undefined) {
      where.verified = verified === 'true';
    }
    
    const submissions = await prisma.taskSubmission.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            email: true,
            department: true,
            position: true
          }
        },
        task: {
          select: {
            id: true,
            title: true,
            type: true,
            category: true
          }
        }
      },
      orderBy: { date: 'desc' }
    });
    
    res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions
    });
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
    
    const submission = await prisma.taskSubmission.update({
      where: { id: parseInt(submissionId) },
      data: {
        verified: true,
        verifiedBy: verifiedBy ? parseInt(verifiedBy) : null,
        verifiedAt: new Date()
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
    
    res.status(200).json({
      success: true,
      message: 'Submission verified successfully',
      data: submission
    });
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
    
    // Get submission to update task count
    const submission = await prisma.taskSubmission.findUnique({
      where: { id: parseInt(submissionId) },
      include: { task: true }
    });
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }
    
    // Delete submission
    await prisma.taskSubmission.delete({
      where: { id: parseInt(submissionId) }
    });
    
    // Update task achieved count
    const newAchieved = Math.max(submission.task.achieved - submission.count, 0);
    const newStatus = newAchieved < submission.task.target ? 'active' : submission.task.status;
    
    await prisma.task.update({
      where: { id: submission.taskId },
      data: {
        achieved: newAchieved,
        status: newStatus
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Submission deleted successfully'
    });
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
    
    const where = {
      taskId: parseInt(taskId)
    };
    
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    
    const submissions = await prisma.taskSubmission.findMany({
      where,
      orderBy: { date: 'asc' }
    });
    
    const task = await prisma.task.findUnique({
      where: { id: parseInt(taskId) }
    });
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Calculate analytics
    const totalSubmitted = submissions.reduce((sum, sub) => sum + sub.count, 0);
    const avgDaily = submissions.length > 0 ? totalSubmitted / submissions.length : 0;
    const peakSubmission = submissions.reduce((max, sub) => 
      sub.count > max.count ? sub : max, 
      { count: 0, date: new Date() }
    );
    
    res.status(200).json({
      success: true,
      data: {
        task: {
          id: task.id,
          title: task.title,
          type: task.type,
          target: task.target,
          achieved: task.achieved
        },
        submissions,
        analytics: {
          totalSubmitted,
          avgDaily,
          peakSubmission: {
            count: peakSubmission.count,
            date: peakSubmission.date
          },
          completionRate: (task.achieved / task.target) * 100
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
      where: { assignedToId: parseInt(employeeId) },
      include: {
        submissions: {
          where: { employeeId: parseInt(employeeId) }
        }
      }
    });
    
    const totalTasks = tasks.length;
    const activeTasks = tasks.filter(t => t.status === 'active').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const overdueTasks = tasks.filter(t => t.status === 'overdue').length;
    
    const totalTarget = tasks.reduce((sum, task) => sum + task.target, 0);
    const totalAchieved = tasks.reduce((sum, task) => sum + task.achieved, 0);
    const completionRate = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;
    
    const totalSubmissions = tasks.reduce((sum, task) => sum + task.submissions.length, 0);
    const verifiedSubmissions = tasks.reduce((sum, task) => 
      sum + task.submissions.filter(s => s.verified).length, 0
    );
    
    res.status(200).json({
      success: true,
      data: {
        totalTasks,
        activeTasks,
        completedTasks,
        overdueTasks,
        completionRate: completionRate.toFixed(2),
        totalSubmissions,
        verifiedSubmissions,
        tasks
      }
    });
  } catch (error) {
    next(error);
  }
};