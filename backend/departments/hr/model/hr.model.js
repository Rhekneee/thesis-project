const db = require("../../../db");

const HRModel = {
    // 🔹 Get permission by ID
    getPermissionById: async (permissionId) => {
        const query = "SELECT * FROM permission WHERE id = ?";
        const [result] = await db.query(query, [permissionId]);
        return result.length > 0 ? result[0] : null;
    },

    // 🔹 Create a new user with username included
    createUser: async (email, permission_id, full_name) => {
        console.log("🔹 Permission being passed to createUser:", permission_id, "Type:", typeof permission_id);

        if (!permission_id) {
            throw new Error("❌ Permission ID is required and cannot be null");
        }

        const defaultPassword = "default123"; 

        // Include username in the insert query
        const query = `
            INSERT INTO users (email, username, permission_id, password) 
            VALUES (?, ?, ?, ?)
        `;

        const [result] = await db.query(query, [email, full_name, permission_id, defaultPassword]);
        console.log("✅ New user created with ID:", result.insertId);
        
        return result.insertId;
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
                (user_id, email, permission_id, full_name, contact, address, birthday, employment_status, educational_background, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `;
    
            const employeeValues = [
                employeeData.user_id,
                employeeData.email,
                employeeData.permission_id,
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

    // 🔹 Fetch all employees
    getAllEmployees: async () => {
        const query = `
            SELECT 
                e.*, 
                p.role_name 
            FROM 
                employees e
            LEFT JOIN 
                permission p ON e.permission_id = p.id
        `;
        const [employees] = await db.query(query);
        return employees.map(employee => ({
            ...employee,
            birthday: employee.birthday
                ? new Date(employee.birthday).toISOString().split('T')[0]
                : null
        }));
    },
            

    // 🔹 Get employee by ID (Added this function for updates)
    getEmployeeById: async (employeeId) => {
        try {
            const query = "SELECT * FROM employees WHERE id = ?";
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
    getAllPermissions: async () => {
        try {
            const query = "SELECT id, role_name FROM permission";
            const [permissions] = await db.query(query);
            return permissions;
        } catch (error) {
            console.error("❌ Error fetching permissions:", error);
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
            console.log("🔹 Received Employee Data:", employeeData);
    
            const {
                email, full_name, contact, address, birthday,
                employment_status, educational_background, emergency_contact_name,
                emergency_contact_relationship, emergency_contact_phone, permission_id
            } = employeeData;
    
            // 🔥 Validate if employee exists before updating
            const existingEmployee = await HRModel.getEmployeeById(employeeId);
            if (!existingEmployee) {
                console.log("❌ Employee not found in the database.");
                throw new Error("Employee not found.");
            }
    
            const query = `
                UPDATE employees 
                SET email = ?, full_name = ?, contact = ?, address = ?, birthday = ?, 
                    employment_status = ?, educational_background = ?, emergency_contact_name = ?, 
                    emergency_contact_relationship = ?, emergency_contact_phone = ?, permission_id = ? 
                WHERE employee_id  = ?
            `;
    
            const [result] = await db.query(query, [
                email, full_name, contact, address, birthday,
                employment_status, educational_background, emergency_contact_name,
                emergency_contact_relationship, emergency_contact_phone, permission_id, employeeId
            ]);
    
            console.log("✅ Update Query Result:", result);
    
            if (result.affectedRows === 0) {
                console.log("❌ No rows were updated. Possible incorrect employee ID.");
                throw new Error("Update failed. No changes were made.");
            }
    
            console.log("✅ Employee updated successfully.");
            return HRModel.getEmployeeById(employeeId);
    
        } catch (error) {
            console.error("❌ Error updating employee:", error.message);
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
