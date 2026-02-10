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

const toEST = (date) => {
  if (!date) return null;
  // Convert to EST and set to midnight for date comparisons
  const estDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  estDate.setHours(0, 0, 0, 0);
  return estDate;
};

// Helper to ensure proper date object
const ensureDate = (dateInput) => {
  if (!dateInput) return getESTDate();
  if (dateInput instanceof Date) return toEST(dateInput);
  const parsed = new Date(dateInput);
  if (isNaN(parsed.getTime())) return getESTDate();
  return toEST(parsed);
};
// Helper function to format time
const formatTime = (dateTime) => {
  if (!dateTime) return '--:--';
  try {
    const date = new Date(dateTime);
    return date.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (error) {
    return '--:--';
  }
};

const formatDate = (dateTime) => {
  if (!dateTime) return '';
  try {
    const date = new Date(dateTime);
    return date.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (error) {
    return '';
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

exports.exportAllEmployeesMonthly = async (req, res, next) => {
  try {
    console.log('📥 All employees monthly export request (EST):', { query: req.query });

    const { month, year, department } = req.query;

    const targetMonth = month ? parseInt(month) - 1 : new Date().getMonth();
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    // Create dates in EST
    const monthStart = new Date(targetYear, targetMonth, 1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnd = new Date(targetYear, targetMonth + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    console.log('📅 Export range (EST):', {
      start: formatDate(monthStart),
      end: formatDate(monthEnd)
    });

    // Get all employees (optionally filter by department)
    const employeeWhere = { isActive: true };
    if (department && department !== 'all') {
      employeeWhere.department = department;
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        department: true,
        position: true
      },
      orderBy: [
        { department: 'asc' },
        { lastName: 'asc' }
      ]
    });

    if (employees.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No employees found'
      });
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Monthly Attendance');

    // Set column widths
    worksheet.columns = [
      { width: 20 }, // Employee Name
      { width: 12 }, // Employee ID
      { width: 15 }, // Department
      { width: 15 }, // Date
      { width: 10 }, // Day
      { width: 12 }, // Check In (EST)
      { width: 12 }, // Check Out (EST)
      { width: 12 }, // Total Hours
      { width: 12 }, // Break Time
      { width: 15 }, // Status
      { width: 30 }  // Notes
    ];

    // Add title
    worksheet.mergeCells('A1:K1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'All Employees - Monthly Attendance Report (EST)';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6B8DA2' }
    };
    titleCell.font.color = { argb: 'FFFFFFFF' };

    // Add month/year
    worksheet.mergeCells('A2:K2');
    const dateCell = worksheet.getCell('A2');
    dateCell.value = `Month: ${monthStart.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: 'long',
      year: 'numeric'
    })} | Timezone: EST/EDT`;
    dateCell.font = { size: 12, bold: true };
    dateCell.alignment = { horizontal: 'center' };
    dateCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5A42C' }
    };

    // Add report info
    worksheet.mergeCells('A3:K3');
    const infoCell = worksheet.getCell('A3');
    const estNow = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    infoCell.value = `Generated: ${estNow} EST | Total Employees: ${employees.length}`;
    infoCell.font = { size: 10, italic: true };
    infoCell.alignment = { horizontal: 'center' };

    worksheet.addRow([]);

    // Add headers
    const headerRow = worksheet.addRow([
      'Employee Name',
      'Employee ID',
      'Department',
      'Date',
      'Day',
      'Check In (EST)',
      'Check Out (EST)',
      'Total Hours',
      'Break Time',
      'Status',
      'Notes'
    ]);

    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Process each employee
    let totalRecords = 0;
    let departmentSummaries = {};

    for (const employee of employees) {
      // Get attendance records for this employee
      const attendanceRecords = await prisma.attendance.findMany({
        where: {
          employeeId: employee.id,
          date: {
            gte: monthStart,
            lte: monthEnd
          }
        },
        orderBy: { date: 'asc' }
      });

      // If no attendance records, add a row showing no data
      if (attendanceRecords.length === 0) {
        const row = worksheet.addRow([
          `${employee.firstName} ${employee.lastName}`,
          employee.employeeId,
          employee.department,
          'No Records',
          '-',
          '-',
          '-',
          '-',
          '-',
          'No Data',
          '-'
        ]);

        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFEF2F2' }
          };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
        continue;
      }

      // Add attendance records with break time
      for (const record of attendanceRecords) {
        const breakMinutes = await calculateBreakTime(employee.id, record.date);
        const breakDetails = await getBreakDetails(employee.id, record.date);

        // Format break details for notes if there are multiple breaks
        let breakNotes = '';
        if (breakDetails.length > 0) {
          breakNotes = breakDetails.map((b, i) =>
            `Break ${i + 1}: ${b.start}-${b.end} (${b.duration}m)`
          ).join('; ');
        }

        const row = worksheet.addRow([
          `${employee.firstName} ${employee.lastName}`,
          employee.employeeId,
          employee.department,
          formatDate(record.date),
          new Date(record.date).toLocaleDateString('en-US', {
            timeZone: 'America/New_York',
            weekday: 'short'
          }),
          formatTime(record.checkIn),
          formatTime(record.checkOut),
          formatHours(record.totalHours),
          `${breakMinutes}m`,
          record.status.charAt(0).toUpperCase() + record.status.slice(1).replace('_', ' '),
          record.notes ? `${record.notes}${breakNotes ? ' | ' + breakNotes : ''}` : breakNotes
        ]);

        // Color code by status
        const statusColors = {
          'present': 'FFD4EDDA',
          'late': 'FFFFF3CD',
          'absent': 'FFF8D7DA',
          'half_day': 'FFD1ECF1',
          'on_leave': 'FFE2E3E5'
        };

        row.eachCell((cell, colNumber) => {
          if (colNumber === 10) { // Status column
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: statusColors[record.status] || 'FFFFFFFF' }
            };
          }
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });

        totalRecords++;

        // Track department summaries
        if (!departmentSummaries[employee.department]) {
          departmentSummaries[employee.department] = {
            present: 0,
            absent: 0,
            late: 0,
            halfDay: 0,
            onLeave: 0,
            totalHours: 0,
            totalBreakMinutes: 0
          };
        }

        const deptSummary = departmentSummaries[employee.department];
        if (record.status === 'present') deptSummary.present++;
        if (record.status === 'absent') deptSummary.absent++;
        if (record.status === 'late') deptSummary.late++;
        if (record.status === 'half_day') deptSummary.halfDay++;
        if (record.status === 'on_leave') deptSummary.onLeave++;
        deptSummary.totalHours += (record.totalHours || 0);
        deptSummary.totalBreakMinutes += breakMinutes;
      }
    }

    // Add summary section
    worksheet.addRow([]);
    worksheet.addRow([]);

    const summaryTitleRow = worksheet.addRow(['DEPARTMENT SUMMARY']);
    worksheet.mergeCells(`A${summaryTitleRow.number}:K${summaryTitleRow.number}`);
    summaryTitleRow.font = { bold: true, size: 12 };
    summaryTitleRow.alignment = { horizontal: 'center' };
    summaryTitleRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    const summaryHeaderRow = worksheet.addRow([
      'Department',
      'Present',
      'Late',
      'Absent',
      'Half Day',
      'On Leave',
      'Total Hours',
      'Total Break Time'
    ]);

    summaryHeaderRow.font = { bold: true };
    summaryHeaderRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD0D0D0' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Add department summaries
    Object.entries(departmentSummaries).forEach(([dept, summary]) => {
      const row = worksheet.addRow([
        dept,
        summary.present,
        summary.late,
        summary.absent,
        summary.halfDay,
        summary.onLeave,
        formatHours(summary.totalHours),
        `${summary.totalBreakMinutes}m`
      ]);

      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Add footer with timezone info
    worksheet.addRow([]);
    worksheet.addRow([]);
    const footerRow = worksheet.addRow(['All times are in Eastern Standard Time (EST) / Eastern Daylight Time (EDT)']);
    worksheet.mergeCells(`A${footerRow.number}:K${footerRow.number}`);
    footerRow.font = { italic: true, size: 9 };
    footerRow.alignment = { horizontal: 'center' };

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Send response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="all-employees-attendance-EST-${monthStart.toISOString().split('T')[0]}.xlsx"`);
    res.send(buffer);

    console.log('✅ Export completed successfully (EST)');

  } catch (error) {
    console.error('❌ Export all employees monthly error:', error);
    next(error);
  }
};

const getBreakDetails = async (employeeId, date) => {
  try {
    const targetDate = ensureDate(date);
    targetDate.setHours(0, 0, 0, 0);

    const breaks = await prisma.break.findMany({
      where: {
        employeeId: employeeId,
        date: targetDate,
        status: 'completed'
      },
      orderBy: { startTime: 'asc' }
    });

    return breaks.map(brk => ({
      start: formatTime(brk.startTime),
      end: formatTime(brk.endTime),
      duration: brk.duration || 0
    }));
  } catch (error) {
    console.error('Error getting break details:', error);
    return [];
  }
};

module.exports = exports;