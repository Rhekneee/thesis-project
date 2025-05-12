const db = require("../db");
const bcrypt = require('bcrypt');

// Helper function to authenticate user
const authenticateUser = async (email, password) => {
    const SQL_COMMAND = `
        SELECT users.id, users.email, users.password, users.created_at, users.role_id, roles.name AS role_name 
        FROM users 
        JOIN roles ON users.role_id = roles.id
        WHERE users.email = ?;
    `;

    const [users] = await db.query(SQL_COMMAND, [email]);

    if (users.length === 0) {
        throw new Error("Invalid email or password");
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
        throw new Error("Invalid email or password");
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
        const { email, password } = req.body;
        console.log("🔍 Login attempt with:", { email });

        // First check if user exists
        const checkUserSQL = `
            SELECT users.id, users.email, users.password, users.created_at, users.role_id, roles.name AS role_name, employees.employee_id
            FROM users
            JOIN roles ON users.role_id = roles.id
            JOIN employees ON users.id = employees.user_id
            WHERE LOWER(users.email) = LOWER(?);
        `;
        
        console.log("🔍 Checking if user exists...");
        const [users] = await db.query(checkUserSQL, [email]);
        console.log("🔍 User check result:", users);

        if (users.length === 0) {
            console.log("❌ User not found");
            return res.status(401).json({ message: "Invalid email address." });
        }

        const user = users[0];
        console.log("🔍 Found user:", { 
            id: user.id, 
            email: user.email, 
            role: user.role_name
        });

        // Now check password using bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            console.log("❌ Password mismatch");
            return res.status(401).json({ message: "Invalid password." });
        }

        console.log("✅ Login successful for user:", user.email);

        // Set session data
        req.session.user = {
            id: user.id,
            email: user.email,
            role_name: user.role_name,
            employee_id: user.employee_id
        };
        console.log("📝 Session data set:", req.session.user);

        // Send JSON response for successful login
        return res.status(200).json({ 
            message: "Login successful",
            redirect: "/dashboard"
        });

    } catch (error) {
        console.error("❌ Login error:", error);
        return res.status(500).json({ message: "Internal server error" });
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
