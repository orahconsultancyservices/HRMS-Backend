// src/middleware/authMiddleware.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Extract user info from request and attach to req.user.
 * NEVER throws — always calls next() so requests are never silently blocked.
 */
exports.extractUser = async (req, res, next) => {
  try {
    // ── Try x-user header first (frontend sends this) ──────────────────────
    const userHeader = req.headers['x-user'];
    if (userHeader) {
      let parsed;
      try {
        parsed = JSON.parse(userHeader);
      } catch {
        // Bad JSON — skip header, continue
      }

      if (parsed?.id) {
        try {
          const freshUser = await prisma.employee.findUnique({
            where: { id: parsed.id },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              orgEmail: true,
              employeeId: true,
              role: true,
              reportTo: true,
              position: true,
              department: true,
              departmentId: true,
              managesDepartment: true,
              avatar: true,
              teamMembers: { select: { id: true } },
              permissions: {
                where: { isActive: true },
                select: { id: true, targetType: true, targetId: true, targetName: true, accessLevel: true, isActive: true }
              }
            }
          });

          if (freshUser) {
            req.user = {
              ...freshUser,
              role: resolveRole(freshUser, parsed.role),
              teamMemberIds: freshUser.teamMembers.map(m => m.id),
              accessPermissions: freshUser.permissions || []
            };
            return next();
          }
        } catch (dbErr) {
          console.warn('⚠️  extractUser: DB lookup failed for x-user header:', dbErr.message);
          // Fall through — don't block the request
        }
      }
    }

    // ── Try userId / empId from query or body ──────────────────────────────
    const userId =
      req.query.userId  || req.query.empId ||
      req.body?.userId  || req.body?.empId;

    if (userId) {
      try {
        const user = await prisma.employee.findUnique({
          where: { id: parseInt(userId) },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            orgEmail: true,
            employeeId: true,
            role: true,
            reportTo: true,
            position: true,
            department: true,
            departmentId: true,
            managesDepartment: true,
            avatar: true,
            teamMembers: { select: { id: true } },
            permissions: {
              where: { isActive: true },
              select: { id: true, targetType: true, targetId: true, targetName: true, accessLevel: true, isActive: true }
            }
          }
        });

        if (user) {
          req.user = {
            ...user,
            role: resolveRole(user, null),   // no session role available from query/body path
            teamMemberIds: user.teamMembers.map(m => m.id),
            accessPermissions: user.permissions || []
          };
        }
      } catch (dbErr) {
        console.warn('⚠️  extractUser: DB lookup failed for userId param:', dbErr.message);
      }
    }

    // Always continue — req.user may be undefined for unauthenticated endpoints
    next();

  } catch (err) {
    // Absolute safety net — never block a request
    console.error('❌ extractUser unexpected error:', err.message);
    next();
  }
};

/**
 * Require authenticated user — use on protected routes.
 */
exports.requireAuth = (req, res, next) => {
  if (!req.user?.id) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized — please provide user information'
    });
  }
  next();
};

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Resolve the effective role for a user.
 *
 * Priority order:
 *  1. DB role = 'admin'                 → 'employer'  (explicit admin record)
 *  2. DB role is an explicit non-default → use DB role (manager / teamlead / hr)
 *  3. Session role from x-user header   → trust it (was set by a successful login)
 *  4. Position-string heuristics        → detect teamlead / hr from job title
 *  5. Default                           → 'employee'
 *
 * Why we trust sessionRole for the employer case:
 *   The admin user is auto-created with role='employee' (Prisma default), but the
 *   auth controller always returns role='employer' on login.  Without this fallback
 *   the admin's DB lookup would resolve to 'employee', causing the department filter
 *   to scope the admin to only themselves.
 */
function resolveRole(user, sessionRole) {
  const dbRole = user.role;

  // Admin DB record → treat as employer
  if (dbRole === 'admin') return 'employer';

  // Any explicitly set non-default DB role takes priority
  if (dbRole && dbRole !== 'employee') return dbRole;

  // DB role is 'employee' (default / not explicitly set).
  // Trust the role that was stamped into the session at login time.
  const VALID_SESSION_ROLES = ['employer', 'manager', 'teamlead', 'hr'];
  if (sessionRole && VALID_SESSION_ROLES.includes(sessionRole)) return sessionRole;

  // Last resort: detect from position string
  const pos = (user.position || '').toLowerCase();
  if (
    pos === 'hr' ||
    pos.includes('human resource') ||
    pos.includes('hr manager') ||
    pos.includes('hr executive') ||
    pos.includes('hr officer')
  ) return 'hr';

  if (
    pos.includes('team lead') || pos.includes('team leader') ||
    pos.includes(' tl')       || pos === 'tl'               ||
    pos.includes('lead recruiter') || pos.includes('senior lead')
  ) return 'teamlead';

  return 'employee';
}