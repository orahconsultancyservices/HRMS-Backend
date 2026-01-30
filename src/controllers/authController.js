// src/controllers/authController.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    console.log('=== LOGIN ATTEMPT ===');
    console.log('Email:', email);
    console.log('Password provided:', !!password);
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }
    
    // Check if it's an admin login
    if (email === process.env.ADMIN_EMAIL || email === 'admin@orah.com') {
      console.log('Admin login attempt');
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      
      if (password === adminPassword) {
        console.log('Admin login successful');
        return res.status(200).json({
          success: true,
          message: 'Login successful',
          data: {
            role: 'employer',
            name: 'Admin User',
            email: email,
            empId: 'ADMIN001',
            id: 'ADMIN001',
            isAdmin: true
          }
        });
      } else {
        console.log('Admin password mismatch');
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
    }
    
    console.log('Employee login attempt - searching for:', email);
    
    // Find employee by organization email - use findFirst instead of findUnique
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
      console.log('No employee found with orgEmail:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    console.log('Employee ID:', employee.id);
    console.log('Employee Name:', `${employee.firstName} ${employee.lastName}`);
    console.log('Stored password preview:', employee.orgPassword.substring(0, 20) + '...');
    
    // Check if password is hashed
    const isPasswordHashed = employee.orgPassword.startsWith('$2');
    console.log('Is password hashed:', isPasswordHashed);
    
    let isPasswordValid = false;
    
    if (isPasswordHashed) {
      console.log('Comparing with bcrypt...');
      isPasswordValid = await bcrypt.compare(password, employee.orgPassword);
    } else {
      console.log('Comparing plain text...');
      isPasswordValid = password === employee.orgPassword;
    }
    
    console.log('Password valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('❌ Password validation failed');
      console.log('   Expected:', employee.orgPassword.substring(0, 20) + '...');
      console.log('   Received:', password);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    console.log('✅ Login successful for:', employee.employeeId);
    
    // Remove password from response
    const { orgPassword, ...sanitizedEmployee } = employee;
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        role: 'employee',
        empId: sanitizedEmployee.employeeId,
        id: sanitizedEmployee.id,
        name: `${sanitizedEmployee.firstName} ${sanitizedEmployee.lastName}`,
        email: sanitizedEmployee.orgEmail,
        department: sanitizedEmployee.department,
        position: sanitizedEmployee.position,
        avatar: sanitizedEmployee.avatar,
        joinDate: sanitizedEmployee.joinDate,
        leaveBalance: sanitizedEmployee.leaveBalance
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
      return res.status(400).json({
        success: false,
        message: 'Email and role are required'
      });
    }
    
    // Admin verification
    if (role === 'employer' && (email === 'admin@orah.com' || email === process.env.ADMIN_EMAIL)) {
      return res.status(200).json({
        success: true,
        message: 'Session valid',
        data: {
          role: 'employer',
          name: 'Admin User',
          email: email,
          empId: 'ADMIN001',
          id: 'ADMIN001',
          isAdmin: true
        }
      });
    }
    
    // Employee verification
    const employee = await prisma.employee.findFirst({
      where: {
        orgEmail: email,
        isActive: true
      },
      include: {
        leaveBalance: true
      }
    });
    
    if (!employee) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session'
      });
    }
    
    const { orgPassword, ...sanitizedEmployee } = employee;
    
    res.status(200).json({
      success: true,
      message: 'Session valid',
      data: {
        role: 'employee',
        empId: sanitizedEmployee.employeeId,
        id: sanitizedEmployee.id,
        name: `${sanitizedEmployee.firstName} ${sanitizedEmployee.lastName}`,
        email: sanitizedEmployee.orgEmail,
        department: sanitizedEmployee.department,
        position: sanitizedEmployee.position,
        avatar: sanitizedEmployee.avatar,
        leaveBalance: sanitizedEmployee.leaveBalance
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
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // Find employee
    const employee = await prisma.employee.findFirst({
      where: {
        orgEmail: email,
        isActive: true
      }
    });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
    
    // Verify old password
    const isPasswordHashed = employee.orgPassword.startsWith('$2');
    let isOldPasswordValid = false;
    
    if (isPasswordHashed) {
      isOldPasswordValid = await bcrypt.compare(oldPassword, employee.orgPassword);
    } else {
      isOldPasswordValid = oldPassword === employee.orgPassword;
    }
    
    if (!isOldPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await prisma.employee.update({
      where: { id: employee.id },
      data: { orgPassword: hashedPassword }
    });
    
    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    next(error);
  }
};

// Cleanup on module unload
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});