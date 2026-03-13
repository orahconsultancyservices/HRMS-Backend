// src/utils/timezoneUtils.js - BACKEND VERSION (CommonJS)
// This file ensures consistent EST/EDT timezone handling across the backend

/**
 * ⏰ TIMEZONE HANDLING STRATEGY
 * 
 * All dates in the system are handled in EST/EDT timezone.
 * We use America/New_York timezone which automatically handles DST transitions.
 * 
 * RULES:
 * 1. Store dates in database as UTC (Prisma/MySQL default)
 * 2. Convert to EST for display and comparisons
 * 3. Always use these utilities instead of new Date() directly
 * 4. Calendar dates use midnight EST for consistency
 */

const TIMEZONE = 'America/New_York';

const timezoneUtils = {
  // ============================================
  // CORE DATE FUNCTIONS
  // ============================================

  /**
   * Get current date/time in EST
   * Use this instead of new Date()
   */
  now: () => {
    return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
  },

  /**
   * Convert any date to EST
   * @param {Date|string} date - Input date
   * @returns {Date} Date object in EST
   */
  toEST: (date) => {
    if (!date) return timezoneUtils.now();
    const inputDate = typeof date === 'string' ? new Date(date) : date;
    return new Date(inputDate.toLocaleString('en-US', { timeZone: TIMEZONE }));
  },

  /**
   * Get EST midnight (00:00:00) for a given date
   * Critical for date comparisons and calendar operations
   * @param {Date|string} date - Input date (defaults to today)
   * @returns {Date} Date object at midnight EST
   */
  toMidnightEST: (date = new Date()) => {
    const estDate = timezoneUtils.toEST(date);
    estDate.setHours(0, 0, 0, 0);
    return estDate;
  },

  /**
   * Get end of day (23:59:59.999) in EST
   * @param {Date|string} date - Input date
   * @returns {Date} Date object at end of day EST
   */
  toEndOfDayEST: (date = new Date()) => {
    const estDate = timezoneUtils.toEST(date);
    estDate.setHours(23, 59, 59, 999);
    return estDate;
  },

  // ============================================
  // FORMATTING FUNCTIONS
  // ============================================

  /**
   * Format date as YYYY-MM-DD in EST
   * Perfect for API queries and database comparisons
   */
  formatDate: (date = new Date()) => {
    const estDate = timezoneUtils.toEST(date);
    const year = estDate.getFullYear();
    const month = String(estDate.getMonth() + 1).padStart(2, '0');
    const day = String(estDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Format time as HH:MM in EST (24-hour format)
   */
  formatTime: (date) => {
    if (!date) return '--:--';
    try {
      const estDate = timezoneUtils.toEST(date);
      return estDate.toLocaleTimeString('en-US', {
        timeZone: TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return '--:--';
    }
  },

  /**
   * Format datetime for input fields (datetime-local)
   * Returns: YYYY-MM-DDTHH:MM format in EST
   */
  formatForInput: (date) => {
    if (!date) return '';
    try {
      const estDate = timezoneUtils.toEST(date);
      const year = estDate.getFullYear();
      const month = String(estDate.getMonth() + 1).padStart(2, '0');
      const day = String(estDate.getDate()).padStart(2, '0');
      const hours = String(estDate.getHours()).padStart(2, '0');
      const minutes = String(estDate.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (error) {
      console.error('Error formatting for input:', error);
      return '';
    }
  },

  /**
   * Format date for display (e.g., "Mon, Jan 15, 2024")
   */
  formatDisplayDate: (date) => {
    if (!date) return '';
    try {
      return timezoneUtils.toEST(date).toLocaleDateString('en-US', {
        timeZone: TIMEZONE,
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting display date:', error);
      return '';
    }
  },

  /**
   * Get day name (Mon, Tue, etc.) in EST
   */
  getDayName: (date) => {
    if (!date) return '';
    try {
      return timezoneUtils.toEST(date).toLocaleDateString('en-US', {
        timeZone: TIMEZONE,
        weekday: 'short'
      });
    } catch (error) {
      return '';
    }
  },

  /**
   * Format hours (e.g., 8.5 hours → "8h 30m")
   */
  formatHours: (hours) => {
    if (!hours || hours === 0) return '--';
    const totalMinutes = Math.round(hours * 60);
    const displayHours = Math.floor(totalMinutes / 60);
    const displayMinutes = totalMinutes % 60;
    return `${displayHours}h ${displayMinutes}m`;
  },

  // ============================================
  // COMPARISON FUNCTIONS
  // ============================================

  /**
   * Check if two dates are the same day in EST
   * Critical for attendance lookups
   */
  isSameDay: (date1, date2) => {
    const est1 = timezoneUtils.toMidnightEST(date1);
    const est2 = timezoneUtils.toMidnightEST(date2);
    return est1.getTime() === est2.getTime();
  },

  /**
   * Check if date is today in EST
   */
  isToday: (date) => {
    return timezoneUtils.isSameDay(date, timezoneUtils.now());
  },

  /**
   * Check if date is in the past (before today) in EST
   */
  isPast: (date) => {
    const today = timezoneUtils.toMidnightEST();
    const checkDate = timezoneUtils.toMidnightEST(date);
    return checkDate < today;
  },

  /**
   * Check if date is in the future (after today) in EST
   */
  isFuture: (date) => {
    const today = timezoneUtils.toMidnightEST();
    const checkDate = timezoneUtils.toMidnightEST(date);
    return checkDate > today;
  },

  // ============================================
  // CALENDAR HELPER FUNCTIONS
  // ============================================

  /**
   * Get the first day of month (0=Sunday, 6=Saturday) in EST
   */
  getFirstDayOfMonth: (year, month) => {
    // Create date in UTC then convert to EST to avoid timezone shift
    const date = new Date(Date.UTC(year, month, 1));
    const estDate = timezoneUtils.toMidnightEST(date);
    return estDate.getDay();
  },

  /**
   * Get number of days in month in EST
   */
  getDaysInMonth: (year, month) => {
    // Month + 1, day 0 gives last day of current month
    const date = new Date(Date.UTC(year, month + 1, 0));
    return date.getUTCDate();
  },

  /**
   * Get month name
   */
  getMonthName: (monthIndex) => {
    return new Date(2000, monthIndex, 1).toLocaleDateString('en-US', {
      month: 'long'
    });
  },

  /**
   * Get week start (Sunday) for a given date in EST
   */
  getWeekStart: (date = new Date()) => {
    const estDate = timezoneUtils.toMidnightEST(date);
    const day = estDate.getDay();
    const diff = estDate.getDate() - day; // Subtract day of week to get Sunday
    estDate.setDate(diff);
    return estDate;
  },

  /**
   * Get week end (Saturday) for a given date in EST
   */
  getWeekEnd: (date = new Date()) => {
    const weekStart = timezoneUtils.getWeekStart(date);
    weekStart.setDate(weekStart.getDate() + 6);
    return weekStart;
  },

  /**
   * Get month start in EST
   */
  getMonthStart: (year, month) => {
    const date = new Date(year, month, 1);
    return timezoneUtils.toMidnightEST(date);
  },

  /**
   * Get month end in EST
   */
  getMonthEnd: (year, month) => {
    const date = new Date(year, month + 1, 0); // Last day of month
    return timezoneUtils.toEndOfDayEST(date);
  },

  // ============================================
  // DATE ARITHMETIC
  // ============================================

  /**
   * Add days to a date in EST
   */
  addDays: (date, days) => {
    const estDate = timezoneUtils.toEST(date);
    estDate.setDate(estDate.getDate() + days);
    return estDate;
  },

  /**
   * Add months to a date in EST
   */
  addMonths: (date, months) => {
    const estDate = timezoneUtils.toEST(date);
    estDate.setMonth(estDate.getMonth() + months);
    return estDate;
  },

  /**
   * Get difference in days between two dates
   */
  daysDiff: (date1, date2) => {
    const est1 = timezoneUtils.toMidnightEST(date1);
    const est2 = timezoneUtils.toMidnightEST(date2);
    const diffTime = Math.abs(est2 - est1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  // ============================================
  // VALIDATION FUNCTIONS
  // ============================================

  /**
   * Check if a date string is valid
   */
  isValidDate: (dateString) => {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  },

  /**
   * Ensure we have a valid Date object
   */
  ensureDate: (input) => {
    if (!input) return timezoneUtils.now();
    if (input instanceof Date) return input;
    const parsed = new Date(input);
    return timezoneUtils.isValidDate(input) ? parsed : timezoneUtils.now();
  },

  // ============================================
  // TIMEZONE INFO
  // ============================================

  /**
   * Get timezone name (EST or EDT based on current date)
   */
  getTimezoneName: () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(now);
    const tzPart = parts.find(part => part.type === 'timeZoneName');
    return tzPart ? tzPart.value : 'EST';
  },

  /**
   * Get timezone offset in minutes
   */
  getTimezoneOffset: () => {
    const now = timezoneUtils.now();
    return now.getTimezoneOffset();
  },

  /**
   * Get human-readable timezone info
   */
  getTimezoneInfo: () => {
    const tzName = timezoneUtils.getTimezoneName();
    const offset = timezoneUtils.getTimezoneOffset();
    const offsetHours = Math.abs(offset / 60);
    const sign = offset > 0 ? '-' : '+';
    return {
      name: tzName,
      display: `${tzName} (UTC${sign}${offsetHours})`,
      zone: TIMEZONE
    };
  }
};

// CommonJS export for Node.js
module.exports = { timezoneUtils, TIMEZONE };