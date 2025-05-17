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
        console.log("🔍 DEBUG: Login attempt started");
        console.log("🔍 DEBUG: Input credentials - employee_id/username:", employee_id);
        console.log("🔍 DEBUG: Password provided:", password ? "Yes" : "No");

        // First check if it's a developer trying to log in using username
        const checkDeveloperSQL = `
            SELECT u.id, u.username, u.password, da.status
            FROM users u
            JOIN developer_accounts da ON u.id = da.id
            WHERE u.username = ? AND da.status = 'active'
        `;
        
        console.log("🔍 DEBUG: Checking developer account for username:", employee_id);
        const [developers] = await db.query(checkDeveloperSQL, [employee_id]);
        console.log("🔍 DEBUG: Developer query result:", developers.length > 0 ? "Found" : "Not found");
        
        if (developers.length > 0) {
            console.log("🔍 DEBUG: Developer account found, attempting password verification");
            const developer = developers[0];
            console.log("🔍 DEBUG: Developer details - ID:", developer.id, "Username:", developer.username, "Status:", developer.status);
            
            const isPasswordValid = await bcrypt.compare(password, developer.password);
            console.log("🔍 DEBUG: Password verification result:", isPasswordValid ? "Valid" : "Invalid");
            
            if (!isPasswordValid) {
                console.log("❌ DEBUG: Developer password verification failed");
                return res.status(401).json({ message: "Invalid credentials." });
            }
            
            console.log("🔍 DEBUG: Fetching complete user details for developer");
            // Get user details for session using the user id
            const [userDetails] = await db.query(`
                SELECT u.id, u.email, u.username, u.role_id, r.name AS role_name, e.employee_id
                FROM users u
                JOIN roles r ON u.role_id = r.id
                LEFT JOIN employees e ON u.id = e.user_id
                WHERE u.id = ?
            `, [developer.id]);

            console.log("🔍 DEBUG: User details query result:", userDetails.length > 0 ? "Found" : "Not found");

            if (userDetails.length > 0) {
                const user = userDetails[0];
                console.log("🔍 DEBUG: Setting session for developer - ID:", user.id, "Role:", user.role_name);
                req.session.user = {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    role_name: user.role_name,
                    employee_id: user.employee_id,
                    is_external: true
                };
                console.log("✅ DEBUG: Developer login successful");
                return res.status(200).json({ 
                    message: "Login successful",
                    redirect: "/dashboard"
                });
            } else {
                console.log("❌ DEBUG: Developer found but user details not found");
            }
        } else {
            console.log("🔍 DEBUG: Not a developer account, checking employee login");
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
        
        console.log("🔍 DEBUG: Checking employee account for ID:", employee_id);
        const [users] = await db.query(checkUserSQL, [employee_id]);
        console.log("🔍 DEBUG: Employee query result:", users.length > 0 ? "Found" : "Not found");

        if (users.length === 0) {
            console.log("❌ DEBUG: No employee found with ID:", employee_id);
            return res.status(401).json({ message: "Invalid credentials." });
        }

        const user = users[0];
        console.log("🔍 DEBUG: Employee found - ID:", user.id, "Role:", user.role_name);

        // Now check password using bcrypt
        console.log("🔍 DEBUG: Attempting password verification for employee");
        const isPasswordValid = await bcrypt.compare(password, user.password);
        console.log("🔍 DEBUG: Employee password verification result:", isPasswordValid ? "Valid" : "Invalid");
        
        if (!isPasswordValid) {
            console.log("❌ DEBUG: Employee password verification failed");
            return res.status(401).json({ message: "Invalid password." });
        }

        console.log("🔍 DEBUG: Setting session for employee");
        req.session.user = {
            id: user.id,
            email: user.email,
            username: user.username,
            role_name: user.role_name,
            employee_id: user.employee_id,
            is_external: false
        };
        console.log("📝 DEBUG: Session data set:", req.session.user);

        // Determine redirect path based on role
        let redirectPath = '/dashboard';
        if (user.role_id === 25) { // Developer
            redirectPath = '/developer/developer_dashboard';
        } else if (user.role_id === 26) { // Customer
            redirectPath = '/customer/dashboard';
        }
        console.log("🔍 DEBUG: Redirect path determined:", redirectPath);

        console.log("✅ DEBUG: Employee login successful");
        return res.status(200).json({ 
            message: "Login successful",
            redirect: redirectPath
        });

    } catch (error) {
        console.error("❌ DEBUG: Login error occurred:", error);
        console.error("❌ DEBUG: Error stack:", error.stack);
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
