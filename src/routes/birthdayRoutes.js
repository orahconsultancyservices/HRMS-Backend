const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/birthdays:
 *   get:
 *     summary: Get all employees with birthdays
 *     tags: [Birthdays]
 *     responses:
 *       200:
 *         description: List of employees with birthdays
 */
router.get('/', async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      where: {
        birthday: {
          not: null
        },
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        email: true,
        phone: true,
        department: true,
        position: true,
        birthday: true,
        avatar: true,
        joinDate: true,
        leaveBalance: {
          select: {
            casual: true,
            sick: true,
            earned: true
          }
        }
      },
      orderBy: {
        firstName: 'asc'
      }
    });

    // Transform data to match frontend format
    const formattedEmployees = employees.map(emp => ({
      id: emp.id.toString(),
      name: `${emp.firstName} ${emp.lastName}`,
      avatar: emp.avatar || emp.firstName.charAt(0) + emp.lastName.charAt(0),
      department: emp.department,
      position: emp.position,
      birthday: emp.birthday ? new Date(emp.birthday).toISOString().split('T')[0] : null,
      email: emp.email,
      phone: emp.phone || '',
      joinDate: emp.joinDate ? new Date(emp.joinDate).toISOString().split('T')[0] : null,
      leaveBalance: emp.leaveBalance || {
        casual: 0,
        sick: 0,
        earned: 0
      }
    }));

    res.json({
      success: true,
      count: formattedEmployees.length,
      data: formattedEmployees
    });
  } catch (error) {
    console.error('Error fetching birthdays:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching birthday data',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/birthdays/upcoming:
 *   get:
 *     summary: Get upcoming birthdays (next 30 days)
 *     tags: [Birthdays]
 *     responses:
 *       200:
 *         description: List of upcoming birthdays
 */
router.get('/upcoming', async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      where: {
        birthday: {
          not: null
        },
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        department: true,
        position: true,
        birthday: true,
        avatar: true
      }
    });

    const today = new Date();
    const currentYear = today.getFullYear();
    
    // Calculate upcoming birthdays
    const upcomingBirthdays = employees
      .map(emp => {
        const birthday = new Date(emp.birthday);
        const thisYearBirthday = new Date(currentYear, birthday.getMonth(), birthday.getDate());
        const nextYearBirthday = new Date(currentYear + 1, birthday.getMonth(), birthday.getDate());
        
        const nextBirthday = thisYearBirthday >= today ? thisYearBirthday : nextYearBirthday;
        const daysUntil = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));
        
        return {
          id: emp.id.toString(),
          name: `${emp.firstName} ${emp.lastName}`,
          avatar: emp.avatar || emp.firstName.charAt(0) + emp.lastName.charAt(0),
          department: emp.department,
          position: emp.position,
          birthday: new Date(emp.birthday).toISOString().split('T')[0],
          daysUntil,
          nextBirthday: nextBirthday.toISOString().split('T')[0]
        };
      })
      .filter(emp => emp.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    res.json({
      success: true,
      count: upcomingBirthdays.length,
      data: upcomingBirthdays
    });
  } catch (error) {
    console.error('Error fetching upcoming birthdays:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching upcoming birthdays',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/birthdays/today:
 *   get:
 *     summary: Get today's birthdays
 *     tags: [Birthdays]
 *     responses:
 *       200:
 *         description: List of today's birthdays
 */
router.get('/today', async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      where: {
        birthday: {
          not: null
        },
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        department: true,
        position: true,
        birthday: true,
        avatar: true,
        email: true
      }
    });

    const today = new Date();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();

    const todaysBirthdays = employees
      .filter(emp => {
        const birthday = new Date(emp.birthday);
        return birthday.getMonth() === todayMonth && birthday.getDate() === todayDate;
      })
      .map(emp => ({
        id: emp.id.toString(),
        name: `${emp.firstName} ${emp.lastName}`,
        avatar: emp.avatar || emp.firstName.charAt(0) + emp.lastName.charAt(0),
        department: emp.department,
        position: emp.position,
        birthday: new Date(emp.birthday).toISOString().split('T')[0],
        email: emp.email
      }));

    res.json({
      success: true,
      count: todaysBirthdays.length,
      data: todaysBirthdays
    });
  } catch (error) {
    console.error('Error fetching today\'s birthdays:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching today\'s birthdays',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/birthdays/month/{month}:
 *   get:
 *     summary: Get birthdays for a specific month
 *     tags: [Birthdays]
 *     parameters:
 *       - in: path
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *     responses:
 *       200:
 *         description: List of birthdays in the specified month
 */
router.get('/month/:month', async (req, res) => {
  try {
    const month = parseInt(req.params.month);
    
    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        message: 'Invalid month. Must be between 1 and 12'
      });
    }

    const employees = await prisma.employee.findMany({
      where: {
        birthday: {
          not: null
        },
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        department: true,
        position: true,
        birthday: true,
        avatar: true
      }
    });

    const monthBirthdays = employees
      .filter(emp => {
        const birthday = new Date(emp.birthday);
        return birthday.getMonth() === month - 1;
      })
      .map(emp => ({
        id: emp.id.toString(),
        name: `${emp.firstName} ${emp.lastName}`,
        avatar: emp.avatar || emp.firstName.charAt(0) + emp.lastName.charAt(0),
        department: emp.department,
        position: emp.position,
        birthday: new Date(emp.birthday).toISOString().split('T')[0]
      }))
      .sort((a, b) => {
        const dateA = new Date(a.birthday).getDate();
        const dateB = new Date(b.birthday).getDate();
        return dateA - dateB;
      });

    res.json({
      success: true,
      month,
      count: monthBirthdays.length,
      data: monthBirthdays
    });
  } catch (error) {
    console.error('Error fetching month birthdays:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching month birthdays',
      error: error.message
    });
  }
});

module.exports = router;