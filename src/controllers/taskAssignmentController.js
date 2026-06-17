// src/controllers/taskAssignmentController.js
// Enhanced Task Assignment with Role-based Targets

const prisma = require("../lib/prisma");

// ============================================
// ROLE-BASED TASK ASSIGNMENT
// ============================================

// Get default KPIs for an employee's designation
exports.getEmployeeDefaultKPIs = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { type } = req.query;

    // Get employee with designation
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(employeeId) },
      include: {
        designation: {
          include: {
            defaultKPIs: {
              where: { isActive: true },
              orderBy: { type: 'asc' }
            }
          }
        }
      }
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    if (!employee.designation) {
      return res.status(400).json({
        success: false,
        message: 'Employee has no designation assigned'
      });
    }

    let kpis = employee.designation.defaultKPIs;
    
    // Filter by type if specified
    if (type && type !== 'all') {
      kpis = kpis.filter(kpi => kpi.type === type);
    }

    res.status(200).json({
      success: true,
      data: {
        employee: {
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          employeeId: employee.employeeId,
          designation: employee.designation.name
        },
        kpis
      }
    });
  } catch (error) {
    next(error);
  }
};

// Create tasks based on designation defaults
exports.createTasksFromDefaults = async (req, res, next) => {
  try {
    const { employeeId, assignedById, type, startDate, endDate } = req.body;

    if (!employeeId || !assignedById || !type || !startDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide employeeId, assignedById, type, and startDate'
      });
    }

    // Validate type
    const validTypes = ['daily', 'weekly', 'monthly'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Type must be one of: ${validTypes.join(', ')}`
      });
    }

    // Get employee and designation
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(employeeId) },
      include: {
        designation: {
          include: {
            defaultKPIs: {
              where: { 
                type: type,
                isActive: true 
              }
            }
          }
        }
      }
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    if (!employee.designation) {
      return res.status(400).json({
        success: false,
        message: 'Employee has no designation assigned'
      });
    }

    if (employee.designation.defaultKPIs.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No default KPIs found for ${type} tasks in this designation`
      });
    }

    // Check assigner exists
    const assigner = await prisma.employee.findUnique({
      where: { id: parseInt(assignedById) }
    });

    if (!assigner) {
      return res.status(404).json({
        success: false,
        message: 'Assigning user not found'
      });
    }

    const createdTasks = [];
    const start = new Date(startDate);

    // Calculate task creation based on type
    if (type === 'daily') {
      // Create daily tasks for each KPI
      for (const kpi of employee.designation.defaultKPIs) {
        const task = await prisma.task.create({
          data: {
            title: `${kpi.metricName} - ${type}`,
            description: `Auto-generated ${type} task based on designation defaults`,
            type: kpi.type,
            category: kpi.category,
            target: kpi.defaultTarget,
            unit: kpi.unit,
            deadline: new Date(start.getTime() + (24 * 60 * 60 * 1000)), // Next day
            priority: 'medium',
            assignedToId: parseInt(employeeId),
            assignedById: parseInt(assignedById),
            notes: `Default target for ${employee.designation.name}: ${kpi.defaultTarget} ${kpi.unit}`
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
        createdTasks.push(task);
      }
    } else if (type === 'weekly') {
      // Create weekly tasks
      const weekEnd = new Date(start.getTime() + (7 * 24 * 60 * 60 * 1000));
      
      for (const kpi of employee.designation.defaultKPIs) {
        const task = await prisma.task.create({
          data: {
            title: `${kpi.metricName} - ${type}`,
            description: `Auto-generated ${type} task based on designation defaults`,
            type: kpi.type,
            category: kpi.category,
            target: kpi.defaultTarget,
            unit: kpi.unit,
            deadline: weekEnd,
            priority: 'medium',
            assignedToId: parseInt(employeeId),
            assignedById: parseInt(assignedById),
            notes: `Default target for ${employee.designation.name}: ${kpi.defaultTarget} ${kpi.unit}`
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
        createdTasks.push(task);
      }
    } else if (type === 'monthly') {
      // Create monthly tasks
      const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      
      for (const kpi of employee.designation.defaultKPIs) {
        // Use target range for monthly if available
        const target = kpi.targetMax || kpi.defaultTarget;
        
        const task = await prisma.task.create({
          data: {
            title: `${kpi.metricName} - ${type}`,
            description: `Auto-generated ${type} task based on designation defaults`,
            type: kpi.type,
            category: kpi.category,
            target: target,
            unit: kpi.unit,
            deadline: monthEnd,
            priority: 'medium',
            assignedToId: parseInt(employeeId),
            assignedById: parseInt(assignedById),
            notes: `Default target for ${employee.designation.name}: ${kpi.targetMin || kpi.defaultTarget}-${kpi.targetMax || kpi.defaultTarget} ${kpi.unit}`
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
        createdTasks.push(task);
      }
    }

    res.status(201).json({
      success: true,
      message: `Created ${createdTasks.length} ${type} tasks successfully`,
      data: {
        employee: {
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          employeeId: employee.employeeId,
          designation: employee.designation.name
        },
        tasks: createdTasks,
        summary: {
          totalTasks: createdTasks.length,
          type,
          createdFor: start.toISOString().split('T')[0]
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// TEAM LEAD AUTHORITY FEATURES
// ============================================

// Adjust task target (Team Lead only)
exports.adjustTaskTarget = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { newTarget, adjustedBy, reason } = req.body;

    if (!newTarget || !adjustedBy) {
      return res.status(400).json({
        success: false,
        message: 'Please provide newTarget and adjustedBy'
      });
    }

    const parsedTarget = parseInt(newTarget);
    if (isNaN(parsedTarget) || parsedTarget <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Target must be a positive integer'
      });
    }

    // Step 1: fetch the task itself first (type/category needed for the KPI filter below)
    const task = await prisma.task.findUnique({
      where: { id: parseInt(taskId) }
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (task.isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Cannot adjust target for a locked task'
      });
    }

    // Step 2: now fetch the designation's default KPI using the task's own type/category
    const taskWithDesignation = await prisma.task.findUnique({
      where: { id: parseInt(taskId) },
      include: {
        assignedTo: {
          include: {
            designation: {
              include: {
                defaultKPIs: {
                  where: {
                    type: task.type,
                    category: task.category,
                    isActive: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Get default KPI for validation
    const defaultKPI = taskWithDesignation?.assignedTo?.designation?.defaultKPIs[0];
    if (defaultKPI) {
      const minAllowed = Math.floor(defaultKPI.defaultTarget * 0.8); // 20% reduction
      const maxAllowed = Math.ceil(defaultKPI.defaultTarget * 1.2);   // 20% increase

      if (parsedTarget < minAllowed || parsedTarget > maxAllowed) {
        return res.status(400).json({
          success: false,
          message: `Target adjustment not allowed. Must be between ${minAllowed} and ${maxAllowed} (±20% of default)`
        });
      }
    }

    // Update task with adjustment tracking
    const updatedTask = await prisma.task.update({
      where: { id: parseInt(taskId) },
      data: {
        target: parsedTarget,
        originalTarget: task.target,
        adjustedBy: parseInt(adjustedBy),
        adjustedDate: new Date(),
        notes: `${task.notes || ''}\n\n[ADJUSTED] ${new Date().toISOString().split('T')[0]}: Target changed from ${task.target} to ${parsedTarget}. Reason: ${reason || 'Not specified'}`
      },
      include: {
        assignedTo: {
          select: {
            id: true, firstName: true, lastName: true,
            employeeId: true, email: true, department: true,
            position: true, avatar: true
          }
        },
        adjuster: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Task target adjusted successfully',
      data: updatedTask
    });
  } catch (error) {
    next(error);
  }
};

// Get tasks for team management (Team Lead dashboard)
exports.getTeamTasks = async (req, res, next) => {
  try {
    const { teamLeadId } = req.query;
    const { type, status, startDate, endDate } = req.query;

    if (!teamLeadId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide teamLeadId'
      });
    }

    // Get team members reporting to this team lead
    const parsedTeamLeadId = parseInt(teamLeadId);
    const teamMembers = await prisma.employee.findMany({
      where: {
        isActive: true,
        reportTo: parsedTeamLeadId
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        department: true,
        position: true,
        designation: {
          select: { id: true, name: true }
        }
      }
    });

    const where = {
      assignedToId: {
        // Include team members AND the team lead themselves
        // (admins can assign tasks directly to the team lead)
        in: [...teamMembers.map(m => m.id), parsedTeamLeadId]
      }
    };

    if (type && type !== 'all') where.type = type;
    if (status && status !== 'all') where.status = status;
    
    if (startDate && endDate) {
      where.deadline = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignedTo: {
          select: {
            id: true, firstName: true, lastName: true,
            employeeId: true, department: true, position: true,
            designation: { select: { name: true } },
            avatar: true
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
      orderBy: { deadline: 'asc' }
    });

    // Calculate team statistics
    const stats = {
      totalTasks: tasks.length,
      activeTasks: tasks.filter(t => t.status === 'active').length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      overdueTasks: tasks.filter(t => t.status === 'overdue').length,
      totalTarget: tasks.reduce((sum, t) => sum + t.target, 0),
      totalAchieved: tasks.reduce((sum, t) => sum + t.achieved, 0),
      teamMembers: teamMembers.length,
      completionRate: tasks.length > 0 
        ? Math.round((tasks.reduce((sum, t) => sum + t.achieved, 0) / tasks.reduce((sum, t) => sum + t.target, 0)) * 100)
        : 0
    };

    res.status(200).json({
      success: true,
      data: {
        tasks,
        stats,
        teamMembers,
        filters: { type, status, startDate, endDate }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// BATCH OPERATIONS
// ============================================

// Create tasks for multiple employees
exports.createBatchTasks = async (req, res, next) => {
  try {
    const { employeeIds, assignedById, type, startDate } = req.body;

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of employeeIds'
      });
    }

    if (!assignedById || !type || !startDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide assignedById, type, and startDate'
      });
    }

    const results = [];
    const errors = [];

    for (const employeeId of employeeIds) {
      try {
        // Reuse the single employee task creation logic
        const result = await exports.createTasksFromDefaults({
          params: { employeeId },
          body: { employeeId, assignedById, type, startDate }
        });
        
        if (result.statusCode === 201) {
          results.push({
            employeeId,
            success: true,
            tasksCreated: result.body.data.tasks.length
          });
        } else {
          errors.push({
            employeeId,
            success: false,
            error: result.body.message
          });
        }
      } catch (error) {
        errors.push({
          employeeId,
          success: false,
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Batch task creation completed. Success: ${results.length}, Errors: ${errors.length}`,
      data: {
        results,
        errors,
        summary: {
          totalEmployees: employeeIds.length,
          successful: results.length,
          failed: errors.length,
          totalTasksCreated: results.reduce((sum, r) => sum + r.tasksCreated, 0)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
