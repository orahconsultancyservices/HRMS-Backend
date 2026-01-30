// src/controllers/attendanceController.js
const prisma = require("../lib/prisma");



// Add this at the very top of attendanceController.js, right after the imports:

// Helper function to get database ID from either numeric ID or employee code
// In attendanceController.js, update the getDatabaseEmployeeId function

const getDatabaseEmployeeId = async (employeeIdentifier) => {
  try {
    console.log('🔄 getDatabaseEmployeeId called with:', employeeIdentifier);

    // If it's already a number, use it
    if (!isNaN(parseInt(employeeIdentifier))) {
      const id = parseInt(employeeIdentifier);
      console.log('✅ Using numeric ID directly:', id);

      // Verify employee exists
      const employee = await prisma.employee.findUnique({
        where: { id: id }
      });

      if (!employee) {
        throw new Error(`Employee not found with ID: ${id}`);
      }

      return id;
    }

    // It's an employee code (EMP001)
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

    // For development, you can return a fallback ID
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️ Development mode: Returning fallback ID 1');
      return 1; // Fallback for testing
    }

    throw error;
  }
};


// Get all attendance records with filters
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

    // Date range filter
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

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
      count: attendance.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      stats,
      data: attendance
    });
  } catch (error) {
    next(error);
  }
};

// Get attendance by ID
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

    res.status(200).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    next(error);
  }
};

// Get employee's attendance
exports.getEmployeeAttendance = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate, month, year } = req.query;

    // FIX: Use helper to get database ID
    const databaseEmployeeId = await getDatabaseEmployeeId(employeeId);

    const where = {
      employeeId: databaseEmployeeId // Use the converted ID
    };

    // Apply date filters
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    } else if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      where.date = {
        gte: start,
        lte: end
      };
    }

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

    // Calculate statistics
    const stats = {
      present: attendance.filter(a => a.status === 'present').length,
      absent: attendance.filter(a => a.status === 'absent').length,
      late: attendance.filter(a => a.status === 'late').length,
      half_day: attendance.filter(a => a.status === 'half_day').length,
      on_leave: attendance.filter(a => a.status === 'on_leave').length,
      totalHours: attendance.reduce((acc, curr) => acc + (curr.totalHours || 0), 0)
    };

    res.status(200).json({
      success: true,
      count: attendance.length,
      stats,
      data: attendance
    });
  } catch (error) {
    next(error);
  }
};

// Clock in
exports.clockIn = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    console.log('🔵 Clock In Request:', {
      params: req.params,
      body: req.body,
      url: req.originalUrl,
      employeeId: employeeId,
      type: typeof employeeId
    });

    // FIRST: Check if employeeId is EMP001 format
    // If it's not a number, we need to find the database ID
    let databaseEmployeeId;

    if (isNaN(parseInt(employeeId))) {
      console.log('🔄 Employee ID is not numeric, looking up by employee code:', employeeId);

      // Find employee by employeeId (EMP001) code
      const employee = await prisma.employee.findUnique({
        where: { employeeId: employeeId }
      });

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: `Employee not found with code: ${employeeId}`
        });
      }

      databaseEmployeeId = employee.id;
      console.log('✅ Found employee:', {
        code: employee.employeeId,
        databaseId: employee.id,
        name: `${employee.firstName} ${employee.lastName}`
      });
    } else {
      databaseEmployeeId = parseInt(employeeId);
      console.log('✅ Using numeric employee ID:', databaseEmployeeId);

      // Verify employee exists
      const employee = await prisma.employee.findUnique({
        where: { id: databaseEmployeeId }
      });

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: `Employee not found with ID: ${databaseEmployeeId}`
        });
      }

      console.log('✅ Employee verified:', {
        id: employee.id,
        code: employee.employeeId,
        name: `${employee.firstName} ${employee.lastName}`
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already clocked in today
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
        message: 'Already clocked in today'
      });
    }

    // Determine status based on time
    const checkInTime = new Date();
    const hour = checkInTime.getHours();
    const minute = checkInTime.getMinutes();
    const isLate = hour > 9 || (hour === 9 && minute > 30); // Late after 9:30 AM

    // FIX HERE: Get location and notes from req.body
    const { location, notes } = req.body || {};

    const attendance = await prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId: databaseEmployeeId, // Use databaseEmployeeId here
          date: today
        }
      },
      update: {
        checkIn: checkInTime,
        status: isLate ? 'late' : 'present',
        location: location || existingAttendance?.location,
        notes: notes || existingAttendance?.notes,
        updatedAt: new Date()
      },
      create: {
        employeeId: databaseEmployeeId, // Use databaseEmployeeId here
        date: today,
        checkIn: checkInTime,
        status: isLate ? 'late' : 'present',
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
      data: attendance
    });
  } catch (error) {
    console.error('Clock in error:', error);
    next(error);
  }
};

// Clock out
exports.clockOut = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    console.log('🔵 Clock Out Request for:', employeeId);

    // FIX: Get database employee ID using helper
    const databaseEmployeeId = await getDatabaseEmployeeId(employeeId);

    // FIX: Get location and notes from req.body
    const { location, notes } = req.body || {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's attendance
    const attendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: databaseEmployeeId, // Use databaseEmployeeId
          date: today
        }
      }
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'No clock-in record found for today'
      });
    }

    if (attendance.checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Already clocked out today'
      });
    }

    const checkOutTime = new Date();

    // Calculate total hours
    let totalHours = 0;
    if (attendance.checkIn) {
      const diffMs = checkOutTime - attendance.checkIn;
      totalHours = diffMs / (1000 * 60 * 60);

      // Adjust for breaks
      const breaks = await prisma.break.findMany({
        where: {
          employeeId: databaseEmployeeId,
          date: today,
          status: 'completed'
        }
      });

      const breakMinutes = breaks.reduce((acc, curr) => acc + (curr.duration || 0), 0);
      totalHours -= breakMinutes / 60;
    }

    // Determine if half day (less than 4 hours)
    const isHalfDay = totalHours < 4;

    const updatedAttendance = await prisma.attendance.update({
      where: {
        employeeId_date: {
          employeeId: databaseEmployeeId, // Use databaseEmployeeId
          date: today
        }
      },
      data: {
        checkOut: checkOutTime,
        totalHours: parseFloat(totalHours.toFixed(2)),
        status: isHalfDay ? 'half_day' : attendance.status,
        location: location || attendance.location,
        notes: notes || attendance.notes,
        updatedAt: new Date()
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
      data: updatedAttendance
    });
  } catch (error) {
    console.error('Clock out error:', error);
    next(error);
  }
};

// Get today's attendance status
exports.getTodayStatus = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    console.log('🔍 getTodayStatus called with:', employeeId);

    let databaseEmployeeId;
    try {
      databaseEmployeeId = await getDatabaseEmployeeId(employeeId);
    } catch (error) {
      console.error('❌ Could not get database employee ID:', error.message);
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
        data: null
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let attendance;
    try {
      attendance = await prisma.attendance.findUnique({
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
    } catch (dbError) {
      console.error('❌ Database error in getTodayStatus:', dbError.message);

      // For development, return null instead of crashing
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Development mode: Returning null for attendance');
        return res.status(200).json({
          success: true,
          data: null
        });
      }

      throw dbError;
    }

    // Add cache control headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    console.log('✅ getTodayStatus result:', attendance ? 'Found' : 'Not found');

    res.status(200).json({
      success: true,
      data: attendance || null
    });

  } catch (error) {
    console.error('❌ Error in getTodayStatus:', error);
    next(error);
  }
};

// Mark attendance manually (for admin)
exports.markAttendance = async (req, res, next) => {
  try {
    const { employeeId, date, status, checkIn, checkOut, notes } = req.body;

    if (!employeeId || !date || !status) {
      return res.status(400).json({
        success: false,
        message: 'Please provide employeeId, date, and status'
      });
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Calculate total hours if checkIn and checkOut provided
    let totalHours = 0;
    if (checkIn && checkOut) {
      const checkInTime = new Date(checkIn);
      const checkOutTime = new Date(checkOut);
      const diffMs = checkOutTime - checkInTime;
      totalHours = diffMs / (1000 * 60 * 60);
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
        totalHours: totalHours > 0 ? parseFloat(totalHours.toFixed(2)) : null,
        notes,
        updatedAt: new Date(),
        updatedBy: req.user?.id?.toString() || 'admin'
      },
      create: {
        employeeId: parseInt(employeeId),
        date: attendanceDate,
        status,
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        totalHours: totalHours > 0 ? parseFloat(totalHours.toFixed(2)) : null,
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
      data: attendance
    });
  } catch (error) {
    next(error);
  }
};

// Delete attendance
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

// Bulk mark attendance (for admin)
exports.bulkMarkAttendance = async (req, res, next) => {
  try {
    const { employees, date, status, notes } = req.body;

    if (!employees || !employees.length || !date || !status) {
      return res.status(400).json({
        success: false,
        message: 'Please provide employees array, date, and status'
      });
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

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
            updatedAt: new Date(),
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
      errors
    });
  } catch (error) {
    next(error);
  }
};

// Get attendance statistics
exports.getAttendanceStats = async (req, res, next) => {
  try {
    const { department, startDate, endDate } = req.query;

    const where = {};

    if (department && department !== 'all') {
      where.employee = {
        department: department
      };
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    } else {
      // Default to current month
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      where.date = {
        gte: start,
        lte: end
      };
    }

    // Get all attendance for the period
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

    // Calculate statistics
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

    // Department-wise breakdown
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

    // Daily trend for last 30 days
    const dailyTrend = [];
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const dailyAttendance = await prisma.attendance.groupBy({
      by: ['date'],
      where: {
        ...where,
        date: {
          gte: last30Days
        }
      },
      _count: {
        _all: true
      },
      _avg: {
        totalHours: true
      }
    });

    dailyAttendance.forEach(day => {
      dailyTrend.push({
        date: day.date,
        count: day._count._all,
        avgHours: day._avg.totalHours || 0
      });
    });

    res.status(200).json({
      success: true,
      data: {
        stats,
        departmentBreakdown,
        dailyTrend
      }
    });
  } catch (error) {
    next(error);
  }
};

// Break management
exports.startBreak = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { reason } = req.body || {};

    // FIX: Get database employee ID
    const databaseEmployeeId = await getDatabaseEmployeeId(employeeId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if there's an active break
    const activeBreak = await prisma.break.findFirst({
      where: {
        employeeId: databaseEmployeeId, // Use databaseEmployeeId
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
        employeeId: databaseEmployeeId, // Use databaseEmployeeId
        date: today,
        startTime: new Date(),
        reason: reason || null,
        status: 'active'
      }
    });

    res.status(200).json({
      success: true,
      message: 'Break started',
      data: breakRecord
    });
  } catch (error) {
    console.error('Start break error:', error);
    next(error);
  }
};



exports.endBreak = async (req, res, next) => {
  try {
    const { employeeId, breakId } = req.params;

    // FIX: Get database employee ID
    const databaseEmployeeId = await getDatabaseEmployeeId(employeeId);

    const breakRecord = await prisma.break.findFirst({
      where: {
        id: parseInt(breakId),
        employeeId: databaseEmployeeId, // Use databaseEmployeeId
        status: 'active'
      }
    });

    if (!breakRecord) {
      return res.status(404).json({
        success: false,
        message: 'Active break not found'
      });
    }

    const endTime = new Date();
    const duration = Math.round((endTime - breakRecord.startTime) / (1000 * 60)); // in minutes

    const updatedBreak = await prisma.break.update({
      where: { id: parseInt(breakId) },
      data: {
        endTime,
        duration,
        status: 'completed'
      }
    });

    res.status(200).json({
      success: true,
      message: 'Break ended',
      data: updatedBreak
    });
  } catch (error) {
    console.error('End break error:', error);
    next(error);
  }
};


// Get employee breaks
exports.getEmployeeBreaks = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { date } = req.query;

    // FIX: Get database employee ID
    const databaseEmployeeId = await getDatabaseEmployeeId(employeeId);

    const where = {
      employeeId: databaseEmployeeId // Use databaseEmployeeId
    };

    if (date) {
      const queryDate = new Date(date);
      queryDate.setHours(0, 0, 0, 0);
      where.date = queryDate;
    }

    const breaks = await prisma.break.findMany({
      where,
      orderBy: { startTime: 'desc' }
    });

    // Add cache control headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.status(200).json({
      success: true,
      count: breaks.length,
      data: breaks
    });
  } catch (error) {
    next(error);
  }
};