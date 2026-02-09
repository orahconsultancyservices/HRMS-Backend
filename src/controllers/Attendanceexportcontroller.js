// src/controllers/attendanceExportController.js - CORRECTED VERSION
const prisma = require("../lib/prisma");
const ExcelJS = require('exceljs');

// Helper function to get database employee ID
const getDatabaseEmployeeId = async (employeeIdentifier) => {
  try {
    if (!isNaN(parseInt(employeeIdentifier))) {
      const id = parseInt(employeeIdentifier);
      const employee = await prisma.employee.findUnique({
        where: { id: id }
      });
      if (!employee) {
        throw new Error(`Employee not found with ID: ${id}`);
      }
      return id;
    }

    const employee = await prisma.employee.findUnique({
      where: { employeeId: employeeIdentifier.toString() }
    });

    if (!employee) {
      throw new Error(`Employee not found with code: ${employeeIdentifier}`);
    }

    return employee.id;
  } catch (error) {
    console.error('❌ Error in getDatabaseEmployeeId:', error.message);
    throw error;
  }
};

// Helper to ensure proper date object
const ensureDate = (dateInput) => {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;
  const parsed = new Date(dateInput);
  if (isNaN(parsed.getTime())) return new Date();
  return parsed;
};

// Helper function to format time
const formatTime = (dateTime) => {
  if (!dateTime) return '--:--';
  try {
    const date = ensureDate(dateTime);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (error) {
    return '--:--';
  }
};

// Helper function to format hours
const formatHours = (hours) => {
  if (!hours || hours === 0) return '0h 0m';
  const totalMinutes = Math.round(hours * 60);
  const displayHours = Math.floor(totalMinutes / 60);
  const displayMinutes = totalMinutes % 60;
  return `${displayHours}h ${displayMinutes}m`;
};

// Helper function to calculate total break time
const calculateBreakTime = async (employeeId, date) => {
  try {
    const targetDate = ensureDate(date);
    targetDate.setHours(0, 0, 0, 0);
    
    const breaks = await prisma.break.findMany({
      where: {
        employeeId: employeeId,
        date: targetDate,
        status: 'completed'
      }
    });

    const totalMinutes = breaks.reduce((sum, brk) => sum + (brk.duration || 0), 0);
    return totalMinutes;
  } catch (error) {
    console.error('Error calculating break time:', error);
    return 0;
  }
};

// Export daily attendance
exports.exportDailyAttendance = async (req, res, next) => {
  try {
    console.log('📥 Daily export request:', { params: req.params, query: req.query });
    
    const { employeeId } = req.params;
    const { date } = req.query;

    const databaseEmployeeId = await getDatabaseEmployeeId(employeeId);

    const targetDate = date ? ensureDate(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    // Get employee details
    const employee = await prisma.employee.findUnique({
      where: { id: databaseEmployeeId },
      select: {
        firstName: true,
        lastName: true,
        employeeId: true,
        department: true,
        position: true
      }
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get attendance record
    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId: databaseEmployeeId,
        date: targetDate
      }
    });

    // Get breaks
    const breakMinutes = await calculateBreakTime(databaseEmployeeId, targetDate);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Daily Attendance');

    // Set column widths
    worksheet.columns = [
      { width: 25 },
      { width: 20 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 }
    ];

    // Add title
    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'Daily Attendance Report';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FF000000' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add date
    worksheet.mergeCells('A2:G2');
    const dateCell = worksheet.getCell('A2');
    dateCell.value = `Date: ${targetDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}`;
    dateCell.font = { size: 12, bold: true };
    dateCell.alignment = { horizontal: 'center' };

    // Add employee info
    worksheet.addRow([]);
    worksheet.addRow(['Employee Information']);
    worksheet.getCell('A4').font = { bold: true, size: 12 };
    
    worksheet.addRow(['Employee ID:', employee.employeeId]);
    worksheet.addRow(['Name:', `${employee.firstName} ${employee.lastName}`]);
    worksheet.addRow(['Department:', employee.department]);
    worksheet.addRow(['Position:', employee.position]);

    // Add attendance details
    worksheet.addRow([]);
    worksheet.addRow(['Attendance Details']);
    worksheet.getCell('A9').font = { bold: true, size: 12 };

    if (attendance) {
      worksheet.addRow(['Check In:', formatTime(attendance.checkIn)]);
      worksheet.addRow(['Check Out:', formatTime(attendance.checkOut)]);
      worksheet.addRow(['Total Hours:', formatHours(attendance.totalHours)]);
      worksheet.addRow(['Break Time:', `${breakMinutes}m`]);
      worksheet.addRow(['Status:', attendance.status.charAt(0).toUpperCase() + attendance.status.slice(1)]);
      worksheet.addRow(['Location:', attendance.location || 'N/A']);
      worksheet.addRow(['Notes:', attendance.notes || 'N/A']);
    } else {
      worksheet.addRow(['Status:', 'No attendance record found']);
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Send response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="daily-attendance-${targetDate.toISOString().split('T')[0]}.xlsx"`);
    res.send(buffer);

  } catch (error) {
    console.error('❌ Export daily attendance error:', error);
    next(error);
  }
};

// Export weekly attendance
exports.exportWeeklyAttendance = async (req, res, next) => {
  try {
    console.log('📥 Weekly export request:', { params: req.params, query: req.query });
    
    const { employeeId } = req.params;
    const { startDate } = req.query;

    const databaseEmployeeId = await getDatabaseEmployeeId(employeeId);

    const weekStart = startDate ? ensureDate(startDate) : new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    // Get employee details
    const employee = await prisma.employee.findUnique({
      where: { id: databaseEmployeeId },
      select: {
        firstName: true,
        lastName: true,
        employeeId: true,
        department: true,
        position: true
      }
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get attendance records
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        employeeId: databaseEmployeeId,
        date: {
          gte: weekStart,
          lte: weekEnd
        }
      },
      orderBy: { date: 'asc' }
    });

    // Get breaks for each day
    const recordsWithBreaks = await Promise.all(
      attendanceRecords.map(async (record) => {
        const breakMinutes = await calculateBreakTime(databaseEmployeeId, record.date);
        return { ...record, breakMinutes };
      })
    );

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Weekly Attendance');

    // Set column widths
    worksheet.columns = [
      { width: 15 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 15 },
      { width: 12 },
      { width: 15 }
    ];

    // Add title
    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'Weekly Attendance Report';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add date range
    worksheet.mergeCells('A2:G2');
    const dateCell = worksheet.getCell('A2');
    dateCell.value = `Week: ${weekStart.toLocaleDateString('en-US')} - ${weekEnd.toLocaleDateString('en-US')}`;
    dateCell.font = { size: 12, bold: true };
    dateCell.alignment = { horizontal: 'center' };

    // Add employee info
    worksheet.addRow([]);
    worksheet.addRow([
      `Employee: ${employee.firstName} ${employee.lastName}`,
      '',
      '',
      `ID: ${employee.employeeId}`,
      '',
      `Dept: ${employee.department}`
    ]);
    const employeeRow = worksheet.getRow(4);
    employeeRow.font = { bold: true };

    // Add headers
    worksheet.addRow([]);
    const headerRow = worksheet.addRow(['Date', 'Day', 'Check In', 'Check Out', 'Total Hours', 'Break Time', 'Status']);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Add data rows
    recordsWithBreaks.forEach((record) => {
      const row = worksheet.addRow([
        record.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        record.date.toLocaleDateString('en-US', { weekday: 'short' }),
        formatTime(record.checkIn),
        formatTime(record.checkOut),
        formatHours(record.totalHours),
        `${record.breakMinutes}m`,
        record.status.charAt(0).toUpperCase() + record.status.slice(1)
      ]);
      
      // Alternate row colors
      row.eachCell((cell) => {
        if (worksheet.lastRow.number % 2 === 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' }
          };
        }
      });
    });

    // Add summary
    worksheet.addRow([]);
    const totalHours = recordsWithBreaks.reduce((sum, r) => sum + (r.totalHours || 0), 0);
    const totalBreaks = recordsWithBreaks.reduce((sum, r) => sum + r.breakMinutes, 0);
    const summaryRow = worksheet.addRow(['TOTAL', '', '', '', formatHours(totalHours), `${totalBreaks}m`, '']);
    summaryRow.font = { bold: true };
    summaryRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Send response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="weekly-attendance-${weekStart.toISOString().split('T')[0]}.xlsx"`);
    res.send(buffer);

  } catch (error) {
    console.error('❌ Export weekly attendance error:', error);
    next(error);
  }
};

// Export monthly attendance
exports.exportMonthlyAttendance = async (req, res, next) => {
  try {
    console.log('📥 Monthly export request:', { params: req.params, query: req.query });
    
    const { employeeId } = req.params;
    const { month, year } = req.query;

    const databaseEmployeeId = await getDatabaseEmployeeId(employeeId);

    const targetMonth = month ? parseInt(month) - 1 : new Date().getMonth();
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    const monthStart = new Date(targetYear, targetMonth, 1);
    monthStart.setHours(0, 0, 0, 0);
    
    const monthEnd = new Date(targetYear, targetMonth + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    // Get employee details
    const employee = await prisma.employee.findUnique({
      where: { id: databaseEmployeeId },
      select: {
        firstName: true,
        lastName: true,
        employeeId: true,
        department: true,
        position: true
      }
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get attendance records
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        employeeId: databaseEmployeeId,
        date: {
          gte: monthStart,
          lte: monthEnd
        }
      },
      orderBy: { date: 'asc' }
    });

    // Get breaks for each day
    const recordsWithBreaks = await Promise.all(
      attendanceRecords.map(async (record) => {
        const breakMinutes = await calculateBreakTime(databaseEmployeeId, record.date);
        return { ...record, breakMinutes };
      })
    );

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Monthly Attendance');

    // Set column widths
    worksheet.columns = [
      { width: 15 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 15 },
      { width: 12 },
      { width: 15 },
      { width: 30 }
    ];

    // Add title
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'Monthly Attendance Report';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add month/year
    worksheet.mergeCells('A2:H2');
    const dateCell = worksheet.getCell('A2');
    dateCell.value = `Month: ${monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    dateCell.font = { size: 12, bold: true };
    dateCell.alignment = { horizontal: 'center' };

    // Add employee info
    worksheet.addRow([]);
    worksheet.addRow([
      `Employee: ${employee.firstName} ${employee.lastName}`,
      '',
      `ID: ${employee.employeeId}`,
      '',
      `Dept: ${employee.department}`,
      '',
      `Position: ${employee.position}`
    ]);
    const employeeRow = worksheet.getRow(4);
    employeeRow.font = { bold: true };

    // Add headers
    worksheet.addRow([]);
    const headerRow = worksheet.addRow(['Date', 'Day', 'Check In', 'Check Out', 'Total Hours', 'Break Time', 'Status', 'Notes']);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Add data rows
    recordsWithBreaks.forEach((record) => {
      const row = worksheet.addRow([
        record.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        record.date.toLocaleDateString('en-US', { weekday: 'short' }),
        formatTime(record.checkIn),
        formatTime(record.checkOut),
        formatHours(record.totalHours),
        `${record.breakMinutes}m`,
        record.status.charAt(0).toUpperCase() + record.status.slice(1),
        record.notes || ''
      ]);
      
      // Alternate row colors
      row.eachCell((cell) => {
        if (worksheet.lastRow.number % 2 === 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' }
          };
        }
      });
    });

    // Add statistics
    worksheet.addRow([]);
    worksheet.addRow(['STATISTICS']);
    worksheet.getCell(`A${worksheet.lastRow.number}`).font = { bold: true, size: 12 };

    const stats = {
      totalDays: recordsWithBreaks.length,
      present: recordsWithBreaks.filter(r => r.status === 'present').length,
      late: recordsWithBreaks.filter(r => r.status === 'late').length,
      absent: recordsWithBreaks.filter(r => r.status === 'absent').length,
      halfDay: recordsWithBreaks.filter(r => r.status === 'half_day').length,
      onLeave: recordsWithBreaks.filter(r => r.status === 'on_leave').length,
      totalHours: recordsWithBreaks.reduce((sum, r) => sum + (r.totalHours || 0), 0),
      totalBreaks: recordsWithBreaks.reduce((sum, r) => sum + r.breakMinutes, 0)
    };

    worksheet.addRow(['Total Working Days:', stats.totalDays]);
    worksheet.addRow(['Present:', stats.present]);
    worksheet.addRow(['Late:', stats.late]);
    worksheet.addRow(['Absent:', stats.absent]);
    worksheet.addRow(['Half Day:', stats.halfDay]);
    worksheet.addRow(['On Leave:', stats.onLeave]);
    worksheet.addRow(['Total Hours:', formatHours(stats.totalHours)]);
    worksheet.addRow(['Total Break Time:', `${stats.totalBreaks}m`]);
    worksheet.addRow(['Average Hours/Day:', stats.totalDays > 0 ? formatHours(stats.totalHours / stats.totalDays) : '0h 0m']);

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Send response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="monthly-attendance-${monthStart.toISOString().split('T')[0]}.xlsx"`);
    res.send(buffer);

  } catch (error) {
    console.error('❌ Export monthly attendance error:', error);
    next(error);
  }
};

module.exports = exports;