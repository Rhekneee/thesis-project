const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const hrRoutes = require('./departments/hr/routes/hr.routes');
const crmRoutes = require('./departments/crm/routes/crm.routes');

const app = express();  
const PORT = 4000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// 🔹 Session Configuration
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }  // Change to true if using HTTPS
}));

// 🔹 Serve Static Files
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // ✅ Serve uploaded resumes

// 🔹 Routes
app.use('/auth', authRoutes);
app.use('/hr', hrRoutes);
app.use("/crm", crmRoutes);

// ❌ REMOVE DUPLICATE UPLOAD ROUTE HERE

// 🔹 Default route - Load login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'index.html'));
});


app.get('/customer', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'customer.html'));
});

// 🔹 Role-Based Dashboard Route
app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }

    const roleDashboards = {
        owner: "owner_dashboard.html",
        office_administrator: "manager_hr.html",
        liaison_officer: "manager_crm.html",
        finance_accounting: "manager_finance.html",
        general_foreman: "manager_manufacturing.html",
        warehouse_supervisor: "manager_supply_chain.html",
        corporate_secretary: "manager_corporate_secretary.html"
    };

    const dashboardFile = roleDashboards[req.session.user.role_name];

    if (!dashboardFile) {
        console.error(`❌ No dashboard assigned for role: ${req.session.user.role_name}`);
        return res.status(403).send("Unauthorized access.");
    }

    const dashboardPath = path.join(__dirname, '..', 'views', dashboardFile);
    res.sendFile(dashboardPath, (err) => {
        if (err) {
            console.error(`❌ Dashboard file not found: ${dashboardFile}`);
        }
    });
});

// 🔹 Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("❌ Logout error:", err);
            return res.status(500).json({ message: "Logout failed." });
        }
        res.redirect("/");
    });
});

// 🔹 Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
