// src/utils/helpers.js
const prisma = require("../lib/prisma");

/**
 * Convert employee identifier (ID or code like EMP001) to database ID
 * @param {string|number} employeeIdentifier - Employee ID or code
 * @returns {Promise<number>} Database employee ID
 */
async function getDatabaseEmployeeId(employeeIdentifier) {
  try {
    // If it's already a number, verify and return
    if (!isNaN(parseInt(employeeIdentifier))) {
      const id = parseInt(employeeIdentifier);
      
      const employee = await prisma.employee.findUnique({
        where: { id },
        select: { id: true, employeeId: true },
      });

      if (!employee) {
        throw new Error(`Employee not found with ID: ${id}`);
      }

      return id;
    }

    // It's an employee code (EMP001)
    const employee = await prisma.employee.findUnique({
      where: { employeeId: employeeIdentifier.toString() },
      select: { id: true, employeeId: true },
    });

    if (!employee) {
      throw new Error(`Employee not found with code: ${employeeIdentifier}`);
    }

    return employee.id;
  } catch (error) {
    console.error("❌ Error in getDatabaseEmployeeId:", error.message);
    throw error;
  }
}

/**
 * Normalize date to start of day (00:00:00)
 * @param {Date|string} date - Date to normalize
 * @returns {Date} Normalized date
 */
function normalizeDate(date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Calculate days between two dates (inclusive)
 * @param {Date} from - Start date
 * @param {Date} to - End date
 * @returns {number} Number of days
 */
function calculateDays(from, to) {
  const timeDiff = to.getTime() - from.getTime();
  const days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, days);
}

/**
 * Check if time is late (after 9:30 AM)
 * @param {Date} time - Time to check
 * @returns {boolean} Whether time is late
 */
function isLateCheckIn(time) {
  const hour = time.getHours();
  const minute = time.getMinutes();
  return hour > 9 || (hour === 9 && minute > 30);
}

/**
 * Calculate total working hours excluding breaks
 * @param {Date} checkIn - Check in time
 * @param {Date} checkOut - Check out time
 * @param {number} breakMinutes - Total break minutes
 * @returns {number} Total hours worked
 */
function calculateWorkingHours(checkIn, checkOut, breakMinutes = 0) {
  const diffMs = checkOut - checkIn;
  let totalHours = diffMs / (1000 * 60 * 60);
  totalHours -= breakMinutes / 60;
  return Math.max(0, parseFloat(totalHours.toFixed(2)));
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Whether email is valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize employee data (remove sensitive fields)
 * @param {Object} employee - Employee object
 * @returns {Object} Sanitized employee data
 */
function sanitizeEmployee(employee) {
  const { orgPassword, ...sanitized } = employee;
  return sanitized;
}

/**
 * Generate employee ID (EMP001, EMP002, etc.)
 * @param {number} nextNumber - Next sequential number
 * @returns {string} Generated employee ID
 */
function generateEmployeeId(nextNumber) {
  return `EMP${String(nextNumber).padStart(3, "0")}`;
}

/**
 * Parse query parameters for pagination
 * @param {Object} query - Request query object
 * @returns {Object} Pagination parameters
 */
function parsePaginationParams(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Build date range filter for Prisma
 * @param {string} startDate - Start date string
 * @param {string} endDate - End date string
 * @returns {Object|null} Prisma date filter object
 */
function buildDateRangeFilter(startDate, endDate) {
  if (!startDate && !endDate) return null;

  const filter = {};
  if (startDate) filter.gte = new Date(startDate);
  if (endDate) filter.lte = new Date(endDate);

  return filter;
}

module.exports = {
  getDatabaseEmployeeId,
  normalizeDate,
  calculateDays,
  isLateCheckIn,
  calculateWorkingHours,
  isValidEmail,
  sanitizeEmployee,
  generateEmployeeId,
  parsePaginationParams,
  buildDateRangeFilter,
};