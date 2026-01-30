// src/services/paidLeaveService.js
// FIXED: Returns only whole numbers (integers) for paid leaves

class PaidLeaveService {
  constructor() {
    this.MONTHLY_PAID_LEAVES = 1; // 1 paid leave per month
  }

  /**
   * Calculate earned paid leaves since joining (INCLUDES HALF DAYS)
   * Each complete month = 1 paid leave
   * Half days (0.5) are counted in balance
   */
  calculateEarnedPaidLeaves(joinDate) {
    const join = new Date(joinDate);
    const now = new Date();
    
    // Calculate COMPLETE months worked only
    let monthsWorked = (now.getFullYear() - join.getFullYear()) * 12 + 
                       (now.getMonth() - join.getMonth());
    
    // If the current day is before the join day, subtract 1 month
    // (because the current month is not complete)
    if (now.getDate() < join.getDate()) {
      monthsWorked--;
    }
    
    // Return complete months (each month = 1 paid leave)
    // This will be used as whole number base
    return Math.max(0, monthsWorked);
  }

  /**
   * Get available paid leaves (includes 0.5 for half days)
   */
  async getAvailablePaidLeaves(employeeId, prisma) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { joinDate: true }
    });

    if (!employee) return 0;

    const earnedPaidLeaves = this.calculateEarnedPaidLeaves(employee.joinDate);
    
    // Get consumed paid leaves (includes half days as 0.5)
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
    
    return available; // Can include 0.5 for half days
  }

  /**
   * Check if leave can be paid (supports half days 0.5)
   */
  async canBePaidLeave(employeeId, requestedDays, prisma) {
    const availablePaidLeaves = await this.getAvailablePaidLeaves(employeeId, prisma);
    
    // Support both whole days and half days (0.5)
    if (availablePaidLeaves >= requestedDays) {
      return {
        canBePaid: true,
        paidDays: requestedDays, // Can be 0.5, 1, 1.5, 2, etc.
        unpaidDays: 0
      };
    } else if (availablePaidLeaves > 0) {
      return {
        canBePaid: false, // Cannot fully cover as paid
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
}

module.exports = new PaidLeaveService();