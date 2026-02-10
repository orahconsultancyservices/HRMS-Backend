// src/utils/dateUtils.js
export const dateUtils = {
  // Convert any date to EST midnight for comparisons
  toESTMidnight: (date = new Date()) => {
    const estDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    estDate.setHours(0, 0, 0, 0);
    return estDate;
  },

  // Get current EST date
  getCurrentEST: () => {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  },

  // Format date as YYYY-MM-DD in EST
  formatESTDate: (date = new Date()) => {
    const estDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const year = estDate.getFullYear();
    const month = String(estDate.getMonth() + 1).padStart(2, '0');
    const day = String(estDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // Check if two dates are the same day in EST
  isSameESTDay: (date1, date2) => {
    const estDate1 = dateUtils.toESTMidnight(date1);
    const estDate2 = dateUtils.toESTMidnight(date2);
    return estDate1.getTime() === estDate2.getTime();
  },

  // Get day of week in EST (0 = Sunday, 1 = Monday, etc.)
  getESTDayOfWeek: (date = new Date()) => {
    const estDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    return estDate.getDay();
  }
};