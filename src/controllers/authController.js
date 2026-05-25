// src/controllers/authController.js
// UPDATED - Added manager role + loads access permissions on login

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Helper: determine role from DB role field + position fallback
function determineRole(employee) {
  const dbRole = employee.role;

  // If DB has explicit role set (not the default 'employee'), use it
  if (dbRole && dbRole !== 'employee') {
    return dbRole;
  }

  // Fallback: detect from position string
  const pos = (employee.position || '').toLowerCase();

  if (
    pos === 'hr' ||
    pos.includes('human resource') ||
    pos.includes('hr manager') ||
    pos.includes('hr executive') ||
    pos.includes('hr officer')
  ) {
    return 'hr';
  }

  if (
    pos.includes('manager') ||
    pos.includes('department head') ||
    pos.includes('dept head') ||
    pos.includes(' mgr') ||
    pos === 'mgr'
  ) {
    return 'manager';
  }

  if (
    pos.includes('team lead') ||
    pos.includes('team leader') ||
    pos.includes(' tl') ||
    pos === 'tl' ||
    pos.includes('lead recruiter') ||
    pos.includes('senior lead')
  ) {
    return 'teamlead';
  }

  return 'employee';
}

// Helper: load access permissions for teamlead/manager
async function loadAccessPermissions(employeeId) {
  try {
    const permissions = await prisma.accessPermission.findMany({
      where: { employeeId, isActive: true },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        targetName: true,
        accessLevel: true
      }
    });
    return permissions;
  } catch {
    // Table might not exist yet during migration
    return [];
  }
}

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // ─── Admin Login ──────────────────────────────────────────────────────
    if (email === process.env.ADMIN_EMAIL || email === 'admin@orah.com') {
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

      if (password !== adminPassword) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      let adminUser = await prisma.employee.findFirst({
        where: {
          OR: [
            { email: 'admin@orah.com' },
            { orgEmail: 'admin@orah.com' },
            { employeeId: 'ADMIN001' }
          ]
        }
      });

      if (!adminUser) {
        adminUser = await prisma.employee.create({
          data: {
            firstName: 'Admin', lastName: 'User', employeeId: 'ADMIN001',
            email: 'admin@orah.com', orgEmail: 'admin@orahconsultancy.com',
            orgPassword: 'admin123', phone: '0000000000',
            department: 'Management', position: 'Administrator',
            joinDate: new Date(), birthday: new Date('1990-01-01'),
            location: 'Ahmedabad', emergencyContact: '0000000000',
            avatar: 'A', isActive: true
          }
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          role: 'employer',
          name: `${adminUser.firstName} ${adminUser.lastName}`,
          email: adminUser.email,
          orgEmail: adminUser.orgEmail,
          empId: adminUser.employeeId,
          employeeId: adminUser.employeeId,
          id: adminUser.id,
          department: adminUser.department,
          position: adminUser.position,
          avatar: adminUser.avatar,
          isAdmin: true,
          accessPermissions: []
        }
      });
    }

    // ─── Employee / TeamLead / Manager Login ───────────────────────────────
    const employee = await prisma.employee.findFirst({
      where: { orgEmail: email, isActive: true },
      include: { leaveBalance: true }
    });

    if (!employee) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Verify password
    const isHashed = employee.orgPassword.startsWith('$2');
    const isValid = isHashed
      ? await bcrypt.compare(password, employee.orgPassword)
      : password === employee.orgPassword;

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const role = determineRole(employee);
    
    // Load access permissions for leads/managers
    const accessPermissions = ['teamlead', 'manager', 'hr'].includes(role)
      ? await loadAccessPermissions(employee.id)
      : [];

    const { orgPassword, ...sanitized } = employee;

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        role,
        empId: sanitized.employeeId,
        employeeId: sanitized.employeeId,
        id: sanitized.id,
        name: `${sanitized.firstName} ${sanitized.lastName}`,
        email: sanitized.orgEmail,
        department: sanitized.department,
        departmentId: sanitized.departmentId,
        position: sanitized.position,
        avatar: sanitized.avatar,
        joinDate: sanitized.joinDate,
        reportTo: sanitized.reportTo,
        managesDepartment: sanitized.managesDepartment,
        leaveBalance: sanitized.leaveBalance,
        isTeamLead: role === 'teamlead',
        accessPermissions
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error.message);
    if (error.code === 'P1001') {
      return res.status(503).json({ success: false, message: 'Database connection error. Please try again later.' });
    }
    next(error);
  }
};

exports.verifySession = async (req, res, next) => {
  try {
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ success: false, message: 'Email and role are required' });
    }

    // Admin
    if ((role === 'employer' || role === 'admin') && (email === 'admin@orah.com' || email === process.env.ADMIN_EMAIL)) {
      const adminUser = await prisma.employee.findFirst({
        where: { OR: [{ email: 'admin@orah.com' }, { orgEmail: 'admin@orah.com' }, { employeeId: 'ADMIN001' }] }
      });

      if (!adminUser) {
        return res.status(401).json({ success: false, message: 'Admin user not found' });
      }

      return res.status(200).json({
        success: true, message: 'Session valid',
        data: {
          role: 'employer',
          name: `${adminUser.firstName} ${adminUser.lastName}`,
          email: adminUser.email, orgEmail: adminUser.orgEmail,
          empId: adminUser.employeeId, employeeId: adminUser.employeeId,
          id: adminUser.id, department: adminUser.department,
          position: adminUser.position, avatar: adminUser.avatar,
          isAdmin: true, accessPermissions: []
        }
      });
    }

    // Employee / Lead / Manager
    const employee = await prisma.employee.findFirst({
      where: { orgEmail: email, isActive: true },
      include: { leaveBalance: true }
    });

    if (!employee) {
      return res.status(401).json({ success: false, message: 'Invalid session' });
    }

    const detectedRole = determineRole(employee);
    const accessPermissions = ['teamlead', 'manager', 'hr'].includes(detectedRole)
      ? await loadAccessPermissions(employee.id)
      : [];

    const { orgPassword, ...sanitized } = employee;

    return res.status(200).json({
      success: true, message: 'Session valid',
      data: {
        role: detectedRole,
        empId: sanitized.employeeId, employeeId: sanitized.employeeId,
        id: sanitized.id,
        name: `${sanitized.firstName} ${sanitized.lastName}`,
        email: sanitized.orgEmail,
        department: sanitized.department, departmentId: sanitized.departmentId,
        position: sanitized.position, avatar: sanitized.avatar,
        reportTo: sanitized.reportTo, managesDepartment: sanitized.managesDepartment,
        isTeamLead: detectedRole === 'teamlead',
        leaveBalance: sanitized.leaveBalance,
        accessPermissions
      }
    });
  } catch (error) {
    console.error('Verify session error:', error);
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { email, oldPassword, newPassword } = req.body;

    if (!email || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const employee = await prisma.employee.findFirst({
      where: { orgEmail: email, isActive: true }
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const isHashed = employee.orgPassword.startsWith('$2');
    const isOldValid = isHashed
      ? await bcrypt.compare(oldPassword, employee.orgPassword)
      : oldPassword === employee.orgPassword;

    if (!isOldValid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.employee.update({ where: { id: employee.id }, data: { orgPassword: hashed } });

    return res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    next(error);
  }
};

process.on('beforeExit', async () => { await prisma.$disconnect(); });