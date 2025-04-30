const db = require("../../../db");

const HRModel = {
    // 🔹 Get permission by ID
    getRoleById: async (roleId) => {
        const query = "SELECT * FROM roles WHERE id = ?";
        const [result] = await db.query(query, [roleId]);
        return result.length > 0 ? result[0] : null;
    },

    // 🔹 Create a new user with username included
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

    // 🔹 Get all employees (filtered by is_deleted flag)
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

    checkRequestApproval: async (userId, date) => {
        const sql = `
            SELECT * FROM attendance 
            WHERE user_id = ? AND date = ? 
              AND (early_leave_approved = TRUE OR half_day_approved = TRUE)
        `;
        const [request] = await db.execute(sql, [userId, date]);
        return request.length > 0 ? request[0] : null;
    },

    // Check if already checked in
    alreadyCheckedIn: async (userId, date) => {
        const sql = `SELECT check_in FROM attendance WHERE user_id = ? AND date = ?`;
        const [rows] = await db.execute(sql, [userId, date]);
        return rows.length > 0 && rows[0].check_in !== null;
    },

    // CHECK-IN LOGIC
    checkIn: async (userId, checkInTime, date, userLat, userLng) => {
        const officeLat = 14.364277187613206;
        const officeLng = 120.92761115020912;
        const allowedRadius = 500;

        const distance = HRModel.getDistanceMeters(officeLat, officeLng, userLat, userLng);
        if (distance > allowedRadius) {
            return { error: `You are outside the allowed range (${Math.round(distance)}m).` };
        }

        const alreadyIn = await HRModel.alreadyCheckedIn(userId, date);
        if (alreadyIn) {
            return { error: "You have already checked in today." };
        }

        const hourPHT = new Date(checkInTime).getUTCHours() + 8;
        const request = await HRModel.checkRequestApproval(userId, date);
        if (hourPHT < 9 && !request) {
            return { error: "You can only check in after 9:00 AM or with approved request." };
        }

        const checkInFormatted = HRModel.adjustToPHT(checkInTime);

        const [existing] = await db.execute(
            `SELECT attendance_id FROM attendance WHERE user_id = ? AND date = ?`,
            [userId, date]
        );

        if (existing.length > 0) {
            const sql = `UPDATE attendance SET check_in = ?, status = 'Present' WHERE user_id = ? AND date = ?`;
            await db.execute(sql, [checkInFormatted, userId, date]);
        } else {
            const sql = `INSERT INTO attendance (user_id, date, check_in, status) VALUES (?, ?, ?, 'Present')`;
            await db.execute(sql, [userId, date, checkInFormatted]);
        }

        return { success: true, message: "Check-in recorded." };
    },

    // CHECK-OUT LOGIC
    checkOut: async (userId, checkOutTime, date) => {
        const hourPHT = new Date(checkOutTime).getUTCHours() + 8;
        const request = await HRModel.checkRequestApproval(userId, date);

        if (hourPHT < 18 && !request) {
            return { error: "You can only check out after 6:00 PM unless approved for early out." };
        }

        const checkOutFormatted = HRModel.adjustToPHT(checkOutTime);
        const sql = `
            UPDATE attendance
            SET check_out = ?, 
                total_hours = TIMESTAMPDIFF(MINUTE, check_in, ?)/60,
                overtime_hours = GREATEST(TIMESTAMPDIFF(MINUTE, check_in, ?)/60 - 8, 0)
            WHERE user_id = ? AND date = ? AND check_in IS NOT NULL
        `;
        const [result] = await db.execute(sql, [
            checkOutFormatted,
            checkOutFormatted,
            checkOutFormatted,
            userId,
            date
        ]);

        if (result.affectedRows === 0) {
            return { error: "Check-in required before check-out." };
        }

        return { success: true, message: "Check-out recorded." };
    },

    requestEarlyOut: async (userId, date, remarks) => {
        const sql = `UPDATE attendance SET early_leave_request = 1, remarks = ? WHERE user_id = ? AND date = ?`;
        await db.execute(sql, [remarks, userId, date]);
        return { success: true };
    },

    requestHalfDay: async (userId, date, remarks) => {
        const sql = `UPDATE attendance SET half_day_request = 1, remarks = ? WHERE user_id = ? AND date = ?`;
        await db.execute(sql, [remarks, userId, date]);
        return { success: true };
    },

    approveRequest: async (userId, date, type, isApproved) => {
        const column = type === "earlyOut" ? "early_leave_approved" : "half_day_approved";
        const status = isApproved ? (type === "earlyOut" ? "Early Out" : "Half Day") : "Absent";

        const sql = `
            UPDATE attendance
            SET ${column} = ?, status = ?
            WHERE user_id = ? AND date = ?
        `;
        await db.execute(sql, [isApproved, status, userId, date]);
        return { success: true };
    },

    getTodayAttendance: async (userId, date) => {
        try {
            const sql = `SELECT * FROM attendance WHERE user_id = ? AND date = ?`;
            const [rows] = await db.execute(sql, [userId, date]);
            return rows;  // Return the attendance data
        } catch (error) {
            console.error('Error fetching attendance data:', error);
            throw error;
        }
    },

    getApplicationsByStatus: async (status) => {
        const query = "SELECT * FROM applications WHERE status = ?";
        const [rows] = await db.execute(query, [status]);
        return rows;
    },

    // Update the application status (Pending, Ready for Interview, Accepted, Rejected)
    updateApplicationStatus: async (id, status) => {
        const query = "UPDATE applications SET status = ? WHERE id = ?";
        await db.execute(query, [status, id]);
    },

    // Get application details by ID
    getApplicationById: async (id) => {
        const query = "SELECT * FROM applications WHERE id = ?";
        const [rows] = await db.execute(query, [id]);
        return rows[0] || null;
    }

};

module.exports = HRModel;
