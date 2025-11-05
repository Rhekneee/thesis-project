const db = require("../../../db");
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// Add a function to fix existing plain text passwords
const fixPlainTextPasswords = async () => {
    try {
        const [users] = await db.query('SELECT id, password FROM users WHERE password NOT LIKE "$2b$%"');
        
        if (users.length > 0) {
            
            for (const user of users) {
                const saltRounds = 10;
                const hashedPassword = await bcrypt.hash(user.password, saltRounds);
                
                await db.query(
                    'UPDATE users SET password = ? WHERE id = ?',
                    [hashedPassword, user.id]
                );
            }
        } else {
        }
    } catch (error) {
        console.error('❌ Error fixing passwords:', error);
        throw error;
    }
};

// Call the fix function when the module loads
fixPlainTextPasswords().catch(console.error);

const HRModel = {
    // 🔹 Save employee face encoding
    saveEmployeeFace: async (employeeId, faceEncoding) => {
        try {
            const [result] = await db.query(
                `INSERT INTO employee_faces (employee_id, face_encoding) VALUES (?, ?)`,
                [employeeId, JSON.stringify(faceEncoding)]
            );
            return result.insertId;
        } catch (error) {
            console.error("❌ Error saving employee face:", error);
            throw error;
        }
    },

    // 🔹 Get all departments (id, name)
    getAllDepartments: async () => {
        try {
            const [rows] = await db.query(`SELECT id, name FROM departments ORDER BY name`);
            return rows;
        } catch (error) {
            console.error('❌ Error fetching departments:', error);
            throw error;
        }
    },

    // 🔹 Get position_id for an employee based on their role_id
    getPositionIdByEmployeeId: async (employeeId) => {
        try {
            const [rows] = await db.query(`
                SELECT p.position_id, p.salary as basic_salary
                FROM employees e
                JOIN positions p ON e.role_id = p.role_id
                WHERE e.employee_id = ?
            `, [employeeId]);
            
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error("❌ [getPositionIdByEmployeeId] Error fetching position:", error.message || error);
            throw error;
        }
    },

    // 🔹 Get position_id and basic_salary for multiple employees
    getPositionDataForEmployees: async (employeeIds) => {
        try {
            if (!employeeIds || employeeIds.length === 0) {
                return {};
            }
            
            const placeholders = employeeIds.map(() => '?').join(',');
            const [rows] = await db.query(`
                SELECT e.employee_id, p.position_id, p.salary as basic_salary
                FROM employees e
                JOIN positions p ON e.role_id = p.role_id
                WHERE e.employee_id IN (${placeholders})
            `, employeeIds);
            
            // Convert to object for easy lookup
            const positionData = {};
            rows.forEach(row => {
                positionData[row.employee_id] = {
                    position_id: row.position_id,
                    basic_salary: row.basic_salary
                };
            });
            
            return positionData;
        } catch (error) {
            console.error("❌ [getPositionDataForEmployees] Error fetching position data:", error.message || error);
            throw error;
        }
    },

    // 🔹 Check payroll status for role changes effectiveness
    checkPayrollStatus: async () => {
        try {
            // Get current date
            const currentDate = new Date();
            const currentDateStr = currentDate.toISOString().split('T')[0];
            
            // Check if there's an active payroll period (current date falls within any period)
            const [activePeriods] = await db.query(`
                SELECT 
                    pp.*,
                    COUNT(p.id) as payroll_count,
                    COUNT(CASE WHEN p.status IN ('pending', 'approved', 'released') THEN 1 END) as active_payroll_count
                FROM payroll_periods pp
                LEFT JOIN payroll p ON pp.id = p.payroll_period_id
                WHERE pp.start_date <= ? AND pp.end_date >= ?
                GROUP BY pp.id
                ORDER BY pp.created_at DESC
                LIMIT 1
            `, [currentDateStr, currentDateStr]);
            
            // Check if there are any pending/approved payroll entries for current period
            const [pendingPayrolls] = await db.query(`
                SELECT COUNT(*) as count
                FROM payroll p
                JOIN payroll_periods pp ON p.payroll_period_id = pp.id
                WHERE pp.start_date <= ? AND pp.end_date >= ?
                AND p.status IN ('pending', 'approved', 'released')
            `, [currentDateStr, currentDateStr]);
            
            // Get the most recent payroll period (regardless of current date)
            const [recentPeriods] = await db.query(`
                SELECT 
                    pp.*,
                    COUNT(p.id) as payroll_count,
                    COUNT(CASE WHEN p.status IN ('pending', 'approved', 'released') THEN 1 END) as active_payroll_count
                FROM payroll_periods pp
                LEFT JOIN payroll p ON pp.id = p.payroll_period_id
                GROUP BY pp.id
                ORDER BY pp.created_at DESC
                LIMIT 1
            `);
            
            const result = {
                hasActivePeriod: activePeriods.length > 0,
                hasPendingPayroll: pendingPayrolls[0].count > 0,
                currentPeriod: activePeriods[0] || null,
                recentPeriod: recentPeriods[0] || null,
                effectiveImmediately: activePeriods.length === 0 || pendingPayrolls[0].count === 0
            };
            
            return result;
        } catch (error) {
            console.error("❌ [checkPayrollStatus] Error checking payroll status:", error.message || error);
            throw error;
        }
    },

    // 🔹 Get all face encodings for an employee
    getEmployeeFaces: async (employeeId) => {
        try {
            const [rows] = await db.query(
                `SELECT id, employee_id, face_encoding, created_at FROM employee_faces WHERE employee_id = ? ORDER BY created_at DESC`,
                [employeeId]
            );
            return rows;
        } catch (error) {
            console.error("❌ Error fetching employee faces:", error);
            throw error;
        }
    },

    // 🔹 Get permission by ID
    getRoleById: async (roleId) => {
        const query = "SELECT * FROM roles WHERE id = ?";
        const [result] = await db.query(query, [roleId]);
        return result.length > 0 ? result[0] : null;
    },

    // 🔹 Create a new user with username included
    createUser: async (email, role_id, username) => {
        console.log("🔹 Creating user with:", { email, role_id, username });

        if (!role_id) {
            throw new Error("❌ Role ID is required and cannot be null");
        }

        // Validate inputs
        if (!email || !username) {
            throw new Error("❌ Email and username are required");
        }

        // Test database connection first
        try {
            const [testResult] = await db.query("SELECT 1 as test");
            console.log("🔹 Database connection test successful");
        } catch (error) {
            console.error("❌ Database connection test failed:", error);
            throw new Error("Database connection failed");
        }

        const defaultPassword = "default123";
        // Hash the default password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);
        console.log("🔹 Password hashed successfully");

        // Check if email already exists
        try {
            const [existingUser] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
            if (existingUser.length > 0) {
                throw new Error("User with this email already exists");
            }
            console.log("🔹 Email is unique, proceeding with insert");
        } catch (error) {
            if (error.message.includes("already exists")) {
                throw error;
            }
            console.error("❌ Error checking existing user:", error);
        }

        // 🧾 Insert the user with hashed password
        const userInsertQuery = `
            INSERT INTO users (email, username, role_id, password, created_at, is_active) 
            VALUES (?, ?, ?, ?, NOW(), 1)
        `;

        try {
            console.log("🔹 About to execute user insert query");
            console.log("🔹 Query:", userInsertQuery);
            console.log("🔹 Values:", [email, username, role_id, "***hashed***"]);
            
            const [result] = await db.query(userInsertQuery, [
                email,
                username, // Use the full_name as username
                role_id,
                hashedPassword
            ]);

            console.log("✅ User created successfully with ID:", result.insertId);
            console.log("✅ Result object:", result);
            return result.insertId;
        } catch (error) {
            console.error("❌ Error creating user:", error);
            console.error("❌ SQL Error details:", {
                message: error.message,
                sqlMessage: error.sqlMessage,
                code: error.code,
                sql: error.sql
            });
            throw new Error("Failed to create user: " + (error.sqlMessage || error.message));
        }
    },

    // 🔹 Generate random password for temporary accounts
    generateRandomPassword: () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    },

    // 🔹 Create a new user with onboarding pending status (for new hires)
    createUserWithOnboardingPending: async (email, role_id, employee_id) => {
        console.log("🔹 Creating user with onboarding pending status:", { email, role_id, employee_id });

        if (!role_id) {
            throw new Error("❌ Role ID is required and cannot be null");
        }

        // Validate inputs
        if (!email || !employee_id) {
            throw new Error("❌ Email and employee_id are required");
        }

        // Test database connection first
        try {
            const [testResult] = await db.query("SELECT 1 as test");
            console.log("🔹 Database connection test successful");
        } catch (error) {
            console.error("❌ Database connection test failed:", error);
            throw new Error("Database connection failed");
        }

        // Generate random password for temporary account
        const randomPassword = HRModel.generateRandomPassword();
        console.log("🔹 Generated random password for temporary account");

        // Hash the random password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(randomPassword, saltRounds);
        console.log("🔹 Password hashed successfully");

        // Check if email already exists
        try {
            const [existingUser] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
            if (existingUser.length > 0) {
                throw new Error("User with this email already exists");
            }
            console.log("🔹 Email is unique, proceeding with insert");
        } catch (error) {
            if (error.message.includes("already exists")) {
                throw error;
            }
            console.error("❌ Error checking existing user:", error);
        }

        // 🧾 Insert the user with employee_id as username, hashed password and active status but onboarding pending
        const userInsertQuery = `
            INSERT INTO users (email, username, role_id, password, created_at, is_active, onboarding_completed) 
            VALUES (?, ?, ?, ?, NOW(), 1, 0)
        `;

        try {
            console.log("🔹 About to execute user insert query with onboarding pending");
            console.log("🔹 Query:", userInsertQuery);
            console.log("🔹 Values:", [email, employee_id, role_id, "***hashed***"]);
            
            const [result] = await db.query(userInsertQuery, [
                email,
                employee_id, // Use employee_id as username
                role_id,
                hashedPassword
            ]);

            console.log("✅ User created successfully with onboarding pending, ID:", result.insertId);
            console.log("✅ Result object:", result);
            return { userId: result.insertId, tempPassword: randomPassword };
        } catch (error) {
            console.error("❌ Error creating user with onboarding pending:", error);
            console.error("❌ SQL Error details:", {
                message: error.message,
                sqlMessage: error.sqlMessage,
                code: error.code,
                sql: error.sql
            });
            throw new Error("Failed to create user: " + (error.sqlMessage || error.message));
        }
    },

    // 🔹 Complete onboarding and transition to permanent account
    completeOnboarding: async (userId, employeeId) => {
        console.log("🔹 Completing onboarding for user:", userId, "with employee ID:", employeeId);

        try {
            // Update user to use employee_id as permanent username and mark onboarding as completed
            const updateQuery = `
                UPDATE users 
                SET username = ?, onboarding_completed = 1 
                WHERE id = ?
            `;

            const [result] = await db.query(updateQuery, [employeeId, userId]);
            
            if (result.affectedRows === 0) {
                throw new Error("User not found or already completed onboarding");
            }

            console.log("✅ Onboarding completed successfully for user:", userId);
            return true;
        } catch (error) {
            console.error("❌ Error completing onboarding:", error);
            throw new Error("Failed to complete onboarding: " + (error.sqlMessage || error.message));
        }
    },

    // 🔹 Get user ID by email
    getUserIdByEmail: async (email) => {
        try {
            const query = "SELECT id FROM users WHERE email = ?";
            const [rows] = await db.query(query, [email]);
            return rows.length > 0 ? rows[0].id : null;
        } catch (error) {
            console.error("❌ Error fetching user by email:", error);
            throw error;
        }
    },

    // 🔹 Add a new employee with validation and transaction handling
    addEmployee: async (employeeData) => {
        if (!employeeData.user_id) {
            throw new Error("❌ User ID is required");
        }
    
        const connection = await db.getConnection();
    
        try {
            await connection.beginTransaction();
    
            const employeeQuery = `
                INSERT INTO employees 
                (employee_id, user_id, email, role_id, full_name, contact, address, birthday, employment_status, educational_background, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `;
    
            const employeeValues = [
                employeeData.employee_id,
                employeeData.user_id,
                employeeData.email,
                employeeData.role_id,
                employeeData.full_name,
                employeeData.contact,
                employeeData.address,
                employeeData.birthday,
                employeeData.employment_status,
                employeeData.educational_background,
                employeeData.emergency_contact_name,
                employeeData.emergency_contact_relationship,
                employeeData.emergency_contact_phone
            ];
    
            const [employeeResult] = await connection.query(employeeQuery, employeeValues);
    
            await connection.commit();
            connection.release();
    
            console.log("✅ Employee added with ID:", employeeResult.insertId);
    
            return { user_id: employeeData.user_id, employee_id: employeeResult.insertId };
        } catch (error) {
            console.error("❌ SQL Error adding employee:", error);
            await connection.rollback();
            connection.release();
            throw new Error("Failed to add employee: " + (error.sqlMessage || error.message));
        }
    },

    // 🔹 Get last inserted employee to determine the next ID (e.g., 2025-1007)
    getLastEmployeeId: async () => {
        const query = "SELECT employee_id FROM employees ORDER BY employee_id DESC LIMIT 1";
        const [rows] = await db.query(query);
        return rows.length > 0 ? rows[0] : null;
    },

    // 🔹 Get all employees (filtered by is_deleted flag, excluding Owner role and current logged-in user)
    getAllEmployees: async (includeDeleted = true, excludeUserId = null) => {
        let query = `
            SELECT 
                e.*, 
                r.name AS role_name, 
                d.name AS department_name
            FROM 
                employees e
            JOIN 
                roles r ON e.role_id = r.id
            JOIN 
                departments d ON r.department_id = d.id
            WHERE r.name != 'Owner'
        `;
    
        // Add the filter condition if needed
        if (!includeDeleted) {
            query += ` AND e.is_deleted = 0`; // Only active employees
        }

        // Exclude the current logged-in user from the list
        if (excludeUserId) {
            query += ` AND e.user_id != ?`;
        }

        try {
            const queryParams = excludeUserId ? [excludeUserId] : [];
            const [employees] = await db.query(query, queryParams);
            return employees.map(employee => ({
                ...employee,
                birthday: employee.birthday
                    ? new Date(employee.birthday).toISOString().split('T')[0]
                    : null
            }));
        } catch (err) {
            console.error("❌ Failed to fetch employees:", err);
            throw err;
        }
    },

    // 🔹 Get employee by ID (Added this function for updates)
    getEmployeeById: async (employeeId) => {
        try {
            const query = `
                SELECT 
                    e.employee_id,
                    e.user_id,
                    e.full_name,
                    e.email,
                    e.contact,
                    e.address,
                    e.birthday,
                    e.employment_status,
                    e.educational_background,
                    e.emergency_contact_name,
                    e.emergency_contact_relationship,
                    e.emergency_contact_phone,
                    e.is_deleted,
                    e.profile_picture,
                    r.name as role_name,
                    d.name as department_name,
                    u.is_active
                FROM employees e
                LEFT JOIN roles r ON e.role_id = r.id
                LEFT JOIN departments d ON r.department_id = d.id
                LEFT JOIN users u ON e.user_id = u.id
                WHERE e.employee_id = ?
            `;
            const [rows] = await db.query(query, [employeeId]);
            if (rows.length > 0) {
                let employee = rows[0];

                // Format birthday as 'YYYY-MM-DD'
                employee.birthday = employee.birthday ? new Date(employee.birthday).toISOString().split('T')[0] : null;
                return employee;
            }
            return null;
        } catch (error) {
            console.error("❌ Error fetching employee by ID:", error);
            throw error;
        }
    },

    // 🔹 Get all permissions with salary and position information (excluding supplier, developer, and superadmin)
    getAllRoles: async () => {
        try {
            const query = `
                SELECT 
                    r.id,
                    r.name as role_name,
                    d.name as department_name,
                    p.salary as daily_rate
                FROM roles r
                LEFT JOIN departments d ON r.department_id = d.id
                LEFT JOIN positions p ON r.id = p.role_id
                WHERE r.name != 'Owner' 
                AND r.name != 'Supplier' 
                AND r.name != 'Developer'
                AND LOWER(r.name) != 'superadmin'
                ORDER BY r.name
            `;
    
            const [roles] = await db.query(query);
    
            // Process roles to handle construction workers salary range
            const processedRoles = await Promise.all(roles.map(async (role) => {
                if (role.role_name === 'constructual_workers' || role.role_name.toLowerCase().includes('constructual')) {
                    // Get salary range from construction_roles table for constructual_workers
                    const rangeQuery = `
                        SELECT 
                            MIN(daily_rate) as min_rate,
                            MAX(daily_rate) as max_rate
                        FROM construction_roles 
                        WHERE role_name = 'constructual_workers'
                    `;
                    const [rangeResult] = await db.query(rangeQuery);
                    
                    if (rangeResult.length > 0 && rangeResult[0].min_rate && rangeResult[0].max_rate) {
                        role.daily_rate = `${rangeResult[0].min_rate}-${rangeResult[0].max_rate}`;
                    } else {
                        // Default range if no data found
                        role.daily_rate = '500-900';
                    }
                }
                return role;
            }));
    
            return processedRoles;
        } catch (error) {
            console.error("❌ [getAllRoles] Error during role fetch:", error.message || error);
            throw error;
        }
    },

    // 🔹 Get all construction roles from construction_roles table
    getAllConstructionRoles: async () => {
        try {
            const query = `
                SELECT 
                    cr.id as construction_role_id,
                    cr.role_name,
                    cr.daily_rate,
                    d.name as department_name,
                    cr.date_created
                FROM construction_roles cr
                LEFT JOIN departments d ON cr.department_id = d.id
                ORDER BY cr.role_name
            `;
    
            const [constructionRoles] = await db.query(query);
    
            return constructionRoles;
        } catch (error) {
            console.error("❌ [getAllConstructionRoles] Error during construction roles fetch:", error.message || error);
            throw error;
        }
    },

    // 🔹 Update an employee role (roles + positions)
    updateEmployeeRole: async ({ id, role_name, salary, department_id }) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Update roles table
            const updates = [];
            const values = [];
            if (role_name !== undefined && role_name !== null) { updates.push('name = ?'); values.push(role_name); }
            if (department_id) { updates.push('department_id = ?'); values.push(department_id); }
            if (updates.length > 0) {
                values.push(id);
                await connection.query(`UPDATE roles SET ${updates.join(', ')} WHERE id = ?`, values);
            }

            // If salary is a single numeric value, update positions linked to this role
            if (salary !== undefined && salary !== null) {
                const numeric = String(salary).trim();
                if (!numeric.includes('-') && !isNaN(Number(numeric))) {
                    await connection.query(`UPDATE positions SET salary = ? WHERE role_id = ?`, [Number(numeric), id]);
                }
            }

            await connection.commit();
            connection.release();
            return true;
        } catch (error) {
            await connection.rollback();
            connection.release();
            console.error('❌ Error updating employee role:', error);
            throw error;
        }
    },

    // 🔹 Update a construction role
    updateConstructionRole: async ({ id, role_name, daily_rate, department_id }) => {
        try {
            const updates = [];
            const values = [];
            if (role_name !== undefined && role_name !== null) { updates.push('role_name = ?'); values.push(role_name); }
            if (daily_rate !== undefined && daily_rate !== null && !isNaN(Number(String(daily_rate).trim()))) { updates.push('daily_rate = ?'); values.push(Number(String(daily_rate).trim())); }
            if (department_id) { updates.push('department_id = ?'); values.push(department_id); }
            if (updates.length === 0) return false;
            values.push(id);
            await db.query(`UPDATE construction_roles SET ${updates.join(', ')} WHERE id = ?`, values);
            return true;
        } catch (error) {
            console.error('❌ Error updating construction role:', error);
            throw error;
        }
    },
    
    
    
    // 🔹 Check if employee email already exists
    checkEmployeeEmailExists: async (email) => {
        const query = "SELECT employee_id FROM employees WHERE email = ?";
        const [rows] = await db.query(query, [email]);
        return rows.length > 0;
    },

    // 🔹 Update Employee
    updateEmployee: async (employeeId, employeeData) => {
        try {
            console.log(`🔹 Attempting to update Employee ID: ${employeeId}`);
        
            const {
                email, full_name, contact, address, birthday,
                employment_status, educational_background, emergency_contact_name,
                emergency_contact_relationship, emergency_contact_phone, role_id
            } = employeeData;            
        
            // 🔥 Validate if employee exists before updating
            const existingEmployee = await HRModel.getEmployeeById(employeeId);
            if (!existingEmployee) {
                console.log("❌ Employee not found in the database.");
                throw new Error("Employee not found.");
            }
        
            // Update the employee details
            const employeeQuery = `
                UPDATE employees 
                SET email = ?, full_name = ?, contact = ?, address = ?, birthday = ?, 
                    employment_status = ?, educational_background = ?, emergency_contact_name = ?, 
                    emergency_contact_relationship = ?, emergency_contact_phone = ?, role_id = ? 
                WHERE employee_id = ?
            `;
        
            const [employeeResult] = await db.query(employeeQuery, [
                email, full_name, contact, address, birthday,
                employment_status, educational_background, emergency_contact_name,
                emergency_contact_relationship, emergency_contact_phone, role_id, employeeId
            ]);
        
            console.log("✅ Employee update result:", employeeResult);
        
            if (employeeResult.affectedRows === 0) {
                console.log("❌ No rows were updated. Possible incorrect employee ID.");
                throw new Error("Update failed. No changes were made.");
            }
        
            // Also update the user's details (email, full_name, and role_id) in the users table
            const userQuery = `
            UPDATE users 
            SET email = ?, username = ?, role_id = ? 
            WHERE id = ?;
        `;
        
        const [userResult] = await db.query(userQuery, [
            email, full_name, role_id, existingEmployee.user_id
        ]);
        
        
            console.log("✅ User update result:", userResult);
        
            if (userResult.affectedRows === 0) {
                console.log("❌ No rows were updated in the users table.");
                throw new Error("User update failed.");
            }
        
            console.log("✅ Employee and user updated successfully.");
            return HRModel.getEmployeeById(employeeId);
        
        } catch (error) {
            console.error("❌ Error updating employee and user:", error.message);
            throw error;
        }
    },
    


    // 🔹 Soft delete or restore employee + linked user
    softDeleteOrRestoreEmployee : async (employeeId, shouldDelete) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
    
            // Get the user_id and current delete status from the employee table
            const [rows] = await connection.query(
                "SELECT user_id, is_deleted FROM employees WHERE employee_id = ?",
                [employeeId]
            );
            if (rows.length === 0) throw new Error("Employee not found");
    
            const userId = rows[0].user_id;
            const currentStatus = rows[0].is_deleted;
    
            // Prevent unnecessary updates if the employee is already in the requested state
            if (currentStatus === shouldDelete) {
                throw new Error(`Employee is already ${shouldDelete ? 'archived' : 'active'}`);
            }
    
            // Update employees table based on the shouldDelete flag
            await connection.query(
                "UPDATE employees SET is_deleted = ? WHERE employee_id = ?",
                [shouldDelete, employeeId]
            );
    
            // Update users table based on the employee's new delete status
            await connection.query(
                "UPDATE users SET is_active = ? WHERE id = ?",
                [!shouldDelete, userId]
            );
    
            // Commit the transaction
            await connection.commit();
            connection.release();
            return true;
        } catch (error) {
            // Rollback if anything goes wrong
            await connection.rollback();
            connection.release();
            console.error("❌ Soft delete/restore failed:", error);
            throw error;
        }
    },
    

    adjustToPHT: (time) => {
        const date = new Date(time);
        date.setHours(date.getHours() + 8);
        return date.toISOString().slice(0, 19).replace("T", " ");
    },


    // Haversine formula to calculate distance (in meters)
    getDistanceMeters: (lat1, lon1, lat2, lon2) => {
        const R = 6371e3;
        const toRad = deg => (deg * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                  Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },

    checkRequestApproval: async (userId, date, requestType) => {
        try {
            // First get the employee_id from the user_id
            const [employee] = await db.execute(
                'SELECT employee_id FROM employees WHERE user_id = ?',
                [userId]
            );

            if (!employee || employee.length === 0) {
                console.log('❌ No employee found for user_id:', userId);
                return null;
            }

            const employeeId = employee[0].employee_id;
            console.log('🔍 Checking request approval for employee:', employeeId);

            const sql = `
                SELECT * FROM requests
                WHERE employee_id = ? AND request_date = ? AND status = 'approved' AND request_type = ?`;

            const [result] = await db.execute(sql, [employeeId, date, requestType]);
            console.log('📝 Request approval check result:', result.length > 0 ? 'Found approved request' : 'No approved request found');

            return result.length > 0 ? result[0] : null;
        } catch (error) {
            console.error('❌ Error in checkRequestApproval:', error);
            throw error;
        }
    },

    // Check if already checked in
    alreadyCheckedIn: async (userId, date) => {
        try {
            const sql = `SELECT check_in FROM attendance WHERE user_id = ? AND DATE(date) = DATE(?)`;
            const [rows] = await db.execute(sql, [userId, date]);
            return rows.length > 0 && rows[0].check_in !== null;
        } catch (error) {
            console.error('Error checking check-in status:', error);
            throw error;
        }
    },    
    
    // CHECK-IN LOGIC
    checkIn: async (userId, checkInTime, date, userLat, userLng) => {
        const officeLat = 14.343377281933318
        const officeLng = 120.979644495176
        const allowedRadius = 500;

        // const officeLat = 14.327791594318544;
        // const officeLng = 120.94059104947334;
        // const allowedRadius = 500;
        
        try {
            // Check if the user is within the allowed radius
            const distance = HRModel.getDistanceMeters(officeLat, officeLng, userLat, userLng);
            
            if (distance > allowedRadius) {
                return { error: `You are outside the allowed range (${Math.round(distance)}m).` };
            }

            // Check if the user has already checked in
            const alreadyIn = await HRModel.alreadyCheckedIn(userId, date);
            
            if (alreadyIn) {
                return { error: "You have already checked in today." };
            }

            const checkInDate = new Date(checkInTime);

            // Ensure the checkInTime is valid
            if (isNaN(checkInDate.getTime())) {
                return { error: "Invalid check-in time format." };
            }

            // Convert to Philippine Time (PHT) from UTC (UTC +8 hours)
            const localTime = new Date(checkInDate.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
        
            const hourPHT = localTime.getHours();
            const minutesPHT = localTime.getMinutes();
            const secondsPHT = localTime.getSeconds();

            // Check if the employee has an approved half-day request for the day
            const request = await HRModel.checkRequestApproval(userId, date, "halfDay");
        
            // If no approved half-day request, enforce the 9 AM check-in time
            if (!request && hourPHT < 9) {
                return { error: "You can only check in after 9:00 AM unless approved for half-day." };
            }

            let status = "Present";

            // If the employee has an approved half-day request
            if (request) {
                if (hourPHT >= 9 && hourPHT < 12) {
                    status = "Half Day";
                } else if (hourPHT >= 12 && hourPHT < 18) {
                    status = "Half Day";
                }
            } else if (!request && (hourPHT > 9 || (hourPHT === 9 && minutesPHT > 10))) {
                status = "Late";
            }        
        
            // Format the check-in time
            const checkInFormatted = `${String(hourPHT).padStart(2, '0')}:${String(minutesPHT).padStart(2, '0')}:${String(secondsPHT).padStart(2, '0')}`;
        
            const [existing] = await db.execute(
                `SELECT attendance_id FROM attendance WHERE user_id = ? AND date = ?`,
                [userId, date]
            );
        
            if (existing.length > 0) {
                const sql = `UPDATE attendance SET check_in = ?, status = ? WHERE user_id = ? AND date = ?`;
                await db.execute(sql, [checkInFormatted, status, userId, date]);
            } else {
                const sql = `INSERT INTO attendance (user_id, date, check_in, status) VALUES (?, ?, ?, ?)`;
                await db.execute(sql, [userId, date, checkInFormatted, status]);
            }
        
            return { success: true, message: "Check-in recorded." };
        } catch (error) {
            console.error('Error in checkIn function:', error);
            throw error;
        }
    },

        
    checkOut: async (userId, checkOutTime, date) => {
        try {
            // Convert check-out time to Philippine Time (PHT)
            const checkOutDate = new Date(checkOutTime);
            const hourPHT = checkOutDate.getUTCHours() + 8;
            const minutesPHT = checkOutDate.getUTCMinutes();

            // Check if it's before 6 PM
            if (hourPHT < 18) {
                return { error: "Check-out is only available after 6:00 PM." };
            }

            // First, check if the user has checked in
            const [checkInRecord] = await db.execute(
                `SELECT check_in, status FROM attendance WHERE user_id = ? AND date = ?`,
                [userId, date]
            );

            if (!checkInRecord || !checkInRecord[0].check_in) {
                return { error: "You must check in first." };
            }

            // Format the hour to 24-hour format (0-23)
            const formattedHour = String(hourPHT % 24).padStart(2, '0');
            const checkOutFormatted = `${formattedHour}:${String(minutesPHT).padStart(2, '0')}:${String(checkOutDate.getSeconds()).padStart(2, '0')}`;

            // Get check-in time for calculations
            const checkInTime = checkInRecord[0].check_in;
            const [checkInHour, checkInMinute] = checkInTime.split(':').map(Number);

            // Calculate total minutes worked
            const totalMinutes = (hourPHT * 60 + minutesPHT) - (checkInHour * 60 + checkInMinute);
            const totalHours = totalMinutes / 60;

            let status = checkInRecord[0].status;
            let overtimeHours = 0;
            let adjustedHours = totalHours;

            // Handle different attendance statuses
            if (status === 'Half Day') {
                // For half day, cap the hours at 4
                adjustedHours = Math.min(totalHours, 4);
            } else if (hourPHT >= 18) {
                // Overtime - calculate hours after 6 PM
                overtimeHours = (hourPHT * 60 + minutesPHT - 18 * 60) / 60;
                status = 'Overtime';
            }

            // Update attendance record with calculated values
            const sql = `
                UPDATE attendance
                SET check_out = ?,
                    total_hours = ?,
                    overtime_hours = ?,
                    status = ?
                WHERE user_id = ? AND date = ? AND check_in IS NOT NULL
            `;

            const [result] = await db.execute(sql, [
                checkOutFormatted,
                adjustedHours,
                overtimeHours,
                status,
                userId,
                date
            ]);

            if (result.affectedRows === 0) {
                return { error: "Check-in required before check-out." };
            }

            return { success: true, message: "Check-out recorded successfully." };

        } catch (error) {
            console.error('Error during check-out:', error);
            return { error: error.message || 'Internal Server Error' };
        }
    },    

    markMissedCheckOuts: async (targetDate) => {
        try {
        const [result] = await db.execute(`
            UPDATE attendance
            SET status = 'Missed Check-Out'
            WHERE check_in IS NOT NULL
            AND check_out IS NULL
            AND status IN ('Present', 'Late')
            AND DATE(date) = ?
        `, [targetDate]);

        return { success: true, affected: result.affectedRows };
        } catch (error) {
        console.error('Error updating missed check-outs:', error);
        return { success: false, error: error.message };
        }
    },
        
    requestHalfDay: async (employeeId, requestDate, timeSlot, remarks) => {
        if (!employeeId || !requestDate || !timeSlot || !remarks) {
            throw new Error('Invalid input: employeeId, requestDate, timeSlot, and remarks are required.');
        }

        // Insert half-day request into the requests table
        const sql = `INSERT INTO requests (
            employee_id, 
            request_type, 
            request_date, 
            time_slot, 
            remarks, 
            status
        ) VALUES (?, 'halfday', ?, ?, ?, 'pending')`;

        try {
            const [result] = await db.execute(sql, [employeeId, requestDate, timeSlot, remarks]);
            console.log("Half-day request submitted successfully:", result);
            return { success: true };
        } catch (error) {
            console.error('Error submitting half-day request:', error);
            throw new Error('Failed to submit half-day request.');
        }
    },
    
    requestOvertime: async (employeeId, requestDate, overtimeHours, remarks) => {
        if (!employeeId || !requestDate || !overtimeHours || !remarks) {
            throw new Error('Invalid input: employeeId, requestDate, overtimeHours, and remarks are required.');
        }

        // Insert overtime request into the requests table
        const sql = `INSERT INTO requests (
            employee_id, 
            request_type, 
            request_date, 
            overtime_hours, 
            remarks, 
            status
        ) VALUES (?, 'overtime', ?, ?, ?, 'pending')`;

        try {
            const [result] = await db.execute(sql, [employeeId, requestDate, overtimeHours, remarks]);
            console.log("Overtime request submitted successfully:", result);
            return { success: true };
        } catch (error) {
            console.error('Error submitting overtime request:', error);
            throw new Error('Failed to submit overtime request.');
        }
    },
    
    checkRequestApproval: async (userId, date, requestType) => {
        try {
            // First get the employee_id from the user_id
            const [employee] = await db.execute(
                'SELECT employee_id FROM employees WHERE user_id = ?',
                [userId]
            );

            if (!employee || employee.length === 0) {
                console.log('❌ No employee found for user_id:', userId);
                return null;
            }

            const employeeId = employee[0].employee_id;
            console.log('🔍 Checking request approval for employee:', employeeId);

            const sql = `
                SELECT * FROM requests
                WHERE employee_id = ? AND request_date = ? AND status = 'approved' AND request_type = ?`;

            const [result] = await db.execute(sql, [employeeId, date, requestType]);
            console.log('📝 Request approval check result:', result.length > 0 ? 'Found approved request' : 'No approved request found');

            return result.length > 0 ? result[0] : null;
        } catch (error) {
            console.error('❌ Error in checkRequestApproval:', error);
            throw error;
        }
    },

    // Approve or Reject Requests (Early-out or Half-day)

    getAllPendingRequests: async () => {
        const sql = `SELECT * FROM requests WHERE status = 'pending'`; // Only select requests where status is 'pending'
        try {
            const [requests] = await db.execute(sql);
            return requests;
        } catch (error) {
            console.error('Error fetching all pending requests:', error);
            throw new Error('Failed to fetch all pending requests.');
        }
    },

    // Get all pending requests by user_id (for HR head to select pending requests by user)
    getPendingRequestsByUserId: async (userId) => {
        const sql = `SELECT * FROM requests WHERE user_id = ? AND status = 'pending'`; // Only select pending requests for a specific user
        try {
            const [requests] = await db.execute(sql, [userId]);
            return requests;
        } catch (error) {
            console.error('Error fetching pending requests by userId:', error);
            throw new Error('Failed to fetch pending requests by userId.');
        }
    },

    // Approve or Reject Requests (Half-day, Early-out, Overtime)
    handleRequestApproval: async (userId, requestType, status) => {
        // SQL query to update the request status with TRIM to handle any spaces in request_type
        const requestSql = `
            UPDATE requests
            SET status = ?
            WHERE user_id = ? AND TRIM(request_type) = ?`;

        try {
            // Log the SQL query and parameters for debugging
            console.log('Executing SQL:', requestSql, [status, userId, requestType]);

            // Execute the SQL query with the parameters
            const [result] = await db.execute(requestSql, [status, userId, requestType]);

            // Log how many rows were affected
            console.log('Rows affected:', result.affectedRows);

            // Return success if the row was updated
            return { success: true, affectedRows: result.affectedRows };
        } catch (error) {
            console.error('Error in handleRequestApproval:', error);
            throw new Error('Failed to approve/reject request.');
        }
    },  

    getTodayAttendance: async (userId, date) => {
        try {
            // Use DATE() to compare only the date part of the timestamp
            const sql = `SELECT * FROM attendance WHERE user_id = ? AND DATE(date) = CURDATE()`;
            const [rows] = await db.execute(sql, [userId]);
            return rows;  // Return the attendance data
        } catch (error) {
            console.error('Error fetching attendance data:', error);
            throw error;
        }
    },
    

    getAttendanceHistory: async (userId) => {
        const sql = `
          SELECT 
            a.date, 
            a.check_in, 
            a.check_out, 
            a.status, 
            a.total_hours, 
            a.overtime_hours,
            a.attendance_id,
            GROUP_CONCAT(ap.image_path) as all_photos
          FROM attendance a
          LEFT JOIN attendance_photos ap ON a.attendance_id = ap.attendance_id
          WHERE a.user_id = ? 
          GROUP BY a.attendance_id, a.date, a.check_in, a.check_out, a.status, a.total_hours, a.overtime_hours
          ORDER BY a.date DESC
        `;
        const [rows] = await db.execute(sql, [userId]);
        return rows;
      },

      getAllAttendanceRecords: async () => {
        const [rows] = await db.query(
            `SELECT 
                e.full_name AS name,
                r.name AS position,
                d.name AS department,
                a.date,
                DATE_FORMAT(a.check_in, '%h:%i %p') AS checkin,
                DATE_FORMAT(a.check_out, '%h:%i %p') AS checkout,
                a.status,
                a.total_hours,
                a.overtime_hours
            FROM attendance a
            JOIN employees e ON a.user_id = e.user_id
            JOIN roles r ON e.role_id = r.id
            JOIN departments d ON r.department_id = d.id
            ORDER BY a.date DESC`
        );
        return rows;
    },    

    getApplicationsByStatus: async (status) => {
        const query = "SELECT * FROM applications WHERE status = ?";
        const [rows] = await db.execute(query, [status]);
        return rows;
    },

    // Update the application status (Pending, Ready for Interview, Accepted, Rejected)
    updateApplicationStatus: async (id, status, remarks = null) => {
        if (status === 'Rejected' && remarks) {
            const query = "UPDATE applications SET status = ?, rejection_reason = ? WHERE id = ?";
            await db.execute(query, [status, remarks, id]);
        } else {
            const query = "UPDATE applications SET status = ? WHERE id = ?";
            await db.execute(query, [status, id]);
        }
    },


    scheduleInterview: async (id, date, time) => {
        const query = `UPDATE applications SET interview_date = ?, interview_time = ?, status = 'Ready for Interview' WHERE id = ?`;
        await db.execute(query, [date, time, id]);
    }, 

    // Get application details by ID
    getApplicationById: async (id) => {
        const query = "SELECT * FROM applications WHERE id = ?";
        const [rows] = await db.execute(query, [id]);
        return rows[0] || null;
    },

    markAbsences: async (date) => {
        try {
            // Get all active employees
            const [employees] = await db.execute(
                `SELECT user_id FROM employees WHERE is_deleted = 0`
            );

            // For each employee, check if they have an attendance record for the date
            for (const employee of employees) {
                const [attendance] = await db.execute(
                    `SELECT * FROM attendance WHERE user_id = ? AND DATE(date) = ?`,
                    [employee.user_id, date]
                );

                // If no attendance record exists, mark as absent
                if (attendance.length === 0) {
                    await db.execute(
                        `INSERT INTO attendance (user_id, date, status) VALUES (?, ?, 'Absent')`,
                        [employee.user_id, date]
                    );
                }
            }
            return { success: true };
        } catch (error) {
            console.error('Error marking absences:', error);
            return { success: false, error: error.message };
        }
    },

    getEmployeesWithAttendance: async (startDate, endDate) => {
        try {
            console.log('\n=== PAYROLL GENERATION DEBUG ===');
            console.log('1. Input Parameters:', {
                startDate,
                endDate,
                startDateType: typeof startDate,
                endDateType: typeof endDate
            });
            
            const query = `
                WITH date_range AS (
                    SELECT CURDATE() - INTERVAL (a.a + (10 * b.a) + (100 * c.a)) DAY AS date
                    FROM (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) AS a
                    CROSS JOIN (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) AS b
                    CROSS JOIN (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) AS c
                    WHERE CURDATE() - INTERVAL (a.a + (10 * b.a) + (100 * c.a)) DAY BETWEEN ? AND ?
                ),
                            employee_dates AS (
                SELECT e.employee_id, d.date
                FROM employees e
                CROSS JOIN date_range d
                WHERE e.is_deleted = 0
            )
            SELECT 
                e.employee_id, 
                e.full_name, 
                e.role_id,
                r.name as position,
                COALESCE(p.salary, 0) AS monthly_salary,
                COALESCE(SUM(CASE WHEN a.date BETWEEN ? AND ? THEN a.total_hours ELSE 0 END), 0) AS total_hours, 
                COALESCE(SUM(CASE WHEN a.date BETWEEN ? AND ? THEN a.overtime_hours ELSE 0 END), 0) AS overtime_hours,
                COALESCE(COUNT(DISTINCT CASE WHEN a.date BETWEEN ? AND ? AND a.status IN ('Present', 'Late', 'Overtime') THEN DATE(a.date) END), 0) AS days_present,
                COALESCE(COUNT(DISTINCT CASE WHEN a.date BETWEEN ? AND ? AND a.status = 'Half Day' THEN DATE(a.date) END), 0) AS days_half_day,
                COALESCE(COUNT(DISTINCT CASE WHEN a.date BETWEEN ? AND ? AND a.status = 'Early Out' THEN DATE(a.date) END), 0) AS days_early_out,
                COALESCE(COUNT(DISTINCT CASE 
                    WHEN ed.date BETWEEN ? AND ? 
                    AND (a.status = 'Absent' OR a.status IS NULL) 
                    AND ed.date NOT IN (
                        SELECT date 
                        FROM attendance 
                        WHERE user_id = e.user_id 
                        AND status IN ('Holiday', 'Rest Day', 'On Leave')
                    )
                    THEN ed.date 
                END), 0) AS days_absent,
                COALESCE(COUNT(DISTINCT CASE WHEN a.date BETWEEN ? AND ? AND a.status IN ('Holiday', 'Rest Day') THEN DATE(a.date) END), 0) AS days_holiday_rest,
                COALESCE(COUNT(DISTINCT CASE WHEN a.date BETWEEN ? AND ? AND a.status = 'On Leave' THEN DATE(a.date) END), 0) AS days_on_leave
                FROM employees e
                LEFT JOIN roles r ON e.role_id = r.id
                LEFT JOIN positions p ON e.role_id = p.role_id 
                LEFT JOIN attendance a ON e.user_id = a.user_id
                LEFT JOIN employee_dates ed ON e.employee_id = ed.employee_id
                WHERE e.is_deleted = 0
                AND r.name != 'Owner'
                GROUP BY e.employee_id, e.full_name, e.role_id, r.name, p.salary`;

            const params = [
                startDate, endDate,  // date_range
                startDate, endDate,  // total_hours
                startDate, endDate,  // overtime_hours
                startDate, endDate,  // days_present
                startDate, endDate,  // days_half_day
                startDate, endDate,  // days_early_out
                startDate, endDate,  // days_absent
                startDate, endDate,  // days_holiday_rest
                startDate, endDate   // days_on_leave
            ];

            const [rows] = await db.query(query, params);

            console.log('2. Query Results:');
            console.log('- Number of employees found:', rows.length);
            return rows;
        } catch (error) {
            console.error('Error in getEmployeesWithAttendance:', error);
            throw error;
        }
    },
    
    getDeductionsBySalary: async (salary) => {
        try {
            // Use the new payroll_deductions table
            const [rows] = await db.query(`
                SELECT 
                    id,
                    deduction_type,
                    fixed_amount,
                    description,
                    category,
                    is_active,
                    effective_date,
                    created_at,
                    updated_at
                FROM payroll_deductions 
                WHERE is_active = TRUE
                ORDER BY category, deduction_type
            `);
            return rows;
        } catch (error) {
            console.error("❌ Error fetching deductions:", error);
            throw error;
        }
    },
    
    insertPayrollRecords: async (records) => {
        const values = records.map(r => [
            r.employee_id,
            new Date().toISOString().split('T')[0], // payroll_date (current date)
            r.days_present,
            r.days_absent,
            r.total_hours || 0,
            r.overtime_hours || 0,
            r.monthly_salary || 0,        // fixed_salary
            r.total_deductions || 0,
            r.absence_deduction || 0,
            r.net_pay || 0,               // net_salary
            r.payroll_period || '',
            r.status || 'pending',        // default to 'pending'
            r.monthly_salary || 0         // salary_before_tax
        ]);
    
        try {
            console.log('Inserting payroll records without start/end dates');

            const [result] = await db.query(
                `INSERT INTO payroll 
                 (employee_id, payroll_date, days_present, 
                  days_absent, total_hours, overtime_hours, fixed_salary, total_deductions, 
                  absence_deduction, net_salary, payroll_period, status, salary_before_tax)
                 VALUES ?`, [values]
            );

            // Return the inserted IDs
            const insertedIds = [];
            for (let i = 0; i < records.length; i++) {
                insertedIds.push(result.insertId + i);
            }
            
            return insertedIds;
        } catch (error) {
            console.error('Error inserting payroll records:', error);
            throw error;
        }
    },
    getPendingPayroll: async () => {
        try {
            const [rows] = await db.query(
                `SELECT 
                    p.*, 
                    p.position_id,
                    p.basic_salary_snapshot,
                    e.full_name,  
                    r.name AS position,
                    DATE_FORMAT(p.payroll_date, '%Y-%m-%d') as payroll_date
                 FROM payroll p 
                 JOIN employees e 
                   ON p.employee_id = e.employee_id
                 JOIN roles r ON e.role_id = r.id
                 WHERE p.status = "pending"
                 ORDER BY p.payroll_date DESC`
            );
            console.log('Retrieved pending payroll records:', {
                count: rows.length,
                firstRecord: rows[0] ? {
                    payroll_date: rows[0].payroll_date,
                    payroll_period: rows[0].payroll_period
                } : null
            });
            return rows;
        } catch (err) {
            console.error('Error in getPendingPayroll:', err);
            throw err;
        }
    },
    getAcceptPayroll: async () => {
        try {
            const [rows] = await db.query(
                `SELECT 
                    p.*,
                    p.position_id,
                    p.basic_salary_snapshot,
                    e.full_name,
                    r.name AS position,
                    pos.salary AS base_salary
                FROM payroll p 
                JOIN employees e ON p.employee_id = e.employee_id
                JOIN roles r ON e.role_id = r.id
                JOIN positions pos ON e.role_id = pos.role_id
                WHERE p.status = 'approved'
                ORDER BY p.payroll_date DESC, p.employee_id`
            );
            return rows;
        } catch (err) {
            console.error('Error in getAcceptPayroll:', err);
            throw err;
        }
    },
    updatePayrollStatus: async (payrollId, status, remarks) => {
        try {
            // Check if status is 'rejected' and update accordingly
            let query = `
                UPDATE payroll
                SET status = ?, 
                    remarks = ? 
                WHERE id = ?`;
    
            // If the status is 'rejected' and remarks are provided, keep the remarks
            if (status !== 'rejected') {
                remarks = null;  // Set remarks to null if the status is not 'rejected'
            }
    
            // Execute the update query
            await db.query(query, [status, remarks, payrollId]);
        } catch (err) {
            console.error('Error in updatePayrollStatus:', err);
            throw err;
        }
    },
    
    // Get all deductions
    getAllDeductions: async () => {
        try {
            const [rows] = await db.query(`
                SELECT 
                    id,
                    deduction_type,
                    fixed_amount,
                    description,
                    category,
                    is_active,
                    effective_date,
                    created_at,
                    updated_at
                FROM payroll_deductions
                ORDER BY category, deduction_type
            `);
            return rows;
        } catch (error) {
            console.error("❌ Error fetching deductions:", error);
            throw error;
        }
    },

    // Archive a deduction (soft delete)
    archiveDeduction: async (id) => {
        try {
            const [result] = await db.query(
                `UPDATE payroll_deductions 
                 SET is_active = 0, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [id]
            );
            return result;
        } catch (error) {
            console.error("❌ Error archiving deduction:", error);
            throw error;
        }
    },

    // Restore a deduction
    restoreDeduction: async (id) => {
        try {
            const [result] = await db.query(
                `UPDATE payroll_deductions 
                 SET is_active = 1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [id]
            );
            return result;
        } catch (error) {
            console.error("❌ Error restoring deduction:", error);
            throw error;
        }
    },

    // Model function to update a deduction
    updateDeduction: async (deduction) => {
        try {
            const [result] = await db.query(`
                UPDATE payroll_deductions 
                SET deduction_type = ?,
                    fixed_amount = ?,
                    description = ?,
                    category = ?,
                    is_active = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                deduction.deduction_type,
                deduction.fixed_amount,
                deduction.description,
                deduction.category,
                deduction.is_active,
                deduction.id
            ]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error("❌ Error updating deduction:", error);
            throw error;
        }
    },

    // Add new deduction
    addDeduction: async (deduction) => {
        try {
            const [result] = await db.query(`
                INSERT INTO payroll_deductions 
                (deduction_type, fixed_amount, percentage, min_salary_range, max_salary_range, tax_status, description, category, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                deduction.deduction_type,
                deduction.fixed_amount || 0.00,
                deduction.percentage || 0.00,
                deduction.min_salary_range || 0.00,
                deduction.max_salary_range || 999999.99,
                deduction.tax_status || 'non_taxable',
                deduction.description || null,
                deduction.category || 'government',
                deduction.is_active !== undefined ? deduction.is_active : true
            ]);
            return result.insertId;
        } catch (error) {
            console.error("❌ Error adding deduction:", error);
            throw error;
        }
    },

    // Get position salary from position table
    getPositionSalary: async (roleId) => {
        try {
            const query = `
                SELECT p.salary, p.position_name 
                FROM positions p 
                WHERE p.role_id = ?
            `;
            const [rows] = await db.query(query, [roleId]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error("❌ Error fetching position salary:", error);
            throw error;
        }
    },

    // Calculate income tax based on Philippine tax brackets
    calculateIncomeTax: (grossSalary) => {
        // Philippine Income Tax Brackets (2023)
        const taxBrackets = [
            { min: 0, max: 250000, rate: 0 },
            { min: 250000, max: 400000, rate: 15 },
            { min: 400000, max: 800000, rate: 20 },
            { min: 800000, max: 2000000, rate: 25 },
            { min: 2000000, max: 8000000, rate: 30 },
            { min: 8000000, max: Infinity, rate: 35 }
        ];

        let tax = 0;
        let remainingSalary = grossSalary;

        for (const bracket of taxBrackets) {
            if (remainingSalary <= 0) break;
            
            const taxableInBracket = Math.min(remainingSalary, bracket.max - bracket.min);
            if (taxableInBracket > 0) {
                tax += (taxableInBracket * bracket.rate) / 100;
                remainingSalary -= taxableInBracket;
            }
        }

        return Math.round(tax * 100) / 100; // Round to 2 decimal places
    },

    // ===== PAYROLL ONLY: Calculate deductions with support for deduction mode (split vs monthly)
    // Calculate deductions for an employee based on salary, payroll period, and deduction mode
    calculateDeductions: async (employeeSalary, payrollPeriod = 'second', deductionMode = 'split') => {
        try {
            const [deductions] = await db.query(`
                SELECT id, deduction_type, salary_min, salary_max, total_rate,
                       employee_percentage, employer_percentage, is_active
                FROM deductions 
                WHERE is_active = 1 
                ORDER BY deduction_type
            `);

            let totalDeductions = 0;
            let taxableDeductions = 0;
            let nonTaxableDeductions = 0;
            const deductionDetails = [];
            const nextPeriodDeductions = []; // Deductions that will apply to next period

            

            for (const deduction of deductions) {
                let deductionAmount = 0;
                
                // Calculate employee share only, using salary range brackets when provided
                const inRange = (val, min, max) => {
                    if (min == null && max == null) return true;
                    if (min == null) return val <= Number(max);
                    if (max == null) return val >= Number(min);
                    return val >= Number(min) && val <= Number(max);
                };

                if (Number(deduction.fixed_amount) > 0) {
                    deductionAmount = Number(deduction.fixed_amount);
                } else if (inRange(Number(employeeSalary), deduction.salary_min, deduction.salary_max) && Number(deduction.employee_percentage) > 0) {
                    deductionAmount = (Number(employeeSalary) * Number(deduction.employee_percentage)) / 100;
                } else if (Number(deduction.percentage) > 0) {
                    // Fallback if legacy percentage column exists
                    deductionAmount = (Number(employeeSalary) * Number(deduction.percentage)) / 100;
                }

                

                // Special handling for Income Tax (progressive tax brackets)
                if (deduction.deduction_type === 'Income Tax') {
                    deductionAmount = HRModel.calculateIncomeTax(employeeSalary);
                }

                if (deductionAmount > 0) {
                    // Apply deduction logic based on selected mode
                    if (deductionMode === 'split') {
                        // Split equally across first and second halves
                        const splitAmount = Math.round((deductionAmount / 2) * 100) / 100;
                        
                        // Always apply half in the current period
                        totalDeductions += splitAmount;
                        const taxStatus = deduction.tax_status || 'non_taxable';
                        if (taxStatus === 'taxable') {
                            taxableDeductions += splitAmount;
                        } else {
                            nonTaxableDeductions += splitAmount;
                        }
                        deductionDetails.push({
                            id: deduction.id,
                            deduction_type: deduction.deduction_type,
                            amount: splitAmount,
                            tax_status: taxStatus,
                            category: deduction.category,
                            description: deduction.description,
                            applied_in_current_period: true,
                            mode: 'split'
                        });
                        // In first half, show the other half as next period info
                        if (payrollPeriod === 'first') {
                            nextPeriodDeductions.push({
                                id: deduction.id,
                                deduction_type: deduction.deduction_type,
                                amount: splitAmount,
                                tax_status: taxStatus,
                                category: deduction.category,
                                description: deduction.description,
                                applied_in_current_period: false,
                                mode: 'split'
                            });
                        }
                    } else {
                        // 'monthly' mode: apply full amount only in second half (or always for income tax)
                        const shouldApplyDeduction = payrollPeriod === 'second' || deduction.deduction_type === 'Income Tax';
                        
                        if (shouldApplyDeduction) {
                            totalDeductions += deductionAmount;
                            const taxStatus2 = deduction.tax_status || 'non_taxable';
                            if (taxStatus2 === 'taxable') {
                                taxableDeductions += deductionAmount;
                            } else {
                                nonTaxableDeductions += deductionAmount;
                            }
                        deductionDetails.push({
                            id: deduction.id,
                            deduction_type: deduction.deduction_type,
                                amount: deductionAmount,
                                tax_status: taxStatus2,
                                category: deduction.category,
                                description: deduction.description,
                                applied_in_current_period: true,
                                mode: 'monthly'
                            });
                        } else {
                            // First half preview of what will apply in second
                            nextPeriodDeductions.push({
                                id: deduction.id,
                                deduction_type: deduction.deduction_type,
                                amount: deductionAmount,
                                tax_status: deduction.tax_status || 'non_taxable',
                                category: deduction.category,
                                description: deduction.description,
                                applied_in_current_period: false,
                                mode: 'monthly'
                            });
                        }
                    }
                }
            }

            

            return {
                totalDeductions,
                taxableDeductions,
                nonTaxableDeductions,
                deductionDetails,
                nextPeriodDeductions
            };
        } catch (error) {
            console.error("❌ Error calculating deductions:", error);
            throw error;
        }
    },

    // Add this new function
    cancelPendingPayroll: async () => {
        try {
            const [result] = await db.query(
                `DELETE FROM payroll WHERE status = 'pending'`
            );
            console.log('Cancelled payroll records:', result.affectedRows);
            return result.affectedRows;
        } catch (error) {
            console.error('Error cancelling payroll records:', error);
            throw error;
        }
    },

    // Get a single deduction by ID
    getDeductionById: async (id) => {
        try {
            const [rows] = await db.query(`
                SELECT 
                    id,
                    deduction_type,
                    fixed_amount,
                    description,
                    category,
                    is_active,
                    effective_date,
                    created_at,
                    updated_at
                FROM payroll_deductions 
                WHERE id = ?`,
                [id]
            );
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error("❌ Error fetching deduction by ID:", error);
            throw error;
        }
    },

    createDeductionsTable: async () => {
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS payroll_deductions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    deduction_type VARCHAR(100) NOT NULL,
                    fixed_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    percentage DECIMAL(5,2) DEFAULT 0.00,
                    min_salary_range DECIMAL(10,2) DEFAULT 0.00,
                    max_salary_range DECIMAL(10,2) DEFAULT 999999.99,
                    tax_status ENUM('taxable', 'non_taxable') DEFAULT 'non_taxable',
                    description TEXT,
                    category ENUM('government', 'company', 'other') DEFAULT 'government',
                    is_active BOOLEAN DEFAULT TRUE,
                    effective_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);
            console.log("✅ Payroll deductions table created or already exists");
        } catch (error) {
            console.error("❌ Error creating payroll deductions table:", error);
            throw error;
        }
    },

    // Update employee contact information
    updateEmployeeContact: async (employeeId, contactData) => {
        try {
            const {
                birthday,
                address,
                contact,
                emergency_contact_name,
                emergency_contact_relationship,
                emergency_contact_phone
            } = contactData;

            // Validate employee exists
            const existingEmployee = await HRModel.getEmployeeById(employeeId);
            if (!existingEmployee) {
                throw new Error("Employee not found");
            }

            // Update the employee contact information
            const query = `
                UPDATE employees 
                SET birthday = ?,
                    address = ?,
                    contact = ?,
                    emergency_contact_name = ?,
                    emergency_contact_relationship = ?,
                    emergency_contact_phone = ?
                WHERE employee_id = ?
            `;

            const [result] = await db.query(query, [
                birthday,
                address,
                contact,
                emergency_contact_name,
                emergency_contact_relationship,
                emergency_contact_phone,
                employeeId
            ]);

            if (result.affectedRows === 0) {
                throw new Error("No changes were made");
            }

            // Return updated employee data
            return await HRModel.getEmployeeById(employeeId);
        } catch (error) {
            console.error("❌ Error updating employee contact:", error);
            throw error;
        }
    },

    // Create or update security questions for a user
    updateSecurityQuestions: async (userId, questions) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // First, delete existing questions for this user
            await connection.query(
                'DELETE FROM user_security_questions WHERE user_id = ?',
                [userId]
            );

            // Hash the answers before storing
            const bcrypt = require('bcrypt');
            const saltRounds = 10;

            // Insert new questions
            for (let i = 1; i <= 3; i++) {
                const question = questions[`question${i}`];
                const answer = questions[`answer${i}`];
                
                // Hash the answer
                const answerHash = await bcrypt.hash(answer.toLowerCase().trim(), saltRounds);

                await connection.query(
                    `INSERT INTO user_security_questions 
                    (user_id, question_number, question, answer_hash) 
                    VALUES (?, ?, ?, ?)`,
                    [userId, i, question, answerHash]
                );
            }

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            console.error("❌ Error updating security questions:", error);
            throw error;
        } finally {
            connection.release();
        }
    },

    // Get security questions for a user
    getSecurityQuestions: async (userId) => {
        try {
            const [questions] = await db.query(
                `SELECT question_number, question, answer_hash 
                FROM user_security_questions 
                WHERE user_id = ? 
                ORDER BY question_number`,
                [userId]
            );

            // Format the response to match the frontend expectations
            const formattedQuestions = {
                question1: questions[0]?.question || '',
                answer1: '',  // Don't send the hash to frontend
                question2: questions[1]?.question || '',
                answer2: '',
                question3: questions[2]?.question || '',
                answer3: ''
            };

            return formattedQuestions;
        } catch (error) {
            console.error("❌ Error fetching security questions:", error);
            throw error;
        }
    },

    // Verify security question answers
    verifySecurityQuestions: async (userId, answers) => {
        try {
            // Validate input
            if (!userId || !answers || typeof answers !== 'object') {
                console.error("❌ Invalid input to verifySecurityQuestions:", { userId, answers });
                return false;
            }

            const [questions] = await db.query(
                `SELECT question_number, answer_hash 
                FROM user_security_questions 
                WHERE user_id = ? 
                ORDER BY question_number`,
                [userId]
            );

            if (questions.length === 0) {
                console.error("❌ No security questions found for user:", userId);
                return false;
            }

            const bcrypt = require('bcrypt');
            
            // Verify each answer
            for (let i = 1; i <= questions.length; i++) {
                const answerKey = `answer${i}`;
                const answer = answers[answerKey];
                
                // Skip if answer is undefined or empty
                if (!answer || typeof answer !== 'string') {
                    console.error(`❌ Invalid answer for question ${i}:`, answer);
                    return false;
                }

                const storedHash = questions[i-1].answer_hash;
                const isMatch = await bcrypt.compare(answer.toLowerCase().trim(), storedHash);
                
                if (!isMatch) {
                    console.error(`❌ Answer mismatch for question ${i}`);
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error("❌ Error verifying security questions:", error);
            throw error;
        }
    },

    async changePassword(userId, currentPassword, newPassword) {
        try {
            console.log('🔍 Starting password change for user:', userId);
            
            // First, verify the current password
            const [user] = await db.query(
                'SELECT password FROM users WHERE id = ?',
                [userId]
            );

            if (!user || user.length === 0) {
                console.log('❌ User not found in database');
                throw new Error('User not found');
            }

            console.log('🔍 Found user in database');
            console.log('🔍 Attempting to verify current password...');

            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user[0].password);
            console.log('🔍 Password verification result:', isCurrentPasswordValid);

            if (!isCurrentPasswordValid) {
                console.log('❌ Current password verification failed');
                throw new Error('Current password is incorrect');
            }

            console.log('✅ Current password verified successfully');

            // Hash the new password
            const saltRounds = 10;
            const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
            console.log('🔍 New password hashed successfully');

            // Update the password (removed updated_at field)
            await db.query(
                'UPDATE users SET password = ? WHERE id = ?',
                [newPasswordHash, userId]
            );
            console.log('✅ Password updated successfully in database');

            return true;
        } catch (error) {
            console.error('❌ Error in changePassword:', error);
            throw error;
        }
    },

    // Update employee profile picture
    updateProfilePicture: async (employeeId, imagePath) => {
        try {
            // Extract just the filename from the path if it's a full path
            const filename = imagePath.includes('/') ? imagePath.split('/').pop() : imagePath;
            console.log('Storing filename in database:', filename);

            const query = `
                UPDATE employees 
                SET profile_picture = ?
                WHERE employee_id = ?
            `;

            const [result] = await db.query(query, [filename, employeeId]);

            if (result.affectedRows === 0) {
                throw new Error("Employee not found");
            }

            return filename;
        } catch (error) {
            console.error("❌ Error updating profile picture:", error);
            throw error;
        }
    },

    // Fix existing profile picture paths in the database
    fixProfilePicturePaths: async () => {
        try {
            const query = `
                UPDATE employees 
                SET profile_picture = SUBSTRING_INDEX(profile_picture, '/', -1)
                WHERE profile_picture LIKE '/uploads/profile_pictures/%'
            `;
            const [result] = await db.query(query);
            console.log(`Fixed ${result.affectedRows} profile picture paths`);
            return result.affectedRows;
        } catch (error) {
            console.error("❌ Error fixing profile picture paths:", error);
            throw error;
        }
    },

    // Forgot Password Model Functions
    getSecurityQuestionsByEmail: async (email) => {
        try {
            // First get the user ID from email
            const [user] = await db.query(
                'SELECT id FROM users WHERE email = ?',
                [email]
            );

            if (!user || user.length === 0) {
                return null;
            }

            const userId = user[0].id;

            // Get security questions for the user
            const [questions] = await db.query(
                `SELECT question_number, question 
                FROM user_security_questions 
                WHERE user_id = ? 
                ORDER BY question_number`,
                [userId]
            );

            if (questions.length === 0) {
                return null;
            }

            return {
                userId: userId,
                questions: {
                    question1: questions[0]?.question || '',
                    question2: questions[1]?.question || '',
                    question3: questions[2]?.question || ''
                }
            };
        } catch (error) {
            console.error("❌ Error in getSecurityQuestionsByEmail:", error);
            throw error;
        }
    },

    verifySecurityAnswers: async (userId, answers) => {
        try {
            // Get stored security questions and answers
            const [questions] = await db.query(
                `SELECT question_number, answer_hash 
                FROM user_security_questions 
                WHERE user_id = ? 
                ORDER BY question_number`,
                [userId]
            );

            if (questions.length === 0) {
                return false;
            }

            // Verify each answer
            for (let i = 1; i <= questions.length; i++) {
                const answerKey = `answer${i}`;
                const answer = answers[answerKey];
                
                if (!answer || typeof answer !== 'string') {
                    return false;
                }

                const storedHash = questions[i-1].answer_hash;
                const isMatch = await bcrypt.compare(answer.toLowerCase().trim(), storedHash);
                
                if (!isMatch) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error("❌ Error in verifySecurityAnswers:", error);
            throw error;
        }
    },

    updateUserPassword: async (userId, newPassword) => {
        try {
            // Hash the new password
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
            
            // Update the password
            const [result] = await db.query(
                'UPDATE users SET password = ? WHERE id = ?',
                [hashedPassword, userId]
            );

            return result.affectedRows > 0;
        } catch (error) {
            console.error("❌ Error in updateUserPassword:", error);
            throw error;
        }
    },

    // Leave Management Functions
    applyLeave: async (userId, leaveTypeId, startDate, endDate, reason) => {
        try {
            // Calculate total days (including weekends)
            const start = new Date(startDate);
            const end = new Date(endDate);
            const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

            // Insert leave request
            const [result] = await db.query(`
                INSERT INTO leave_request 
                (user_id, leave_type_id, start_date, end_date, total_days, reason, status)
                VALUES (?, ?, ?, ?, ?, ?, 'pending')
            `, [userId, leaveTypeId, startDate, endDate, totalDays, reason]);

            return { success: true, requestId: result.insertId };
        } catch (error) {
            console.error("❌ Error applying for leave:", error);
            throw error;
        }
    },

    getLeaveTypes: async () => {
        try {
            const [types] = await db.query(`
                SELECT * FROM leave_types 
                WHERE is_active = TRUE
            `);
            return types;
        } catch (error) {
            console.error("❌ Error fetching leave types:", error);
            throw error;
        }
    },

    getLeaveBalance: async (userId, leaveTypeId, year) => {
        try {
            const [balance] = await db.query(`
                SELECT * FROM leave_balance
                WHERE user_id = ? AND leave_type_id = ? AND year = ?
            `, [userId, leaveTypeId, year]);
            return balance[0] || null;
        } catch (error) {
            console.error("❌ Error fetching leave balance:", error);
            throw error;
        }
    },

    getLeaveRequests: async (userId = null) => {
        try {
            let query = `
                SELECT 
                    lr.id,
                    lr.employeeId,
                    lr.leaveTypeId,
                    lr.fromDate,
                    lr.toDate,
                    lr.reason,
                    lr.status,
                    lr.remarks,
                    lr.created_at,
                    lr.updated_at,
                    lt.leaveType as leave_type_name,
                    e.full_name as employee_name
                FROM leave_request lr
                JOIN leave_types lt ON lr.leaveTypeId = lt.id
                JOIN employees e ON lr.employeeId = e.employee_id
            `;
            
            if (userId) {
                query += ' WHERE lr.employeeId = ?';
                const [requests] = await db.query(query, [userId]);
                return requests;
            } else {
                const [requests] = await db.query(query);
                return requests;
            }
        } catch (error) {
            console.error("❌ Error fetching leave requests:", error);
            throw error;
        }
    },

    handleLeaveRequest: async (requestId, status, remarks = null) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Get the leave request details first
            const [request] = await connection.query(`
                SELECT 
                    lr.employeeId,
                    lr.leaveTypeId,
                    lr.fromDate,
                    lr.toDate,
                    lr.status
                FROM leave_request lr
                WHERE lr.id = ?
            `, [requestId]);

            if (!request || request.length === 0) {
                throw new Error('Leave request not found');
            }

            const currentStatus = request[0].status;
            if (currentStatus !== 'pending') {
                throw new Error('Leave request is not in pending status');
            }

            // Update leave request status
            await connection.query(`
                UPDATE leave_request
                SET status = ?, remarks = ?
                WHERE id = ?
            `, [status, remarks, requestId]);

            // Only update leave balance if the request is approved
            if (status === 'approved') {
                // Calculate number of days (excluding weekends)
                const start = new Date(request[0].fromDate);
                const end = new Date(request[0].toDate);
                let days = 0;
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    const day = d.getDay();
                    if (day !== 0 && day !== 6) { // Skip Sunday (0) and Saturday (6)
                        days++;
                    }
                }

                // Get current balance
                const [balance] = await connection.query(`
                    SELECT 
                        lt.initial_balance,
                        COALESCE(lb.remainingBalance, lt.initial_balance) as remainingBalance
                    FROM leave_types lt
                    LEFT JOIN leave_balance lb ON 
                        lt.id = lb.leaveTypeId AND 
                        lb.employeeId = ?
                    WHERE lt.id = ?
                `, [request[0].employeeId, request[0].leaveTypeId]);

                if (!balance || balance.length === 0) {
                    throw new Error('Leave type not found');
                }

                // Update leave balance
                await connection.query(`
                    INSERT INTO leave_balance 
                    (employeeId, leaveTypeId, totalBalance, usedBalance, remainingBalance)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                    usedBalance = usedBalance + ?,
                    remainingBalance = totalBalance - (usedBalance + ?)
                `, [
                    request[0].employeeId,
                    request[0].leaveTypeId,
                    balance[0].initial_balance,
                    days,
                    balance[0].remainingBalance - days,
                    days,
                    days
                ]);
            }

            await connection.commit();
            return { success: true };
        } catch (error) {
            await connection.rollback();
            console.error("❌ Error handling leave request:", error);
            throw error;
        } finally {
            connection.release();
        }
    },

    // Apply for leave
    applyForLeave: async (employeeId, leaveTypeId, fromDate, toDate, reason) => {
        if (!employeeId) {
            throw new Error('Employee ID is required');
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Check if employee has sufficient balance
            const [balance] = await connection.query(`
                SELECT 
                    lt.initial_balance,
                    COALESCE(lb.remainingBalance, lt.initial_balance) as remainingBalance
                FROM leave_types lt
                LEFT JOIN leave_balance lb ON 
                    lt.id = lb.leaveTypeId AND 
                    lb.employeeId = ?
                WHERE lt.id = ?
            `, [employeeId, leaveTypeId]);

            if (!balance || balance.length === 0) {
                throw new Error('Leave type not found');
            }

            // Calculate number of days (excluding weekends)
            const start = new Date(fromDate);
            const end = new Date(toDate);
            let days = 0;
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const day = d.getDay();
                if (day !== 0 && day !== 6) { // Skip Sunday (0) and Saturday (6)
                    days++;
                }
            }

            if (days > balance[0].remainingBalance) {
                throw new Error('Insufficient leave balance');
            }

            // Insert leave request without affecting balance
            const [requestResult] = await connection.query(`
                INSERT INTO leave_request 
                (employeeId, leaveTypeId, fromDate, toDate, remarks, status)
                VALUES (?, ?, ?, ?, ?, 'pending')
            `, [employeeId, leaveTypeId, fromDate, toDate, reason]);

            await connection.commit();
            return { success: true, requestId: requestResult.insertId };
        } catch (error) {
            await connection.rollback();
            console.error("❌ Error applying for leave:", error);
            throw error;
        } finally {
            connection.release();
        }
    },

    // Cancel leave request
    cancelLeaveRequest: async (requestId, employeeId) => {
        if (!employeeId) {
            throw new Error('Employee ID is required');
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Get the leave request details
            const [request] = await connection.query(`
                SELECT leaveTypeId, fromDate, toDate, status
                FROM leave_request
                WHERE id = ? AND employeeId = ? AND status = 'pending'
            `, [requestId, employeeId]);

            if (!request || request.length === 0) {
                throw new Error('Leave request not found or cannot be cancelled');
            }

            // Only update status to cancelled, no need to restore balance since it wasn't deducted
            await connection.query(`
                UPDATE leave_request
                SET status = 'cancelled'
                WHERE id = ? AND employeeId = ?
            `, [requestId, employeeId]);

            await connection.commit();
            return { success: true };
        } catch (error) {
            await connection.rollback();
            console.error("❌ Error cancelling leave request:", error);
            throw error;
        } finally {
            connection.release();
        }
    },

    // Get leave requests for an employee
    getEmployeeLeaveRequests: async (employeeId) => {
        try {
            if (!employeeId) {
                throw new Error('Employee ID is required');
            }

            const query = `
                SELECT 
                    lr.id,
                    lr.employeeId,
                    lr.leaveTypeId,
                    lr.fromDate,
                    lr.toDate,
                    lr.remarks,
                    lr.status,
                    lt.leaveType as leave_type_name
                FROM leave_request lr
                JOIN leave_types lt ON lr.leaveTypeId = lt.id
                WHERE lr.employeeId = ?
                ORDER BY lr.fromDate DESC
            `;

            const [rows] = await db.query(query, [employeeId]);
            return rows;
        } catch (error) {
            console.error("❌ Error fetching employee leave requests:", error);
            throw error;
        }
    },

    // Get leave types with balances for an employee
    getLeaveTypesWithBalances: async (employeeId) => {
        try {
            if (!employeeId) {
                throw new Error('Employee ID is required');
            }

            const query = `
                SELECT 
                    lt.id,
                    lt.leaveType,
                    lt.initial_balance,
                    COALESCE(lb.usedBalance, 0) as usedBalance,
                    COALESCE(lb.remainingBalance, lt.initial_balance) as remainingBalance
                FROM leave_types lt
                LEFT JOIN leave_balance lb ON 
                    lt.id = lb.leaveTypeId AND 
                    lb.employeeId = ?
                ORDER BY lt.leaveType
            `;

            const [rows] = await db.query(query, [employeeId]);
            return rows;
        } catch (error) {
            console.error("❌ Error fetching leave types with balances:", error);
            throw error;
        }
    },

    // Restore a leave request
    restoreLeaveRequest: async (requestId) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Get the leave request details first
            const [request] = await connection.query(`
                SELECT 
                    lr.employeeId,
                    lr.leaveTypeId,
                    lr.fromDate,
                    lr.toDate,
                    lr.status
                FROM leave_request lr
                WHERE lr.id = ? AND lr.status = 'cancelled'
            `, [requestId]);

            if (!request || request.length === 0) {
                throw new Error('Leave request not found or not in cancelled status');
            }

            // Update leave request status back to pending
            await connection.query(`
                UPDATE leave_request
                SET status = 'pending'
                WHERE id = ?
            `, [requestId]);

            await connection.commit();
            return { success: true };
        } catch (error) {
            await connection.rollback();
            console.error("❌ Error restoring leave request:", error);
            throw error;
        } finally {
            connection.release();
        }
    },

    // Permanently delete a leave request
    permanentlyDeleteLeaveRequest: async (requestId) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Get the leave request details first
            const [request] = await connection.query(`
                SELECT 
                    lr.employeeId,
                    lr.leaveTypeId,
                    lr.fromDate,
                    lr.toDate,
                    lr.status
                FROM leave_request lr
                WHERE lr.id = ?
            `, [requestId]);

            if (!request || request.length === 0) {
                throw new Error('Leave request not found');
            }

            // Only allow deletion of cancelled or rejected requests
            if (!['cancelled', 'rejected'].includes(request[0].status)) {
                throw new Error('Only cancelled or rejected leave requests can be permanently deleted');
            }

            // Permanently delete the leave request
            await connection.query(`
                DELETE FROM leave_request
                WHERE id = ?
            `, [requestId]);

            await connection.commit();
            return { success: true };
        } catch (error) {
            await connection.rollback();
            console.error("❌ Error permanently deleting leave request:", error);
            throw error;
        } finally {
            connection.release();
        }
    },

    // Work Adjustment Model Functions
    getAllWorkAdjustments: async (employeeId) => {
        try {
            const query = `
                SELECT 
                    r.id as request_id,
                    r.employee_id,
                    r.request_date,
                    r.request_type,
                    r.time_slot,
                    r.overtime_hours,
                    r.remarks,
                    r.status,
                    r.created_at,
                    e.full_name as employee_name
                FROM requests r
                JOIN employees e ON r.employee_id = e.employee_id
                WHERE r.request_type IN ('halfday', 'overtime')
                AND r.employee_id = ?
                ORDER BY r.request_date DESC, r.created_at DESC
            `;
            const [requests] = await db.query(query, [employeeId]);
            return requests;
        } catch (error) {
            console.error('Error fetching work adjustments:', error);
            throw new Error('Failed to fetch work adjustments');
        }
    },

    cancelWorkAdjustment: async (requestId) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Get the request details first
            const [request] = await connection.query(`
                SELECT status
                FROM requests
                WHERE id = ? AND request_type IN ('halfday', 'overtime')
            `, [requestId]);

            if (!request || request.length === 0) {
                throw new Error('Work adjustment request not found');
            }

            if (request[0].status !== 'pending') {
                throw new Error('Only pending requests can be cancelled');
            }

            // Update request status to cancelled
            await connection.query(`
                UPDATE requests
                SET status = 'cancelled'
                WHERE id = ?
            `, [requestId]);

            await connection.commit();
            return { success: true };
        } catch (error) {
            await connection.rollback();
            console.error('Error cancelling work adjustment:', error);
            throw error;
        } finally {
            connection.release();
        }
    },

    // Restore a work adjustment request
    restoreWorkAdjustment: async (requestId) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Get the request details first
            const [request] = await connection.query(`
                SELECT status
                FROM requests
                WHERE id = ? AND request_type IN ('halfday', 'overtime')
                AND status = 'cancelled'
            `, [requestId]);

            if (!request || request.length === 0) {
                throw new Error('Work adjustment request not found or not in cancelled status');
            }

            // Update request status back to pending
            await connection.query(`
                UPDATE requests
                SET status = 'pending'
                WHERE id = ?
            `, [requestId]);

            await connection.commit();
            return { success: true };
        } catch (error) {
            await connection.rollback();
            console.error('Error restoring work adjustment:', error);
            throw error;
        } finally {
            connection.release();
        }
    },

    // Permanently delete a work adjustment request
    permanentlyDeleteWorkAdjustment: async (requestId) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Get the request details first
            const [request] = await connection.query(`
                SELECT status
                FROM requests
                WHERE id = ? AND request_type IN ('halfday', 'overtime')
            `, [requestId]);

            if (!request || request.length === 0) {
                throw new Error('Work adjustment request not found');
            }

            // Only allow deletion of cancelled or rejected requests
            if (!['cancelled', 'rejected'].includes(request[0].status)) {
                throw new Error('Only cancelled or rejected work adjustment requests can be permanently deleted');
            }

            // Permanently delete the request
            await connection.query(`
                DELETE FROM requests
                WHERE id = ?
            `, [requestId]);

            await connection.commit();
            return { success: true };
        } catch (error) {
            await connection.rollback();
            console.error('Error permanently deleting work adjustment:', error);
            throw error;
        } finally {
            connection.release();
        }
    },

    // Get pending requests by employee ID
    getPendingRequestsByEmployeeId: async (employeeId) => {
        try {
            const [requests] = await db.query(`
                SELECT r.*, e.first_name, e.last_name
                FROM requests r
                JOIN employees e ON r.employee_id = e.employee_id
                WHERE r.employee_id = ? AND r.status = 'pending'
                ORDER BY r.created_at DESC
            `, [employeeId]);
            return requests;
        } catch (error) {
            console.error('Error fetching pending requests:', error);
            throw error;
        }
    },

    // Request early out
    requestEarlyOut: async (employeeId, date, reason) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Check if there's already a pending request for this date
            const [existing] = await connection.query(`
                SELECT id FROM requests 
                WHERE employee_id = ? 
                AND request_date = ? 
                AND status = 'pending'
                AND request_type = 'earlyout'
            `, [employeeId, date]);

            if (existing.length > 0) {
                throw new Error('You already have a pending early out request for this date');
            }

            // Insert the early out request
            const [result] = await connection.query(`
                INSERT INTO requests (
                    employee_id, 
                    request_type, 
                    request_date, 
                    reason, 
                    status, 
                    created_at
                ) VALUES (?, 'earlyout', ?, ?, 'pending', NOW())
            `, [employeeId, date, reason]);

            await connection.commit();
            return { 
                success: true, 
                message: 'Early out request submitted successfully',
                requestId: result.insertId 
            };
        } catch (error) {
            await connection.rollback();
            console.error('Error submitting early out request:', error);
            throw error;
        } finally {
            connection.release();
        }
    },

    getAllLeaveRequestsWithDetails: async () => {
        try {
            const query = `
                SELECT 
                    lr.id,
                    lr.employeeId,
                    lr.leaveTypeId,
                    lr.fromDate as start_date,
                    lr.toDate as end_date,
                    lr.remarks,
                    lr.status,
                    lt.leaveType as leave_type_name,
                    e.full_name as employee_name,
                    d.name as department_name,
                    DATEDIFF(lr.toDate, lr.fromDate) + 1 as total_days
                FROM leave_request lr
                JOIN leave_types lt ON lr.leaveTypeId = lt.id
                JOIN employees e ON lr.employeeId = e.employee_id
                LEFT JOIN roles r ON e.role_id = r.id
                LEFT JOIN departments d ON r.department_id = d.id
                ORDER BY lr.id DESC
            `;
            
            const [requests] = await db.query(query);
            return requests;
        } catch (error) {
            console.error("❌ Error fetching all leave requests:", error);
            // Log the full error details
            console.error("SQL Error details:", {
                message: error.message,
                code: error.code,
                sqlMessage: error.sqlMessage,
                sql: error.sql
            });
            throw error;
        }
    },

    getAllWorkAdjustmentRequestsWithDetails: async () => {
        try {
            const query = `
                SELECT 
                    wa.id,
                    wa.employee_id,
                    wa.request_date,
                    wa.time_slot,
                    wa.remarks,
                    wa.status,
                    wa.request_type,
                    wa.overtime_hours,
                    e.full_name as employee_name,
                    d.name as department_name,
                    r.name as role_name
                FROM requests wa
                JOIN employees e ON wa.employee_id = e.employee_id
                JOIN roles r ON e.role_id = r.id
                JOIN departments d ON r.department_id = d.id
                WHERE wa.status = 'pending'
                ORDER BY wa.id DESC
            `;
            
            const [requests] = await db.query(query);
            return requests;
        } catch (error) {
            console.error("❌ Error fetching all work adjustment requests:", error);
            console.error("SQL Error details:", {
                message: error.message,
                code: error.code,
                sqlMessage: error.sqlMessage,
                sql: error.sql
            });
            throw error;
        }
    },

    // Get total active employees count
    getTotalActiveEmployees: async () => {
        try {
            const [result] = await db.query(`
                SELECT COUNT(*) as total
                FROM employees
                WHERE is_deleted = 0
            `);
            return result[0].total;
        } catch (error) {
            console.error('Error getting total active employees:', error);
            throw error;
        }
    },

    // Get new hires count (accepted applications)
    getNewHiresCount: async () => {
        try {
            const [result] = await db.query(`
                SELECT COUNT(*) as total
                FROM applications
                WHERE status = 'Accepted'
            `);
            return result[0].total;
        } catch (error) {
            console.error('Error getting new hires count:', error);
            throw error;
        }
    },

    // Get pending leave requests count
    getPendingLeaveRequestsCount: async () => {
        try {
            const [result] = await db.query(`
                SELECT COUNT(*) as total
                FROM leave_request
                WHERE status = 'pending'
            `);
            return result[0].total;
        } catch (error) {
            console.error('Error getting pending leave requests count:', error);
            throw error;
        }
    },

    // Get total pending approvals count (work adjustments + leave requests)
    getTotalPendingApprovalsCount: async () => {
        try {
            const [result] = await db.query(`
                SELECT (
                    (SELECT COUNT(*) FROM requests WHERE status = 'pending' AND request_type IN ('halfday', 'overtime')) +
                    (SELECT COUNT(*) FROM leave_request WHERE status = 'pending')
                ) as total
            `);
            return result[0].total;
        } catch (error) {
            console.error('Error getting total pending approvals count:', error);
            throw error;
        }
    },

    // Recruitment Dashboard Methods
    // Get pending applications count
    getPendingApplicationsCount: async () => {
        try {
            const [result] = await db.query(`
                SELECT COUNT(*) as total
                FROM applications
                WHERE status = 'Pending'
            `);
            return result[0].total;
        } catch (error) {
            console.error('Error getting pending applications count:', error);
            throw error;
        }
    },

    // Get job posting trend data (monthly, quarterly, yearly)
    getJobPostingTrend: async (period = 'monthly') => {
        try {
            let query = '';
            let labels = [];
            let values = [];

            if (period === 'monthly') {
                // Last 12 months
                query = `
                    SELECT 
                        DATE_FORMAT(created_at, '%Y-%m') as month,
                        COUNT(*) as count
                    FROM applications
                    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
                    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
                    ORDER BY month ASC
                `;
            } else if (period === 'quarterly') {
                // Last 4 quarters
                query = `
                    SELECT 
                        YEAR(created_at) as year,
                        QUARTER(created_at) as quarter,
                        COUNT(*) as count
                    FROM applications
                    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 4 QUARTER)
                    GROUP BY YEAR(created_at), QUARTER(created_at)
                    ORDER BY YEAR(created_at), QUARTER(created_at) ASC
                `;
            } else {
                // Last 5 years
                query = `
                    SELECT 
                        YEAR(created_at) as year,
                        COUNT(*) as count
                    FROM applications
                    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 5 YEAR)
                    GROUP BY YEAR(created_at)
                    ORDER BY year ASC
                `;
            }

            const [results] = await db.query(query);
            
            results.forEach(row => {
                if (period === 'monthly') {
                    const date = new Date(row.month + '-01');
                    labels.push(date.toLocaleString(undefined, { month: 'short', year: 'numeric' }));
                } else if (period === 'quarterly') {
                    labels.push(`Q${row.quarter} ${row.year}`);
                } else {
                    labels.push(row.year.toString());
                }
                values.push(parseInt(row.count) || 0);
            });

            return { labels, values };
        } catch (error) {
            console.error('Error getting job posting trend:', error);
            throw error;
        }
    },

    // Payroll Dashboard Methods
    // Get payroll approved count
    getPayrollApprovedCount: async () => {
        try {
            const [result] = await db.query(`
                SELECT COUNT(*) as total
                FROM payroll_periods
                WHERE status = 'approved'
            `);
            return result[0].total;
        } catch (error) {
            console.error('Error getting payroll approved count:', error);
            throw error;
        }
    },

    // Get total payroll amount (sum of net_salary from released payrolls)
    getTotalDeductions: async () => {
        try {
            const [result] = await db.query(`
                SELECT COALESCE(SUM(net_salary), 0) as total
                FROM payroll
                WHERE status = 'released'
            `);
            return result[0].total || 0;
        } catch (error) {
            console.error('Error getting total payroll amount:', error);
            throw error;
        }
    },

    // Get department payroll distribution (excluding executives)
    getDepartmentPayrollDistribution: async () => {
        try {
            const [results] = await db.query(`
                SELECT 
                    d.id as department_id,
                    d.name as department_name,
                    COUNT(DISTINCT e.employee_id) as employee_count
                FROM departments d
                LEFT JOIN roles r ON r.department_id = d.id
                LEFT JOIN employees e ON e.role_id = r.id 
                    AND e.is_deleted = 0
                LEFT JOIN users u ON e.user_id = u.id
                    AND u.is_active = 1
                    AND r.name NOT LIKE '%executive%'
                    AND r.name NOT LIKE '%Executive%'
                WHERE d.is_deleted = 0
                GROUP BY d.id, d.name
                HAVING employee_count > 0
                ORDER BY employee_count DESC
            `);
            return results;
        } catch (error) {
            console.error('Error getting department payroll distribution:', error);
            throw error;
        }
    },

    // Initialize pre-onboarding documents for a new employee
    initializePreOnboardingDocuments: async (employeeId, userId, roleId) => {
        try {
            // Get required document types for this role
            const [documentTypes] = await db.query(`
                SELECT document_type 
                FROM document_types 
                WHERE (required_for_role_id = ? OR required_for_role_id IS NULL)
                AND is_required = TRUE
                ORDER BY document_type
            `, [roleId]);

            if (documentTypes.length === 0) {
                console.log(`No required documents found for role ${roleId}`);
                return true;
            }

            // Insert required documents for this employee
            const insertPromises = documentTypes.map(docType => {
                return db.query(`
                    INSERT INTO pre_onboarding_documents 
                    (user_id, employee_id, document_type, status) 
                    VALUES (?, ?, ?, 'pending')
                    ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
                `, [userId, employeeId, docType.document_type]);
            });

            await Promise.all(insertPromises);
            console.log(`✅ Initialized ${documentTypes.length} pre-onboarding documents for employee ${employeeId}`);
            return true;
        } catch (error) {
            console.error("❌ Error initializing pre-onboarding documents:", error);
            throw error;
        }
    },

    // Get pre-onboarding documents for an employee
    getPreOnboardingDocuments: async (employeeId) => {
        try {
            const query = `
                SELECT 
                    pod.*,
                    u.full_name as reviewed_by_name
                FROM pre_onboarding_documents pod
                LEFT JOIN employees u ON pod.reviewed_by = u.user_id
                WHERE pod.employee_id = ?
                ORDER BY pod.document_type
            `;
            
            const [documents] = await db.query(query, [employeeId]);
            return documents;
        } catch (error) {
            console.error("❌ Error fetching pre-onboarding documents:", error);
            throw error;
        }
    },

    // Upload a pre-onboarding document
    uploadPreOnboardingDocument: async (employeeId, documentType, filePath) => {
        try {
            const query = `
                UPDATE pre_onboarding_documents 
                SET file_path = ?,
                    status = 'uploaded',
                    uploaded_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE employee_id = ? AND document_type = ?
            `;
            
            const [result] = await db.query(query, [filePath, employeeId, documentType]);
            
            if (result.affectedRows === 0) {
                throw new Error('Document type not found for this employee');
            }
            
            return true;
        } catch (error) {
            console.error("❌ Error uploading pre-onboarding document:", error);
            throw error;
        }
    },

    // Review a pre-onboarding document
    reviewPreOnboardingDocument: async (employeeId, documentType, status, remarks, reviewedBy) => {
        try {
            const query = `
                UPDATE pre_onboarding_documents 
                SET status = ?,
                    remarks = ?,
                    reviewed_by = ?,
                    reviewed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE employee_id = ? AND document_type = ?
            `;
            
            const [result] = await db.query(query, [status, remarks, reviewedBy, employeeId, documentType]);
            
            if (result.affectedRows === 0) {
                throw new Error('Document not found');
            }
            
            return true;
        } catch (error) {
            console.error("❌ Error reviewing pre-onboarding document:", error);
            throw error;
        }
    },

    // Check if all required documents are completed
    checkOnboardingCompletion: async (employeeId) => {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_documents,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_documents,
                    SUM(CASE WHEN status IN ('pending', 'uploaded', 'reviewed', 'rejected') THEN 1 ELSE 0 END) as pending_documents
                FROM pre_onboarding_documents 
                WHERE employee_id = ?
            `;
            
            const [result] = await db.query(query, [employeeId]);
            const { total_documents, approved_documents, pending_documents } = result[0];
            
            return {
                total: total_documents,
                approved: approved_documents,
                pending: pending_documents,
                isComplete: total_documents > 0 && total_documents === approved_documents
            };
        } catch (error) {
            console.error("❌ Error checking onboarding completion:", error);
            throw error;
        }
    },

    // Complete onboarding for an employee (HR confirms all documents)
    completeOnboarding: async (employeeId) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            
            // Check if all documents are completed
            const completionStatus = await HRModel.checkOnboardingCompletion(employeeId);
            
            if (!completionStatus.isComplete) {
                throw new Error("Cannot complete onboarding: Not all pre-onboarding documents are approved");
            }
            
            // Get user_id from employee
            const [employeeResult] = await connection.query(
                "SELECT user_id FROM employees WHERE employee_id = ?",
                [employeeId]
            );
            
            if (employeeResult.length === 0) {
                throw new Error("Employee not found");
            }
            
            const userId = employeeResult[0].user_id;
            
            // Mark onboarding as completed
            await connection.query(
                "UPDATE users SET onboarding_completed = 1 WHERE id = ?",
                [userId]
            );
            
            await connection.commit();
            console.log(`✅ Onboarding completed for user ${userId} (employee ${employeeId})`);
            return true;
        } catch (error) {
            await connection.rollback();
            console.error("❌ Error completing onboarding:", error);
            throw error;
        } finally {
            connection.release();
        }
    },

    // Get onboarding status for an employee
    getOnboardingStatus: async (employeeId) => {
        try {
            const documents = await HRModel.getPreOnboardingDocuments(employeeId);
            const completion = await HRModel.checkOnboardingCompletion(employeeId);
            
            // Get employee and user info
            const [employeeResult] = await db.query(`
                SELECT e.*, u.is_active, u.onboarding_completed
                FROM employees e 
                JOIN users u ON e.user_id = u.id 
                WHERE e.employee_id = ?
            `, [employeeId]);
            
            const employee = employeeResult[0];
            
            return {
                employee,
                documents,
                completion,
                canComplete: completion.isComplete && !employee.onboarding_completed
            };
        } catch (error) {
            console.error("❌ Error getting onboarding status:", error);
            throw error;
        }
    },

    // Check if user has completed onboarding
    checkUserOnboardingStatus: async (userId) => {
        try {
            const [result] = await db.query(`
                SELECT onboarding_completed 
                FROM users 
                WHERE id = ?
            `, [userId]);
            
            const onboardingCompleted = result.length > 0 ? result[0].onboarding_completed : true;
            
            return onboardingCompleted;
        } catch (error) {
            console.error("Error checking user onboarding status:", error);
            throw error;
        }
    },

    // Add document type
    addDocumentType: async (documentType, requiredForRoleId = null, requiredForDepartmentId = null, isRequired = true) => {
        try {
            const [result] = await db.query(`
                INSERT INTO document_types 
                (document_type, required_for_role_id, required_for_department_id, is_required)
                VALUES (?, ?, ?, ?)
            `, [documentType, requiredForRoleId, requiredForDepartmentId, isRequired]);
            
            return result.insertId;
        } catch (error) {
            console.error("❌ Error adding document type:", error);
            throw error;
        }
    },

    // Get all document types
    getAllDocumentTypes: async () => {
        try {
            const [types] = await db.query(`
                SELECT 
                    dt.*,
                    r.name as role_name,
                    d.name as department_name
                FROM document_types dt
                LEFT JOIN roles r ON dt.required_for_role_id = r.id
                LEFT JOIN departments d ON dt.required_for_department_id = d.id
                ORDER BY dt.document_type
            `);
            return types;
        } catch (error) {
            console.error("❌ Error fetching document types:", error);
            throw error;
        }
    },

    // Update document type
    updateDocumentType: async (id, documentType, requiredForRoleId, requiredForDepartmentId, isRequired) => {
        try {
            const [result] = await db.query(`
                UPDATE document_types 
                SET document_type = ?,
                    required_for_role_id = ?,
                    required_for_department_id = ?,
                    is_required = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [documentType, requiredForRoleId, requiredForDepartmentId, isRequired, id]);
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error("❌ Error updating document type:", error);
            throw error;
        }
    },

    // Delete document type
    deleteDocumentType: async (id) => {
        try {
            const [result] = await db.query(`
                DELETE FROM document_types WHERE id = ?
            `, [id]);
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error("❌ Error deleting document type:", error);
            throw error;
        }
    },

    // Check if user needs pre-onboarding
    checkIfUserNeedsPreOnboarding: async (userId) => {
        try {
            // First check if user exists and get onboarding status with role info
            const [userResult] = await db.query(`
                SELECT u.id, u.onboarding_completed, u.role_id, r.name as role_name, e.employee_id
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                LEFT JOIN employees e ON u.id = e.user_id
                WHERE u.id = ?
            `, [userId]);
            
            if (userResult.length === 0) {
                return { needsOnboarding: false, reason: 'User not found' };
            }
            
            const user = userResult[0];
            
            // If onboarding is already completed, no need for pre-onboarding
            if (user.onboarding_completed === 1) {
                return { needsOnboarding: false, reason: 'Onboarding already completed' };
            }
            
            // Handle external users (developers, suppliers, etc.) based on role
            // These roles typically don't need pre-onboarding
            const externalRoles = ['developer', 'supplier', 'client', 'vendor'];
            if (externalRoles.includes(user.role_name?.toLowerCase())) {
                return { needsOnboarding: false, reason: 'External user - no pre-onboarding required' };
            }
            
            // If user has no employee_id, they might be an external user or invalid
            if (!user.employee_id) {
                // Mark them as completed to avoid blocking
                await db.query(`
                    UPDATE users SET onboarding_completed = 1 WHERE id = ?
                `, [userId]);
                return { needsOnboarding: false, reason: 'User without employee_id - marked as completed' };
            }
            
            // Check if there are any pre-onboarding documents for this employee
            const [documentsResult] = await db.query(`
                SELECT COUNT(*) as document_count
                FROM pre_onboarding_documents 
                WHERE employee_id = ?
            `, [user.employee_id]);
            
            const hasDocuments = documentsResult[0].document_count > 0;
            
            // If no documents exist, this might be a new employee who needs documents initialized
            if (!hasDocuments) {
                // Check if this is a new employee (onboarding_completed = 0)
                if (user.onboarding_completed === 0) {
                    return { 
                        needsOnboarding: true, 
                        reason: 'New employee - pre-onboarding required',
                        employeeId: user.employee_id,
                        totalDocuments: 0,
                        approvedDocuments: 0
                    };
                } else {
                    // This is a legacy employee (onboarding_completed = 1 but no documents)
                    await db.query(`
                        UPDATE users SET onboarding_completed = 1 WHERE id = ?
                    `, [userId]);
                    return { needsOnboarding: false, reason: 'Legacy employee - marked as completed' };
                }
            }
            
            // Check completion status of existing documents
            const [completionResult] = await db.query(`
                SELECT 
                    COUNT(*) as total_documents,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_documents
                FROM pre_onboarding_documents 
                WHERE employee_id = ?
            `, [user.employee_id]);
            
            const { total_documents, approved_documents } = completionResult[0];
            const isComplete = total_documents > 0 && total_documents === approved_documents;
            
            if (isComplete) {
                // All documents are approved, mark onboarding as completed
                await db.query(`
                    UPDATE users SET onboarding_completed = 1 WHERE id = ?
                `, [userId]);
                return { needsOnboarding: false, reason: 'All documents approved - onboarding completed' };
            }
            
            // User needs pre-onboarding
            return { 
                needsOnboarding: true, 
                reason: 'Pre-onboarding required',
                employeeId: user.employee_id,
                totalDocuments: total_documents,
                approvedDocuments: approved_documents
            };
            
        } catch (error) {
            console.error("Error checking if user needs pre-onboarding:", error);
            throw error;
        }
    },

    // Initialize pre-onboarding for legacy employees (optional)
    initializePreOnboardingForLegacyEmployee: async (employeeId) => {
        try {
            console.log('🔍 Initializing pre-onboarding for legacy employee:', employeeId);
            
            // Get employee details
            const [employeeResult] = await db.query(`
                SELECT e.user_id, e.role_id
                FROM employees e
                WHERE e.employee_id = ?
            `, [employeeId]);
            
            if (employeeResult.length === 0) {
                throw new Error('Employee not found');
            }
            
            const { user_id, role_id } = employeeResult[0];
            
            // Get required document types for this role
            const [documentTypes] = await db.query(`
                SELECT document_type
                FROM document_types
                WHERE required_for_role_id = ? AND is_required = TRUE
                ORDER BY document_type
            `, [role_id]);
            
            if (documentTypes.length === 0) {
                console.log('No required documents for this role');
                return true;
            }
            
            // Insert required documents for this employee
            const insertPromises = documentTypes.map(docType => {
                return db.query(`
                    INSERT INTO pre_onboarding_documents 
                    (user_id, employee_id, document_type, status) 
                    VALUES (?, ?, ?, 'pending')
                    ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
                `, [user_id, employeeId, docType.document_type]);
            });
            
            await Promise.all(insertPromises);
            console.log(`✅ Initialized ${documentTypes.length} pre-onboarding documents for legacy employee ${employeeId}`);
            return true;
        } catch (error) {
            console.error("❌ Error initializing pre-onboarding for legacy employee:", error);
            throw error;
        }
    },

    // Get the appropriate verifier role for different user types
    getVerifierRoleForUser: async (userId) => {
        try {
            const [userResult] = await db.query(`
                SELECT u.role_id, r.name as role_name
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                WHERE u.id = ?
            `, [userId]);
            
            if (userResult.length === 0) {
                return null;
            }
            
            const roleName = userResult[0].role_name?.toLowerCase();
            
            // Define verification boundaries
            const verificationMap = {
                // Internal employees - verified by HR
                'admin_staff': 'office_administrator',
                'office_administrator': 'office_administrator', // HR can verify other HR
                'finance_accounting': 'office_administrator',
                'general_foreman': 'office_administrator',
                'foreman_1': 'office_administrator',
                'foreman_2': 'office_administrator',
                'foreman_3': 'office_administrator',
                'sales_marketing_head': 'office_administrator',
                'agents': 'office_administrator',
                
                // Developers - verified by CRM or Manufacturing
                'developer': 'sales_marketing_head', // CRM Admin
                
                // Suppliers - verified by Supply Chain
                'supplier': 'logistics', // Supply Chain Manager
                
                // Default to HR for unknown roles
                'default': 'office_administrator'
            };
            
            const verifierRole = verificationMap[roleName] || verificationMap['default'];
            console.log(`🔍 User role: ${roleName}, Verifier role: ${verifierRole}`);
            
            return verifierRole;
        } catch (error) {
            console.error("❌ Error getting verifier role:", error);
            throw error;
        }
    },

    // Check if current user can verify onboarding for target user
    canVerifyOnboarding: async (currentUserId, targetUserId) => {
        try {
            // Get current user's role
            const [currentUserResult] = await db.query(`
                SELECT u.role_id, r.name as role_name
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                WHERE u.id = ?
            `, [currentUserId]);
            
            if (currentUserResult.length === 0) {
                return false;
            }
            
            const currentUserRole = currentUserResult[0].role_name?.toLowerCase();
            
            // Get target user's verifier role
            const verifierRole = await HRModel.getVerifierRoleForUser(targetUserId);
            
            if (!verifierRole) {
                return false;
            }
            
            // Check if current user has the required verifier role
            const canVerify = currentUserRole === verifierRole.toLowerCase();
            console.log(`🔍 Current user role: ${currentUserRole}, Required verifier: ${verifierRole}, Can verify: ${canVerify}`);
            
            return canVerify;
        } catch (error) {
            console.error("❌ Error checking verification permissions:", error);
            throw error;
        }
    },

    // Get required documents based on user role
    getRequiredDocumentsForRole: async (roleId) => {
        try {
            const [documents] = await db.query(`
                SELECT dt.*, r.name as role_name
                FROM document_types dt
                LEFT JOIN roles r ON dt.required_for_role_id = r.id
                WHERE dt.required_for_role_id = ? AND dt.is_required = TRUE
                ORDER BY dt.document_type
            `, [roleId]);
            
            return documents;
        } catch (error) {
            console.error("❌ Error fetching required documents for role:", error);
            throw error;
        }
    },

    // Get required documents for a specific role
    getRequiredDocumentsForRole: async (roleId) => {
        try {
            console.log('🔍 HR Model: getRequiredDocumentsForRole called for role ID:', roleId);
            
            const [documentsResult] = await db.query(`
                SELECT document_type, is_required
                FROM document_types
                WHERE required_for_role_id = ? AND is_required = TRUE
                ORDER BY document_type
            `, [roleId]);
            
            console.log('🔍 HR Model: Found', documentsResult.length, 'required documents for role');
            return documentsResult;
        } catch (error) {
            console.error("❌ Error getting required documents for role:", error);
            throw error;
        }
    },

    // Get user data (employee ID)
    getUserData: async (userId) => {
        try {
            const [userResult] = await db.query(`
                SELECT u.id, e.employee_id
                FROM users u
                LEFT JOIN employees e ON u.id = e.user_id
                WHERE u.id = ?
            `, [userId]);

            if (userResult.length === 0) {
                return null;
            }

            return userResult[0];
        } catch (error) {
            console.error("Error getting user data:", error);
            throw error;
        }
    },

    // Get onboarding documents for employee
    getOnboardingDocuments: async (employeeId) => {
        try {
            console.log('🔍 HR Model: getOnboardingDocuments called for employee ID:', employeeId);
            
            const [documentsResult] = await db.query(`
                SELECT id, document_type, status, file_path, uploaded_at, remarks
                FROM onboarding_documents 
                WHERE employee_id = ?
                ORDER BY document_type
            `, [employeeId]);

            return documentsResult;
        } catch (error) {
            console.error("❌ Error getting onboarding documents:", error);
            throw error;
        }
    },

    // Upload onboarding document (for bulk upload)
    uploadOnboardingDocument: async (employeeId, documentType, filename, originalName, fileSize, mimeType) => {
        try {
            console.log('🔍 HR Model: uploadOnboardingDocument called');
            
            // Get user_id from employee_id
            const [userResult] = await db.query(`
                SELECT user_id FROM employees WHERE employee_id = ?
            `, [employeeId]);
            
            if (!userResult || userResult.length === 0) {
                throw new Error('Employee not found');
            }
            
            const userId = userResult[0].user_id;
            
            // Insert or update document in onboarding_documents table
            const [existingDoc] = await db.query(`
                SELECT id FROM onboarding_documents 
                WHERE employee_id = ? AND document_type = ?
            `, [employeeId, documentType]);
            
            if (existingDoc && existingDoc.length > 0) {
                // Update existing document
                await db.query(`
                    UPDATE onboarding_documents 
                    SET file_path = ?, status = 'uploaded', uploaded_at = NOW()
                    WHERE employee_id = ? AND document_type = ?
                `, [filename, employeeId, documentType]);
            } else {
                // Insert new document
                await db.query(`
                    INSERT INTO onboarding_documents 
                    (user_id, employee_id, document_type, file_path, status, uploaded_at) 
                    VALUES (?, ?, ?, ?, 'uploaded', NOW())
                `, [userId, employeeId, documentType, filename]);
            }

            return {
                success: true,
                message: 'Document uploaded successfully',
                filename: filename
            };
        } catch (error) {
            console.error("❌ Error uploading onboarding document:", error);
            throw error;
        }
    },

    // Update document status after upload
    updateDocumentStatus: async (employeeId, documentType, filename) => {
        try {
            console.log('🔍 HR Model: updateDocumentStatus called');
            
            await db.query(`
                UPDATE onboarding_documents 
                SET status = 'uploaded', file_path = ?, uploaded_at = NOW()
                WHERE employee_id = ? AND document_type = ?
            `, [filename, employeeId, documentType]);

            return true;
        } catch (error) {
            console.error("❌ Error updating document status:", error);
            throw error;
        }
    },

    // Get user details with role and employee info
    getUserDetailsWithRole: async (userId) => {
        try {
            console.log('🔍 HR Model: getUserDetailsWithRole called for user ID:', userId);
            
            const [userResult] = await db.query(`
                SELECT u.id, u.role_id, r.name as role_name, e.employee_id
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                LEFT JOIN employees e ON u.id = e.user_id
                WHERE u.id = ?
            `, [userId]);

            if (userResult.length === 0) {
                return null;
            }

            return userResult[0];
        } catch (error) {
            console.error("❌ Error getting user details with role:", error);
            throw error;
        }
    },

    // Check if documents exist for employee
    checkDocumentsExist: async (employeeId) => {
        try {
            console.log('🔍 HR Model: checkDocumentsExist called for employee ID:', employeeId);
            
            const [result] = await db.query(`
                SELECT COUNT(*) as count
                FROM pre_onboarding_documents 
                WHERE employee_id = ?
            `, [employeeId]);

            return result[0].count > 0;
        } catch (error) {
            console.error("❌ Error checking documents exist:", error);
            throw error;
        }
    },

    // Get default documents
    getDefaultDocuments: async () => {
        try {
            console.log('🔍 HR Model: getDefaultDocuments called');
            
            const [defaultDocs] = await db.query(`
                SELECT document_type
                FROM document_types
                WHERE required_for_role_id IS NULL AND is_required = TRUE
                ORDER BY document_type
            `);

            return defaultDocs;
        } catch (error) {
            console.error("❌ Error getting default documents:", error);
            throw error;
        }
    },

    // Initialize documents for user
    initializeDocumentsForUser: async (userId, employeeId, documents) => {
        try {
            console.log('🔍 HR Model: initializeDocumentsForUser called');
            
            const insertPromises = documents.map(doc => {
                return db.query(`
                    INSERT INTO pre_onboarding_documents 
                    (user_id, employee_id, document_type, status) 
                    VALUES (?, ?, ?, 'pending')
                `, [userId, employeeId, doc.document_type]);
            });

            await Promise.all(insertPromises);
            return true;
        } catch (error) {
            console.error("❌ Error initializing documents for user:", error);
            throw error;
        }
    },

    // Get all permissions
    getAllPermissions: async () => {
        try {
            console.log('🔍 HR Model: getAllPermissions called');
            
            const [permissions] = await db.query("SELECT * FROM permissions");
            return permissions;
        } catch (error) {
            console.error("❌ Error getting all permissions:", error);
            throw error;
        }
    },

    // 🔹 Onboarding Document Queries
    // Create onboarding document
    createOnboardingDocument: async (documentData) => {
        try {
            console.log('🔍 HR Model: createOnboardingDocument called');
            const { user_id, employee_id, document_type, file_path, status = 'pending', remarks = null } = documentData;
            
            const query = `
                INSERT INTO onboarding_documents 
                (user_id, employee_id, document_type, file_path, status, remarks, uploaded_at) 
                VALUES (?, ?, ?, ?, ?, ?, NOW())
            `;
            
            const [result] = await db.query(query, [user_id, employee_id, document_type, file_path, status, remarks]);
            
            return {
                success: true,
                documentId: result.insertId,
                message: 'Document uploaded successfully'
            };
        } catch (error) {
            console.error('❌ Error creating onboarding document:', error);
            throw new Error('Failed to create onboarding document');
        }
    },

    // Get documents by employee ID
    getOnboardingDocumentsByEmployee: async (employeeId) => {
        try {
            console.log('🔍 HR Model: getOnboardingDocumentsByEmployee called for employee ID:', employeeId);
            
            const query = `
                SELECT 
                    id, user_id, employee_id, document_type, file_path, 
                    status, remarks, uploaded_at, reviewed_at, reviewed_by
                FROM onboarding_documents 
                WHERE employee_id = ?
                ORDER BY uploaded_at DESC
            `;
            
            const [documents] = await db.query(query, [employeeId]);
            
            return {
                success: true,
                documents: documents
            };
        } catch (error) {
            console.error('❌ Error getting onboarding documents:', error);
            throw new Error('Failed to get onboarding documents');
        }
    },

    // Get all documents pending verification (status = 'uploaded')
    getPendingOnboardingDocuments: async () => {
        try {
            if (process.env.NODE_ENV === 'development') console.debug('🔍 HR Model: getPendingOnboardingDocuments called');
            const [rows] = await db.query(`
                SELECT 
                    od.id,
                    od.user_id,
                    od.employee_id,
                    e.full_name,
                    od.document_type,
                    od.file_path,
                    od.status,
                    od.remarks,
                    od.uploaded_at,
                    od.reviewed_at,
                    od.reviewed_by
                FROM onboarding_documents od
                LEFT JOIN employees e ON e.employee_id = od.employee_id
                WHERE od.status = 'uploaded'
                ORDER BY od.uploaded_at DESC
            `);
            if (process.env.NODE_ENV === 'development') console.debug('🔍 HR Model: pending docs count =', rows.length);
            return rows;
        } catch (error) {
            console.error('❌ Error getting pending onboarding documents:', error);
            throw error;
        }
    },

    // Update document status
    updateOnboardingDocumentStatus: async (documentId, status, reviewedBy = null, remarks = null) => {
        try {
            if (process.env.NODE_ENV === 'development') console.debug('🔍 HR Model: updateOnboardingDocumentStatus called');
            
            const updateQuery = `
                UPDATE onboarding_documents 
                SET status = ?, reviewed_by = ?, reviewed_at = NOW(), remarks = ?
                WHERE id = ?
            `;
            const [res] = await db.query(updateQuery, [status, reviewedBy, remarks, documentId]);

            if (res && res.affectedRows > 0) {
                return {
                    success: true,
                    message: 'Document status updated successfully',
                    table: 'onboarding_documents'
                };
            }
            
            return {
                success: false,
                message: 'No document found to update',
                table: 'onboarding_documents'
            };
        } catch (error) {
            console.error('❌ Error updating document status:', error);
            throw new Error('Failed to update document status');
        }
    },

    // Get document by ID
    getOnboardingDocumentById: async (documentId) => {
        try {
            console.log('🔍 HR Model: getOnboardingDocumentById called for document ID:', documentId);
            
            const query = `
                SELECT 
                    id, user_id, employee_id, document_type, file_path, 
                    status, remarks, uploaded_at, reviewed_at, reviewed_by
                FROM pre_onboarding_documents 
                WHERE id = ?
            `;
            
            const [documents] = await db.query(query, [documentId]);
            
            return documents[0] || null;
        } catch (error) {
            console.error('❌ Error getting document by ID:', error);
            throw new Error('Failed to get document');
        }
    },

    // Delete document
    deleteOnboardingDocument: async (documentId) => {
        try {
            console.log('🔍 HR Model: deleteOnboardingDocument called for document ID:', documentId);
            
            const query = 'DELETE FROM pre_onboarding_documents WHERE id = ?';
            await db.query(query, [documentId]);
            
            return {
                success: true,
                message: 'Document deleted successfully'
            };
        } catch (error) {
            console.error('❌ Error deleting document:', error);
            throw new Error('Failed to delete document');
        }
    },

    // Get documents count by status
    getOnboardingDocumentsCountByStatus: async (employeeId) => {
        try {
            console.log('🔍 HR Model: getOnboardingDocumentsCountByStatus called for employee ID:', employeeId);
            
            const query = `
                SELECT 
                    status, COUNT(*) as count
                FROM pre_onboarding_documents 
                WHERE employee_id = ?
                GROUP BY status
            `;
            
            const [results] = await db.query(query, [employeeId]);
            
            const counts = {
                pending: 0,
                uploaded: 0,
                approved: 0,
                rejected: 0
            };
            
            results.forEach(result => {
                counts[result.status] = result.count;
            });
            
            return counts;
        } catch (error) {
            console.error('❌ Error getting documents count:', error);
            throw new Error('Failed to get documents count');
        }
    },

    // Get required documents for employee based on role and department
    getRequiredDocumentsForEmployee: async (userId) => {
        try {
            console.log('🔍 HR Model: getRequiredDocumentsForEmployee called for user ID:', userId);
            
            const query = `
                SELECT DISTINCT rd.document_type, rd.is_required, rd.importance_level
                FROM required_documents rd
                LEFT JOIN users u ON u.id = ?
                LEFT JOIN employees e ON e.user_id = u.id
                LEFT JOIN roles r ON u.role_id = r.id
                WHERE (rd.required_for_role_id = u.role_id OR rd.required_for_role_id IS NULL)
                AND (rd.required_for_department_id = r.department_id OR rd.required_for_department_id IS NULL)
                AND rd.is_required = TRUE
                ORDER BY 
                    CASE rd.importance_level 
                        WHEN 'essential' THEN 1 
                        WHEN 'important' THEN 2 
                        WHEN 'optional' THEN 3 
                        ELSE 4 
                    END,
                    rd.document_type
            `;
            
            const [documents] = await db.query(query, [userId]);
            
            return {
                success: true,
                documents: documents
            };
        } catch (error) {
            console.error('❌ Error getting required documents for employee:', error);
            throw new Error('Failed to get required documents');
        }
    },

    // Check if employee needs onboarding with detailed status
    checkOnboardingStatus: async (employeeId) => {
        try {
            console.log('🔍 HR Model: checkOnboardingStatus called for employee ID:', employeeId);
            
            // Get document counts by importance level
            const query = `
                SELECT 
                    COUNT(*) as total_documents,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_documents,
                    SUM(CASE WHEN status = 'uploaded' THEN 1 ELSE 0 END) as uploaded_documents,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_documents,
                    SUM(CASE WHEN pod.importance_level = 'essential' AND pod.status = 'approved' THEN 1 ELSE 0 END) as essential_approved,
                    SUM(CASE WHEN pod.importance_level = 'essential' THEN 1 ELSE 0 END) as total_essential
                FROM pre_onboarding_documents pod
                WHERE pod.employee_id = ?
            `;
            
            const [results] = await db.query(query, [employeeId]);
            const result = results[0];
            
            // Determine onboarding status
            let onboardingStatus = 'pending';
            let statusMessage = '';
            
            if (result.total_documents === 0) {
                onboardingStatus = 'not_started';
                statusMessage = 'Please upload required documents to begin onboarding';
            } else if (result.uploaded_documents > 0 && result.approved_documents === 0) {
                onboardingStatus = 'documents_submitted';
                statusMessage = 'Documents submitted. Please report to HR for finalization and account activation.';
            } else if (result.essential_approved === result.total_essential && result.total_essential > 0) {
                onboardingStatus = 'essential_complete';
                statusMessage = 'Essential documents approved. Account can be activated. Remaining documents can be completed later.';
            } else if (result.approved_documents > 0 && result.approved_documents < result.total_documents) {
                onboardingStatus = 'partially_complete';
                statusMessage = 'Some documents approved. Please complete remaining documents.';
            } else if (result.approved_documents === result.total_documents) {
                onboardingStatus = 'complete';
                statusMessage = 'All documents approved. Onboarding complete!';
            }
            
            return {
                needsOnboarding: onboardingStatus !== 'complete' && onboardingStatus !== 'essential_complete',
                onboardingStatus: onboardingStatus,
                statusMessage: statusMessage,
                totalDocuments: result.total_documents,
                approvedDocuments: result.approved_documents,
                uploadedDocuments: result.uploaded_documents,
                pendingDocuments: result.pending_documents,
                essentialApproved: result.essential_approved,
                totalEssential: result.total_essential
            };
        } catch (error) {
            console.error('❌ Error checking onboarding status:', error);
            throw new Error('Failed to check onboarding status');
        }
    },

    // Delete deduction
    deleteDeduction: async (id) => {
        try {
            const [result] = await db.query(
                `DELETE FROM payroll_deductions WHERE id = ?`,
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error("❌ Error deleting deduction:", error);
            throw error;
        }
    },

    // 🔹 Individual Deduction Overrides for Payroll Entries
    // Create table for individual deduction overrides
    createDeductionOverridesTable: async () => {
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS payroll_deduction_overrides (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    payroll_id INT,
                    employee_id VARCHAR(20),
                    deduction_type VARCHAR(100) NOT NULL,
                    original_amount DECIMAL(10,2) NOT NULL,
                    override_amount DECIMAL(10,2) NOT NULL,
                    override_reason TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (payroll_id) REFERENCES payroll(id) ON DELETE CASCADE,
                    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
                    UNIQUE KEY unique_override (payroll_id, employee_id, deduction_type)
                )
            `);
            console.log("✅ Payroll deduction overrides table created or already exists");
        } catch (error) {
            console.error("❌ Error creating deduction overrides table:", error);
            throw error;
        }
    },

    // Get deduction overrides for a specific payroll entry
    getDeductionOverrides: async (payrollId, employeeId) => {
        try {
            const [rows] = await db.query(`
                SELECT 
                    id,
                    deduction_type,
                    original_amount,
                    override_amount,
                    override_reason
                FROM payroll_deduction_overrides 
                WHERE payroll_id = ? AND employee_id = ?
                ORDER BY deduction_type
            `, [payrollId, employeeId]);
            return rows;
        } catch (error) {
            console.error("❌ Error fetching deduction overrides:", error);
            throw error;
        }
    },

    // Save or update deduction overrides
    saveDeductionOverrides: async (payrollId, employeeId, overrides) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Delete existing overrides for this employee in this payroll
            await connection.query(
                'DELETE FROM payroll_deduction_overrides WHERE payroll_id = ? AND employee_id = ?',
                [payrollId, employeeId]
            );

            // Insert new overrides
            if (overrides && overrides.length > 0) {
                const values = overrides.map(override => [
                    payrollId,
                    employeeId,
                    override.deduction_type,
                    override.original_amount,
                    override.override_amount,
                    override.override_reason || null
                ]);

                await connection.query(`
                    INSERT INTO payroll_deduction_overrides 
                    (payroll_id, employee_id, deduction_type, original_amount, override_amount, override_reason)
                    VALUES ?
                `, [values]);
            }

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            console.error("❌ Error saving deduction overrides:", error);
            throw error;
        } finally {
            connection.release();
        }
    },

    // Get detailed deductions breakdown for an employee
    getEmployeeDeductionsBreakdown: async (employeeId, salary) => {
        try {
            // Get base deductions from payroll_deductions table
            const [baseDeductions] = await db.query(`
                SELECT 
                    deduction_type,
                    fixed_amount,
                    description,
                    category
                FROM payroll_deductions 
                WHERE is_active = TRUE
                ORDER BY category, deduction_type
            `);

            // Calculate total deductions
            const totalDeductions = baseDeductions.reduce((sum, deduction) => {
                return sum + parseFloat(deduction.fixed_amount || 0);
            }, 0);

            return {
                deductions: baseDeductions,
                total: totalDeductions
            };
        } catch (error) {
            console.error("❌ Error getting employee deductions breakdown:", error);
            throw error;
        }
    },

    // Get payroll entry with deduction breakdown
    getPayrollEntryWithDeductions: async (payrollId, employeeId) => {
        try {
            // Get payroll entry
            const [payrollEntry] = await db.query(`
                SELECT *, position_id, basic_salary_snapshot FROM payroll WHERE id = ? AND employee_id = ?
            `, [payrollId, employeeId]);

            if (payrollEntry.length === 0) {
                return null;
            }

            const entry = payrollEntry[0];

            // Get base deductions
            const deductionsBreakdown = await HRModel.getEmployeeDeductionsBreakdown(employeeId, entry.fixed_salary);

            // Get any overrides for this payroll entry
            const overrides = await HRModel.getDeductionOverrides(payrollId, employeeId);

            // Apply overrides to deductions
            const finalDeductions = deductionsBreakdown.deductions.map(deduction => {
                const override = overrides.find(o => o.deduction_type === deduction.deduction_type);
                return {
                    ...deduction,
                    original_amount: parseFloat(deduction.fixed_amount),
                    override_amount: override ? parseFloat(override.override_amount) : parseFloat(deduction.fixed_amount),
                    is_overridden: !!override,
                    override_reason: override ? override.override_reason : null
                };
            });

            // Calculate final total
            const finalTotal = finalDeductions.reduce((sum, deduction) => {
                return sum + deduction.override_amount;
            }, 0);

            return {
                payrollEntry: entry,
                deductions: finalDeductions,
                totalDeductions: finalTotal,
                overrides: overrides
            };
        } catch (error) {
            console.error("❌ Error getting payroll entry with deductions:", error);
            throw error;
        }
    },

    // Payslip Management Functions (for HR to view payslips)
    getAllPayslips: async function() {
        try {
            console.log('🔍 HR Model: Starting getAllPayslips...');
            
            // First, let's test if we can connect to the database
            console.log('🔍 HR Model: Testing database connection...');
            const [testResult] = await db.query('SELECT 1 as test');
            console.log('🔍 HR Model: Database connection test result:', testResult);
            
            // Check if payslip table exists
            console.log('🔍 HR Model: Checking if payslip table exists...');
            const [tableCheck] = await db.query(`
                SELECT COUNT(*) as count 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                AND table_name = 'payslip'
            `);
            console.log('🔍 HR Model: Payslip table exists:', tableCheck[0].count > 0);
            
            // Check if we have any payslips
            console.log('🔍 HR Model: Checking payslip count...');
            const [countResult] = await db.query('SELECT COUNT(*) as count FROM payslip');
            console.log('🔍 HR Model: Total payslips in database:', countResult[0].count);
            
            // Now try the main query
            const SQL_COMMAND = `
                SELECT 
                    p.id,
                    p.payslip_number,
                    p.payslip_date,
                    p.payslip_period,
                    p.employee_id,
                    e.full_name,
                    r.name as position,
                    e.profile_picture,
                    p.basic_salary,
                    p.salary_before_tax,
                    p.total_deductions,
                    p.absence_deduction,
                    p.net_salary,
                    p.start_date,
                    p.end_date,
                    p.days_present,
                    p.days_absent,
                    p.total_hours,
                    p.overtime_hours,
                    p.payment_method,
                    p.status,
                    p.approved_date,
                    u.username as approved_by_name,
                    p.next_period_deductions
                FROM payslip p
                JOIN employees e ON p.employee_id = e.employee_id
                JOIN roles r ON e.role_id = r.id
                LEFT JOIN users u ON p.approved_by = u.id
                ORDER BY p.payslip_date DESC, p.payslip_number DESC
            `;

            console.log('🔍 HR Model: Executing main query...');
            console.log('🔍 HR Model: SQL Command:', SQL_COMMAND);
            
            const [payslips] = await db.query(SQL_COMMAND);
            
            console.log('🔍 HR Model: Query executed successfully');
            console.log('🔍 HR Model: Number of payslips found:', payslips.length);
            if (payslips.length > 0) {
                console.log('🔍 HR Model: Sample payslip:', payslips[0]);
            }
            
            return payslips;
        } catch (error) {
            console.error('❌ HR Model: Error in getAllPayslips:', error);
            console.error('❌ HR Model: Error details:', {
                message: error.message,
                code: error.code,
                sqlMessage: error.sqlMessage,
                sqlState: error.sqlState,
                sql: error.sql
            });
            throw new Error('Failed to fetch payslips');
        }
    },

    getPayslipById: async function(payslipId) {
        const SQL_COMMAND = `
            SELECT 
                p.*,
                e.full_name,
                r.name as position,
                e.profile_picture,
                u.username as approved_by_name
            FROM payslip p
            JOIN employees e ON p.employee_id = e.employee_id
            JOIN roles r ON e.role_id = r.id
            LEFT JOIN users u ON p.approved_by = u.id
            WHERE p.id = ?
        `;

        try {
            const [payslips] = await db.query(SQL_COMMAND, [payslipId]);
            return payslips[0] || null;
        } catch (error) {
            console.error('Error in getPayslipById:', error);
            throw new Error('Failed to fetch payslip');
        }
    },

    // =========================
    // Payroll Periods Management
    // =========================

    // ===== PAYROLL ONLY: Create a new payroll period with deduction_mode
    createPayrollPeriod: async (periodName, startDate, endDate, deductionMode = 'split') => {
        try {
            const [result] = await db.query(`
                INSERT INTO payroll_periods (period_name, start_date, end_date, deduction_mode, status, created_at)
                VALUES (?, ?, ?, ?, 'pending', NOW())
            `, [periodName, startDate, endDate, deductionMode]);
            
            return result.insertId;
        } catch (error) {
            console.error("❌ Error creating payroll period:", error);
            throw error;
        }
    },

    // Get all payroll periods
    getAllPayrollPeriods: async () => {
        try {
            const [periods] = await db.query(`
            SELECT 
                    pp.*,
                    COUNT(DISTINCT e.employee_id) as total_employees,
                    COUNT(DISTINCT CASE WHEN p.status = 'pending' THEN e.employee_id END) as pending_employees,
                    COUNT(DISTINCT CASE WHEN p.status = 'approved' THEN e.employee_id END) as approved_employees,
                    COALESCE(SUM(p.net_salary), 0) as total_amount
                FROM payroll_periods pp
                LEFT JOIN employees e ON e.is_deleted = 0
                LEFT JOIN payroll p ON pp.id = p.payroll_period_id
                GROUP BY pp.id
                ORDER BY pp.created_at DESC
            `);
            return periods;
        } catch (error) {
            console.error("❌ Error fetching payroll periods:", error);
            throw error;
        }
    },

    // Get payroll period by ID
    getPayrollPeriodById: async (periodId) => {
        try {
            const [periods] = await db.query(`
                SELECT * FROM payroll_periods WHERE id = ?
            `, [periodId]);
            return periods[0] || null;
        } catch (error) {
            console.error("❌ Error fetching payroll period:", error);
            throw error;
        }
    },

    // ===== PAYROLL ONLY: Update deduction_mode for a payroll period
    updatePayrollPeriodDeductionMode: async (periodId, deductionMode) => {
        try {
            await db.query(`
                UPDATE payroll_periods
                SET deduction_mode = ?
                WHERE id = ?
            `, [deductionMode, periodId]);
        } catch (error) {
            console.error("❌ Error updating payroll period deduction_mode:", error);
            throw error;
        }
    },

    // Get all payroll entries for a specific period
    getPayrollEntriesByPeriod: async (periodId) => {
        try {
            const [entries] = await db.query(`
            SELECT 
                    p.*,
                    p.position_id,
                    p.basic_salary_snapshot,
                e.full_name,
                r.name as position,
                    e.profile_picture
                FROM payroll p
                JOIN employees e ON p.employee_id = e.employee_id
                JOIN roles r ON e.role_id = r.id
                WHERE p.payroll_period_id = ?
                ORDER BY e.full_name
            `, [periodId]);
            return entries;
        } catch (error) {
            console.error("❌ Error fetching payroll entries by period:", error);
            throw error;
        }
    },

    // Count payroll rows linked to a period (any status)
    countPayrollByPeriod: async (periodId) => {
        try {
            const [rows] = await db.query(`
                SELECT COUNT(*) AS cnt
                FROM payroll
                WHERE payroll_period_id = ?
            `, [periodId]);
            return rows[0]?.cnt || 0;
        } catch (error) {
            console.error("❌ Error counting payroll by period:", error);
            throw error;
        }
    },

    // Update payroll period status
    updatePayrollPeriodStatus: async (periodId, status) => {
        try {
            const [result] = await db.query(`
                UPDATE payroll_periods 
                SET status = ?, updated_at = NOW()
                WHERE id = ?
            `, [status, periodId]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error("❌ Error updating payroll period status:", error);
            throw error;
        }
    },

    // ===== PAYROLL ONLY: Find or create payroll period for given dates (respects deduction_mode when creating)
    findOrCreatePayrollPeriod: async (startDate, endDate, periodName = null, deductionMode = 'split') => {
        try {
            // First, try to find existing period by dates
            const [existing] = await db.query(`
                SELECT * FROM payroll_periods 
                WHERE start_date = ? AND end_date = ?
            `, [startDate, endDate]);
            
            if (existing.length > 0) {
                console.log('Found existing payroll period:', existing[0].id);
                return existing[0].id;
            }
            
            // Create new period if not found
            if (!periodName) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                const month = start.toLocaleDateString('en-US', { month: 'short' });
                const year = end.getFullYear();
                const isFirstHalf = start.getDate() <= 15;
                const period = isFirstHalf ? 'first' : 'second';
                periodName = `${month} ${year} - ${period}`;
            }
            
            console.log('Creating new payroll period:', periodName);
            const periodId = await HRModel.createPayrollPeriod(periodName, startDate, endDate, deductionMode);
            return periodId;
        } catch (error) {
            console.error("❌ Error finding or creating payroll period:", error);
            throw error;
        }
    },

    // Link payroll entries to period
    linkPayrollToPeriod: async (payrollIds, periodId) => {
        try {
            const [result] = await db.query(`
                UPDATE payroll 
                SET payroll_period_id = ?
                WHERE id IN (${payrollIds.map(() => '?').join(',')})
            `, [periodId, ...payrollIds]);
            
            return result.affectedRows;
        } catch (error) {
            console.error("❌ Error linking payroll to period:", error);
            throw error;
        }
    },

    // Migration function to create periods from existing payroll data
    migrateExistingPayrollToPeriods: async () => {
        try {
            console.log('🔄 Starting payroll periods migration...');
            
            // Get all unique date combinations from existing payroll
            const [uniqueDates] = await db.query(`
                SELECT DISTINCT start_date, end_date 
                FROM payroll 
                WHERE payroll_period_id IS NULL
                ORDER BY start_date, end_date
            `);
            
            console.log(`📊 Found ${uniqueDates.length} unique date combinations`);
            
            let totalLinked = 0;
            
            for (const datePair of uniqueDates) {
                // Create period for this date combination
                const periodName = `${new Date(datePair.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(datePair.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                
                const periodId = await HRModel.createPayrollPeriod(periodName, datePair.start_date, datePair.end_date);
                
                // Link all payroll entries with these dates to this period
                const [result] = await db.query(`
                    UPDATE payroll 
                    SET payroll_period_id = ?
                    WHERE start_date = ? AND end_date = ? AND payroll_period_id IS NULL
                `, [periodId, datePair.start_date, datePair.end_date]);
                
                totalLinked += result.affectedRows;
                console.log(`✅ Created period "${periodName}" and linked ${result.affectedRows} payroll entries`);
            }
            
            console.log(`🎉 Migration complete! Linked ${totalLinked} total payroll entries to periods`);
            return { periodsCreated: uniqueDates.length, entriesLinked: totalLinked };
        } catch (error) {
            console.error("❌ Error during payroll periods migration:", error);
            throw error;
        }
    },

    // Get payroll summary for a period
    getPayrollPeriodSummary: async (periodId) => {
        try {
            const [summary] = await db.query(`
                SELECT 
                    pp.period_name,
                    pp.start_date,
                    pp.end_date,
                    pp.status,
                    COUNT(p.id) as total_employees,
                    SUM(p.net_salary) as total_payroll_amount,
                    AVG(p.net_salary) as average_salary,
                    SUM(p.total_hours) as total_hours,
                    SUM(p.overtime_hours) as total_overtime_hours
                FROM payroll_periods pp
                LEFT JOIN payroll p ON pp.id = p.payroll_period_id
                WHERE pp.id = ?
                GROUP BY pp.id
            `, [periodId]);
            
            return summary[0] || null;
        } catch (error) {
            console.error("❌ Error fetching payroll period summary:", error);
            throw error;
        }
    },

    // Check if payroll period exists for given dates
    checkPayrollPeriodExists: async (startDate, endDate) => {
        try {
            const [periods] = await db.query(`
                SELECT id FROM payroll_periods 
                WHERE start_date = ? AND end_date = ?
            `, [startDate, endDate]);
            
            return periods.length > 0 ? periods[0].id : null;
        } catch (error) {
            console.error("❌ Error checking payroll period existence:", error);
            throw error;
        }
    },

    // Delete payroll period (only if no linked payroll entries)
    deletePayrollPeriod: async (periodId) => {
        try {
            // Check if period has linked payroll entries
            const [linked] = await db.query(`
                SELECT COUNT(*) as count FROM payroll WHERE payroll_period_id = ?
            `, [periodId]);
            
            if (linked[0].count > 0) {
                throw new Error(`Cannot delete period: ${linked[0].count} payroll entries are linked to this period`);
            }
            
            const [result] = await db.query(`
                DELETE FROM payroll_periods WHERE id = ?
            `, [periodId]);
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error("❌ Error deleting payroll period:", error);
            throw error;
        }
    },

    // Get pending payroll periods
    getPendingPayrollPeriods: async () => {
        try {
            const [periods] = await db.query(`
                SELECT 
                    pp.*,
                    COUNT(p.id) as employee_count
                FROM payroll_periods pp
                LEFT JOIN payroll p ON pp.id = p.payroll_period_id
                WHERE pp.status = 'pending'
                GROUP BY pp.id
                ORDER BY pp.created_at DESC
            `);
            return periods;
        } catch (error) {
            console.error("❌ Error fetching pending payroll periods:", error);
            throw error;
        }
    },

    // Get approved payroll periods
    getApprovedPayrollPeriods: async () => {
        try {
            const [periods] = await db.query(`
                SELECT 
                    pp.*,
                    COUNT(p.id) as employee_count,
                    SUM(p.net_salary) as total_amount
                FROM payroll_periods pp
                LEFT JOIN payroll p ON pp.id = p.payroll_period_id
                WHERE pp.status = 'approved'
                GROUP BY pp.id
                ORDER BY pp.created_at DESC
            `);
            return periods;
        } catch (error) {
            console.error("❌ Error fetching approved payroll periods:", error);
            throw error;
        }
    },

    // Update existing payroll generation to use periods
    insertPayrollRecordsWithPeriod: async (records, periodId) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            
            // Get employee IDs from records
            const employeeIds = records.map(r => r.employee_id);
            
            // Get position data for all employees
            const positionData = await HRModel.getPositionDataForEmployees(employeeIds);
            
            const values = records.map(r => {
                const posData = positionData[r.employee_id] || {};
                return [
                    r.employee_id,
                    posData.position_id || null, // position_id
                    posData.basic_salary || r.monthly_salary || 0, // basic_salary_snapshot
                    new Date().toISOString().split('T')[0], // payroll_date (current date)
                    r.days_present,
                    r.days_absent,
                    r.total_hours || 0,
                    r.overtime_hours || 0,
                    r.monthly_salary || 0,
                    r.total_deductions || 0,
                    r.absence_deduction || 0,
                    r.net_pay || 0,
                    r.payroll_period || '',
                    r.status || 'pending',
                    r.monthly_salary || 0,
                    periodId, // payroll_period_id
                    r.sss_deduction_id || null,
                    r.philhealth_deduction_id || null,
                    r.pagibig_deduction_id || null
                ];
            });

            console.log('Inserting payroll records with position data and period ID:', periodId);

            const [result] = await connection.query(
                `INSERT INTO payroll 
                 (employee_id, position_id, basic_salary_snapshot, payroll_date, days_present, 
                  days_absent, total_hours, overtime_hours, fixed_salary, total_deductions, 
                  absence_deduction, net_salary, payroll_period, status, salary_before_tax, payroll_period_id,
                  sss_deduction_id, philhealth_deduction_id, pagibig_deduction_id)
                 VALUES ?`, [values]
            );

            // Return the inserted IDs
            const insertedIds = [];
            for (let i = 0; i < records.length; i++) {
                insertedIds.push(result.insertId + i);
            }
            
            // Update payroll_periods table with the first payroll_id
            const firstPayrollId = insertedIds.length > 0 ? insertedIds[0] : null;
            if (firstPayrollId !== null) {
                await connection.query(`
                    UPDATE payroll_periods 
                    SET payroll_id = ? 
                    WHERE id = ?
                `, [firstPayrollId, periodId]);
            }
            
            await connection.commit();
            connection.release();
            
            return insertedIds;
        } catch (error) {
            await connection.rollback();
            connection.release();
            console.error('Error inserting payroll records with period:', error);
            throw error;
        }
    },

    // ... existing code ...
    async saveContractSignature({ userId, employeeId, signaturePath, signedAt }) {
        const db = require('../../../db');
        // Upsert: if an employment contract row exists, update; otherwise insert a new row
        // Assume document_type label for contract is 'Employment Contract'
        const docType = 'Employment Contract';
        // Try update first
        const [updateRes] = await db.query(
            `UPDATE onboarding_documents 
             SET contract_status = 'signed', signature_path = ?, signed_at = ?, status = 'uploaded'
             WHERE employee_id = ? AND document_type = ?`,
            [signaturePath, signedAt, employeeId, docType]
        );
        if (updateRes.affectedRows === 0) {
            // Insert
            const [insertRes] = await db.query(
                `INSERT INTO onboarding_documents (user_id, employee_id, document_type, file_path, status, contract_status, signature_path, signed_at)
                 VALUES (?, ?, ?, NULL, 'uploaded', 'signed', ?, ?)`,
                [userId, employeeId, docType, signaturePath, signedAt]
            );
            return insertRes.insertId;
        }
        return true;
    },

    async getContractStatus(employeeId) {
        const db = require('../../../db');
        const [rows] = await db.query(
            `SELECT contract_status, signature_path, signed_at 
             FROM onboarding_documents 
             WHERE employee_id = ? AND document_type = 'Employment Contract' 
             ORDER BY id DESC LIMIT 1`,
            [employeeId]
        );
        return rows && rows[0] ? rows[0] : null;
    },

    async validateContract(documentId, validatedBy) {
        const db = require('../../../db');
        const [res] = await db.query(
            `UPDATE onboarding_documents 
             SET status = 'approved', hr_validated = 1, reviewed_by = ?, reviewed_at = NOW()
             WHERE id = ?`,
            [validatedBy, documentId]
        );
        return res.affectedRows > 0;
    },

    async getEmployeeEmailAndIdByDocumentId(documentId) {
        const db = require('../../../db');
        const [rows] = await db.query(
            `SELECT u.email, e.employee_id 
             FROM onboarding_documents od
             JOIN employees e ON e.employee_id = od.employee_id
             JOIN users u ON u.id = e.user_id
             WHERE od.id = ?
             LIMIT 1`,
            [documentId]
        );
        return rows && rows[0] ? rows[0] : { email: null, employee_id: null };
    },

    // Check if employee is eligible for onboarding approval email
    async checkEligibilityForOnboardingEmail(employeeId) {
        const db = require('../../../db');
        
        // Check if employment contract is validated/approved
        const [contractRows] = await db.query(
            `SELECT COUNT(*) as count FROM onboarding_documents 
             WHERE employee_id = ? 
             AND document_type LIKE '%employment contract%' 
             AND status = 'approved'`,
            [employeeId]
        );
        
        const contractApproved = contractRows[0].count > 0;
        
        // Check if at least one ID document is approved (excluding employment contract)
        const [idRows] = await db.query(
            `SELECT COUNT(*) as count FROM onboarding_documents 
             WHERE employee_id = ? 
             AND document_type NOT LIKE '%employment contract%'
             AND status = 'approved'`,
            [employeeId]
        );
        
        const idApproved = idRows[0].count > 0;
        // Relaxed eligibility: send onboarding email as soon as at least one valid ID (or any non-contract doc) is approved.
        // Previously: eligible only when contractApproved && idApproved
        return {
            contractApproved,
            idApproved,
            eligible: idApproved
        };
    },

    // Send onboarding approval email if eligible
    async sendOnboardingEmailIfEligible(employeeId) {
        const eligibility = await this.checkEligibilityForOnboardingEmail(employeeId);
        
        if (eligibility.eligible) {
            // Get employee email and user ID
            const [rows] = await db.query(
                `SELECT u.email, e.employee_id, u.id as user_id
                 FROM employees e
                 JOIN users u ON u.id = e.user_id
                 WHERE e.employee_id = ?
                 LIMIT 1`,
                [employeeId]
            );
            
            if (rows && rows[0]) {
                const { email, employee_id, user_id } = rows[0];
                const { sendOnboardingApprovalNotification } = require('../../../utils/emailService');
                
                // Get the current temporary password from the database
                const [passwordRows] = await db.query(
                    `SELECT password FROM users WHERE id = ?`,
                    [user_id]
                );
                
                if (passwordRows && passwordRows[0]) {
                    const currentHashedPassword = passwordRows[0].password;
                    
                    // Send the onboarding approval email with instructions about password
                    await sendOnboardingApprovalNotification(email, employee_id, 'default123');
                    if (process.env.NODE_ENV === 'development') {
                        console.debug(`✅ Onboarding approval email sent to ${email} for employee ${employee_id}`);
                    }
                    
                    // Update password to default123 for permanent account
                    const bcrypt = require('bcrypt');
                    const defaultPassword = 'default123';
                    const saltRounds = 10;
                    const newHashedPassword = await bcrypt.hash(defaultPassword, saltRounds);
                    
                    await db.query(
                        `UPDATE users SET password = ?, onboarding_completed = 1 WHERE id = ?`,
                        [newHashedPassword, user_id]
                    );
                    
                    if (process.env.NODE_ENV === 'development') {
                        console.debug(`✅ Password updated to default123 and onboarding marked as completed for user ${user_id} (employee ${employee_id})`);
                    }
                }
                
                return true;
            }
        }
        
        return false;
    },

    // Get employee distribution by department via roles mapping
    getEmployeeDistributionByDepartment: async () => {
        try {
            const db = require('../../../db');
            const [rows] = await db.query(`
                SELECT 
                    r.department_id AS department_id,
                    COALESCE(d.name, CONCAT('Department ', r.department_id)) AS department_name,
                    COUNT(*) AS count
                FROM employees e
                JOIN roles r ON r.id = e.role_id
                LEFT JOIN departments d ON d.id = r.department_id
                WHERE e.is_deleted IS NULL OR e.is_deleted = 0
                GROUP BY r.department_id, d.name
                ORDER BY count DESC
            `);
            return rows || [];
        } catch (error) {
            console.error('❌ Error getting employee distribution by department:', error);
            throw new Error('Failed to get employee distribution');
        }
    },

    // Attendance trend from attendance table
    getAttendanceTrend: async (period) => {
        const db = require('../../../db');
        try {
            const now = new Date();
            let startDate, endDate, groupBy;

            if (period === 'year') {
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear(), 11, 31);
                groupBy = 'MONTH(a.date)';
            } else if (period === 'month') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                groupBy = 'DATE(a.date)';
            } else {
                // week (Monday - Sunday)
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                startDate = new Date(now.getFullYear(), now.getMonth(), diff);
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                groupBy = 'DATE(a.date)';
            }

            const startStr = startDate.toISOString().slice(0, 10);
            const endStr = endDate.toISOString().slice(0, 10);

            // Total active employees as baseline
            const [empRows] = await db.query(
                `SELECT COUNT(*) as total FROM employees WHERE (is_deleted IS NULL OR is_deleted = 0)`
            );
            const totalEmployees = empRows && empRows[0] ? Number(empRows[0].total) : 0;

            // Aggregate attendance records in range
            const [rows] = await db.query(
                `SELECT 
                    ${groupBy} as grp,
                    SUM(CASE WHEN a.check_in IS NOT NULL THEN 1 ELSE 0 END) AS present_count
                 FROM attendance a
                 WHERE DATE(a.date) BETWEEN ? AND ?
                 GROUP BY grp
                 ORDER BY grp ASC`,
                [startStr, endStr]
            );

            const labels = [];
            const values = [];

            if (period === 'year') {
                // Fill months Jan..Dec
                for (let m = 0; m < 12; m++) {
                    const label = new Date(now.getFullYear(), m, 1).toLocaleString('default', { month: 'short' });
                    labels.push(label);
                    const found = rows.find(r => Number(r.grp) === (m + 1));
                    const present = found ? Number(found.present_count) : 0;
                    const daysInMonth = new Date(now.getFullYear(), m + 1, 0).getDate();
                    // Expected opportunities: totalEmployees * working days approx; use daysInMonth for simplicity
                    const denom = totalEmployees * daysInMonth || 1;
                    values.push(Math.max(0, Math.min(100, Math.round((present / denom) * 100))));
                }
            } else {
                // day-level between start and end
                const dayCount = Math.round((endDate - startDate) / (1000*60*60*24)) + 1;
                for (let i = 0; i < dayCount; i++) {
                    const d = new Date(startDate);
                    d.setDate(startDate.getDate() + i);
                    labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
                    const key = d.toISOString().slice(0, 10);
                    const found = rows.find(r => new Date(r.grp).toISOString().slice(0,10) === key);
                    const present = found ? Number(found.present_count) : 0;
                    const denom = totalEmployees || 1;
                    values.push(Math.max(0, Math.min(100, Math.round((present / denom) * 100))));
                }
            }

            return { labels, values };
        } catch (error) {
            console.error('❌ Error computing attendance trend:', error);
            throw new Error('Failed to compute attendance trend');
        }
    },

    // Payroll periods approval progress (approved vs remaining)
    getPayrollApprovalProgress: async () => {
        const db = require('../../../db');
        try {
            // Count total periods
            const [periods] = await db.query(`SELECT COUNT(*) AS total FROM payroll_periods`);
            const totalPeriods = periods && periods[0] ? Number(periods[0].total) : 0;

            if (totalPeriods === 0) {
                return { approved: 0, remaining: 100, totalPeriods: 0 };
            }

            // A period is considered approved if all its entries are approved OR period status is approved
            const [approvedByStatus] = await db.query(`SELECT COUNT(*) AS cnt FROM payroll_periods WHERE status = 'approved'`);
            const approvedStatusCount = approvedByStatus && approvedByStatus[0] ? Number(approvedByStatus[0].cnt) : 0;

            // Additionally include periods whose all entries are approved (if entries table exists)
            let approvedByEntriesCount = 0;
            try {
                const [rows] = await db.query(`
                    SELECT COUNT(*) AS cnt
                    FROM payroll_periods p
                    WHERE NOT EXISTS (
                        SELECT 1 FROM payroll_entries e
                        WHERE e.period_id = p.id AND e.status <> 'approved'
                    )
                `);
                approvedByEntriesCount = rows && rows[0] ? Number(rows[0].cnt) : 0;
            } catch (_) {
                // entries table may not exist; ignore
            }

            // Combine (some overlap; use UNION logic if needed; for simplicity take max)
            const approvedPeriods = Math.max(approvedStatusCount, approvedByEntriesCount);
            const approvedPct = Math.max(0, Math.min(100, Math.round((approvedPeriods / totalPeriods) * 100)));
            const remainingPct = 100 - approvedPct;
            return { approved: approvedPct, remaining: remainingPct, totalPeriods: totalPeriods };
        } catch (error) {
            console.error('❌ Error computing payroll approval progress:', error);
            return { approved: 0, remaining: 100, totalPeriods: 0 };
        }
    },

    // Get employee attendance summary for pie chart
    getEmployeeAttendanceSummary: async (employeeId, options = {}) => {
        const db = require('../../../db');
        try {
            const { period = 'all' } = options;
            
            // Convert employee_id to user_id if needed
            const [employeeCheck] = await db.query(`
                SELECT user_id, employee_id 
                FROM employees 
                WHERE employee_id = ? OR user_id = ?
            `, [employeeId, employeeId]);
            
            let actualUserId = employeeId;
            if (employeeCheck.length > 0) {
                actualUserId = employeeCheck[0].user_id;
            }
            
            // Build date filter based on period
            let whereClause = 'WHERE user_id = ?';
            let queryParams = [actualUserId];
            
            // Add period-based date filters
            const now = new Date();
            let periodStart, periodEnd;

            switch (period.toLowerCase()) {
                case 'week':
                    // Current week (Monday to Sunday)
                    const startOfWeek = new Date(now);
                    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
                    startOfWeek.setHours(0, 0, 0, 0);
                    periodStart = startOfWeek.toISOString().split('T')[0];
                    
                    const endOfWeek = new Date(startOfWeek);
                    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
                    endOfWeek.setHours(23, 59, 59, 999);
                    periodEnd = endOfWeek.toISOString().split('T')[0];
                    break;

                case 'month':
                    // Current month
                    periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                    break;

                case 'year':
                    // Current year
                    periodStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
                    periodEnd = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
                    break;

                case 'last_week':
                    // Previous week
                    const lastWeekStart = new Date(now);
                    lastWeekStart.setDate(now.getDate() - now.getDay() - 6); // Previous Monday
                    lastWeekStart.setHours(0, 0, 0, 0);
                    periodStart = lastWeekStart.toISOString().split('T')[0];
                    
                    const lastWeekEnd = new Date(lastWeekStart);
                    lastWeekEnd.setDate(lastWeekStart.getDate() + 6); // Previous Sunday
                    lastWeekEnd.setHours(23, 59, 59, 999);
                    periodEnd = lastWeekEnd.toISOString().split('T')[0];
                    break;

                case 'last_month':
                    // Previous month
                    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    periodStart = lastMonth.toISOString().split('T')[0];
                    periodEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
                    break;

                case 'last_year':
                    // Previous year
                    periodStart = new Date(now.getFullYear() - 1, 0, 1).toISOString().split('T')[0];
                    periodEnd = new Date(now.getFullYear() - 1, 11, 31).toISOString().split('T')[0];
                    break;

                default:
                    // 'all' - no date filtering
                    break;
            }

            // Apply period-based filters if not 'all'
            if (period !== 'all' && periodStart && periodEnd) {
                whereClause += ' AND date >= ? AND date <= ?';
                queryParams.push(periodStart, periodEnd);
            }
            
            // Get the detailed counts
            const [rows] = await db.query(`
                SELECT 
                    COUNT(CASE WHEN status = 'Present' THEN 1 END) as present,
                    COUNT(CASE WHEN status = 'Late' THEN 1 END) as late,
                    COUNT(CASE WHEN status = 'Absent' THEN 1 END) as absent,
                    COUNT(*) as total
                FROM attendance 
                ${whereClause}
            `, queryParams);
            
            const result = rows[0] || { present: 0, late: 0, absent: 0, total: 0 };
            
            return {
                present: parseInt(result.present) || 0,
                late: parseInt(result.late) || 0,
                absent: parseInt(result.absent) || 0,
                total: parseInt(result.total) || 0
            };
        } catch (error) {
            console.error('❌ Error getting employee attendance summary:', error);
            throw error;
        }
    },

    // Get employee attendance history with pagination and date filtering
    getEmployeeAttendanceHistory: async (employeeId, options = {}) => {
        const db = require('../../../db');
        try {
            const { page = 1, limit = 20, startDate, endDate, period = 'all' } = options;
            const offset = (page - 1) * limit;

            let whereClause = 'WHERE user_id = ?';
            let queryParams = [employeeId];

            // Add period-based date filters
            const now = new Date();
            let periodStart, periodEnd;

            switch (period.toLowerCase()) {
                case 'week':
                    // Current week (Monday to Sunday)
                    const startOfWeek = new Date(now);
                    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
                    startOfWeek.setHours(0, 0, 0, 0);
                    periodStart = startOfWeek.toISOString().split('T')[0];
                    
                    const endOfWeek = new Date(startOfWeek);
                    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
                    endOfWeek.setHours(23, 59, 59, 999);
                    periodEnd = endOfWeek.toISOString().split('T')[0];
                    break;

                case 'month':
                    // Current month
                    periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                    break;

                case 'year':
                    // Current year
                    periodStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
                    periodEnd = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
                    break;

                case 'last_week':
                    // Previous week
                    const lastWeekStart = new Date(now);
                    lastWeekStart.setDate(now.getDate() - now.getDay() - 6); // Previous Monday
                    lastWeekStart.setHours(0, 0, 0, 0);
                    periodStart = lastWeekStart.toISOString().split('T')[0];
                    
                    const lastWeekEnd = new Date(lastWeekStart);
                    lastWeekEnd.setDate(lastWeekStart.getDate() + 6); // Previous Sunday
                    lastWeekEnd.setHours(23, 59, 59, 999);
                    periodEnd = lastWeekEnd.toISOString().split('T')[0];
                    break;

                case 'last_month':
                    // Previous month
                    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    periodStart = lastMonth.toISOString().split('T')[0];
                    periodEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
                    break;

                case 'last_year':
                    // Previous year
                    periodStart = new Date(now.getFullYear() - 1, 0, 1).toISOString().split('T')[0];
                    periodEnd = new Date(now.getFullYear() - 1, 11, 31).toISOString().split('T')[0];
                    break;

                default:
                    // Custom date range or all records
                    if (startDate) {
                        whereClause += ' AND date >= ?';
                        queryParams.push(startDate);
                    }
                    if (endDate) {
                        whereClause += ' AND date <= ?';
                        queryParams.push(endDate);
                    }
                    break;
            }

            // Apply period-based filters if not 'all'
            if (period !== 'all' && periodStart && periodEnd) {
                whereClause += ' AND date >= ? AND date <= ?';
                queryParams.push(periodStart, periodEnd);
            }

            // Get total count
            const [countRows] = await db.query(`
                SELECT COUNT(*) as total 
                FROM attendance 
                ${whereClause}
            `, queryParams);

            const totalRecords = countRows[0].total;

            // Get paginated records
            const [rows] = await db.query(`
                SELECT 
                    attendance_id,
                    user_id,
                    date,
                    time_in,
                    time_out,
                    status,
                    hours_worked,
                    overtime_hours,
                    notes,
                    created_at,
                    updated_at
                FROM attendance 
                ${whereClause}
                ORDER BY date DESC, created_at DESC
                LIMIT ? OFFSET ?
            `, [...queryParams, limit, offset]);

            return {
                data: rows,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalRecords / limit),
                    totalRecords: totalRecords,
                    limit: limit,
                    hasNextPage: page < Math.ceil(totalRecords / limit),
                    hasPrevPage: page > 1
                },
                period: {
                    type: period,
                    startDate: periodStart || startDate,
                    endDate: periodEnd || endDate
                }
            };
        } catch (error) {
            console.error('❌ Error getting employee attendance history:', error);
            throw error;
        }
    },

    // ========== CONSTRUCTION WORKERS METHODS ==========
    
    getAllConstructionWorkers: async () => {
        const db = require('../../../db');
        try {
            const [rows] = await db.query(`
                SELECT 
                    cw.id,
                    cw.picture,
                    cw.firstname,
                    cw.middlename,
                    cw.lastname,
                    cw.contact_number,
                    cw.role_id,
                    cw.project_id,
                    cw.date_hired,
                    cw.status,
                    cw.created_at,
                    cr.role_name,
                    p.project_name
                FROM construction_workers cw
                LEFT JOIN construction_roles cr ON cw.role_id = cr.id
                LEFT JOIN projects p ON cw.project_id = p.id
                ORDER BY cw.created_at DESC
            `);
            return rows;
        } catch (error) {
            console.error('❌ Error getting all construction workers:', error);
            throw error;
        }
    },

    getConstructionWorkerById: async (workerId) => {
        const db = require('../../../db');
        try {
            const [rows] = await db.query(`
                SELECT 
                    cw.id,
                    cw.firstname,
                    cw.middlename,
                    cw.lastname,
                    cw.contact_number,
                    cw.role_id,
                    cw.project_id,
                    cw.date_hired,
                    cw.status,
                    cw.created_at,
                    cr.role_name,
                    cr.daily_rate,
                    p.project_name
                FROM construction_workers cw
                LEFT JOIN construction_roles cr ON cw.role_id = cr.id
                LEFT JOIN projects p ON cw.project_id = p.id
                WHERE cw.id = ?
            `, [workerId]);
            return rows[0] || null;
        } catch (error) {
            console.error('❌ Error getting construction worker by ID:', error);
            throw error;
        }
    },

    addConstructionWorker: async (workerData) => {
        const db = require('../../../db');
        try {
            const {
                firstname,
                middlename,
                lastname,
                contact_number,
                role_id,
                project_id,
                picture,
                status = 'active'
            } = workerData;

            // Set date_hired to today's date automatically
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

            // Start transaction to ensure data consistency
            const connection = await db.getConnection();
            await connection.beginTransaction();

            try {
                // Insert construction worker
                const [result] = await connection.query(`
                    INSERT INTO construction_workers (
                        firstname, middlename, lastname, contact_number,
                        role_id, project_id, picture, date_hired, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    firstname, middlename, lastname, contact_number,
                    role_id, project_id, picture || null, today, status
                ]);

                const workerId = result.insertId;

                // Decrease manpower_per_unit in labor table
                const [updateResult] = await connection.query(`
                    UPDATE labor 
                    SET manpower_per_unit = manpower_per_unit - 1
                    WHERE project_id = ? AND worker_type_id = ? AND manpower_per_unit > 0
                `, [project_id, role_id]);

                if (updateResult.affectedRows === 0) {
                    throw new Error('No available manpower for this role in the selected project');
                }

                await connection.commit();

                return {
                    id: workerId,
                    ...workerData,
                    date_hired: today
                };
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('❌ Error adding construction worker:', error);
            throw error;
        }
    },

    updateConstructionWorker: async (workerId, workerData) => {
        const db = require('../../../db');
        try {
            const {
                firstname,
                middlename,
                lastname,
                contact_number,
                role_id,
                project_id,
                date_hired,
                status
            } = workerData;

            const [result] = await db.query(`
                UPDATE construction_workers 
                SET 
                    firstname = ?,
                    middlename = ?,
                    lastname = ?,
                    contact_number = ?,
                    role_id = ?,
                    project_id = ?,
                    date_hired = ?,
                    status = ?
                WHERE id = ?
            `, [
                firstname, middlename, lastname, contact_number,
                role_id, project_id, date_hired, status, workerId
            ]);

            return result.affectedRows > 0;
        } catch (error) {
            console.error('❌ Error updating construction worker:', error);
            throw error;
        }
    },

    deleteConstructionWorker: async (workerId) => {
        const db = require('../../../db');
        try {
            // Start transaction to ensure data consistency
            const connection = await db.getConnection();
            await connection.beginTransaction();

            try {
                // Get worker details before deletion
                const [workerRows] = await connection.query(`
                    SELECT project_id, role_id FROM construction_workers WHERE id = ?
                `, [workerId]);

                if (workerRows.length === 0) {
                    throw new Error('Construction worker not found');
                }

                const { project_id, role_id } = workerRows[0];

                // Delete construction worker
                const [deleteResult] = await connection.query(`
                    DELETE FROM construction_workers WHERE id = ?
                `, [workerId]);

                if (deleteResult.affectedRows === 0) {
                    throw new Error('Failed to delete construction worker');
                }

                // Increase manpower_per_unit back in labor table
                await connection.query(`
                    UPDATE labor 
                    SET manpower_per_unit = manpower_per_unit + 1
                    WHERE project_id = ? AND worker_type_id = ?
                `, [project_id, role_id]);

                await connection.commit();
                return true;
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('❌ Error deleting construction worker:', error);
            throw error;
        }
    },

    getAllConstructionRoles: async () => {
        const db = require('../../../db');
        try {
            const [rows] = await db.query(`
                SELECT 
                    id,
                    role_name,
                    daily_rate,
                    department_id
                FROM construction_roles
                ORDER BY role_name ASC
            `);
            return rows;
        } catch (error) {
            console.error('❌ Error getting all construction roles:', error);
            throw error;
        }
    },

    getAllProjects: async () => {
        const db = require('../../../db');
        try {
            const [rows] = await db.query(`
                SELECT 
                    p.id,
                    p.project_name,
                    p.start_date,
                    p.end_date,
                    p.status,
                    p.created_at
                FROM projects p
                WHERE p.status = 'planning'
                ORDER BY p.project_name ASC
            `);
            return rows;
        } catch (error) {
            console.error('❌ Error getting all projects:', error);
            throw error;
        }
    },

    getProjectLaborRoles: async (projectId) => {
        const db = require('../../../db');
        try {
            const [rows] = await db.query(`
                SELECT DISTINCT
                    l.worker_type_id,
                    cr.role_name as worker_type_name,
                    l.manpower_per_unit
                FROM labor l
                JOIN construction_roles cr ON cr.id = l.worker_type_id
                WHERE l.project_id = ? AND l.manpower_per_unit > 0
                ORDER BY cr.role_name ASC
            `, [projectId]);
            return rows;
        } catch (error) {
            console.error('❌ Error getting project labor roles:', error);
            throw error;
        }
    },

    // Get pending construction workers (inactive status)
    getPendingConstructionWorkers: async () => {
        const db = require('../../../db');
        try {
            const [rows] = await db.query(`
                SELECT 
                    cw.id,
                    cw.picture,
                    cw.firstname,
                    cw.middlename,
                    cw.lastname,
                    cw.contact_number,
                    cw.role_id,
                    cw.project_id,
                    cw.date_hired,
                    cw.status,
                    cw.created_at,
                    cr.role_name,
                    p.project_name
                FROM construction_workers cw
                LEFT JOIN construction_roles cr ON cw.role_id = cr.id
                LEFT JOIN projects p ON cw.project_id = p.id
                WHERE cw.status = 'inactive'
                ORDER BY cw.created_at DESC
            `);
            return rows;
        } catch (error) {
            console.error('❌ Error getting pending construction workers:', error);
            throw error;
        }
    },

    // Approve construction worker (change status from inactive to active)
    approveConstructionWorker: async (workerId) => {
        const db = require('../../../db');
        try {
            // Generate unique code and QR code
            const uniqueCode = await HRModel.generateUniqueCode();
            const qrCodePath = await HRModel.generateQRCode(uniqueCode, workerId);
            
            const [result] = await db.query(`
                UPDATE construction_workers 
                SET status = 'active', unique_code = ?, qr_code_path = ?
                WHERE id = ? AND status = 'inactive'
            `, [uniqueCode, qrCodePath, workerId]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('❌ Error approving construction worker:', error);
            throw error;
        }
    },

    // Generate unique code for construction worker
    generateUniqueCode: async () => {
        const db = require('../../../db');
        let uniqueCode;
        let isUnique = false;
        
        while (!isUnique) {
            // Generate a random 8-character alphanumeric code
            uniqueCode = Math.random().toString(36).substring(2, 10).toUpperCase();
            
            // Check if code already exists
            const [existing] = await db.query(`
                SELECT id FROM construction_workers WHERE unique_code = ?
            `, [uniqueCode]);
            
            if (existing.length === 0) {
                isUnique = true;
            }
        }
        
        return uniqueCode;
    },

    // Generate QR code for construction worker
    generateQRCode: async (uniqueCode, workerId) => {
        try {
            // Create QR code directory if it doesn't exist
            const qrDir = path.join(__dirname, '../../../uploads/qr_codes');
            if (!fs.existsSync(qrDir)) {
                fs.mkdirSync(qrDir, { recursive: true });
            }
            
            // Generate QR code data
            const qrData = JSON.stringify({
                type: 'construction_worker',
                id: workerId,
                code: uniqueCode,
                timestamp: new Date().toISOString()
            });
            
            // Generate QR code file path
            const fileName = `qr_${workerId}_${uniqueCode}.png`;
            const filePath = path.join(qrDir, fileName);
            
            // Generate QR code image
            await QRCode.toFile(filePath, qrData, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            
            // Return relative path for database storage
            return `qr_codes/${fileName}`;
        } catch (error) {
            console.error('❌ Error generating QR code:', error);
            throw error;
        }
    },

    // Get active construction workers with QR codes for printing
    getActiveConstructionWorkersWithQR: async () => {
        const db = require('../../../db');
        try {
            const [rows] = await db.query(`
                SELECT 
                    cw.id,
                    cw.picture,
                    cw.firstname,
                    cw.middlename,
                    cw.lastname,
                    cw.contact_number,
                    cw.role_id,
                    cw.project_id,
                    cw.date_hired,
                    cw.status,
                    cw.unique_code,
                    cw.qr_code_path,
                    cw.created_at,
                    cr.role_name,
                    p.project_name
                FROM construction_workers cw
                LEFT JOIN construction_roles cr ON cw.role_id = cr.id
                LEFT JOIN projects p ON cw.project_id = p.id
                WHERE cw.status = 'active' AND cw.qr_code_path IS NOT NULL
                ORDER BY cw.created_at DESC
            `);
            return rows;
        } catch (error) {
            console.error('❌ Error getting active construction workers with QR:', error);
            throw error;
        }
    },

    // Reject construction worker (delete from database)
    rejectConstructionWorker: async (workerId) => {
        const db = require('../../../db');
        try {
            // Start transaction to ensure data consistency
            const connection = await db.getConnection();
            await connection.beginTransaction();

            try {
                // Get worker details before deletion
                const [workerRows] = await connection.query(`
                    SELECT project_id, role_id FROM construction_workers WHERE id = ? AND status = 'inactive'
                `, [workerId]);

                if (workerRows.length === 0) {
                    throw new Error('Pending construction worker not found');
                }

                const { project_id, role_id } = workerRows[0];

                // Delete construction worker
                const [deleteResult] = await connection.query(`
                    DELETE FROM construction_workers WHERE id = ? AND status = 'inactive'
                `, [workerId]);

                if (deleteResult.affectedRows === 0) {
                    throw new Error('Failed to reject construction worker');
                }

                // Increase manpower_per_unit back in labor table
                await connection.query(`
                    UPDATE labor 
                    SET manpower_per_unit = manpower_per_unit + 1
                    WHERE project_id = ? AND worker_type_id = ?
                `, [project_id, role_id]);

                await connection.commit();
                return true;
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('❌ Error rejecting construction worker:', error);
            throw error;
        }
    },

  // ========== CONSTRUCTION PAYROLL METHODS ==========

  // Generate construction payroll for a period
  generateConstructionPayroll: async (payrollStart, payrollEnd) => {
    try {
      // Get all active construction workers
      const [workers] = await db.query(`
        SELECT 
          cw.id as worker_id,
          cw.firstname,
          cw.middlename,
          cw.lastname,
          cw.role_id,
          cr.role_name,
          cr.daily_rate,
          cw.project_id,
          p.project_name
        FROM construction_workers cw
        LEFT JOIN construction_roles cr ON cw.role_id = cr.id
        LEFT JOIN projects p ON cw.project_id = p.id
        WHERE cw.status = 'active'
        ORDER BY cw.lastname, cw.firstname
      `);

      const payrollRecords = [];

      for (const worker of workers) {
        // Calculate days present and absent
        const { daysPresent, daysAbsent, totalHours, overtimeHours } = await HRModel.calculateWorkerAttendance(
          worker.worker_id, 
          payrollStart, 
          payrollEnd
        );

        // Calculate salary components
        const basicSalary = daysPresent * worker.daily_rate;
        const overtimePay = overtimeHours * (worker.daily_rate / 8); // Overtime rate = daily_rate / 8 hours
        const salaryBeforeDeductions = basicSalary + overtimePay;
        const netSalary = salaryBeforeDeductions; // No deductions for now

        payrollRecords.push({
          worker_id: worker.worker_id,
          role_id: worker.role_id,
          daily_rate: worker.daily_rate,
          days_present: daysPresent,
          days_absent: daysAbsent,
          total_hours: totalHours,
          overtime_hours: overtimeHours,
          basic_salary: basicSalary,
          overtime_pay: overtimePay,
          salary_before_deductions: salaryBeforeDeductions,
          net_salary: netSalary,
          payroll_start: payrollStart,
          payroll_end: payrollEnd,
          status: 'pending',
          worker_name: `${worker.firstname} ${worker.middlename} ${worker.lastname}`.trim(),
          role_name: worker.role_name,
          project_name: worker.project_name
        });
      }

      return payrollRecords;
    } catch (error) {
      console.error('❌ Error generating construction payroll:', error);
      throw error;
    }
  },

  // Calculate worker attendance for a period
  calculateWorkerAttendance: async (workerId, startDate, endDate) => {
    try {
      // Get attendance records for the period
      const [attendanceRecords] = await db.query(`
        SELECT 
          attendance_date,
          time_in,
          time_out,
          status
        FROM attendance_construction
        WHERE worker_id = ? 
        AND attendance_date BETWEEN ? AND ?
        ORDER BY attendance_date
      `, [workerId, startDate, endDate]);

      let daysPresent = 0;
      let daysAbsent = 0;
      let totalHours = 0;
      let overtimeHours = 0;

      // Generate all dates in the period
      const dates = [];
      const currentDate = new Date(startDate);
      const endDateObj = new Date(endDate);

      while (currentDate <= endDateObj) {
        // Skip Sundays (rest days)
        if (currentDate.getDay() !== 0) {
          dates.push(new Date(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Check each working day
      for (const date of dates) {
        const dateStr = date.toISOString().split('T')[0];
        const record = attendanceRecords.find(r => r.attendance_date.toISOString().split('T')[0] === dateStr);

        if (record && record.time_in && record.status === 'present') {
          daysPresent++;
          
          // Calculate hours worked
          if (record.time_out) {
            const timeIn = new Date(record.time_in);
            const timeOut = new Date(record.time_out);
            const hoursWorked = (timeOut - timeIn) / (1000 * 60 * 60); // Convert to hours
            
            totalHours += hoursWorked;
            
            // Calculate overtime (hours over 8)
            if (hoursWorked > 8) {
              overtimeHours += hoursWorked - 8;
            }
          }
        } else {
          daysAbsent++;
        }
      }

      return {
        daysPresent,
        daysAbsent,
        totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimal places
        overtimeHours: Math.round(overtimeHours * 100) / 100
      };
    } catch (error) {
      console.error('❌ Error calculating worker attendance:', error);
      throw error;
    }
  },

  // Save construction payroll records
  saveConstructionPayroll: async (payrollRecords) => {
    try {
      const connection = await db.getConnection();
      await connection.beginTransaction();

      try {
        // Create payroll period entry (similar to employee payroll)
        if (payrollRecords.length > 0) {
          const firstRecord = payrollRecords[0];
          const startDate = firstRecord.payroll_start;
          const endDate = firstRecord.payroll_end;
          
          // Generate period name based on dates
          const start = new Date(startDate);
          const end = new Date(endDate);
          const month = start.toLocaleDateString('en-US', { month: 'short' });
          const year = end.getFullYear();
          const isFirstHalf = start.getDate() <= 15;
          const period = isFirstHalf ? 'first' : 'second';
          const periodName = `Construction - ${month} ${year} - ${period}`;
          
          // Find or create payroll period
          const periodId = await HRModel.findOrCreatePayrollPeriod(startDate, endDate, periodName);
          console.log('Created/found construction payroll period with ID:', periodId);

          // Insert into construction_payroll table only
          let firstConstructionPayrollId = null;
          for (const record of payrollRecords) {
            const [insertResult] = await connection.query(`
              INSERT INTO construction_payroll (
                worker_id, role_id, daily_rate, days_present, days_absent,
                total_hours, overtime_hours, basic_salary, overtime_pay,
                salary_before_deductions, net_salary, payroll_start, payroll_end, status, payroll_period_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              record.worker_id, record.role_id, record.daily_rate, record.days_present, record.days_absent,
              record.total_hours, record.overtime_hours, record.basic_salary, record.overtime_pay,
              record.salary_before_deductions, record.net_salary, record.payroll_start, record.payroll_end, record.status, periodId
            ]);
            
            // Capture the first inserted ID
            if (firstConstructionPayrollId === null) {
              firstConstructionPayrollId = insertResult.insertId;
            }
          }
          
          // Update payroll_periods table with the construction_payroll_id
          if (firstConstructionPayrollId !== null) {
            await connection.query(`
              UPDATE payroll_periods 
              SET construction_payroll_id = ? 
              WHERE id = ?
            `, [firstConstructionPayrollId, periodId]);
          }
        }

        await connection.commit();
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('❌ Error saving construction payroll:', error);
      throw error;
    }
  },

  // Get construction payroll records
  getConstructionPayroll: async (status = null, limit = 100) => {
    try {
      let query = `
        SELECT 
          cp.*,
          cw.firstname,
          cw.middlename,
          cw.lastname,
          cr.role_name,
          p.project_name
        FROM construction_payroll cp
        LEFT JOIN construction_workers cw ON cp.worker_id = cw.id
        LEFT JOIN construction_roles cr ON cp.role_id = cr.id
        LEFT JOIN projects p ON cw.project_id = p.id
      `;

      const params = [];
      if (status) {
        query += ` WHERE cp.status = ?`;
        params.push(status);
      }

      query += ` ORDER BY cp.created_at DESC LIMIT ?`;
      params.push(limit);

      const [rows] = await db.query(query, params);
      return rows;
    } catch (error) {
      console.error('❌ Error getting construction payroll:', error);
      throw error;
    }
  },

  // Update construction payroll status
  updateConstructionPayrollStatus: async (payrollIds, status, approvedBy = null) => {
    try {
      const connection = await db.getConnection();
      await connection.beginTransaction();

      try {
        for (const payrollId of payrollIds) {
          await connection.query(`
            UPDATE construction_payroll 
            SET status = ?, approved_by = ?, updated_at = NOW()
            WHERE id = ?
          `, [status, approvedBy, payrollId]);
        }

        await connection.commit();
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('❌ Error updating construction payroll status:', error);
      throw error;
    }
  },

  // Delete construction payroll records
  deleteConstructionPayroll: async (payrollIds) => {
    try {
      const connection = await db.getConnection();
      await connection.beginTransaction();

      try {
        for (const payrollId of payrollIds) {
          await connection.query(`DELETE FROM construction_payroll WHERE id = ?`, [payrollId]);
        }

        await connection.commit();
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('❌ Error deleting construction payroll:', error);
      throw error;
    }
  }
};
// ==================== JOB POSTINGS (moved from CRM) ====================
// Data-access moved from CRM to HR for job posting management
HRModel.getAllJobPostings = async ({ limit = 10, offset = 0, search = '' } = {}) => {
  const baseWhere = [];
  const params = [];
  if (search) {
    baseWhere.push('(p.position_name LIKE ? OR r.name LIKE ? OR jp.location LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const whereSql = baseWhere.length ? `WHERE ${baseWhere.join(' AND ')}` : '';

  const countSql = `
    SELECT COUNT(*) as total
    FROM job_postings jp
    JOIN positions p ON jp.position_id = p.position_id
    JOIN roles r ON p.role_id = r.id
    ${whereSql}
  `;
  const [countRows] = await db.execute(countSql, params);
  const total = countRows?.[0]?.total || 0;

  const listSql = `
    SELECT jp.*, p.position_name, p.salary, r.name as role_name, r.id as role_id
    FROM job_postings jp
    JOIN positions p ON jp.position_id = p.position_id
    JOIN roles r ON p.role_id = r.id
    ${whereSql}
    ORDER BY jp.date_posted DESC
    LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}
  `;
  const [rows] = await db.execute(listSql, params);
  return rows;
};

HRModel.countJobPostings = async ({ search = '' } = {}) => {
  const baseWhere = [];
  const params = [];
  if (search) {
    baseWhere.push('(p.position_name LIKE ? OR r.name LIKE ? OR jp.location LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const whereSql = baseWhere.length ? `WHERE ${baseWhere.join(' AND ')}` : '';
  const sql = `
    SELECT COUNT(*) as total
    FROM job_postings jp
    JOIN positions p ON jp.position_id = p.position_id
    JOIN roles r ON p.role_id = r.id
    ${whereSql}
  `;
  const [rows] = await db.execute(sql, params);
  return rows?.[0]?.total || 0;
};

HRModel.getJobPostingById = async (jobId) => {
  const sql = `
    SELECT jp.*, p.position_name, p.salary, r.name as role_name, r.id as role_id
    FROM job_postings jp
    JOIN positions p ON jp.position_id = p.position_id
    JOIN roles r ON p.role_id = r.id
    WHERE jp.job_id = ?
  `;
  const [rows] = await db.execute(sql, [jobId]);
  return rows?.[0] || null;
};

HRModel.createJobPosting = async (data) => {
  const sql = `
    INSERT INTO job_postings (
      position_id, job_description, qualifications, location, application_deadline, how_to_apply
    ) VALUES (?, ?, ?, ?, ?, ?)
  `;
  const [result] = await db.execute(sql, [
    data.position_id,
    data.job_description,
    data.qualifications,
    data.location,
    data.application_deadline,
    data.how_to_apply
  ]);
  return result.insertId;
};

HRModel.updateJobPosting = async (jobId, data) => {
  const sql = `
    UPDATE job_postings SET
      position_id = ?,
      job_description = ?,
      qualifications = ?,
      location = ?,
      application_deadline = ?,
      how_to_apply = ?
    WHERE job_id = ?
  `;
  const [result] = await db.execute(sql, [
    data.position_id,
    data.job_description,
    data.qualifications,
    data.location,
    data.application_deadline,
    data.how_to_apply,
    jobId
  ]);
  return result.affectedRows > 0;
};

HRModel.deleteJobPosting = async (jobId) => {
  const [result] = await db.execute('DELETE FROM job_postings WHERE job_id = ?', [jobId]);
  return result.affectedRows > 0;
};

HRModel.getAllPositions = async () => {
  const sql = `
    SELECT p.position_id, p.position_name, p.salary, r.name as role_name, r.id as role_id
    FROM positions p
    JOIN roles r ON p.role_id = r.id
    ORDER BY r.name, p.position_name
  `;
  const [rows] = await db.execute(sql);
  return rows || [];
};

// Place module export at the very end, after Job Posting section
module.exports = HRModel;
