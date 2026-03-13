// src/controllers/performanceController.js
// Performance Management & Monthly Snapshot Controller

const prisma = require("../lib/prisma");

// ============================================
// DAILY ACTIVITY LOG
// ============================================

// Get daily activities for an employee
exports.getDailyActivities = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate, metricName } = req.query;

    const where = { employeeId: parseInt(employeeId) };
    
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    
    if (metricName) {
      where.metricName = metricName;
    }

    const activities = await prisma.dailyActivityLog.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
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
      count: activities.length,
      data: activities
    });
  } catch (error) {
    next(error);
  }
};

// Create or update daily activity
exports.upsertDailyActivity = async (req, res, next) => {
  try {
    const { employeeId, date, taskId, metricName, actual, notes, profileComment } = req.body;

    if (!employeeId || !date || !taskId || !metricName || actual === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Check if activity date is in the past and locked
    const activityDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (activityDate < today) {
      // Check if this date is locked
      const existingActivity = await prisma.dailyActivityLog.findFirst({
        where: {
          employeeId: parseInt(employeeId),
          date: activityDate,
          isEditable: false
        }
      });

      if (existingActivity) {
        return res.status(403).json({
          success: false,
          message: 'This date is locked and cannot be modified'
        });
      }
    }

    // Verify employee and task exist
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(employeeId) }
    });

    const task = await prisma.task.findUnique({
      where: { id: parseInt(taskId) }
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const activityData = {
      employeeId: parseInt(employeeId),
      date: new Date(date),
      taskId: parseInt(taskId),
      metricName: metricName.trim(),
      actual: parseInt(actual),
      notes: notes?.trim() || null,
      profileComment: profileComment?.trim() || null
    };

    // Upsert the activity
    const activity = await prisma.dailyActivityLog.upsert({
      where: {
        employeeId_taskId_date: {
          employeeId: parseInt(employeeId),
          taskId: parseInt(taskId),
          date: activityDate
        }
      },
      update: activityData,
      create: activityData,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
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
      }
    });

    res.status(200).json({
      success: true,
      message: 'Activity logged successfully',
      data: activity
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// MONTHLY PERFORMANCE SNAPSHOT
// ============================================

// Get monthly performance for an employee
exports.getMonthlyPerformance = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { year, month } = req.query;

    const where = { employeeId: parseInt(employeeId) };
    
    if (year && month) {
      where.year = parseInt(year);
      where.month = parseInt(month);
    }

    const performances = await prisma.monthlyPerformance.findMany({
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
        },
        remarker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        },
        locker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    });

    res.status(200).json({
      success: true,
      count: performances.length,
      data: performances
    });
  } catch (error) {
    next(error);
  }
};

// Generate monthly performance snapshot
exports.generateMonthlyPerformance = async (req, res, next) => {
  try {
    const { employeeId, year, month } = req.body;

    if (!employeeId || !year || !month) {
      return res.status(400).json({
        success: false,
        message: 'Please provide employeeId, year, and month'
      });
    }

    const parsedEmployeeId = parseInt(employeeId);
    const parsedYear = parseInt(year);
    const parsedMonth = parseInt(month);

    // Check if performance snapshot already exists
    const existing = await prisma.monthlyPerformance.findUnique({
      where: {
        employeeId_year_month: {
          employeeId: parsedEmployeeId,
          year: parsedYear,
          month: parsedMonth
        }
      }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Performance snapshot already exists for this month'
      });
    }

    // Get employee details
    const employee = await prisma.employee.findUnique({
      where: { id: parsedEmployeeId },
      include: {
        designation: {
          select: { id: true, name: true }
        },
        dept: {
          select: { id: true, name: true }
        }
      }
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get tasks for the month
    const startDate = new Date(parsedYear, parsedMonth - 1, 1);
    const endDate = new Date(parsedYear, parsedMonth, 0, 23, 59, 59);

    const tasks = await prisma.task.findMany({
      where: {
        assignedToId: parsedEmployeeId,
        deadline: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        submissions: {
          where: {
            employeeId: parsedEmployeeId,
            date: {
              gte: startDate,
              lte: endDate
            }
          }
        }
      }
    });

    // Calculate metrics
    const totalTasks = tasks.length;
    const totalTarget = tasks.reduce((sum, task) => sum + task.target, 0);
    const totalAchieved = tasks.reduce((sum, task) => sum + task.achieved, 0);
    const achievementPercent = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

    // Breakdown by task type
    const dailyTasks = tasks.filter(t => t.type === 'daily');
    const weeklyTasks = tasks.filter(t => t.type === 'weekly');
    const monthlyTasks = tasks.filter(t => t.type === 'monthly');

    const dailyTarget = dailyTasks.reduce((sum, t) => sum + t.target, 0);
    const dailyAchieved = dailyTasks.reduce((sum, t) => sum + t.achieved, 0);
    const weeklyTarget = weeklyTasks.reduce((sum, t) => sum + t.target, 0);
    const weeklyAchieved = weeklyTasks.reduce((sum, t) => sum + t.achieved, 0);
    const monthlyTarget = monthlyTasks.reduce((sum, t) => sum + t.target, 0);
    const monthlyAchieved = monthlyTasks.reduce((sum, t) => sum + t.achieved, 0);

    // Calculate trend vs last month
    const lastMonthDate = new Date(parsedYear, parsedMonth - 2, 1);
    const lastMonthPerformance = await prisma.monthlyPerformance.findUnique({
      where: {
        employeeId_year_month: {
          employeeId: parsedEmployeeId,
          year: parsedMonth === 1 ? parsedYear - 1 : parsedYear,
          month: parsedMonth === 1 ? 12 : parsedMonth - 1
        }
      }
    });

    let trendVsLastMonth = 'stable';
    let percentageChange = 0;

    if (lastMonthPerformance) {
      const change = achievementPercent - lastMonthPerformance.achievementPercent;
      percentageChange = change;
      
      if (change > 5) {
        trendVsLastMonth = 'up';
      } else if (change < -5) {
        trendVsLastMonth = 'down';
      }
    }

    // Create performance snapshot
    const performance = await prisma.monthlyPerformance.create({
      data: {
        employeeId: parsedEmployeeId,
        year: parsedYear,
        month: parsedMonth,
        designationId: employee.designation?.id,
        departmentId: employee.dept?.id,
        totalTasksAssigned: totalTasks,
        totalTasksCompleted: tasks.filter(t => t.status === 'completed').length,
        totalTarget,
        totalAchieved,
        achievementPercent,
        dailyTarget,
        dailyAchieved,
        weeklyTarget,
        weeklyAchieved,
        monthlyTarget,
        monthlyAchieved,
        trendVsLastMonth,
        percentageChange
      },
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
      }
    });

    res.status(201).json({
      success: true,
      message: 'Monthly performance snapshot generated successfully',
      data: performance
    });
  } catch (error) {
    next(error);
  }
};

// Add remarks to monthly performance (Team Lead only)
exports.addPerformanceRemarks = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { teamLeadRemarks, remarkedBy } = req.body;

    if (!teamLeadRemarks || !remarkedBy) {
      return res.status(400).json({
        success: false,
        message: 'Please provide remarks and remarkedBy'
      });
    }

    const performance = await prisma.monthlyPerformance.findUnique({
      where: { id: parseInt(id) }
    });

    if (!performance) {
      return res.status(404).json({
        success: false,
        message: 'Performance record not found'
      });
    }

    if (performance.isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Cannot add remarks to locked performance record'
      });
    }

    const updatedPerformance = await prisma.monthlyPerformance.update({
      where: { id: parseInt(id) },
      data: {
        teamLeadRemarks: teamLeadRemarks.trim(),
        remarkedBy: parseInt(remarkedBy),
        remarkedAt: new Date()
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        },
        remarker: {
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
      message: 'Remarks added successfully',
      data: updatedPerformance
    });
  } catch (error) {
    next(error);
  }
};

// Lock monthly performance (Admin only - month-end)
exports.lockMonthlyPerformance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { lockedBy } = req.body;

    if (!lockedBy) {
      return res.status(400).json({
        success: false,
        message: 'Please provide lockedBy (admin ID)'
      });
    }

    const performance = await prisma.monthlyPerformance.findUnique({
      where: { id: parseInt(id) }
    });

    if (!performance) {
      return res.status(404).json({
        success: false,
        message: 'Performance record not found'
      });
    }

    if (performance.isLocked) {
      return res.status(400).json({
        success: false,
        message: 'Performance record is already locked'
      });
    }

    // Lock the performance record
    const updatedPerformance = await prisma.monthlyPerformance.update({
      where: { id: parseInt(id) },
      data: {
        isLocked: true,
        lockedBy: parseInt(lockedBy),
        lockedAt: new Date()
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        },
        locker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    // Also lock all daily activities for this month
    const startDate = new Date(performance.year, performance.month - 1, 1);
    const endDate = new Date(performance.year, performance.month, 0, 23, 59, 59);

    await prisma.dailyActivityLog.updateMany({
      where: {
        employeeId: performance.employeeId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      data: {
        isEditable: false,
        lockedAt: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Monthly performance locked successfully',
      data: updatedPerformance
    });
  } catch (error) {
    next(error);
  }
};

// Get team performance summary (for Team Lead dashboard)
exports.getTeamPerformanceSummary = async (req, res, next) => {
  try {
    const { teamLeadId, year, month } = req.query;

    if (!teamLeadId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide teamLeadId'
      });
    }

    const parsedTeamLeadId = parseInt(teamLeadId);

    // Get team members (employees under this team lead using reportTo field)
    const teamMembers = await prisma.employee.findMany({
      where: {
        reportTo: parsedTeamLeadId,
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        department: true,
        position: true,
        avatar: true
      }
    });

    if (teamMembers.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          summary: {
            totalMembers: 0,
            membersWithPerformance: 0,
            averageAchievement: 0,
            topPerformer: null,
            underperformers: [],
            trend: { up: 0, down: 0, stable: 0 }
          },
          performances: [],
          teamMembers: []
        }
      });
    }

    const where = {
      employeeId: {
        in: teamMembers.map(m => m.id)
      }
    };

    if (year && month) {
      where.year = parseInt(year);
      where.month = parseInt(month);
    }

    const performances = await prisma.monthlyPerformance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            department: true,
            position: true,
            avatar: true
          }
        }
      },
      orderBy: {
        achievementPercent: 'desc'
      }
    });

    // Calculate team summary
    const teamSummary = {
      totalMembers: teamMembers.length,
      membersWithPerformance: performances.length,
      averageAchievement: performances.length > 0 
        ? performances.reduce((sum, p) => sum + p.achievementPercent, 0) / performances.length 
        : 0,
      topPerformer: performances[0] || null,
      underperformers: performances.filter(p => p.achievementPercent < 70),
      trend: {
        up: performances.filter(p => p.trendVsLastMonth === 'up').length,
        down: performances.filter(p => p.trendVsLastMonth === 'down').length,
        stable: performances.filter(p => p.trendVsLastMonth === 'stable').length
      }
    };

    res.status(200).json({
      success: true,
      data: {
        summary: teamSummary,
        performances,
        teamMembers
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get company-wide performance (Admin dashboard)
exports.getCompanyPerformance = async (req, res, next) => {
  try {
    const { year, month, departmentId } = req.query;

    const where = {};
    if (year && month) {
      where.year = parseInt(year);
      where.month = parseInt(month);
    }
    if (departmentId) {
      where.departmentId = parseInt(departmentId);
    }

    const performances = await prisma.monthlyPerformance.findMany({
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
        },
        dept: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        achievementPercent: 'desc'
      }
    });

    // Department-wise breakdown
    const departmentBreakdown = performances.reduce((acc, perf) => {
      const deptName = perf.dept?.name || 'Unknown';
      if (!acc[deptName]) {
        acc[deptName] = {
          departmentId: perf.departmentId,
          name: deptName,
          employees: 0,
          avgAchievement: 0,
          totalTarget: 0,
          totalAchieved: 0
        };
      }
      
      acc[deptName].employees++;
      acc[deptName].totalTarget += perf.totalTarget;
      acc[deptName].totalAchieved += perf.totalAchieved;
      acc[deptName].avgAchievement = acc[deptName].totalTarget > 0 
        ? (acc[deptName].totalAchieved / acc[deptName].totalTarget) * 100 
        : 0;
      
      return acc;
    }, {});

    const companySummary = {
      totalEmployees: performances.length,
      averageAchievement: performances.length > 0 
        ? performances.reduce((sum, p) => sum + p.achievementPercent, 0) / performances.length 
        : 0,
      totalTarget: performances.reduce((sum, p) => sum + p.totalTarget, 0),
      totalAchieved: performances.reduce((sum, p) => sum + p.totalAchieved, 0),
      departmentBreakdown: Object.values(departmentBreakdown),
      topPerformers: performances.slice(0, 10),
      underperformers: performances.filter(p => p.achievementPercent < 70)
    };

    res.status(200).json({
      success: true,
      data: companySummary
    });
  } catch (error) {
    next(error);
  }
};
// Bulk lock monthly performance for a month (Admin only - month-end close)
exports.bulkLockMonthlyPerformance = async (req, res, next) => {
  try {
    const { year, month, lockedBy, departmentId } = req.body;

    if (!year || !month || !lockedBy) {
      return res.status(400).json({
        success: false,
        message: 'Please provide year, month, and lockedBy (admin ID)'
      });
    }

    // Find all performance records for this month
    const where = {
      year: parseInt(year),
      month: parseInt(month),
      isLocked: false  // Only lock unlocked records
    };

    if (departmentId) {
      where.departmentId = parseInt(departmentId);
    }

    const performancesToLock = await prisma.monthlyPerformance.findMany({ where });

    if (performancesToLock.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No unlocked performance records found for this month'
      });
    }

    // Lock all performance records
    const lockedPerformances = await Promise.all(
      performancesToLock.map(perf =>
        prisma.monthlyPerformance.update({
          where: { id: perf.id },
          data: {
            isLocked: true,
            lockedBy: parseInt(lockedBy),
            lockedAt: new Date()
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
        })
      )
    );

    // Also lock all daily activities for this month across all affected employees
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    const employeeIds = performancesToLock.map(p => p.employeeId);
    
    await prisma.dailyActivityLog.updateMany({
      where: {
        employeeId: { in: employeeIds },
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      data: {
        isEditable: false,
        lockedAt: new Date()
      }
    });

    // Also lock all tasks for this month
    await prisma.task.updateMany({
      where: {
        assignedToId: { in: employeeIds },
        deadline: {
          gte: startDate,
          lte: endDate
        }
      },
      data: {
        isLocked: true,
        lockDate: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: `Successfully locked ${lockedPerformances.length} performance records for ${year}-${String(month).padStart(2, '0')}`,
      data: {
        totalLocked: lockedPerformances.length,
        month,
        year,
        lockedAt: new Date(),
        lockedPerformances
      }
    });
  } catch (error) {
    next(error);
  }
};