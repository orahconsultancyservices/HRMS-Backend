// src/controllers/authController.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// src/controllers/authController.js

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
        
        // ✅ FIX: Find admin user in database to get their numeric ID
        let adminUser = await prisma.employee.findFirst({
          where: {
            OR: [
              { email: 'admin@orah.com' },
              { orgEmail: 'admin@orah.com' },
              { employeeId: 'ADMIN001' }
            ]
          }
        });
        
        // If admin doesn't exist in DB, create them
        if (!adminUser) {
          console.log('Admin not found in database, creating...');
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
        
        console.log('Admin user ID:', adminUser.id);
        
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
            id: adminUser.id,  // ✅ Now it's a number from the database!
            department: adminUser.department,
            position: adminUser.position,
            avatar: adminUser.avatar,
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
    
    // ... rest of the employee login code stays the same
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
      console.log('No employee found with orgEmail:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    console.log('Employee ID:', employee.id);
    console.log('Employee Name:', `${employee.firstName} ${employee.lastName}`);
    
    // Check password
    const isPasswordHashed = employee.orgPassword.startsWith('$2');
    console.log('Is password hashed:', isPasswordHashed);
    
    let isPasswordValid = false;
    
    if (isPasswordHashed) {
      isPasswordValid = await bcrypt.compare(password, employee.orgPassword);
    } else {
      isPasswordValid = password === employee.orgPassword;
    }
    
    console.log('Password valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    console.log('✅ Login successful for:', employee.employeeId);
    
    const { orgPassword, ...sanitizedEmployee } = employee;
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        role: 'employee',
        empId: sanitizedEmployee.employeeId,
        employeeId: sanitizedEmployee.employeeId,
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
      // ✅ FIX: Get admin from database
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
        return res.status(401).json({
          success: false,
          message: 'Admin user not found'
        });
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
          id: adminUser.id,  // ✅ Numeric ID
          department: adminUser.department,
          position: adminUser.position,
          avatar: adminUser.avatar,
          isAdmin: true
        }
      });
    }
    
    // Employee verification (stays the same)
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
        employeeId: sanitizedEmployee.employeeId,
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