// src/controllers/authController.js
// UPDATED - Added Team Lead role support

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    console.log('=== LOGIN ATTEMPT ===');
    console.log('Email:', email);
    console.log('Password provided:', !!password);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // ─── Admin Login ──────────────────────────────────────────────────────
    if (email === process.env.ADMIN_EMAIL || email === 'admin@orah.com') {
      console.log('Admin login attempt');
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

      if (password === adminPassword) {
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
              firstName: 'Admin',
              lastName: 'User',
              employeeId: 'ADMIN001',
              email: 'admin@orah.com',
              orgEmail: 'admin@orahconsultancy.com',
              orgPassword: 'admin123',
              phone: '0000000000',
              department: 'Management',
              position: 'Administrator',
              joinDate: new Date(),
              birthday: new Date('1990-01-01'),
              location: 'Ahmedabad',
              emergencyContact: '0000000000',
              avatar: 'A',
              isActive: true
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
            isAdmin: true
          }
        });
      } else {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    }

    // ─── Employee / Team Lead Login ────────────────────────────────────────
    console.log('Employee login attempt - searching for:', email);

    const employee = await prisma.employee.findFirst({
      where: {
        orgEmail: email,
        isActive: true
      },
      include: {
        leaveBalance: true
      }
    });

    console.log('Found employee:', employee ? 'Yes' : 'No');

    if (!employee) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Verify password
    const isPasswordHashed = employee.orgPassword.startsWith('$2');
    let isPasswordValid = false;

    if (isPasswordHashed) {
      isPasswordValid = await bcrypt.compare(password, employee.orgPassword);
    } else {
      isPasswordValid = password === employee.orgPassword;
    }

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    console.log('✅ Login successful for:', employee.employeeId);

    // ─── Determine Role ────────────────────────────────────────────────────
    // Team Lead detection: position contains 'team lead', 'tl', or 'lead'
    const pos = (employee.position || '').toLowerCase();
    const isTeamLead =
      pos.includes('team lead') ||
      pos.includes('team leader') ||
      pos.includes(' tl') ||
      pos === 'tl' ||
      pos.includes('lead recruiter') ||
      pos.includes('senior lead');

    const role = isTeamLead ? 'teamlead' : 'employee';

    const { orgPassword, ...sanitizedEmployee } = employee;

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        role,
        empId: sanitizedEmployee.employeeId,
        employeeId: sanitizedEmployee.employeeId,
        id: sanitizedEmployee.id,
        name: `${sanitizedEmployee.firstName} ${sanitizedEmployee.lastName}`,
        email: sanitizedEmployee.orgEmail,
        department: sanitizedEmployee.department,
        position: sanitizedEmployee.position,
        avatar: sanitizedEmployee.avatar,
        joinDate: sanitizedEmployee.joinDate,
        leaveBalance: sanitizedEmployee.leaveBalance,
        isTeamLead
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error.message);
    if (error.code === 'P1001') {
      return res.status(503).json({
        success: false,
        message: 'Database connection error. Please try again later.'
      });
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
    if (role === 'employer' && (email === 'admin@orah.com' || email === process.env.ADMIN_EMAIL)) {
      const adminUser = await prisma.employee.findFirst({
        where: {
          OR: [
            { email: 'admin@orah.com' },
            { orgEmail: 'admin@orah.com' },
            { employeeId: 'ADMIN001' }
          ]
        }
      });

      if (!adminUser) {
        return res.status(401).json({ success: false, message: 'Admin user not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'Session valid',
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
          isAdmin: true
        }
      });
    }

    // Employee / Team Lead
    const employee = await prisma.employee.findFirst({
      where: { orgEmail: email, isActive: true },
      include: { leaveBalance: true }
    });

    if (!employee) {
      return res.status(401).json({ success: false, message: 'Invalid session' });
    }

    const pos = (employee.position || '').toLowerCase();
    const isTeamLead =
      pos.includes('team lead') ||
      pos.includes('team leader') ||
      pos.includes(' tl') ||
      pos === 'tl' ||
      pos.includes('lead recruiter') ||
      pos.includes('senior lead');

    const detectedRole = isTeamLead ? 'teamlead' : 'employee';

    const { orgPassword, ...sanitizedEmployee } = employee;

    return res.status(200).json({
      success: true,
      message: 'Session valid',
      data: {
        role: detectedRole,
        empId: sanitizedEmployee.employeeId,
        employeeId: sanitizedEmployee.employeeId,
        id: sanitizedEmployee.id,
        name: `${sanitizedEmployee.firstName} ${sanitizedEmployee.lastName}`,
        email: sanitizedEmployee.orgEmail,
        department: sanitizedEmployee.department,
        position: sanitizedEmployee.position,
        avatar: sanitizedEmployee.avatar,
        leaveBalance: sanitizedEmployee.leaveBalance,
        isTeamLead
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

    const isPasswordHashed = employee.orgPassword.startsWith('$2');
    let isOldPasswordValid = false;

    if (isPasswordHashed) {
      isOldPasswordValid = await bcrypt.compare(oldPassword, employee.orgPassword);
    } else {
      isOldPasswordValid = oldPassword === employee.orgPassword;
    }

    if (!isOldPasswordValid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.employee.update({
      where: { id: employee.id },
      data: { orgPassword: hashedPassword }
    });

    return res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    next(error);
  }
};

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});