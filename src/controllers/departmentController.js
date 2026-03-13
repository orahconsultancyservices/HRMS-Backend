// src/controllers/departmentController.js
// Department & Designation Management Controller

const prisma = require("../lib/prisma");

// ============================================
// DEPARTMENT MANAGEMENT
// ============================================

// Get all departments
exports.getAllDepartments = async (req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      include: {
        designations: {
          where: { isActive: true },
          include: {
            defaultKPIs: {
              where: { isActive: true },
              orderBy: { type: 'asc' }
            }
          }
        },
        _count: {
          select: { employees: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.status(200).json({
      success: true,
      count: departments.length,
      data: departments
    });
  } catch (error) {
    next(error);
  }
};

// Get department by ID
exports.getDepartmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const department = await prisma.department.findUnique({
      where: { id: parseInt(id) },
      include: {
        designations: {
          where: { isActive: true },
          include: {
            defaultKPIs: {
              where: { isActive: true },
              orderBy: { type: 'asc' }
            }
          }
        },
        employees: {
          where: { isActive: true },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            position: true,
            avatar: true
          }
        }
      }
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    res.status(200).json({
      success: true,
      data: department
    });
  } catch (error) {
    next(error);
  }
};

// Create department
exports.createDepartment = async (req, res, next) => {
  try {
    const { name, code, description } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: 'Please provide department name and code'
      });
    }

    // Check if department code already exists
    const existingDept = await prisma.department.findFirst({
      where: { OR: [{ name }, { code }] }
    });

    if (existingDept) {
      return res.status(400).json({
        success: false,
        message: 'Department name or code already exists'
      });
    }

    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description?.trim() || null
      }
    });

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: department
    });
  } catch (error) {
    next(error);
  }
};

// Update department
exports.updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, description, isActive } = req.body;

    const existingDept = await prisma.department.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingDept) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Check for duplicate name/code (excluding current department)
    if (name || code) {
      const duplicate = await prisma.department.findFirst({
        where: {
          AND: [
            { id: { not: parseInt(id) } },
            { OR: [] }
          ]
        }
      });

      if (name) duplicate.where.AND[1].OR.push({ name });
      if (code) duplicate.where.AND[1].OR.push({ code });

      const foundDuplicate = await prisma.department.findFirst(duplicate.where);
      if (foundDuplicate) {
        return res.status(400).json({
          success: false,
          message: 'Department name or code already exists'
        });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (code !== undefined) updateData.code = code.trim().toUpperCase();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const department = await prisma.department.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.status(200).json({
      success: true,
      message: 'Department updated successfully',
      data: department
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// DESIGNATION MANAGEMENT
// ============================================

// Get all designations
exports.getAllDesignations = async (req, res, next) => {
  try {
    const { departmentId, isActive } = req.query;
    
    const where = {};
    if (departmentId) where.departmentId = parseInt(departmentId);
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const designations = await prisma.designation.findMany({
      where,
      include: {
        department: {
          select: { id: true, name: true, code: true }
        },
        defaultKPIs: {
          where: { isActive: true },
          orderBy: { type: 'asc' }
        },
        _count: {
          select: { employees: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.status(200).json({
      success: true,
      count: designations.length,
      data: designations
    });
  } catch (error) {
    next(error);
  }
};

// Get designation by ID
exports.getDesignationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const designation = await prisma.designation.findUnique({
      where: { id: parseInt(id) },
      include: {
        department: {
          select: { id: true, name: true, code: true }
        },
        defaultKPIs: {
          where: { isActive: true },
          orderBy: { type: 'asc' }
        },
        employees: {
          where: { isActive: true },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            avatar: true
          }
        }
      }
    });

    if (!designation) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found'
      });
    }

    res.status(200).json({
      success: true,
      data: designation
    });
  } catch (error) {
    next(error);
  }
};

// Create designation
exports.createDesignation = async (req, res, next) => {
  try {
    const { name, code, departmentId, description } = req.body;

    if (!name || !code || !departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide designation name, code, and department ID'
      });
    }

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: parseInt(departmentId) }
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Check if designation code already exists in this department
    const existingDesignation = await prisma.designation.findFirst({
      where: {
        departmentId: parseInt(departmentId),
        OR: [{ name }, { code }]
      }
    });

    if (existingDesignation) {
      return res.status(400).json({
        success: false,
        message: 'Designation name or code already exists in this department'
      });
    }

    const designation = await prisma.designation.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        departmentId: parseInt(departmentId),
        description: description?.trim() || null
      },
      include: {
        department: {
          select: { id: true, name: true, code: true }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Designation created successfully',
      data: designation
    });
  } catch (error) {
    next(error);
  }
};

// Update designation
exports.updateDesignation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, description, isActive } = req.body;

    const existingDesignation = await prisma.designation.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingDesignation) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found'
      });
    }

    // Check for duplicate name/code in same department (excluding current designation)
    if (name || code) {
      const duplicate = await prisma.designation.findFirst({
        where: {
          AND: [
            { id: { not: parseInt(id) } },
            { departmentId: existingDesignation.departmentId },
            { OR: [] }
          ]
        }
      });

      if (name) duplicate.where.AND[2].OR.push({ name });
      if (code) duplicate.where.AND[2].OR.push({ code });

      const foundDuplicate = await prisma.designation.findFirst(duplicate.where);
      if (foundDuplicate) {
        return res.status(400).json({
          success: false,
          message: 'Designation name or code already exists in this department'
        });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (code !== undefined) updateData.code = code.trim().toUpperCase();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const designation = await prisma.designation.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        department: {
          select: { id: true, name: true, code: true }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Designation updated successfully',
      data: designation
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// DEFAULT KPI MANAGEMENT
// ============================================

// Get default KPIs for a designation
exports.getDefaultKPIs = async (req, res, next) => {
  try {
    const { designationId } = req.params;
    const { type } = req.query;

    const where = { designationId: parseInt(designationId) };
    if (type) where.type = type;

    const kpis = await prisma.defaultKPI.findMany({
      where,
      include: {
        designation: {
          select: { id: true, name: true, code: true }
        }
      },
      orderBy: [{ type: 'asc' }, { metricName: 'asc' }]
    });

    res.status(200).json({
      success: true,
      count: kpis.length,
      data: kpis
    });
  } catch (error) {
    next(error);
  }
};

// Create default KPI
exports.createDefaultKPI = async (req, res, next) => {
  try {
    const {
      designationId, metricName, type, category,
      defaultTarget, unit, targetMin, targetMax, description
    } = req.body;

    if (!designationId || !metricName || !type || !category || !defaultTarget || !unit) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Validate types
    const validTypes = ['daily', 'weekly', 'monthly'];
    const validCategories = ['applications', 'interviews', 'assessments', 'calls', 'meetings', 'closures', 'screenings', 'submissions', 'placements'];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Type must be one of: ${validTypes.join(', ')}`
      });
    }

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Category must be one of: ${validCategories.join(', ')}`
      });
    }

    // Check if designation exists
    const designation = await prisma.designation.findUnique({
      where: { id: parseInt(designationId) }
    });

    if (!designation) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found'
      });
    }

    // Check for duplicate KPI
    const existingKPI = await prisma.defaultKPI.findFirst({
      where: {
        designationId: parseInt(designationId),
        metricName,
        type
      }
    });

    if (existingKPI) {
      return res.status(400).json({
        success: false,
        message: 'KPI with this metric name and type already exists for this designation'
      });
    }

    const kpiData = {
      designationId: parseInt(designationId),
      metricName: metricName.trim(),
      type,
      category,
      defaultTarget: parseInt(defaultTarget),
      unit: unit.trim(),
      description: description?.trim() || null
    };

    // Add min/max targets for monthly KPIs
    if (type === 'monthly') {
      if (targetMin) kpiData.targetMin = parseInt(targetMin);
      if (targetMax) kpiData.targetMax = parseInt(targetMax);
    }

    const kpi = await prisma.defaultKPI.create({
      data: kpiData,
      include: {
        designation: {
          select: { id: true, name: true, code: true }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Default KPI created successfully',
      data: kpi
    });
  } catch (error) {
    next(error);
  }
};

// Update default KPI
exports.updateDefaultKPI = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const existingKPI = await prisma.defaultKPI.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingKPI) {
      return res.status(404).json({
        success: false,
        message: 'Default KPI not found'
      });
    }

    // Convert numeric fields
    if (updateData.defaultTarget !== undefined) {
      updateData.defaultTarget = parseInt(updateData.defaultTarget);
    }
    if (updateData.targetMin !== undefined) {
      updateData.targetMin = parseInt(updateData.targetMin);
    }
    if (updateData.targetMax !== undefined) {
      updateData.targetMax = parseInt(updateData.targetMax);
    }

    // Trim string fields
    if (updateData.metricName !== undefined) {
      updateData.metricName = updateData.metricName.trim();
    }
    if (updateData.unit !== undefined) {
      updateData.unit = updateData.unit.trim();
    }
    if (updateData.description !== undefined) {
      updateData.description = updateData.description?.trim() || null;
    }

    const kpi = await prisma.defaultKPI.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        designation: {
          select: { id: true, name: true, code: true }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Default KPI updated successfully',
      data: kpi
    });
  } catch (error) {
    next(error);
  }
};

// Delete default KPI (soft delete by setting isActive to false)
exports.deleteDefaultKPI = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingKPI = await prisma.defaultKPI.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingKPI) {
      return res.status(404).json({
        success: false,
        message: 'Default KPI not found'
      });
    }

    await prisma.defaultKPI.update({
      where: { id: parseInt(id) },
      data: { isActive: false }
    });

    res.status(200).json({
      success: true,
      message: 'Default KPI deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
