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
        const officeLat = 14.343465748292335;
        const officeLng = 120.97962529302887;
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
        } else if (!request && hourPHT === 9 && minutesPHT > 10) {
            // If no half-day request and check-in is after 9:10 AM, mark as "Late"
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
            console.log('Check-out function called with:', userId, checkOutTime, date);  // Debugging log at the start
    
            // First, check if the user has checked in
            const [checkInRecord] = await db.execute(
                `SELECT check_in FROM attendance WHERE user_id = ? AND date = ?`,
                [userId, date]
            );
    
            console.log('Check-in record:', checkInRecord);  // Log the check-in record for debugging
    
            if (!checkInRecord || !checkInRecord[0].check_in) {
                return { error: "You must check in first." };  // Error if the user hasn't checked in yet
            }
    
            // Convert check-out time to Philippine Time (PHT) - UTC to PHT (UTC + 8)
            const checkOutDate = new Date(checkOutTime);
            const hourPHT = checkOutDate.getUTCHours() + 8;  // Convert UTC to PHT (UTC + 8)
    
            // Format the hour to 24-hour format (0-23)
            const formattedHour = String(hourPHT % 24).padStart(2, '0'); // Handling overflow after 24 hours
            const checkOutFormatted = `${formattedHour}:${String(checkOutDate.getMinutes()).padStart(2, '0')}:${String(checkOutDate.getSeconds()).padStart(2, '0')}`;
    
            console.log('Formatted check-out time (HH:MM:SS):', checkOutFormatted);  // Debugging log for formatted check-out time
    
            // Check if an early-out request is approved for this date
            const request = await HRModel.checkRequestApproval(userId, date, 'early-out');  // Check if early-out request is approved
            console.log('Early-out request:', request);  // Log the early-out request status
            
    
            // If it's before 6 PM and no request is approved, show error
            if (hourPHT < 18 && !request) {
                return { error: "You can only check out after 6:00 PM unless approved for early out." };  // Error if before 6 PM and no approved request
            }
    
            // If the request is approved, allow checkout even before 6 PM
            if (request && request.status === 'approved') {
                console.log(`Early-out request approved for ${userId} on ${date}. Checkout allowed before 6 PM.`);
            }
    
            // SQL query to update check-out time, calculate total hours, and overtime
            const sql = `
                UPDATE attendance
                SET check_out = ?, 
                    total_hours = TIMESTAMPDIFF(MINUTE, check_in, ?) / 60,  -- Calculate total hours worked
                    overtime_hours = GREATEST(TIMESTAMPDIFF(MINUTE, check_in, ?) / 60 - 8, 0)  -- Calculate overtime (anything over 8 hours)
                WHERE user_id = ? AND date = ? AND check_in IS NOT NULL
            `;
    
            console.log('Executing SQL query with values:', [
                checkOutFormatted,
                checkOutFormatted,
                checkOutFormatted,
                userId,
                date
            ]);  // Log the query and parameters
    
            const [result] = await db.execute(sql, [
                checkOutFormatted,  // check-out time in HH:MM:SS format
                checkOutFormatted,
                checkOutFormatted,
                userId,
                date
            ]);
    
            console.log('SQL query result:', result);  // Log the result of the SQL query
    
            if (result.affectedRows === 0) {
                return { error: "Check-in required before check-out." };  // Error if no check-in exists for that date
            }
    
            return { success: true, message: "Check-out recorded." };
    
        } catch (error) {
            console.error('Error during check-out:', error);  // Log any error during check-out
            return { error: error.message || 'Internal Server Error' };  // Return error with message
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
        
    requestHalfDay: async (userId, requestDate, remarks) => {
        if (!userId || !requestDate || !remarks) {
            throw new Error('Invalid input: userId, requestDate, and remarks are required.');
        }
    
        // Insert half-day request into the requests table with status as 'pending'
        const sql = `INSERT INTO requests (user_id, request_date, request_type, remarks, status)
                     VALUES (?, ?, 'halfDay', ?, 'pending')`;
    
        try {
            const [result] = await db.execute(sql, [userId, requestDate, remarks]);
            console.log("Half-day request submitted successfully:", result);
            return { success: true };
        } catch (error) {
            console.error('Error submitting half-day request:', error);
            throw new Error('Failed to submit half-day request.');
        }
    },
    
    // Request Early Out
    requestEarlyOut: async (userId, requestDate, remarks) => {
        if (!userId || !requestDate || !remarks) {
            throw new Error('Invalid input: userId, requestDate, and remarks are required.');
        }

        // Insert early-out request into the requests table with status as 'pending'
        const sql = `INSERT INTO requests (user_id, request_date, request_type, remarks, status)
                     VALUES (?, ?, 'earlyOut', ?, 'pending')`;

        try {
            const [result] = await db.execute(sql, [userId, requestDate, remarks]);
            console.log("Early-out request submitted successfully:", result);
            return { success: true };
        } catch (error) {
            console.error('Error submitting early-out request:', error);
            throw new Error('Failed to submit early-out request.');
        }
    },

    requestOvertime: async (userId, requestDate, remarks) => {
        // Validate input (check if all required fields are provided)
        if (!userId || !requestDate || !remarks) {
            throw new Error('Invalid input: userId, requestDate, and remarks are required.');
        }
    
        // Insert overtime request into the requests table with status as 'pending'
        const sql = `INSERT INTO requests (user_id, request_date, request_type, remarks, status)
                     VALUES (?, ?, 'overtime', ?, 'pending')`;
    
        try {
            const [result] = await db.execute(sql, [userId, requestDate, remarks]);
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
    },

    getEmployeesWithAttendance: async (startDate, endDate) => {
        const [rows] = await db.query(
            `SELECT 
                e.employee_id, 
                e.full_name, 
                e.role_id, 
                COALESCE(p.salary, 0) AS fixed_salary, 
                SUM(a.total_hours) AS total_hours, 
                SUM(a.overtime_hours) AS overtime_hours,
                COUNT(DISTINCT DATE(a.date)) AS days_present 
             FROM employees e
             JOIN attendance a 
               ON e.user_id = a.user_id
            JOIN roles r 
               ON e.role_id = r.id  
            JOIN positions p 
                 ON e.role_id = p.role_id 
             WHERE a.date BETWEEN ? AND ? AND a.status = 'present'  -- Only count 'present' status
             GROUP BY e.employee_id, e.full_name, e.role_id, p.salary`,
            [startDate, endDate]
        );
        return rows;
    },
    
    getDeductionsBySalary: async (salary) => {
        const [rows] = await db.query(
            `SELECT * 
             FROM deductions 
             WHERE ? BETWEEN salary_min AND salary_max`,
            [salary]
        );
        return rows;
    },
    
    insertPayrollRecords: async (records) => {
        const values = records.map(r => [
            r.employee_id,
            r.period_start,
            r.period_end,
            r.payroll_date,
            r.days_present,
            r.total_hours || 0,
            r.overtime_hours,
            r.fixed_salary || 0,
            r.deductions || 0,
            r.salary_before_tax || 0,
            r.net_pay || 0,
            r.payroll_period || '',
            r.status || 'pending'    // default to 'pending'
        ]);
    
        await db.query(
            `INSERT INTO payroll 
             (employee_id, start_date, end_date, payroll_date, days_present, 
              total_hours, overtime_hours, fixed_salary, total_deductions, salary_before_tax, 
              net_salary, payroll_period, status)
             VALUES ?`, [values]
        );
    },
    getPendingPayroll: async () => {
        try {
            const [rows] = await db.query(
                `SELECT p.*, e.full_name,  ros.name AS position
                 FROM payroll p 
                 JOIN employees e 
                   ON p.employee_id = e.employee_id
                     JOIN roles ros ON e.role_id = ros.id
                      JOIN positions pos ON e.role_id = pos.position_id
                 WHERE p.status = "pending"`
            );
            console.log('Rows:', rows); // Log the result to inspect it
            return rows;  // Return the rows if found
        } catch (err) {
            console.error('Error in getPendingPayroll:', err);
            throw err;  // Ensure we throw the error so it's caught in the controller
        }
    },
    getAcceptPayroll: async () => {
        try {
            const [rows] = await db.query(
                `SELECT p.*, e.full_name,  ros.name AS position
                 FROM payroll p 
                 JOIN employees e 
                   ON p.employee_id = e.employee_id
                     JOIN roles ros ON e.role_id = ros.id
                      JOIN positions pos ON e.role_id = pos.position_id
                 WHERE p.status = "approved"`
            );
            console.log('Rows:', rows); // Log the result to inspect it
            return rows;  // Return the rows if found
        } catch (err) {
            console.error('Error in getPendingPayroll:', err);
            throw err;  // Ensure we throw the error so it's caught in the controller
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
        const [rows] = await db.query('SELECT * FROM deductions');
        return rows;  // Return all rows (deductions)
    },

    // Model function to update a deduction
updateDeduction: async (id, deduction_type, salary_min, salary_max, employee_percentage, employer_percentage) => {
    const [result] = await db.query(
        `UPDATE deductions 
         SET deduction_type = ?, salary_min = ?, salary_max = ?, employee_percentage = ?, employer_percentage = ? 
         WHERE id = ?`,
        [deduction_type, salary_min, salary_max, employee_percentage, employer_percentage, id]
    );
    return result;
},

deleteDeduction: async (id) => {
    const [result] = await db.query(
        `DELETE FROM deductions WHERE id = ?`,
        [id]
    );
    return result;
}

    
};

module.exports = HRModel;
