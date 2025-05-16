const db = require("../db");
const bcrypt = require('bcrypt');

// Helper function to authenticate employee
const authenticateEmployee = async (employee_id, password) => {
    const SQL_COMMAND = `
        SELECT users.id, users.email, users.password, users.created_at, users.role_id, roles.name AS role_name, employees.employee_id
        FROM users 
        JOIN roles ON users.role_id = roles.id
        JOIN employees ON users.id = employees.user_id
        WHERE employees.employee_id = ?;
    `;

    const [users] = await db.query(SQL_COMMAND, [employee_id]);

    if (users.length === 0) {
        throw new Error("Invalid employee ID");
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
        throw new Error("Invalid password");
    }

    return user;
};

// Helper function to authenticate developer/customer
const authenticateNonEmployee = async (username, password) => {
    const SQL_COMMAND = `
        SELECT users.id, users.email, users.password, users.created_at, users.role_id, roles.name AS role_name
        FROM users 
        JOIN roles ON users.role_id = roles.id
        WHERE users.username = ? AND users.role_id IN (25, 26);
    `;

    const [users] = await db.query(SQL_COMMAND, [username]);

    if (users.length === 0) {
        throw new Error("Invalid username");
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
        throw new Error("Invalid password");
    }

    return user;
};

// Function to fetch permissions based on role_id
const getPermissionsForRole = async (role_id) => {
    const SQL_COMMAND = `
        SELECT permission_name 
        FROM role_permission 
        WHERE role_id = ?;
    `;
    
    const [permissions] = await db.query(SQL_COMMAND, [role_id]);
    return permissions.map(permission => permission.permission_name);
};

// Login function
exports.login = async (req, res) => {
    try {
        const { identifier, password } = req.body;
        console.log("🔍 Login attempt with identifier:", identifier);

        let user;
        let isEmployee = false;

        // First try to authenticate as employee
        try {
            user = await authenticateEmployee(identifier, password);
            isEmployee = true;
            console.log("✅ Authenticated as employee");
        } catch (employeeError) {
            // If employee authentication fails, try as developer/customer
            try {
                user = await authenticateNonEmployee(identifier, password);
                console.log("✅ Authenticated as developer/customer");
            } catch (nonEmployeeError) {
                // If both authentications fail, determine which error to show
                if (employeeError.message === "Invalid password" || nonEmployeeError.message === "Invalid password") {
                    throw new Error("Invalid password");
                } else if (employeeError.message === "Invalid employee ID") {
                    throw new Error("Invalid employee ID");
                } else {
                    throw new Error("Invalid username");
                }
            }
        }

        console.log("🔍 Found user:", { 
            id: user.id, 
            role: user.role_name,
            employee_id: user.employee_id || 'N/A'
        });

        // Set session data
        req.session.user = {
            id: user.id,
            email: user.email,
            role_name: user.role_name,
            employee_id: user.employee_id || null
        };
        console.log("📝 Session data set:", req.session.user);

        // Determine redirect path based on role
        let redirectPath = '/dashboard';
        if (user.role_id === 25) { // Developer
            redirectPath = '/developer/developer_dashboard';
        } else if (user.role_id === 26) { // Customer
            redirectPath = '/customer/dashboard';
        }

        // Send JSON response for successful login
        return res.status(200).json({ 
            message: "Login successful",
            redirect: redirectPath
        });

    } catch (error) {
        console.error("❌ Login error:", error);
        return res.status(401).json({ message: error.message });
    }
};

// Logout function
exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("❌ Logout error:", err);
            return res.status(500).json({ message: "Logout failed." });
        }
        res.redirect("/");  // Redirect to login page after logout
    });
};
