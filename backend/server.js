require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const MySQLStore = require("express-mysql-session")(session);
const path = require('path');
const db = require("./db");

const authRoutes = require('./routes/auth.routes');
const hrRoutes = require('./departments/hr/routes/hr.routes');
const crmRoutes = require('./departments/crm/routes/crm.routes');
const financeRoutes = require('./departments/finance/routes/finance.routes');
const scmRoutes = require('./departments/supply/routes/scm.routes');
const manuRoutes = require('./departments/manufacturing/routes/manufacturing.routes');
const htmlRoutes = require('./htmlRoutes'); 

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

const sessionStore = new MySQLStore({
    expiration: 1000 * 60 * 60 * 24, // 24 hours
    createDatabaseTable: true,
    schema: {
        tableName: 'sessions',
        columnNames: {
            session_id: 'session_id',
            expires: 'expires',
            data: 'data'
        }
    }
}, db);

// Session Setup
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: true,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        secure: false, // Changed to false to allow HTTP in development and testing
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24,
        sameSite: 'lax', // Changed from 'strict' to 'lax' to allow redirects
        path: '/'
    },
    rolling: true,
    name: 'sessionId'
}));

// Add session debug middleware
app.use((req, res, next) => {
    console.log('🔍 Session Debug:', {
        sessionID: req.sessionID,
        hasSession: !!req.session,
        hasUser: !!req.session?.user,
        cookie: req.session?.cookie,
        path: req.path
    });
    next();
});

// Add session error handling
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        // Handle CSRF token errors
        return res.status(403).json({ error: 'Invalid CSRF token' });
    }
    if (err.code === 'ECONNRESET') {
        // Handle connection reset errors
        return res.status(503).json({ error: 'Session store connection error' });
    }
    next(err);
});

// Add session check middleware
app.use((req, res, next) => {
    if (req.session && req.session.user) {
        // Refresh session on activity
        req.session.touch();
    }
    next();
});

// Static Files
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/public', express.static(path.join(__dirname, '..', 'public')));
app.use(express.static(path.join(__dirname, '..', 'views')));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Routes
app.use('/auth', authRoutes);
app.use('/hr', hrRoutes);
app.use('/crm', crmRoutes);
app.use('/finance', financeRoutes);
app.use('/scm', scmRoutes);

// Use HTML routes for HR Manager pages
htmlRoutes(app);

// Default Route - Login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'login.html'));
});

// Dashboard Route
app.get('/dashboard', (req, res) => {
    console.log("Session at /dashboard:", req.session);

    if (!req.session.user) {
        return res.redirect('/');  // If no session, redirect to login
    }

    // Get user info from session
    const userRole = req.session.user.role_name;
    const isEmployee = req.session.user.employee_id !== undefined;
    const identifier = isEmployee ? req.session.user.employee_id : req.session.user.username;
    
    console.log('User type:', isEmployee ? 'Employee' : 'External User');
    console.log('Role:', userRole);
    console.log('Identifier:', identifier);

    // Role-based dashboard mapping
    const roleDashboards = {
        // Employee dashboards (using employee_id)
        'owner': 'owner_dashboard.html',
        'office_administrator': '/hr admin/hr_admin.html',
        'finance_accounting': '/finance admin/finance_payroll.html',
        'general_foreman': '/manufacturing/manufacturing_dashboard',
        'admin_staff': '/hr_employee/attendance',
        'sales_marketing_head': '/crm admin/crm_admin.html',
        'logistics': '/scm admin/scm-dashboard.html',
        'agents': '/agents/agent_dashboard.html',
        // External user dashboards (using username)
        'developer': '/developer/developer_dashboard',
        'supplier': '/supplier/supplier_dashboard.html'
    };

    const dashboardFile = roleDashboards[userRole];

    if (!dashboardFile) {
        console.error('No dashboard found for role:', userRole);
        return res.status(404).send('Dashboard not found for your role');
    }

    // Store the identifier (employee_id or username) in session for later use
    req.session.user.identifier = identifier;

    // Redirect to the appropriate dashboard
    res.redirect(dashboardFile);
});

// Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ message: "Logout failed." });
        res.redirect("/");
    });
});

// Start Server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
