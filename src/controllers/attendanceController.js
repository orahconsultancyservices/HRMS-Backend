// src/controllers/attendanceController.js - IMPROVED WITH CONSISTENT TIMEZONE HANDLING
const prisma = require("../lib/prisma");

// Import centralized timezone utilities
const { timezoneUtils } = require('../utils/timezoneUtils');

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get database employee ID from either numeric ID or employee code
 * Handles both formats: numeric ID (1, 2, 3) and employee codes (EMP001, EMP002)
 */
const getDatabaseEmployeeId = async (employeeIdentifier) => {
  try {
    console.log('🔄 getDatabaseEmployeeId called with:', employeeIdentifier);

    // If numeric, use directly
    if (!isNaN(parseInt(employeeIdentifier))) {
      const id = parseInt(employeeIdentifier);
      console.log('✅ Using numeric ID directly:', id);

      const employee = await prisma.employee.findUnique({
        where: { id: id }
      });

      if (!employee) {
        throw new Error(`Employee not found with ID: ${id}`);
      }

      return id;
    }

    // Otherwise, lookup by employee code
    console.log('🔍 Looking up employee by code:', employeeIdentifier);

    const employee = await prisma.employee.findUnique({
      where: { employeeId: employeeIdentifier.toString() }
    });

    if (!employee) {
      throw new Error(`Employee not found with code: ${employeeIdentifier}`);
    }

    console.log(`✅ Converted code ${employeeIdentifier} to database ID: ${employee.id}`);
    return employee.id;

  } catch (error) {
    console.error('❌ Error in getDatabaseEmployeeId:', error.message);
    throw error;
  }
};

/**
 * Calculate total break time for attendance records
 * Adds break time to each attendance record
 */
const calculateBreakTimeForRecords = async (attendanceRecords) => {
  return await Promise.all(
    attendanceRecords.map(async (record) => {
      const breaks = await prisma.break.findMany({
        where: {
          employeeId: record.employeeId,
          date: record.date,
          status: 'completed'
        }
      });
      
      const totalBreakMinutes = breaks.reduce((sum, brk) => sum + (brk.duration || 0), 0);
      
      return {
        ...record,
        breaks: totalBreakMinutes
      };
    })
  );
};

/**
 * Calculate work hours with break deduction
 */
const calculateWorkHours = (checkIn, checkOut, breakMinutes = 0) => {
  if (!checkIn || !checkOut) return 0;
  
  const diffMs = new Date(checkOut) - new Date(checkIn);
  let hours = diffMs / (1000 * 60 * 60);
  
  // Subtract break time
  hours -= breakMinutes / 60;
  
  return Math.max(0, parseFloat(hours.toFixed(2)));
};

/**
 * Determine attendance status based on check-in time and hours worked
 */
const determineStatus = (checkIn, totalHours = 0) => {
  if (!checkIn) return 'absent';
  
  const checkInEST = timezoneUtils.toEST(checkIn);
  const hour = checkInEST.getHours();
  const minute = checkInEST.getMinutes();
  
  // Late if after 9:30 AM
  const isLate = hour > 9 || (hour === 9 && minute > 30);
  
  // Half day if less than 4 hours worked
  const isHalfDay = totalHours > 0 && totalHours < 4;
  
  if (isHalfDay) return 'half_day';
  if (isLate) return 'late';
  return 'present';
};

// ============================================
// MAIN CONTROLLER FUNCTIONS
// ============================================

/**
 * Get all attendance records with filters
 * Supports: employeeId, department, status, date range, pagination
 */
exports.getAllAttendance = async (req, res, next) => {
  try {
    const {
      employeeId,
      department,
      startDate,
      endDate,
      status,
      page = 1,
      limit = 50
    } = req.query;

    const where = {};
    const include = {
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
    };

    // Apply filters
    if (employeeId && employeeId !== 'all') {
      where.employeeId = parseInt(employeeId);
    }

    if (department && department !== 'all') {
      where.employee = {
        department: department
      };
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    // Date range filter with EST timezone handling
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = timezoneUtils.toMidnightEST(new Date(startDate));
      }
      if (endDate) {
        where.date.lte = timezoneUtils.toEndOfDayEST(new Date(endDate));
      }
    }

    console.log('📥 Fetching attendance with filters:', where);

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Get attendance records
    const attendance = await prisma.attendance.findMany({
      where,
      include,
      orderBy: { date: 'desc' },
      skip,
      take
    });

    // Add break time to each record
    const attendanceWithBreaks = await calculateBreakTimeForRecords(attendance);

    // Get total count for pagination
    const total = await prisma.attendance.count({ where });

    // Calculate statistics
    const stats = {
      present: await prisma.attendance.count({ where: { ...where, status: 'present' } }),
      absent: await prisma.attendance.count({ where: { ...where, status: 'absent' } }),
      late: await prisma.attendance.count({ where: { ...where, status: 'late' } }),
      half_day: await prisma.attendance.count({ where: { ...where, status: 'half_day' } }),
      on_leave: await prisma.attendance.count({ where: { ...where, status: 'on_leave' } })
    };

    res.status(200).json({
      success: true,
      count: attendanceWithBreaks.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      stats,
      data: attendanceWithBreaks,
      timezone: timezoneUtils.getTimezoneInfo()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get attendance by ID
 */
exports.getAttendanceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const attendance = await prisma.attendance.findUnique({
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
            avatar: true,
            email: true,
            phone: true
          }
        }
      }
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    // Add break time
    const breaks = await prisma.break.findMany({
      where: {
        employeeId: attendance.employeeId,
        date: attendance.date,
        status: 'completed'
      }
    });

    const totalBreakMinutes = breaks.reduce((sum, brk) => sum + (brk.duration || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        ...attendance,
        breaks: totalBreakMinutes,
        breakDetails: breaks
      },
      timezone: timezoneUtils.getTimezoneInfo()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get employee's attendance with optional filters
 * Supports: startDate, endDate, month, year
 */
exports.getEmployeeAttendance = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate, month, year } = req.query;

    const databaseEmployeeId = await getDatabaseEmployeeId(employeeId);

    const where = {
      employeeId: databaseEmployeeId
    };

    // Apply date filters with EST timezone
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = timezoneUtils.toMidnightEST(new Date(startDate));
      }
      if (endDate) {
        where.date.lte = timezoneUtils.toEndOfDayEST(new Date(endDate));
      }
    } else if (month && year) {
      where.date = {
        gte: timezoneUtils.getMonthStart(parseInt(year), parseInt(month) - 1),
        lte: timezoneUtils.getMonthEnd(parseInt(year), parseInt(month) - 1)
      };
    }

    console.log('📅 Fetching employee attendance:', where);

    const attendance = await prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    // Add break time to each record
    const attendanceWithBreaks = await calculateBreakTimeForRecords(attendance);

    // Calculate statistics
    const stats = {
      present: attendanceWithBreaks.filter(a => a.status === 'present').length,
      absent: attendanceWithBreaks.filter(a => a.status === 'absent').length,
      late: attendanceWithBreaks.filter(a => a.status === 'late').length,
      half_day: attendanceWithBreaks.filter(a => a.status === 'half_day').length,
      on_leave: attendanceWithBreaks.filter(a => a.status === 'on_leave').length,
      totalHours: attendanceWithBreaks.reduce((acc, curr) => acc + (curr.totalHours || 0), 0)
    };

    res.status(200).json({
      success: true,
      count: attendanceWithBreaks.length,
      stats,
      data: attendanceWithBreaks,
      timezone: timezoneUtils.getTimezoneInfo()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clock in for the day
 * Creates attendance record with current EST time
 */
exports.clockIn = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    console.log('🔵 Clock In Request (EST):', {
      employeeId,
      body: req.body,
      timezone: timezoneUtils.getTimezoneInfo()
    });

    const databaseEmployeeId = await getDatabaseEmployeeId(employeeId);

    // Get today's date in EST at midnight
    const today = timezoneUtils.toMidnightEST();
    console.log('📅 Today in EST:', timezoneUtils.formatDate(today));

    // Check if already clocked in
    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: databaseEmployeeId,
          date: today
        }
      }
    });

    if (existingAttendance && existingAttendance.checkIn) {
      return res.status(400).json({
        success: false,
        message: 'Already clocked in today',
        data: existingAttendance
      });
    }

    // Get current time in EST
    const checkInTime = timezoneUtils.now();
    console.log('🕒 Check-in time in EST:', timezoneUtils.formatTime(checkInTime));

    // Determine initial status
    const status = determineStatus(checkInTime);

    const { location, notes } = req.body || {};

    // Create or update attendance record
    const attendance = await prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId: databaseEmployeeId,
          date: today
        }
      },
      update: {
        checkIn: checkInTime,
        status: status,
        location: location || existingAttendance?.location,
        notes: notes || existingAttendance?.notes,
        updatedAt: timezoneUtils.now()
      },
      create: {
        employeeId: databaseEmployeeId,
        date: today,
        checkIn: checkInTime,
        status: status,
        location: location || null,
        notes: notes || null,
        createdBy: employeeId.toString()
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Successfully clocked in',
      data: attendance,
      timezone: timezoneUtils.getTimezoneInfo()
    });
  } catch (error) {
    console.error('❌ Clock in error:', error);
    next(error);
  }
};

/**
 * Clock out for the day
 * Updates attendance record with check-out time and calculates total hours
 */
exports.clockOut = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    console.log('🔵 Clock Out Request (EST):', {
      employeeId,
      timezone: timezoneUtils.getTimezoneInfo()
    });

    const databaseEmployeeId = await getDatabaseEmployeeId(employeeId);

    const { location, notes } = req.body || {};

    // Get today's date in EST at midnight
    const today = timezoneUtils.toMidnightEST();

    const attendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: databaseEmployeeId,
          date: today
        }
      }
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'No clock-in record found for today. Please clock in first.'
      });
    }

    if (attendance.checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Already clocked out today',
        data: attendance
      });
    }

    // Get current time in EST
    const checkOutTime = timezoneUtils.now();
    console.log('🕒 Check-out time in EST:', timezoneUtils.formatTime(checkOutTime));

    // Get break time
    const breaks = await prisma.break.findMany({
      where: {
        employeeId: databaseEmployeeId,
        date: today,
        status: 'completed'
      }
    });

    const breakMinutes = breaks.reduce((acc, curr) => acc + (curr.duration || 0), 0);

    // Calculate total hours
    const totalHours = calculateWorkHours(attendance.checkIn, checkOutTime, breakMinutes);

    // Update status based on hours worked
    const finalStatus = determineStatus(attendance.checkIn, totalHours);

    const updatedAttendance = await prisma.attendance.update({
      where: {
        employeeId_date: {
          employeeId: databaseEmployeeId,
          date: today
        }
      },
      data: {
        checkOut: checkOutTime,
        totalHours: totalHours,
        status: finalStatus,
        location: location || attendance.location,
        notes: notes || attendance.notes,
        updatedAt: timezoneUtils.now()
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Successfully clocked out',
      data: {
        ...updatedAttendance,
        breaks: breakMinutes
      },
      timezone: timezoneUtils.getTimezoneInfo()
    });
  } catch (error) {
    console.error('❌ Clock out error:', error);
    next(error);
  }
};

/**
 * Get today's attendance status
 * Returns current attendance record for today in EST
 */
exports.getTodayStatus = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    console.log('🔍 getTodayStatus called (EST):', employeeId);

    const databaseEmployeeId = await getDatabaseEmployeeId(employeeId);

    // Get today's date in EST at midnight
    const today = timezoneUtils.toMidnightEST();
    console.log('📅 Checking attendance for EST date:', timezoneUtils.formatDate(today));

    const attendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: databaseEmployeeId,
          date: today
        }
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    // Get active break if any
    const activeBreak = await prisma.break.findFirst({
      where: {
        employeeId: databaseEmployeeId,
        date: today,
        status: 'active'
      }
    });

    // Set cache control headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    console.log('✅ getTodayStatus result:', attendance ? 'Found' : 'Not found');

    res.status(200).json({
      success: true,
      data: attendance || null,
      activeBreak: activeBreak || null,
      isOnBreak: !!activeBreak,
      timezone: timezoneUtils.getTimezoneInfo(),
      estDate: timezoneUtils.formatDate(today)
    });

  } catch (error) {
    console.error('❌ Error in getTodayStatus:', error);
    next(error);
  }
};

/**
 * Mark attendance manually (admin function)
 * Allows admin to create/update attendance records
 */
exports.markAttendance = async (req, res, next) => {
  try {
    const { employeeId, date, status, checkIn, checkOut, notes } = req.body;

    if (!employeeId || !date || !status) {
      return res.status(400).json({
        success: false,
        message: 'Please provide employeeId, date, and status'
      });
    }

    const attendanceDate = timezoneUtils.toMidnightEST(new Date(date));

    let totalHours = 0;
    let breakMinutes = 0;

    // Calculate hours if both check-in and check-out provided
    if (checkIn && checkOut) {
      // Get breaks for this day
      const breaks = await prisma.break.findMany({
        where: {
          employeeId: parseInt(employeeId),
          date: attendanceDate,
          status: 'completed'
        }
      });
      breakMinutes = breaks.reduce((acc, curr) => acc + (curr.duration || 0), 0);
      totalHours = calculateWorkHours(checkIn, checkOut, breakMinutes);
    }

    const attendance = await prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId: parseInt(employeeId),
          date: attendanceDate
        }
      },
      update: {
        status,
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        totalHours: totalHours > 0 ? totalHours : null,
        notes,
        updatedAt: timezoneUtils.now(),
        updatedBy: req.user?.id?.toString() || 'admin'
      },
      create: {
        employeeId: parseInt(employeeId),
        date: attendanceDate,
        status,
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        totalHours: totalHours > 0 ? totalHours : null,
        notes,
        createdBy: req.user?.id?.toString() || 'admin'
      },
      include: {
        employee: {
          select: {
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
      message: 'Attendance marked successfully',
      data: {
        ...attendance,
        breaks: breakMinutes
      },
      timezone: timezoneUtils.getTimezoneInfo()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update attendance record
 * Allows editing check-in/check-out times and notes
 */
exports.updateAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { checkIn, checkOut, notes, status } = req.body;

    console.log('📝 Updating attendance (EST):', { id, checkIn, checkOut, notes, status });

    const attendance = await prisma.attendance.findUnique({
      where: { id: parseInt(id) }
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    // Recalculate hours if times are updated
    let totalHours = attendance.totalHours;
    if (checkIn || checkOut) {
      const newCheckIn = checkIn ? new Date(checkIn) : attendance.checkIn;
      const newCheckOut = checkOut ? new Date(checkOut) : attendance.checkOut;

      if (newCheckIn && newCheckOut) {
        // Get breaks
        const breaks = await prisma.break.findMany({
          where: {
            employeeId: attendance.employeeId,
            date: attendance.date,
            status: 'completed'
          }
        });
        const breakMinutes = breaks.reduce((acc, curr) => acc + (curr.duration || 0), 0);
        totalHours = calculateWorkHours(newCheckIn, newCheckOut, breakMinutes);
      }
    }

    // Determine final status
    const finalStatus = status || (checkIn ? determineStatus(checkIn, totalHours) : attendance.status);

    const updatedAttendance = await prisma.attendance.update({
      where: { id: parseInt(id) },
      data: {
        checkIn: checkIn ? new Date(checkIn) : attendance.checkIn,
        checkOut: checkOut ? new Date(checkOut) : attendance.checkOut,
        totalHours: totalHours,
        notes: notes !== undefined ? notes : attendance.notes,
        status: finalStatus,
        updatedAt: timezoneUtils.now(),
        updatedBy: req.user?.id?.toString() || 'admin'
      },
      include: {
        employee: {
          select: {
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
      message: 'Attendance updated successfully',
      data: updatedAttendance,
      timezone: timezoneUtils.getTimezoneInfo()
    });
  } catch (error) {
    console.error('❌ Update attendance error:', error);
    next(error);
  }
};

/**
 * Delete attendance record
 */
exports.deleteAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;

    const attendance = await prisma.attendance.findUnique({
      where: { id: parseInt(id) }
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    await prisma.attendance.delete({
      where: { id: parseInt(id) }
    });

    res.status(200).json({
      success: true,
      message: 'Attendance record deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk mark attendance (admin function)
 * Mark attendance for multiple employees at once
 */
exports.bulkMarkAttendance = async (req, res, next) => {
  try {
    const { employees, date, status, notes } = req.body;

    if (!employees || !employees.length || !date || !status) {
      return res.status(400).json({
        success: false,
        message: 'Please provide employees array, date, and status'
      });
    }

    const attendanceDate = timezoneUtils.toMidnightEST(new Date(date));

    const results = [];
    const errors = [];

    for (const employeeId of employees) {
      try {
        const attendance = await prisma.attendance.upsert({
          where: {
            employeeId_date: {
              employeeId: parseInt(employeeId),
              date: attendanceDate
            }
          },
          update: {
            status,
            notes,
            updatedAt: timezoneUtils.now(),
            updatedBy: req.user?.id?.toString() || 'admin'
          },
          create: {
            employeeId: parseInt(employeeId),
            date: attendanceDate,
            status,
            notes,
            createdBy: req.user?.id?.toString() || 'admin'
          }
        });

        results.push(attendance);
      } catch (error) {
        errors.push({
          employeeId,
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Attendance marked for ${results.length} employees`,
      results,
      errors,
      timezone: timezoneUtils.getTimezoneInfo()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get attendance statistics
 * Returns aggregated stats for a date range
 */
exports.getAttendanceStats = async (req, res, next) => {
  try {
    const { department, startDate, endDate } = req.query;

    const where = {};

    if (department && department !== 'all') {
      where.employee = {
        department: department
      };
    }

    // Default to current month if no date range provided
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = timezoneUtils.toMidnightEST(new Date(startDate));
      }
      if (endDate) {
        where.date.lte = timezoneUtils.toEndOfDayEST(new Date(endDate));
      }
    } else {
      const now = timezoneUtils.now();
      where.date = {
        gte: timezoneUtils.getMonthStart(now.getFullYear(), now.getMonth()),
        lte: timezoneUtils.getMonthEnd(now.getFullYear(), now.getMonth())
      };
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            department: true
          }
        }
      }
    });

    const stats = {
      totalEmployees: await prisma.employee.count({
        where: department && department !== 'all' ? { department } : {}
      }),
      totalRecords: attendance.length,
      present: attendance.filter(a => a.status === 'present').length,
      absent: attendance.filter(a => a.status === 'absent').length,
      late: attendance.filter(a => a.status === 'late').length,
      half_day: attendance.filter(a => a.status === 'half_day').length,
      on_leave: attendance.filter(a => a.status === 'on_leave').length,
      averageHours: attendance.length > 0
        ? attendance.reduce((acc, curr) => acc + (curr.totalHours || 0), 0) / attendance.length
        : 0
    };

    // Department breakdown
    const departmentBreakdown = {};
    attendance.forEach(record => {
      const dept = record.employee.department;
      if (!departmentBreakdown[dept]) {
        departmentBreakdown[dept] = {
          present: 0,
          absent: 0,
          late: 0,
          half_day: 0,
          on_leave: 0,
          total: 0
        };
      }
      departmentBreakdown[dept][record.status]++;
      departmentBreakdown[dept].total++;
    });

    res.status(200).json({
      success: true,
      data: {
        stats,
        departmentBreakdown
      },
      timezone: timezoneUtils.getTimezoneInfo()
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// BREAK MANAGEMENT
// ============================================

/**
 * Start a break
 */
exports.startBreak = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { reason } = req.body || {};

    const databaseEmployeeId = await getDatabaseEmployeeId(employeeId);

    const today = timezoneUtils.toMidnightEST();

    // Check for active break
    const activeBreak = await prisma.break.findFirst({
      where: {
        employeeId: databaseEmployeeId,
        date: today,
        status: 'active'
      }
    });

    if (activeBreak) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active break'
      });
    }

    const breakRecord = await prisma.break.create({
      data: {
        employeeId: databaseEmployeeId,
        date: today,
        startTime: timezoneUtils.now(),
        reason: reason || null,
        status: 'active'
      }
    });

    res.status(200).json({
      success: true,
      message: 'Break started',
      data: breakRecord,
      timezone: timezoneUtils.getTimezoneInfo()
    });
  } catch (error) {
    console.error('❌ Start break error:', error);
    next(error);
  }
};

/**
 * End a break
 */
exports.endBreak = async (req, res, next) => {
  try {
    const { employeeId, breakId } = req.params;

    const databaseEmployeeId = await getDatabaseEmployeeId(employeeId);

    const breakRecord = await prisma.break.findFirst({
      where: {
        id: parseInt(breakId),
        employeeId: databaseEmployeeId,
        status: 'active'
      }
    });

    if (!breakRecord) {
      return res.status(404).json({
        success: false,
        message: 'Active break not found'
      });
    }

    const endTime = timezoneUtils.now();
    const duration = Math.round((endTime - breakRecord.startTime) / (1000 * 60));

    const updatedBreak = await prisma.break.update({
      where: { id: parseInt(breakId) },
      data: {
        endTime,
        duration,
        status: 'completed'
      }
    });

    // Update attendance record's total hours if already clocked out
    const attendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: databaseEmployeeId,
          date: breakRecord.date
        }
      }
    });

    if (attendance && attendance.checkIn && attendance.checkOut) {
      // Recalculate total hours with new break time
      const breaks = await prisma.break.findMany({
        where: {
          employeeId: databaseEmployeeId,
          date: breakRecord.date,
          status: 'completed'
        }
      });
      const totalBreakMinutes = breaks.reduce((acc, curr) => acc + (curr.duration || 0), 0);
      const totalHours = calculateWorkHours(attendance.checkIn, attendance.checkOut, totalBreakMinutes);

      await prisma.attendance.update({
        where: { id: attendance.id },
        data: { totalHours }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Break ended',
      data: updatedBreak,
      timezone: timezoneUtils.getTimezoneInfo()
    });
  } catch (error) {
    console.error('❌ End break error:', error);
    next(error);
  }
};

/**
 * Get employee breaks
 * Returns all breaks for an employee, optionally filtered by date
 */
exports.getEmployeeBreaks = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { date } = req.query;

    const databaseEmployeeId = await getDatabaseEmployeeId(employeeId);

    const where = {
      employeeId: databaseEmployeeId
    };

    if (date) {
      where.date = timezoneUtils.toMidnightEST(new Date(date));
    }

    const breaks = await prisma.break.findMany({
      where,
      orderBy: { startTime: 'desc' }
    });

    // Set cache control headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.status(200).json({
      success: true,
      count: breaks.length,
      data: breaks,
      timezone: timezoneUtils.getTimezoneInfo()
    });
  } catch (error) {
    next(error);
  }
};

module.exports = exports;