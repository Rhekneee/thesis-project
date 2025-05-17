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
        const { employee_id, password } = req.body;
        console.log("�� Login attempt with username/userid:", employee_id);

        // First check if it's a developer trying to log in using username
        const checkDeveloperSQL = `
            SELECT u.id, u.username, u.password, da.status
            FROM users u
            JOIN developer_accounts da ON u.id = da.id
            WHERE u.username = ? AND da.status = 'active'
        `;
        
        console.log("🔍 Checking if developer exists with username...");
        const [developers] = await db.query(checkDeveloperSQL, [employee_id]);
        
        if (developers.length > 0) {
            const developer = developers[0];
            const isPasswordValid = await bcrypt.compare(password, developer.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: "Invalid credentials." });
            }
            
            // Get user details for session using the user id
            const [userDetails] = await db.query(`
                SELECT u.id, u.email, u.username, u.role_id, r.name AS role_name, e.employee_id
                FROM users u
                JOIN roles r ON u.role_id = r.id
                LEFT JOIN employees e ON u.id = e.user_id
                WHERE u.id = ?
            `, [developer.id]);

            if (userDetails.length > 0) {
                const user = userDetails[0];
                req.session.user = {
                    id: user.id,  // This is the reference id from users table
                    email: user.email,
                    username: user.username,  // This is what they used to login
                    role_name: user.role_name,
                    employee_id: user.employee_id,
                    is_external: true
                };
                return res.status(200).json({ 
                    message: "Login successful",
                    redirect: "/dashboard"
                });
            }
        }

        // If not a developer, try normal employee login - ONLY through employee_id
        const checkUserSQL = `
            SELECT users.id, users.email, users.username, users.password, users.created_at, 
                   users.role_id, roles.name AS role_name, employees.employee_id
            FROM users
            JOIN roles ON users.role_id = roles.id
            JOIN employees ON users.id = employees.user_id
            WHERE employees.employee_id = ?;
        `;
        
        console.log("🔍 Checking if employee exists with employee_id...");
        const [users] = await db.query(checkUserSQL, [employee_id]);
        console.log("🔍 Employee check result:", users);

        if (users.length === 0) {
            console.log("❌ No user found with the provided credentials");
            return res.status(401).json({ message: "Invalid credentials." });
        }

        const user = users[0];
        console.log("🔍 Found user:", { 
            id: user.id, 
            employee_id: user.employee_id, 
            role: user.role_name,
            username: user.username
        });

        // Now check password using bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            console.log("❌ Password mismatch");
            return res.status(401).json({ message: "Invalid password." });
        }

        console.log("✅ Login successful for employee:", user.employee_id);

        // Set session data
        req.session.user = {
            id: user.id,
            email: user.email,
            username: user.username,
            role_name: user.role_name,
            employee_id: user.employee_id,
            is_external: false
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
