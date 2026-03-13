// src/middleware/roleAuth.js
// Role-based access control middleware

const prisma = require("../lib/prisma");

// ============================================
// MIDDLEWARE: ROLE-BASED ACCESS CONTROL
// ============================================

/**
 * Middleware to verify user role and permissions
 * Expects user info in req.user (set by auth middleware)
 */
const authorize = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      // Get user ID from request (typically set by auth middleware)
      const userId = req.user?.id || req.headers['x-user-id'];
      const userRole = req.user?.role || req.headers['x-user-role'];

      if (!userId || !userRole) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Missing user information'
        });
      }

      // Check if user role is allowed
      if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: This action requires one of these roles: ${allowedRoles.join(', ')}`
        });
      }

      // Fetch full user from database for scoping
      const user = await prisma.employee.findUnique({
        where: { id: parseInt(userId) },
        include: {
          teamMembers: {
            select: { id: true }
          }
        }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Store user info in request for use in controllers
      req.user = {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
        designationId: user.designationId,
        reportTo: user.reportTo,
        teamMemberIds: user.teamMembers.map(m => m.id)
      };

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Authorization check failed'
      });
    }
  };
};

// ============================================
// SCOPE HELPERS
// ============================================

/**
 * Get team member IDs for a team lead
 */
const getTeamMemberIds = async (teamLeadId) => {
  try {
    const teamMembers = await prisma.employee.findMany({
      where: { reportTo: teamLeadId, isActive: true },
      select: { id: true }
    });
    return teamMembers.map(m => m.id);
  } catch (error) {
    console.error('Error fetching team members:', error);
    return [];
  }
};

/**
 * Check if employee is under a team lead
 */
const isEmployeeUnderTeamLead = async (employeeId, teamLeadId) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { reportTo: true }
    });
    return employee?.reportTo === teamLeadId;
  } catch (error) {
    console.error('Error checking team membership:', error);
    return false;
  }
};

/**
 * Check if user can view/edit a specific employee's data
 * Admin: can access anyone
 * TeamLead: can only access their team members
 * Employee: can only access themselves
 */
const canAccessEmployee = async (userId, targetEmployeeId, userRole) => {
  if (!userId || !targetEmployeeId) return false;

  // Admin can access anyone
  if (userRole === 'admin') return true;

  // Employee can only access themselves
  if (userRole === 'employee') return userId === targetEmployeeId;

  // Team Lead can only access their team members
  if (userRole === 'teamlead') {
    return await isEmployeeUnderTeamLead(targetEmployeeId, userId);
  }

  return false;
};

module.exports = {
  authorize,
  getTeamMemberIds,
  isEmployeeUnderTeamLead,
  canAccessEmployee
};
