const db = require("../../../db");

const HRModel = {
    // 🔹 Get permission by ID
    getRoleById: async (roleId) => {
        const query = "SELECT * FROM roles WHERE id = ?";
        const [result] = await db.query(query, [roleId]);
        return result.length > 0 ? result[0] : null;
    },

    // 🔹 Create a new user with username included
    // 🔹 Create a new user with username included and permission_id auto-fetched from role
createUser: async (email, role_id, full_name) => {
    console.log("🔹 Role being passed to createUser:", role_id, "Type:", typeof role_id);

    if (!role_id) {
        throw new Error("❌ Role ID is required and cannot be null");
    }

    const defaultPassword = "default123";

    // 🧠 Step 1: Get permission_id from role_permission
    let permission_id = null;
    try {
        const permissionQuery = `
            SELECT id
            FROM role_permission
            WHERE role_id = ? 
            LIMIT 1;

        `;
        const [rows] = await db.query(permissionQuery, [role_id]);

        if (rows.length > 0) {
            permission_id = rows[0].permission_id;
        }

    } catch (error) {
        console.error("❌ Error fetching permission_id:", error);
        throw new Error("Failed to fetch permission_id for the role");
    }

    // 🧾 Step 2: Insert the user with permission_id
    const userInsertQuery = `
        INSERT INTO users (email, username, role_id, password) 
        VALUES (?, ?, ?, ?)
    `;

    try {
        const [result] = await db.query(userInsertQuery, [
            email,
            full_name,
            role_id,
            defaultPassword,
        ]);

        return result.insertId;
    } catch (error) {
        console.error("❌ Error creating user:", error);
        throw new Error("Failed to create user: " + (error.sqlMessage || error.message));
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
            (user_id, email, role_id, full_name, contact, address, birthday, employment_status, educational_background, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;

        const employeeValues = [
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
            employeeData.emergency_contact_phone,
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

// 🔹 Get All Employees (Filtered by is_deleted flag)
getAllEmployees: async (includeDeleted = true) => {
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
    `;
    
    // Add the filter condition if needed
    if (!includeDeleted) {
        query += ` WHERE e.is_deleted = 0`; // Only active employees
    }

    try {
        const [employees] = await db.query(query);
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
            const query = "SELECT * FROM employees WHERE employee_id = ?";
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

    // 🔹 Get all permissions
    getAllRoles: async () => {
        try {
            const query = "SELECT id, name FROM roles";
    
            const [roles] = await db.query(query);
    
            return roles;
        } catch (error) {
            console.error("❌ [getAllRoles] Error during role fetch:", error.message || error);
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
    


    recordAttendance: async (employeeId, latitude, longitude) => {
        return db.query(
            "INSERT INTO attendance (employee_id, latitude, longitude, status) VALUES (?, ?, ?, 'Present')",
            [employeeId, latitude, longitude]
        );
    },

    // 🔹 Get today's attendance
    getTodayAttendance: async (employeeId) => {
        return db.query(
            "SELECT * FROM attendance WHERE employee_id = ? AND DATE(check_in_time) = CURDATE()",
            [employeeId]
        ).then(results => results[0] || null);
    },
    



    saveResume: async (employee_id, resume_path) => {
        try {
            const sql = `
                INSERT INTO resumes (employee_id, resume_path, uploaded_at)
                VALUES (?, ?, NOW())
            `;
            await pool.query(sql, [employee_id, resume_path]);
            return true;
        } catch (error) {
            console.error("❌ Error saving resume to database:", error);
            return false;
        }
    },


};

module.exports = HRModel;
