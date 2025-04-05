const db = require("../db");

// Helper function to authenticate user
const authenticateUser = async (email, password) => {
    const SQL_COMMAND = `
        SELECT users.id, users.email, users.password, users.created_at, users.role_id, permission.role_name 
        FROM users 
        JOIN permission ON users.role_id = permission.id
        WHERE users.email = ? AND users.password = ?;
    `;

    const [users] = await db.query(SQL_COMMAND, [email, password]);

    if (users.length === 0) {
        throw new Error("Invalid email or password");
    }

    return users[0];
};

// Login function
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Fetch user details along with the role_name from the permission table
        const SQL_COMMAND = `
        SELECT users.id, users.email, users.password, users.created_at, users.permission_id, permission.role_name 
        FROM users 
        JOIN permission ON users.permission_id = permission.id
        WHERE users.email = ? AND users.password = ?;
    `;
    
        const [users] = await db.query(SQL_COMMAND, [email, password]);
    
        if (users.length === 0) {
            console.log("❌ Invalid email or password");
            return res.status(401).json({ message: "Invalid email or password." });
        }
    
        const user = users[0];
        console.log(`✅ Login successful for ${user.role_name} (Permission ID: ${user.permission_id}): ${user.email}`);
    
        // Store user data in session
        req.session.user = {
            id: user.id,
            email: user.email,
            permission_id: user.permission_id,  // Use permission_id from users table
            role_name: user.role_name,  // Use role_name from permission table
            created_at: user.created_at,
        };

        req.session.save((err) => {
            if (err) {
                console.error("❌ Error saving session:", err);
                return res.status(500).json({ message: "Session error." });
            }

            // Redirect to the dashboard
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
        res.redirect("/");
    });
};
