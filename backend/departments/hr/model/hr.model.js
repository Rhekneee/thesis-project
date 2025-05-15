const db = require("../../../db");
const bcrypt = require('bcrypt');

// Add a function to fix existing plain text passwords
const fixPlainTextPasswords = async () => {
    try {
        console.log('🔍 Checking for plain text passwords...');
        const [users] = await db.query('SELECT id, password FROM users WHERE password NOT LIKE "$2b$%"');
        
        if (users.length > 0) {
            console.log(`Found ${users.length} users with plain text passwords`);
            
            for (const user of users) {
                const saltRounds = 10;
                const hashedPassword = await bcrypt.hash(user.password, saltRounds);
                
                await db.query(
                    'UPDATE users SET password = ? WHERE id = ?',
                    [hashedPassword, user.id]
                );
                console.log(`✅ Updated password for user ${user.id}`);
            }
        } else {
            console.log('✅ All passwords are properly hashed');
        }
    } catch (error) {
        console.error('❌ Error fixing passwords:', error);
        throw error;
    }
};

// Call the fix function when the module loads
fixPlainTextPasswords().catch(console.error);

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
        // Hash the default password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);

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

        // 🧾 Step 2: Insert the user with permission_id and hashed password
        const userInsertQuery = `
            INSERT INTO users (email, username, role_id, password) 
            VALUES (?, ?, ?, ?)
        `;

        try {
            const [result] = await db.query(userInsertQuery, [
                email,
                full_name,
                role_id,
                hashedPassword,
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

    // 🔹 Get all permissions
    getAllRoles: async () => {
        try {
            const query = "SELECT id, name FROM roles WHERE name!='Owner'";
    
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
              AND (early_leave_approved = 1 OR half_day_approved = 1)
        `;
        const [request] = await db.execute(sql, [userId, date]);
        return request.length > 0 ? request[0] : null;
    },

    // Check if already checked in
    alreadyCheckedIn: async (userId, date) => {
        try {
            // Log the parameters to verify
            console.log(`Checking if user ${userId} has checked in on ${date}`);
    
            // Query to check for today's check-in
            const sql = `SELECT check_in FROM attendance WHERE user_id = ? AND DATE(date) = DATE(?)`;
            const [rows] = await db.execute(sql, [userId, date]);
    
            // Log the result for debugging
            console.log(`Query result for user ${userId} on ${date}:`, rows);
    
            return rows.length > 0 && rows[0].check_in !== null;
        } catch (error) {
            console.error('Error checking check-in status:', error);
            throw error;
        }
    },    
    
    // CHECK-IN LOGIC
    checkIn: async (userId, checkInTime, date, userLat, userLng) => {
        const officeLat = 14.327421495764893;
        const officeLng = 120.94053562075905;
        const allowedRadius = 500;
    
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
            return { error: "Invalid check-in time format." };  // If the time is invalid, return a dash
        }

        // Convert to Philippine Time (PHT) from UTC (UTC +8 hours)
        const localTime = new Date(checkInDate.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    
        const hourPHT = localTime.getHours(); // Get the hour in Philippine Time (PHT)
        const minutesPHT = localTime.getMinutes();
        const secondsPHT = localTime.getSeconds();

        // Check if the employee has an approved half-day request for the day
        const request = await HRModel.checkRequestApproval(userId, date, "halfDay"); // Check for half-day approval
    
        // If no approved half-day request, enforce the 9 AM check-in time
        if (!request && hourPHT < 9) {
            return { error: "You can only check in after 9:00 AM unless approved for half-day." };
        }

        let status = "Present"; // Default status for employees with no request

        // If the employee has an approved half-day request
        if (request) {
            // Morning half-day (check-in between 9:00 AM to 12:00 PM)
            if (hourPHT >= 9 && hourPHT < 12) {
                status = "Half Day"; // Mark as "Half Day" if the check-in is within the half-day period
            }
            // Afternoon half-day (check-in between 12:00 PM to 6:00 PM)
            else if (hourPHT >= 12 && hourPHT < 18) {
                status = "Half Day"; // Mark as "Half Day" if the check-in is within the half-day period
            }
        } else if (!request && (hourPHT > 9 || (hourPHT === 9 && minutesPHT > 10))) {
            status = "Late";
        }        
        
        // Format the check-in time to 'HH:MM:SS' for the TIME field in the database
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
    },

        
    checkOut: async (userId, checkOutTime, date) => {
        try {
            console.log('Check-out function called with:', userId, checkOutTime, date);

            // First, check if the user has checked in
            const [checkInRecord] = await db.execute(
                `SELECT check_in, status FROM attendance WHERE user_id = ? AND date = ?`,
                [userId, date]
            );

            if (!checkInRecord || !checkInRecord[0].check_in) {
                return { error: "You must check in first." };
            }

            // Convert check-out time to Philippine Time (PHT) - UTC to PHT (UTC + 8)
            const checkOutDate = new Date(checkOutTime);
            const hourPHT = checkOutDate.getUTCHours() + 8;
            const minutesPHT = checkOutDate.getUTCMinutes();

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

            return { success: true, message: "Check-out recorded." };

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
        const sql = `
            SELECT * FROM requests
            WHERE user_id = ? AND request_date = ? AND status = 'approved' AND request_type = ?`;

        const [result] = await db.execute(sql, [userId, date, requestType]);

        return result.length > 0 ? result[0] : null; // Returns the request if found, or null if not
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
          SELECT date, check_in, check_out, status, total_hours, overtime_hours 
          FROM attendance 
          WHERE user_id = ? 
          ORDER BY date DESC
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
    updateApplicationStatus: async (id, status) => {
        const query = "UPDATE applications SET status = ? WHERE id = ?";
        await db.execute(query, [status, id]);
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
                    COALESCE(p.salary, 0) AS fixed_salary,
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
            const [rows] = await db.query(`
                SELECT 
                    id,
                    deduction_type,
                    salary_min,
                    salary_max,
                    employee_percentage,
                    employer_percentage,
                    total_rate
                FROM deductions 
                WHERE ? BETWEEN salary_min AND salary_max
                ORDER BY deduction_type
            `, [salary]);
            return rows;
        } catch (error) {
            console.error("❌ Error fetching deductions by salary:", error);
            throw error;
        }
    },
    
    insertPayrollRecords: async (records) => {
        const values = records.map(r => [
            r.employee_id,
            r.start_date,
            r.end_date,
            r.payroll_date,
            r.days_present,
            r.days_absent,
            r.total_hours || 0,
            r.overtime_hours,
            r.fixed_salary || 0,
            r.total_deductions || 0,
            r.absence_deduction || 0,
            r.net_salary || 0,
            r.payroll_period || '',
            r.status || 'pending',    // default to 'pending'
            r.fixed_salary || 0       // salary_before_tax is same as fixed_salary
        ]);
    
        try {
            console.log('Inserting payroll records with dates:', {
                firstRecord: {
                    start: records[0]?.start_date,
                    end: records[0]?.end_date,
                    payroll_date: records[0]?.payroll_date
                }
            });

            await db.query(
                `INSERT INTO payroll 
                 (employee_id, start_date, end_date, payroll_date, days_present, 
                  days_absent, total_hours, overtime_hours, fixed_salary, total_deductions, 
                  absence_deduction, net_salary, payroll_period, status, salary_before_tax)
                 VALUES ?`, [values]
            );
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
                    e.full_name,  
                    r.name AS position,
                    DATE_FORMAT(p.start_date, '%Y-%m-%d') as start_date,
                    DATE_FORMAT(p.end_date, '%Y-%m-%d') as end_date
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
                    start: rows[0].start_date,
                    end: rows[0].end_date
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
                    salary_min,
                    salary_max,
                    employee_percentage,
                    employer_percentage,
                    (employee_percentage + employer_percentage) as total_rate,
                    is_active
                FROM deductions
                ORDER BY deduction_type, salary_min
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
                `UPDATE deductions 
                 SET is_active = 0
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
                `UPDATE deductions 
                 SET is_active = 1
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
                UPDATE deductions 
                SET deduction_type = ?,
                    salary_min = ?,
                    salary_max = ?,
                    employee_percentage = ?,
                    employer_percentage = ?,
                    total_rate = ?
                WHERE id = ?
            `, [
                deduction.deduction_type,
                deduction.salary_min,
                deduction.salary_max,
                deduction.employee_percentage,
                deduction.employer_percentage,
                deduction.total_rate,
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
                INSERT INTO deductions 
                (deduction_type, salary_min, salary_max, employee_percentage, employer_percentage, total_rate)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                deduction.deduction_type,
                deduction.salary_min,
                deduction.salary_max,
                deduction.employee_percentage,
                deduction.employer_percentage,
                deduction.total_rate
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
            const [rows] = await db.query(
                `SELECT 
                    id,
                    deduction_type,
                    salary_min,
                    salary_max,
                    employee_percentage,
                    employer_percentage,
                    (employee_percentage + employer_percentage) as total_rate
                FROM deductions 
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
                CREATE TABLE IF NOT EXISTS deductions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    deduction_type VARCHAR(50) NOT NULL,
                    salary_min DECIMAL(10, 2) NOT NULL,
                    salary_max DECIMAL(10, 2) NOT NULL,
                    employee_percentage DECIMAL(5, 2) NOT NULL,
                    employer_percentage DECIMAL(5, 2) NOT NULL,
                    total_rate DECIMAL(5, 2) NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);
            console.log("✅ Deductions table created or already exists");
        } catch (error) {
            console.error("❌ Error creating deductions table:", error);
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
};

module.exports = HRModel;
