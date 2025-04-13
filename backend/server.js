const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const hrRoutes = require('./departments/hr/routes/hr.routes');
const crmRoutes = require('./departments/crm/routes/crm.routes');
const htmlRoutes = require('./htmlRoutes'); // Import HTML routes

const app = express();
const PORT = 4000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// Session Setup
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false, // <- important!
    cookie: {
      secure: false,          // keep this false for localhost (or use env-based)
      httpOnly: true
    }
  }));
  

// Static Files
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.static(path.join(__dirname, '..', 'views')));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use('/auth', authRoutes);
app.use('/hr', hrRoutes);
app.use("/crm", crmRoutes);


// Use HTML routes for HR Manager pages
htmlRoutes(app);

// Default Route - Login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'index.html'));
});

// Dashboard Route
app.get('/dashboard', (req, res) => {
    console.log(" Session at /dashboard:", req.session);

    if (!req.session.user) {
        return res.redirect('/');  // If no session, redirect to login
    }

    // Ensure the user has permission to access their dashboard
    const roleDashboards = {
        'owner': 'owner_dashboard.html',
        'office_administrator': '/hr_manager/hr_dashboard.html',
        'liaison_officer': 'manager_crm.html',
        'finance_accounting': 'manager_finance.html',
        'general_foreman': 'manager_manufacturing.html',
        'warehouse_supervisor': 'manager_supply_chain.html',
        'corporate_secretary': 'manager_corporate_secretary.html'
    };

    const userRole = req.session.user.role_name; // Get the role name from session
    const dashboardFile = roleDashboards[userRole]; // Get the corresponding dashboard

    // If role has no associated dashboard, show an error
    if (!dashboardFile) {
        console.error(`❌ No dashboard assigned for role: ${userRole}`);
        return res.status(403).send("Unauthorized access.");
    }

    // Serve the corresponding dashboard
    const dashboardPath = path.join(__dirname, '..', 'views', dashboardFile);
    res.sendFile(dashboardPath, (err) => {
        if (err) {
            console.error(`❌ Dashboard file not found: ${dashboardFile}`);
        }
    });
});

// Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ message: "Logout failed." });
        res.redirect("/");
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
