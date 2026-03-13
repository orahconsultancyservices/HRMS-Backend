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
              avatar: true,
              teamMembers: { select: { id: true } }
            }
          });

          if (freshUser) {
            req.user = {
              ...freshUser,
              role: resolveRole(freshUser),
              teamMemberIds: freshUser.teamMembers.map(m => m.id)
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
            avatar: true,
            teamMembers: { select: { id: true } }
          }
        });

        if (user) {
          req.user = {
            ...user,
            role: resolveRole(user),
            teamMemberIds: user.teamMembers.map(m => m.id)
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

function resolveRole(user) {
  let role = user.role || 'employee';
  if (role === 'employee') {
    const pos = (user.position || '').toLowerCase();
    if (
      pos.includes('team lead') || pos.includes('team leader') ||
      pos.includes(' tl')       || pos === 'tl'               ||
      pos.includes('lead recruiter') || pos.includes('senior lead')
    ) {
      role = 'teamlead';
    }
  }
  return role;
}