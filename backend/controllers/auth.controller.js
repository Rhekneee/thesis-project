const db = require("../db");

// Helper function to authenticate user
const authenticateUser = async (email, password) => {
    const SQL_COMMAND = `
        SELECT users.id, users.email, users.password, users.created_at, users.role_id, roles.name AS role_name 
        FROM users 
        JOIN roles ON users.role_id = roles.id
        WHERE users.email = ? AND users.password = ?;
    `;

    const [users] = await db.query(SQL_COMMAND, [email, password]);

    if (users.length === 0) {
        throw new Error("Invalid email or password");
    }

    return users[0];
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

        // Fetch user details along with the role_name from the roles table
        const SQL_COMMAND = `
              SELECT users.id, users.email, users.password, users.created_at, users.role_id, roles.name AS role_name, employees.employee_id
            FROM users
            JOIN roles ON users.role_id = roles.id
            JOIN employees ON users.id = employees.user_id  -- Join the employees table to fetch employee details
            WHERE users.email = ? AND users.password = ?;
        `;
    
        const [users] = await db.query(SQL_COMMAND, [email, password]);
    
        if (users.length === 0) {
            console.log("❌ Invalid email or password");
            return res.status(401).json({ message: "Invalid email or password." });
        }
    
        const user = users[0];
        console.log(`✅ Login successful for ${user.role_name} (Role ID: ${user.id}): ${user.email}`);
    
        // Fetch the user's permissions based on role_id
        const permissions = await getPermissionsForRole(user.role_id);
        console.log(`Permissions for ${user.role_name}:`, permissions);

        // Store user data and permissions in the session
        req.session.user = {
            id: user.id,
            email: user.email,
            role_id: user.role_id,
            role_name: user.role_name,
            created_at: user.created_at,
            employee_id: user.employee_id,  // Add employee_id to the session
            permissions: permissions, // Store permissions array in the session
        };
        console.log("Session after login:", req.session.user);

        req.session.save((err) => {
            if (err) {
                console.error("❌ Error saving session:", err);
                return res.status(500).json({ message: "Session error." });
            }

            // Redirect to the dashboard after successful login
            res.redirect('/dashboard');
        });

    } catch (error) {
        console.error("❌ Login Error:", error.message);
        res.status(500).json({ message: "Internal Server Error." });
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
