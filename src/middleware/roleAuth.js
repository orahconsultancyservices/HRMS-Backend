// src/middleware/roleAuth.js
// Enhanced Role-based access control middleware for hierarchical organization

const prisma = require("../lib/prisma");

// ============================================
// MIDDLEWARE: ROLE-BASED ACCESS CONTROL
// ============================================

/**
 * Middleware to verify user role and permissions
 * Supports hierarchical access: admin > manager > teamlead > employee
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

      // Fetch full user from database for hierarchical scoping
      const user = await prisma.employee.findUnique({
        where: { id: parseInt(userId) },
        include: {
          dept: {
            select: { id: true, name: true, managerId: true }
          },
          directReports: {
            select: { id: true, role: true, departmentId: true }
          },
          teamMembers: {
            select: { id: true }
          },
          managedDepartment: {
            select: { id: true, name: true }
          }
        }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Store enhanced user info in request for use in controllers
      req.user = {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
        designationId: user.designationId,
        reportTo: user.reportTo,
        managesDepartment: user.managesDepartment,
        department: user.dept,
        directReports: user.directReports,
        teamMemberIds: user.teamMembers.map(m => m.id),
        // Hierarchical access flags
        isDepartmentManager: user.role === 'manager' && user.managesDepartment,
        isTeamLead: user.role === 'teamlead'
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
// ENHANCED SCOPE HELPERS FOR HIERARCHICAL ACCESS
// ============================================

/**
 * Get department members for a department manager
 */
const getDepartmentMemberIds = async (departmentId) => {
  try {
    const members = await prisma.employee.findMany({
      where: { departmentId, isActive: true },
      select: { id: true, role: true }
    });
    return members;
  } catch (error) {
    console.error('Error fetching department members:', error);
    return [];
  }
};

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
 * Check if employee is in a department managed by the manager
 */
const isEmployeeInManagedDepartment = async (employeeId, managerId) => {
  try {
    const manager = await prisma.employee.findUnique({
      where: { id: managerId },
      select: { managesDepartment: true }
    });
    
    if (!manager?.managesDepartment) return false;
    
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { departmentId: true }
    });
    
    return employee?.departmentId === manager.managesDepartment;
  } catch (error) {
    console.error('Error checking department membership:', error);
    return false;
  }
};

/**
 * Enhanced access control for hierarchical organization
 * Admin: can access anyone
 * Manager: can access anyone in their department
 * TeamLead: can access their team members
 * Employee: can only access themselves
 */
const canAccessEmployee = async (userId, targetEmployeeId, userRole) => {
  if (!userId || !targetEmployeeId) return false;

  // Admin can access anyone
  if (userRole === 'admin') return true;

  // Employee can only access themselves
  if (userRole === 'employee') return userId === targetEmployeeId;

  // Manager can access anyone in their department
  if (userRole === 'manager') {
    return await isEmployeeInManagedDepartment(targetEmployeeId, userId);
  }

  // Team Lead can only access their team members
  if (userRole === 'teamlead') {
    return await isEmployeeUnderTeamLead(targetEmployeeId, userId);
  }

  return false;
};

/**
 * Get accessible employees based on user role and hierarchy
 */
const getAccessibleEmployees = async (userId, userRole) => {
  try {
    switch (userRole) {
      case 'admin':
        // Admin can see all active employees
        return await prisma.employee.findMany({
          where: { isActive: true },
          select: { id: true, firstName: true, lastName: true, role: true, departmentId: true }
        });
      
      case 'manager':
        // Manager can see all employees in their department
        const manager = await prisma.employee.findUnique({
          where: { id: userId },
          select: { managesDepartment: true }
        });
        
        if (!manager?.managesDepartment) return [];
        
        return await prisma.employee.findMany({
          where: { departmentId: manager.managesDepartment, isActive: true },
          select: { id: true, firstName: true, lastName: true, role: true, departmentId: true }
        });
      
      case 'teamlead':
        // Team lead can see their direct reports
        return await prisma.employee.findMany({
          where: { reportTo: userId, isActive: true },
          select: { id: true, firstName: true, lastName: true, role: true, departmentId: true }
        });
      
      case 'employee':
        // Employee can only see themselves
        return await prisma.employee.findMany({
          where: { id: userId, isActive: true },
          select: { id: true, firstName: true, lastName: true, role: true, departmentId: true }
        });
      
      default:
        return [];
    }
  } catch (error) {
    console.error('Error fetching accessible employees:', error);
    return [];
  }
};

module.exports = {
  authorize,
  getDepartmentMemberIds,
  getTeamMemberIds,
  isEmployeeUnderTeamLead,
  isEmployeeInManagedDepartment,
  canAccessEmployee,
  getAccessibleEmployees
};
