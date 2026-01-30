// src/controllers/employeeController.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = require("../lib/prisma");

// Get all employees
// Get all employees - return actual passwords for admin
exports.getAllEmployees = async (req, res, next) => {
  try {
    const { department, position, search } = req.query;
    
    const where = {};
    
    if (department && department !== 'all') {
      where.department = department;
    }
    
    if (position && position !== 'all') {
      where.position = position;
    }
    
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { employeeId: { contains: search } }
      ];
    }
    
    const employees = await prisma.employee.findMany({
      where,
      include: {
        leaveBalance: true,
        leaveRequests: {
          orderBy: { appliedDate: 'desc' },
          take: 5
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Return ACTUAL passwords (not recommended for production)
    // IMPORTANT: Only do this for trusted admin interfaces!
    res.status(200).json({
      success: true,
      count: employees.length,
      data: employees // Now includes actual orgPassword
    });
  } catch (error) {
    next(error);
  }
};

// Get employee by ID - return actual password
exports.getEmployeeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(id) },
      include: {
        leaveBalance: true,
        leaveRequests: {
          orderBy: { appliedDate: 'desc' }
        }
      }
    });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
    
    // Return ACTUAL password (not recommended for production)
    res.status(200).json({
      success: true,
      data: employee // Now includes actual orgPassword
    });
  } catch (error) {
    next(error);
  }
};

// Get employee by ID
exports.getEmployeeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(id) },
      include: {
        leaveBalance: true,
        leaveRequests: {
          orderBy: { appliedDate: 'desc' }
        }
      }
    });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
    
    // Remove hashed password but add placeholder
    const { orgPassword, ...sanitizedEmployee } = employee;
    
    res.status(200).json({
      success: true,
      data: {
        ...sanitizedEmployee,
        // Always return placeholder
        orgPassword: '••••••••'
      }
    });
  } catch (error) {
    next(error);
  }
};

// Create new employee
exports.createEmployee = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      employeeId,
      email,
      orgEmail,
      orgPassword,
      phone,
      department,
      position,
      joinDate,
      leaveDate,
      birthday,
      location,
      emergencyContact
    } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !employeeId || !email || !orgEmail || !orgPassword || !department || !position) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }
    
    // Check if employee ID or emails already exist
    const existingEmployee = await prisma.employee.findFirst({
      where: {
        OR: [
          { employeeId },
          { email },
          { orgEmail }
        ]
      }
    });
    
    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID or email already exists'
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(orgPassword, 10);
    
    // Create employee with leave balance
    const employee = await prisma.employee.create({
      data: {
        firstName,
        lastName,
        employeeId,
        email,
        orgEmail,
        orgPassword: orgPassword,
        phone,
        department,
        position,
        joinDate: joinDate ? new Date(joinDate) : new Date(),
        leaveDate: leaveDate ? new Date(leaveDate) : null,
        birthday: birthday ? new Date(birthday) : null,
        location,
        emergencyContact,
        avatar: firstName.charAt(0).toUpperCase(),
        leaveBalance: {
          create: {
            casual: 12,
            sick: 8,
            earned: 20,
            maternity: 90,
            paternity: 7,
            bereavement: 7
          }
        }
      },
      include: {
        leaveBalance: true
      }
    });
    
    // Remove password from response
    const { orgPassword: _, ...sanitizedEmployee } = employee;
    
    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: {
        ...sanitizedEmployee,
        // Return placeholder in response
        orgPassword: '••••••••',
        // Return the plain text password ONLY on creation so admin knows it
        tempPassword: orgPassword
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update employee
exports.updateEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existingEmployee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
    
    // Handle password update logic
    // Only hash if it's not empty and not a placeholder (contains bullets)
    if (updateData.orgPassword) {
      // Check if it's a placeholder or empty
      if (updateData.orgPassword === '' || 
          updateData.orgPassword.includes('•') || 
          updateData.orgPassword === '••••••••') {
        // Don't update password - remove from update data
        delete updateData.orgPassword;
      } else {
        // It's a new password - hash it
        // updateData.orgPassword = await bcrypt.hash(updateData.orgPassword, 10);
      }
    } else {
      // No password field - don't update it
      delete updateData.orgPassword;
    }
    
    // Convert date strings to Date objects
    if (updateData.joinDate) {
      updateData.joinDate = new Date(updateData.joinDate);
    }
    if (updateData.leaveDate) {
      updateData.leaveDate = new Date(updateData.leaveDate);
    }
    if (updateData.birthday) {
      updateData.birthday = new Date(updateData.birthday);
    }
    
    // Update employee
    const employee = await prisma.employee.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        leaveBalance: true
      }
    });
    
    // Remove password
    const { orgPassword, ...sanitizedEmployee } = employee;
    
    res.status(200).json({
      success: true,
      message: 'Employee updated successfully',
      data: {
        ...sanitizedEmployee,
        orgPassword: '••••••••'
      }
    });
  } catch (error) {
    next(error);
  }
};

// In employeeController.js - add this function:

// Get employee by employee code (EMP001)
exports.getEmployeeByCode = async (req, res, next) => {
  try {
    const { code } = req.params;
    
    console.log('🔍 Looking up employee by code:', code);
    
    const employee = await prisma.employee.findUnique({
      where: { employeeId: code },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        email: true,
        department: true,
        position: true,
        avatar: true,
        phone: true,
        joinDate: true
      }
    });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: `Employee not found with code: ${code}`
      });
    }
    
    console.log('✅ Found employee:', {
      id: employee.id,
      code: employee.employeeId,
      name: `${employee.firstName} ${employee.lastName}`
    });
    
    res.status(200).json({
      success: true,
      data: employee
    });
  } catch (error) {
    next(error);
  }
};

// Delete employee
exports.deleteEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existingEmployee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
    
    // Delete employee (cascade will handle related records)
    await prisma.employee.delete({
      where: { id: parseInt(id) }
    });
    
    res.status(200).json({
      success: true,
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get employee leave balance
exports.getLeaveBalance = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const leaveBalance = await prisma.leaveBalance.findUnique({
      where: { employeeId: parseInt(id) },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });
    
    if (!leaveBalance) {
      return res.status(404).json({
        success: false,
        message: 'Leave balance not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: leaveBalance
    });
  } catch (error) {
    next(error);
  }
};

// Update employee leave balance
exports.updateLeaveBalance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { casual, sick, earned, maternity, paternity, bereavement } = req.body;
    
    const leaveBalance = await prisma.leaveBalance.update({
      where: { employeeId: parseInt(id) },
      data: {
        casual: casual !== undefined ? parseInt(casual) : undefined,
        sick: sick !== undefined ? parseInt(sick) : undefined,
        earned: earned !== undefined ? parseInt(earned) : undefined,
        maternity: maternity !== undefined ? parseInt(maternity) : undefined,
        paternity: paternity !== undefined ? parseInt(paternity) : undefined,
        bereavement: bereavement !== undefined ? parseInt(bereavement) : undefined
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Leave balance updated successfully',
      data: leaveBalance
    });
  } catch (error) {
    next(error);
  }
};

// Get departments list
exports.getDepartments = async (req, res, next) => {
  try {
    const departments = await prisma.employee.findMany({
      select: { department: true },
      distinct: ['department']
    });
    
    const departmentList = departments.map(d => d.department);
    
    res.status(200).json({
      success: true,
      data: departmentList
    });
  } catch (error) {
    next(error);
  }
};

// Get positions list
exports.getPositions = async (req, res, next) => {
  try {
    const positions = await prisma.employee.findMany({
      select: { position: true },
      distinct: ['position']
    });
    
    const positionList = positions.map(p => p.position);
    
    res.status(200).json({
      success: true,
      data: positionList
    });
  } catch (error) {
    next(error);
  }
};