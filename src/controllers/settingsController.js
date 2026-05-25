// src/controllers/settingsController.js
const prisma = require('../lib/prisma');

// ─── Defaults ────────────────────────────────────────────────────────────────
// These are used when no override exists in the DB.
// Keys follow the pattern "category.settingName"
const DEFAULT_SETTINGS = {
  // ── Attendance ──────────────────────────────────────────────────────────
  'attendance.workStartTime':        '09:00',
  'attendance.lateBufferMinutes':    '15',
  'attendance.workEndTime':          '18:00',
  'attendance.halfDayHours':         '4',
  'attendance.minimumHoursPresent':  '8',
  'attendance.workingDays':          JSON.stringify([1, 2, 3, 4, 5]), // Mon–Fri
  'attendance.overtimeThresholdHours': '9',
  'attendance.earlyDepartureMinutes':  '30',

  // ── Leave ────────────────────────────────────────────────────────────────
  'leave.casualLeaveQuota':       '12',
  'leave.sickLeaveQuota':         '8',
  'leave.earnedLeaveQuota':       '20',
  'leave.maternityLeaveDays':     '90',
  'leave.paternityLeaveDays':     '7',
  'leave.bereavementLeaveDays':   '7',
  'leave.carryForwardEnabled':    'false',
  'leave.maxCarryForwardDays':    '0',
  'leave.minNoticeDays':          '1',
  'leave.maxConsecutiveDays':     '30',
  'leave.maxAdvanceBookingDays':  '90',
  'leave.leaveYearResetMonth':    '1',
  'leave.halfDayEnabled':         'true',
  'leave.sandwichRuleEnabled':    'false',

  // ── Employee ─────────────────────────────────────────────────────────────
  'employee.idPrefix':                    'EMP',
  'employee.idPadding':                   '3',
  'employee.probationMonths':             '3',
  'employee.noticePeriodDays':            '30',
  'employee.autoDeactivateOnLeaveDate':   'true',
  'employee.defaultDepartment':           '',
  'employee.defaultPosition':             '',

  // ── Organization ─────────────────────────────────────────────────────────
  'org.companyName':          'OCS',
  'org.companyWebsite':       '',
  'org.companyPhone':         '',
  'org.companyAddress':       '',
  'org.timezone':             'Asia/Kolkata',
  'org.dateFormat':           'DD/MM/YYYY',
  'org.timeFormat':           '12h',
  'org.currency':             'INR',
  'org.currencySymbol':       '₹',
  'org.fiscalYearStartMonth': '4',
  'org.language':             'en',

  // ── Notifications ─────────────────────────────────────────────────────────
  'notifications.birthdayReminders':     'true',
  'notifications.leaveApprovalAlerts':   'true',
  'notifications.attendanceAlerts':      'true',
  'notifications.newEmployeeAlert':      'true',
  'notifications.adminEmail':            '',
  'notifications.emailEnabled':          'false',

  // ── Security ─────────────────────────────────────────────────────────────
  'security.sessionTimeoutMinutes': '60',
  'security.maxLoginAttempts':      '5',
  'security.passwordMinLength':     '8',
  'security.requireNumber':         'true',
  'security.requireSpecialChar':    'false',
  'security.requireUppercase':      'false',
  'security.lockoutDurationMinutes':'15',
};

// ─── GET /api/settings ────────────────────────────────────────────────────────
exports.getAllSettings = async (req, res, next) => {
  try {
    const rows = await prisma.systemSettings.findMany();

    // Merge defaults with DB overrides
    const merged = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      merged[row.key] = row.value;
    }

    res.json({ success: true, data: merged });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/settings ────────────────────────────────────────────────────────
// Body: { "attendance.workStartTime": "09:30", "leave.casualLeaveQuota": "15", … }
exports.updateSettings = async (req, res, next) => {
  try {
    const updates = req.body;

    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return res.status(400).json({ success: false, message: 'Body must be a key-value object' });
    }

    // Upsert each entry
    await Promise.all(
      Object.entries(updates).map(([key, value]) => {
        const category = key.split('.')[0];
        return prisma.systemSettings.upsert({
          where:  { key },
          update: { value: String(value), category },
          create: { key, value: String(value), category },
        });
      })
    );

    // Return the full merged state after update
    const rows = await prisma.systemSettings.findMany();
    const merged = { ...DEFAULT_SETTINGS };
    for (const row of rows) merged[row.key] = row.value;

    res.json({ success: true, message: 'Settings saved successfully', data: merged });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/settings/reset/:category ─────────────────────────────────────
// Resets one category (or all if category === 'all') back to defaults
exports.resetSettings = async (req, res, next) => {
  try {
    const { category } = req.params;

    if (category && category !== 'all') {
      await prisma.systemSettings.deleteMany({ where: { category } });
    } else {
      await prisma.systemSettings.deleteMany();
    }

    res.json({ success: true, message: 'Settings reset to defaults', data: DEFAULT_SETTINGS });
  } catch (err) {
    next(err);
  }
};

// Export defaults so the route can expose them
exports.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
