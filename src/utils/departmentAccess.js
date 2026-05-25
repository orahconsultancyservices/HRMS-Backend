const toUnique = (values) => [...new Set(values.filter(Boolean))];

const getAccessibleDepartments = (user) => {
  if (!user) return null;
  if (user.role === "employer" || user.role === "admin" || user.role === "hr") return null;

  const ownDepartment = user.department ? [user.department] : [];
  const extraDepartments = (user.accessPermissions || [])
    .filter((permission) => permission?.targetType === "department" && permission?.isActive !== false)
    .map((permission) => permission.targetName);

  const departments = toUnique([...ownDepartment, ...extraDepartments]);
  return departments.length > 0 ? departments : [];
};

const enforceDepartmentScope = (user, relationField = "employee") => {
  const accessibleDepartments = getAccessibleDepartments(user);
  if (accessibleDepartments === null) return {};

  if (user?.role === "employee") {
    return { [`${relationField}Id`]: user.id };
  }

  return {
    [relationField]: {
      department: { in: accessibleDepartments },
    },
  };
};

module.exports = {
  getAccessibleDepartments,
  enforceDepartmentScope,
};
