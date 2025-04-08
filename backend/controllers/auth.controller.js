const db = require("../db");
<<<<<<< HEAD
<<<<<<< HEAD
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
=======
=======
>>>>>>> aa1bb20 (Initial commit)

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
<<<<<<< HEAD
>>>>>>> 85f9240 (Initial commit)
=======
>>>>>>> aa1bb20 (Initial commit)
};

// Login function
exports.login = async (req, res) => {
    try {
<<<<<<< HEAD
<<<<<<< HEAD
        const { employee_id, password } = req.body;

        // First check if it's a developer trying to log in using username
        const checkDeveloperSQL = `
            SELECT u.id, u.username, u.password, da.status
            FROM users u
            JOIN developer_accounts da ON u.id = da.id
            WHERE u.username = ? AND da.status = 'active'
        `;
        
        
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
                
                // Fetch permissions for the user's role
                const permissions = await getPermissionsForRole(user.role_id);

                req.session.user = {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    role_name: user.role_name,
                    role_id: user.role_id,
                    employee_id: user.employee_id,
                    is_external: true,
                    permissions
                };
                
                return res.status(200).json({ 
                    message: "Login successful",
                    redirect: "/dashboard"
                });
            } else {
                
            }
        } else {
            
        }

        // Check if it's a supplier trying to log in using username
        const checkSupplierSQL = `
            SELECT u.id, u.username, u.password, s.status, u.role_id, s.supplier_id
            FROM users u
            JOIN supplier_account s ON u.username = s.supplier_name
            WHERE u.username = ? AND s.status = 'active' AND u.role_id = 27
        `;
        
        
        const [suppliers] = await db.query(checkSupplierSQL, [employee_id]);
        
        
        if (suppliers.length > 0) {
            
            const supplier = suppliers[0];
            const isPasswordValid = await bcrypt.compare(password, supplier.password);
            
            
            if (!isPasswordValid) {
                
                return res.status(401).json({ message: "Invalid credentials." });
            }
            
            
            // Get user details for session using the user id
            const [userDetails] = await db.query(`
                SELECT u.id, u.email, u.username, u.role_id, r.name AS role_name, s.supplier_id
                FROM users u
                JOIN roles r ON u.role_id = r.id
                JOIN supplier_account s ON u.username = s.supplier_name
                WHERE u.id = ?
            `, [supplier.id]);

            

            if (userDetails.length > 0) {
                const user = userDetails[0];
                
                // Fetch permissions for the user's role
                const permissions = await getPermissionsForRole(user.role_id);

                req.session.user = {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    role_name: user.role_name,
                    role_id: user.role_id,
                    supplier_id: user.supplier_id,
                    is_supplier: true,
                    permissions
                };
                
                return res.status(200).json({ 
                    message: "Login successful",
                    redirect: "/supplier/supplier_dashboard.html"
                });
            } else {
                
            }
        } else {
            
        }

        // If not a developer or supplier, try normal employee login
        // Support both employee_id (permanent) and email (temporary for onboarding)
        let checkUserSQL;
        let queryParams;
        
        // Check if input looks like an email
        if (employee_id.includes('@')) {
            // Login with email (temporary account for onboarding)
            checkUserSQL = `
                SELECT users.id, users.email, users.username, users.password, users.created_at, 
                       users.role_id, roles.name AS role_name, employees.employee_id, users.onboarding_completed
                FROM users
                JOIN roles ON users.role_id = roles.id
                JOIN employees ON users.id = employees.user_id
                WHERE users.email = ? AND users.onboarding_completed = 0;
            `;
            queryParams = [employee_id];
        } else {
            // Login with employee_id (permanent account)
            checkUserSQL = `
                SELECT users.id, users.email, users.username, users.password, users.created_at, 
                       users.role_id, roles.name AS role_name, employees.employee_id, users.onboarding_completed
                FROM users
                JOIN roles ON users.role_id = roles.id
                JOIN employees ON users.id = employees.user_id
                WHERE employees.employee_id = ?;
            `;
            queryParams = [employee_id];
        }
        
        const [users] = await db.query(checkUserSQL, queryParams);
        
        if (users.length === 0) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        const user = users[0];
        
        // Check password using bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid password." });
        }

        
        // Fetch permissions for the user's role
        const permissions = await getPermissionsForRole(user.role_id);

        req.session.user = {
            id: user.id,
            email: user.email,
            username: user.username,
            role_name: user.role_name,
            role_id: user.role_id,
            employee_id: user.employee_id,
            onboarding_completed: user.onboarding_completed,
            is_external: false,
            permissions
        };
        

        // Determine redirect path based on role and onboarding status
        let redirectPath = '/dashboard';
        
        // Check if user needs onboarding
        if (user.onboarding_completed === 0) {
            redirectPath = '/pre_onboarding_form.html';
        } else {
            // Normal role-based redirects for completed onboarding
            if (user.role_id === 25) { // Developer
                redirectPath = '/developer/developer_dashboard';
            } else if (user.role_id === 26) { // Customer
                redirectPath = '/customer/dashboard';
            }
        }
        

        
        return res.status(200).json({ 
            message: "Login successful",
            redirect: redirectPath
        });

    } catch (error) {
        
        return res.status(401).json({ message: error.message });
    }
};

=======
=======
>>>>>>> aa1bb20 (Initial commit)
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


<<<<<<< HEAD
>>>>>>> 85f9240 (Initial commit)
=======
>>>>>>> aa1bb20 (Initial commit)
// Logout function
exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("❌ Logout error:", err);
            return res.status(500).json({ message: "Logout failed." });
        }
<<<<<<< HEAD
<<<<<<< HEAD
        res.redirect("/");  // Redirect to login page after logout
    });
};

// Get current user information
exports.getCurrentUser = async (req, res) => {
    try {
        // Check if user is logged in
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const userId = req.session.user.id;
        
        // Get user's full information including name from employees table
        const userQuery = `
            SELECT 
                u.id,
                u.email,
                u.username,
                u.role_id,
                r.name AS role_name,
                e.employee_id,
                e.full_name,
                u.onboarding_completed,
                u.is_active
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN employees e ON u.id = e.user_id
            WHERE u.id = ?
        `;

        const [users] = await db.query(userQuery, [userId]);

        if (users.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const user = users[0];

        // Determine display name based on onboarding status
        let displayName = 'User';
        
        // Always try to use full name first if available, regardless of onboarding status
        if (user.full_name) {
            displayName = user.full_name;
        } else if (user.onboarding_completed === 1) {
            // Completed onboarding but no full name - use email or username
            displayName = user.email || user.username || 'User';
        } else {
            // Pre-onboarding and no full name - use email or username
            if (user.email) {
                displayName = user.email;
            } else if (user.username) {
                displayName = user.username;
            } else {
                displayName = 'New Employee';
            }
        }

        // Return user information
        res.json({
            id: user.id,
            email: user.email,
            username: user.username,
            role_id: user.role_id,
            role_name: user.role_name,
            employee_id: user.employee_id,
            fullName: user.full_name,
            displayName: displayName,
            onboarding_completed: user.onboarding_completed,
            is_active: user.is_active
        });

    } catch (error) {
        console.error("❌ Error getting current user:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
=======
        res.redirect("/");
    });
};
>>>>>>> 85f9240 (Initial commit)
=======
        res.redirect("/");
    });
};
>>>>>>> aa1bb20 (Initial commit)
