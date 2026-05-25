// src/controllers/accessPermissionController.js
// Manages cross-department/team access permissions for leads and managers

const prisma = require("../lib/prisma");

// GET all permissions for an employee
exports.getEmployeePermissions = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    const permissions = await prisma.accessPermission.findMany({
      where: { employeeId: parseInt(employeeId), isActive: true },
      include: {
        granter: {
          select: { id: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ success: true, data: permissions });
  } catch (error) {
    next(error);
  }
};

// POST grant a permission
exports.grantPermission = async (req, res, next) => {
  try {
    const { employeeId, targetType, targetId, targetName, accessLevel, grantedBy } = req.body;

    if (!employeeId || !targetType || !targetId || !targetName || !grantedBy) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: employeeId, targetType, targetId, targetName, grantedBy'
      });
    }

    if (!['department', 'team'].includes(targetType)) {
      return res.status(400).json({ success: false, message: 'targetType must be department or team' });
    }

    // Check employee exists and is a lead/manager
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(employeeId) }
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (!['teamlead', 'manager', 'hr'].includes(employee.role)) {
      return res.status(400).json({
        success: false,
        message: 'Permissions can only be granted to team leads, managers, and HR'
      });
    }

    // Upsert - update if exists, create if not
    const permission = await prisma.accessPermission.upsert({
      where: {
        employeeId_targetType_targetId: {
          employeeId: parseInt(employeeId),
          targetType,
          targetId: parseInt(targetId)
        }
      },
      update: {
        accessLevel: accessLevel || 'view',
        targetName,
        isActive: true,
        grantedBy: parseInt(grantedBy),
        grantedAt: new Date()
      },
      create: {
        employeeId: parseInt(employeeId),
        targetType,
        targetId: parseInt(targetId),
        targetName,
        accessLevel: accessLevel || 'view',
        grantedBy: parseInt(grantedBy)
      }
    });

    res.status(201).json({
      success: true,
      message: 'Permission granted successfully',
      data: permission
    });
  } catch (error) {
    next(error);
  }
};

// DELETE revoke a permission
exports.revokePermission = async (req, res, next) => {
  try {
    const { id } = req.params;

    const permission = await prisma.accessPermission.findUnique({
      where: { id: parseInt(id) }
    });

    if (!permission) {
      return res.status(404).json({ success: false, message: 'Permission not found' });
    }

    await prisma.accessPermission.update({
      where: { id: parseInt(id) },
      data: { isActive: false }
    });

    res.status(200).json({ success: true, message: 'Permission revoked successfully' });
  } catch (error) {
    next(error);
  }
};

// PUT bulk update permissions for an employee (replaces all current ones)
exports.updateEmployeePermissions = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { permissions, grantedBy } = req.body;
    // permissions: Array<{ targetType, targetId, targetName, accessLevel }>

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ success: false, message: 'permissions must be an array' });
    }

    // Deactivate all current permissions
    await prisma.accessPermission.updateMany({
      where: { employeeId: parseInt(employeeId) },
      data: { isActive: false }
    });

    // Re-create active ones
    if (permissions.length > 0) {
      for (const perm of permissions) {
        await prisma.accessPermission.upsert({
          where: {
            employeeId_targetType_targetId: {
              employeeId: parseInt(employeeId),
              targetType: perm.targetType,
              targetId: parseInt(perm.targetId)
            }
          },
          update: {
            accessLevel: perm.accessLevel || 'view',
            targetName: perm.targetName,
            isActive: true,
            grantedBy: parseInt(grantedBy),
            grantedAt: new Date()
          },
          create: {
            employeeId: parseInt(employeeId),
            targetType: perm.targetType,
            targetId: parseInt(perm.targetId),
            targetName: perm.targetName,
            accessLevel: perm.accessLevel || 'view',
            grantedBy: parseInt(grantedBy)
          }
        });
      }
    }

    // Return updated permissions
    const updated = await prisma.accessPermission.findMany({
      where: { employeeId: parseInt(employeeId), isActive: true }
    });

    res.status(200).json({
      success: true,
      message: `Updated ${updated.length} permissions`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};