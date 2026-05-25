// src/controllers/employeeController.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { getAccessibleDepartments } = require('../utils/departmentAccess');

const prisma = require("../lib/prisma");

// Get all employees
exports.getAllEmployees = async (req, res, next) => {
  try {
    const { department, position, search } = req.query;
    
    const where = {};

    const scopedDepartments = getAccessibleDepartments(req.user);
    if (scopedDepartments !== null) {
      if (req.user?.role === 'employee') {
        where.id = req.user.id;
      } else if (req.user?.role === 'teamlead') {
        // TeamLead sees only their direct reports by default.
        // Additional department/team access granted by admin is also included.
        const conditions = [{ reportTo: req.user.id }];
        for (const perm of (req.user.accessPermissions || [])) {
          if (perm.targetType === 'department') {
            conditions.push({ department: perm.targetName });
          } else if (perm.targetType === 'team') {
            conditions.push({ reportTo: perm.targetId });
          }
        }
        if (conditions.length === 1) {
          where.reportTo = req.user.id;
        } else {
          where.OR = conditions;
        }
      } else {
        where.department = { in: scopedDepartments };
      }
    }
    
    if (department && department !== 'all') {
      if (!where.department || typeof where.department === 'string') {
        where.department = department;
      } else {
        where.department = {
          in: where.department.in.filter((dept) => dept === department)
        };
      }
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
    
    // FIX: Format all dates as UTC strings
    const formattedEmployees = employees.map(emp => ({
      ...emp,
      birthday: emp.birthday ? formatDateUTC(emp.birthday).toISOString() : null,
      joinDate: emp.joinDate ? formatDateUTC(emp.joinDate).toISOString() : null,
      leaveDate: emp.leaveDate ? formatDateUTC(emp.leaveDate).toISOString() : null,
      createdAt: emp.createdAt ? formatDateUTC(emp.createdAt).toISOString() : null,
      updatedAt: emp.updatedAt ? formatDateUTC(emp.updatedAt).toISOString() : null
    }));
    
    res.status(200).json({
      success: true,
      count: employees.length,
      data: formattedEmployees
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

    // Auto-resolve departmentId from the department name string
    let resolvedDepartmentId = null;
    if (department) {
      try {
        const deptRecord = await prisma.department.findFirst({
          where: { name: { equals: department.trim(), mode: 'insensitive' }, isActive: true },
          select: { id: true }
        });
        if (deptRecord) resolvedDepartmentId = deptRecord.id;
      } catch (_) { /* non-fatal: continue without departmentId */ }
    }

    // FIX: Handle birthday as UTC date without timezone conversion
    let birthdayDate = null;
    if (birthday) {
      birthdayDate = new Date(birthday);
      // Set to UTC noon to avoid timezone shifting
      birthdayDate = new Date(Date.UTC(
        birthdayDate.getUTCFullYear(),
        birthdayDate.getUTCMonth(),
        birthdayDate.getUTCDate(),
        12, 0, 0
      ));
    }
    
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
        departmentId: resolvedDepartmentId,
        position,
        joinDate: joinDate ? new Date(joinDate) : new Date(),
        leaveDate: leaveDate ? new Date(leaveDate) : null,
        birthday: birthdayDate,
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
        orgPassword: '••••••••',
        tempPassword: orgPassword
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update the updateEmployee function to handle birthdays as UTC
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
    if (updateData.orgPassword) {
      if (updateData.orgPassword === '' || 
          updateData.orgPassword.includes('•') || 
          updateData.orgPassword === '••••••••') {
        delete updateData.orgPassword;
      }
    } else {
      delete updateData.orgPassword;
    }
    
    // Convert date strings to Date objects
    if (updateData.joinDate) {
      updateData.joinDate = new Date(updateData.joinDate);
    }
    if (updateData.leaveDate) {
      updateData.leaveDate = new Date(updateData.leaveDate);
    }
    
    // FIX: Handle birthday as UTC date without timezone conversion
    if (updateData.birthday) {
      const birthdayDate = new Date(updateData.birthday);
      updateData.birthday = new Date(Date.UTC(
        birthdayDate.getUTCFullYear(),
        birthdayDate.getUTCMonth(),
        birthdayDate.getUTCDate(),
        12, 0, 0
      ));
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

const formatDateUTC = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
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
    
    // Auto-resolve departmentId when department name is provided but departmentId is not
    if (updateData.department && updateData.departmentId === undefined) {
      try {
        const deptRecord = await prisma.department.findFirst({
          where: { name: { equals: updateData.department.trim(), mode: 'insensitive' }, isActive: true },
          select: { id: true }
        });
        if (deptRecord) updateData.departmentId = deptRecord.id;
      } catch (_) { /* non-fatal */ }
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
// ─── Backfill: create Department records + link departmentId ─────────────────
// Safe to call multiple times (fully idempotent).
// Step 1 – collect every unique department string from active employees
// Step 2 – create a Department row for any that don't have one yet
// Step 3 – set departmentId on every employee that still has null
exports.backfillDepartmentIds = async (req, res, next) => {
  try {
    // ── Step 1: unique department strings used by active employees ────────
    const empRows = await prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, department: true, departmentId: true }
    });

    const uniqueNames = [...new Set(
      empRows
        .map(e => (e.department || '').trim())
        .filter(Boolean)
    )];

    // ── Step 2: ensure a Department row exists for each name ─────────────
    const existingDepts = await prisma.department.findMany({
      select: { id: true, name: true, code: true }
    });
    const deptMap = new Map(existingDepts.map(d => [d.name.trim().toLowerCase(), d.id]));
    const usedCodes = new Set(existingDepts.map(d => d.code));

    let created = 0;
    for (const name of uniqueNames) {
      const key = name.toLowerCase();
      if (deptMap.has(key)) continue; // already exists

      // Generate a clean, unique code from the name
      let code = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      if (!code) code = 'DEPT';
      let suffix = 1;
      let finalCode = code;
      while (usedCodes.has(finalCode)) {
        finalCode = `${code.slice(0, 8)}${suffix++}`;
      }
      usedCodes.add(finalCode);

      try {
        const newDept = await prisma.department.create({
          data: { name, code: finalCode, isActive: true }
        });
        deptMap.set(key, newDept.id);
        created++;
      } catch (_) {
        // Extremely unlikely race condition – skip
      }
    }

    // ── Step 3: set departmentId on employees that are still unlinked ────
    let updated = 0;
    for (const emp of empRows) {
      if (emp.departmentId) continue; // already linked
      const key = (emp.department || '').trim().toLowerCase();
      const deptId = deptMap.get(key);
      if (!deptId) continue;
      await prisma.employee.update({
        where: { id: emp.id },
        data: { departmentId: deptId }
      });
      updated++;
    }

    res.status(200).json({
      success: true,
      message: `Backfill complete: ${created} department(s) created, ${updated} employee(s) linked.`,
      data: { created, updated, totalEmployees: empRows.length }
    });
  } catch (error) {
    next(error);
  }
};
