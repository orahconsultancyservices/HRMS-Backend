const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

// Load environment variables FIRST
dotenv.config();

const app = express();

// ─── 1. CORS ──────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://hrms-frontend-624104167591.us-central1.run.app',
    'http://localhost:5173',  // for local development
    'http://localhost:5173',  // for Vite local development
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-user',
    'X-Requested-With',
    'Cache-Control',
    'Pragma',
    'Expires'
  ],
  optionsSuccessStatus: 204
}));

// ─── 2. Body parsers (ONCE, BEFORE routes) ────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── 3. Cache-control header for all /api routes ──────────────────────────────
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ─── 4. Swagger ───────────────────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── 5. Auth middleware (safe — won't crash on DB error) ──────────────────────
const { extractUser } = require('./middleware/authMiddleware');

app.use(async (req, res, next) => {
  try {
    await extractUser(req, res, next);
  } catch (err) {
    console.error('⚠️  extractUser threw unexpectedly:', err.message);
    next(); // don't block the request — just continue without req.user
  }
});

// ─── 6. Routes ────────────────────────────────────────────────────────────────
const authRoutes           = require('./routes/authRoutes');
const employeeRoutes       = require('./routes/employeeRoutes');
const leaveRoutes          = require('./routes/leaveRoutes');
const attendanceRoutes     = require('./routes/attendanceRoutes');
const birthdayRoutes       = require('./routes/birthdayRoutes');
const taskRoutes           = require('./routes/taskRoutes');
const departmentRoutes     = require('./routes/departmentRoutes');
const performanceRoutes    = require('./routes/performanceRoutes');
const taskAssignmentRoutes = require('./routes/taskAssignmentRoutes');
const accessPermissionRoutes = require('./routes/accessPermissionRoutes');
const settingsRoutes         = require('./routes/settingsRoutes');

app.use('/api/auth',            authRoutes);
app.use('/api/employees',       employeeRoutes);
app.use('/api/leaves',          leaveRoutes);
app.use('/api/attendance',      attendanceRoutes);
app.use('/api/birthdays',       birthdayRoutes);
app.use('/api/tasks',           taskRoutes);
app.use('/api/departments',     departmentRoutes);
app.use('/api/performance',     performanceRoutes);
app.use('/api/task-assignment', taskAssignmentRoutes);
app.use('/api/access-permissions', accessPermissionRoutes);
app.use('/api/settings',           settingsRoutes);

// ─── 7. Health / root ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Employee Management System API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      employees: '/api/employees',
      leaves: '/api/leaves',
      attendance: '/api/attendance',
      birthdays: '/api/birthdays',
      tasks: '/api/tasks',
      health: '/health'
    }
  });
});

// ─── 8. Error handler (BEFORE 404 catch-all) ──────────────────────────────────
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// ─── 9. 404 catch-all (LAST) ──────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// ─── 10. Start server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || process.env.SERVER_PORT || 5000;
// const PORT = process.env.PORT || process.env.SERVER_PORT || 8080;

app.listen(PORT, '0.0.0.0', () => {  // ✅ Explicit 0.0.0.0 binding for Cloud Run
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📘 Swagger: http://localhost:${PORT}/api-docs`);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});