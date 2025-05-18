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
const htmlRoutes = require('./htmlRoutes'); 

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

const sessionStore = new MySQLStore({}, db);
// Session Setup
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 2
    }
  }));  

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
        'customer': '/customer/dashboard'
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
