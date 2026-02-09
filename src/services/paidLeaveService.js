// IMPROVED: Paid Leave Service with Caching and Better Performance

class PaidLeaveService {
  constructor() {
    this.MONTHLY_PAID_LEAVES = 1; // 1 paid leave per complete month
    this.balanceCache = new Map(); // In-memory cache
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Calculate earned paid leaves since joining
   * Returns WHOLE NUMBERS only
   */
  calculateEarnedPaidLeaves(joinDate) {
    const join = new Date(joinDate);
    const now = new Date();
    
    const joinDay = join.getDate();
    
    let monthsCompleted = (now.getFullYear() - join.getFullYear()) * 12 + 
                          (now.getMonth() - join.getMonth());
    
    // If we haven't reached the anniversary day this month, subtract 1
    if (now.getDate() < joinDay) {
      monthsCompleted = Math.max(0, monthsCompleted - 1);
    }
    
    // Each complete month = 1 paid leave (whole number)
    return Math.max(0, monthsCompleted);
  }

  /**
   * Get cache key for employee
   */
  getCacheKey(employeeId) {
    return `paid_leave_${employeeId}`;
  }

  /**
   * Check if cache is valid
   */
  isCacheValid(cacheEntry) {
    if (!cacheEntry) return false;
    return (Date.now() - cacheEntry.timestamp) < this.CACHE_TTL;
  }

  /**
   * Clear cache for specific employee
   */
  clearCache(employeeId) {
    const key = this.getCacheKey(employeeId);
    this.balanceCache.delete(key);
    console.log(`🗑️ Cache cleared for employee ${employeeId}`);
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.balanceCache.clear();
    console.log('🗑️ All cache cleared');
  }

  /**
   * Get available paid leaves with caching
   * Supports transaction client for atomic operations
   */
  async getAvailablePaidLeaves(employeeId, prismaClient) {
    const prisma = prismaClient || require('../lib/prisma');
    const cacheKey = this.getCacheKey(employeeId);
    
    // Check cache only if not in transaction
    if (!prismaClient) {
      const cached = this.balanceCache.get(cacheKey);
      if (this.isCacheValid(cached)) {
        console.log(`📦 Cache hit for employee ${employeeId}`);
        return cached.available;
      }
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { joinDate: true }
    });

    if (!employee) {
      console.warn(`⚠️ Employee ${employeeId} not found`);
      return 0;
    }

    // Calculate earned (whole number)
    const earnedPaidLeaves = this.calculateEarnedPaidLeaves(employee.joinDate);
    
    console.log(`📊 Employee ${employeeId} earned paid leaves:`, earnedPaidLeaves);
    
    // Get consumed (can include decimals for half days)
    const consumedPaidLeaves = await prisma.leaveRequest.aggregate({
      where: {
        empId: employeeId,
        isPaid: true,
        status: 'approved'
      },
      _sum: {
        paidDays: true
      }
    });

    const consumed = consumedPaidLeaves._sum.paidDays || 0;
    const available = Math.max(0, earnedPaidLeaves - consumed);
    
    console.log(`📊 Consumed: ${consumed}, Available: ${available}`);
    
    // Cache result only if not in transaction
    if (!prismaClient) {
      this.balanceCache.set(cacheKey, {
        earned: earnedPaidLeaves,
        consumed,
        available,
        timestamp: Date.now()
      });
    }
    
    return available;
  }

  /**
   * Check if leave can be paid (supports half days 0.5)
   * Supports transaction client
   */
  async canBePaidLeave(employeeId, requestedDays, prismaClient) {
    const availablePaidLeaves = await this.getAvailablePaidLeaves(employeeId, prismaClient);
    
    // Support both whole days and half days (0.5)
    if (availablePaidLeaves >= requestedDays) {
      return {
        canBePaid: true,
        paidDays: requestedDays,
        unpaidDays: 0
      };
    } else if (availablePaidLeaves > 0) {
      // Partial coverage
      return {
        canBePaid: false,
        paidDays: availablePaidLeaves,
        unpaidDays: requestedDays - availablePaidLeaves
      };
    } else {
      return {
        canBePaid: false,
        paidDays: 0,
        unpaidDays: requestedDays
      };
    }
  }

  /**
   * Get next credit date for employee
   */
  getNextCreditDate(joinDate) {
    const join = new Date(joinDate);
    const now = new Date();
    const joinDay = join.getDate();
    
    let nextCreditDate = new Date(now.getFullYear(), now.getMonth(), joinDay);
    
    // If we've already passed this month's anniversary, next is next month
    if (now.getDate() >= joinDay) {
      nextCreditDate = new Date(now.getFullYear(), now.getMonth() + 1, joinDay);
    }
    
    return nextCreditDate;
  }

  /**
   * Get detailed breakdown with forecast
   */
  async getDetailedBreakdown(employeeId, prisma) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { 
        joinDate: true,
        firstName: true,
        lastName: true 
      }
    });

    if (!employee) return null;

    const join = new Date(employee.joinDate);
    const now = new Date();
    const joinDay = join.getDate();
    
    // Calculate complete months
    let monthsCompleted = (now.getFullYear() - join.getFullYear()) * 12 + 
                          (now.getMonth() - join.getMonth());
    
    if (now.getDate() < joinDay) {
      monthsCompleted = Math.max(0, monthsCompleted - 1);
    }

    const earnedPaidLeaves = Math.max(0, monthsCompleted);
    const nextCreditDate = this.getNextCreditDate(employee.joinDate);
    
    const consumedPaidLeaves = await prisma.leaveRequest.aggregate({
      where: {
        empId: employeeId,
        isPaid: true,
        status: 'approved'
      },
      _sum: {
        paidDays: true
      }
    });

    const consumed = consumedPaidLeaves._sum.paidDays || 0;
    const available = Math.max(0, earnedPaidLeaves - consumed);

    // Get pending leaves
    const pendingLeaves = await prisma.leaveRequest.aggregate({
      where: {
        empId: employeeId,
        isPaid: true,
        status: 'pending'
      },
      _sum: {
        paidDays: true
      }
    });

    const pending = pendingLeaves._sum.paidDays || 0;
    const daysUntilNextCredit = Math.ceil((nextCreditDate - now) / (1000 * 60 * 60 * 24));

    return {
      employeeName: `${employee.firstName} ${employee.lastName}`,
      joinDate: join.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
      joinDay: joinDay,
      currentDate: now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
      completeMonthsWorked: monthsCompleted,
      earnedPaidLeaves, // Whole number
      consumedPaidLeaves: consumed, // Can be decimal
      pendingPaidLeaves: pending, // Can be decimal
      availablePaidLeaves: available, // Can be decimal
      nextCreditDate: nextCreditDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
      nextCreditIn: `${daysUntilNextCredit} days`,
      projectedNextMonth: earnedPaidLeaves + 1 - consumed, // Forecast
      accrualRate: `${this.MONTHLY_PAID_LEAVES} leave per month`
    };
  }

  /**
   * Validate leave request before creation
   */
  async validateLeaveRequest(employeeId, days, fromDate, toDate, prisma) {
    const errors = [];

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId }
    });

    if (!employee) {
      errors.push('Employee not found');
      return { valid: false, errors };
    }

    // Check future booking limit (e.g., max 90 days in advance)
    const MAX_ADVANCE_DAYS = 90;
    const daysInAdvance = Math.ceil((new Date(fromDate) - new Date()) / (1000 * 60 * 60 * 24));
    
    if (daysInAdvance > MAX_ADVANCE_DAYS) {
      errors.push(`Cannot book leave more than ${MAX_ADVANCE_DAYS} days in advance`);
    }

    // Check minimum notice period (e.g., 1 day)
    const MIN_NOTICE_DAYS = 1;
    if (daysInAdvance < MIN_NOTICE_DAYS) {
      errors.push(`Leave must be applied at least ${MIN_NOTICE_DAYS} day(s) in advance`);
    }

    // Check for overlapping leaves
    const overlapping = await prisma.leaveRequest.findMany({
      where: {
        empId: employeeId,
        status: { in: ['pending', 'approved'] },
        OR: [
          {
            AND: [
              { from: { lte: new Date(toDate) } },
              { to: { gte: new Date(fromDate) } }
            ]
          }
        ]
      }
    });

    if (overlapping.length > 0) {
      errors.push('Overlapping leave request exists');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new PaidLeaveService();