const nodemailer = require('nodemailer'); 
const HRModel = require("../model/hr.model");
const moment = require('moment');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendEmailNotification, sendHireNotification, sendRejectNotification } = require('../../../utils/emailService');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', '..', '..', 'uploads', 'profile_pictures');
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename: employeeId_timestamp.extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `profile_${req.params.id}_${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        // Accept only image files
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
}).single('profile_picture');

const HRController = {
    // 🔹 Add a new employee (Manager Only)
    addEmployee: async (req, res) => {
        try {
            console.log("🔹 Received Request Body:", req.body);
    
            // Check if the user is logged in
            if (!req.session?.user) {
                return res.status(401).json({ error: "Unauthorized: No session found" });
            }
    
            // Check if the user has permission to add employees (only "office_administrator" role)
            const role = req.session.user.role_name;
            if (role !== "office_administrator") {
                return res.status(403).json({ error: "Forbidden: Only Admin Staff can add employees" });
            }
    
            // Destructure the employee data from the request body
            const {
                email, full_name, contact, address, birthday,
                employment_status, educational_background, emergency_contact_name,
                emergency_contact_relationship, emergency_contact_phone, role_id 
            } = req.body;
    
            // Validate required fields
            if (!email || !full_name || !contact || !address || !birthday ||
                !employment_status || !educational_background || !emergency_contact_name ||
                !emergency_contact_relationship || !emergency_contact_phone || !role_id) {
                return res.status(400).json({ error: "Missing required fields" });
            }
    
            // Check if the email already exists
            const emailExists = await HRModel.checkEmployeeEmailExists(email);
            if (emailExists) {
                return res.status(400).json({ error: "Employee with this email already exists" });
            }
    
            // Check if the role exists
            const roleExists = await HRModel.getRoleById(role_id);
            if (!roleExists) {
                return res.status(400).json({ error: "Invalid role ID provided" });
            }
    
            console.log("🔹 Valid Role ID:", role_id);
    
            // Check if the user exists, create user if not
            let user_id = await HRModel.getUserIdByEmail(email);
            if (!user_id) {
                console.log("🔹 Creating new user...");
                user_id = await HRModel.createUser(email, role_id, full_name);
            }
    
            // Generate the employee ID (based on the year and auto-increment after 1006)
            const year = new Date().getFullYear();
            let nextEmployeeId = null;
    
            // Check the last employee ID
            const lastEmployee = await HRModel.getLastEmployeeId();
            const lastEmployeeId = lastEmployee ? lastEmployee.employee_id : null;
    
            // If the last employee ID is within the predefined range (2025-1000 to 2025-1006)
            const predefinedEmployeeIds = ['2025-1000', '2025-1001', '2025-1002', '2025-1003', '2025-1004', '2025-1005'];
            if (predefinedEmployeeIds.includes(lastEmployeeId)) {
                // If last employee ID is within the predefined range, the next one will be 2025-1006
                nextEmployeeId = `2025-${(parseInt(lastEmployeeId.split('-')[1]) + 1).toString().padStart(3, '0')}`;
            } else {
                // For employees after 2025-1006, generate employee_id dynamically
                nextEmployeeId = lastEmployeeId
                    ? `${year}-${(parseInt(lastEmployeeId.split('-')[1]) + 1).toString().padStart(3, '0')}`
                    : `${year}-1006`;  // If no employees yet, start from 2025-1006
            }
    
            // Prepare the employee data
            const employeeData = {
                user_id,
                email,
                role_id: parseInt(role_id),
                full_name,
                contact,
                address,
                birthday,
                employment_status,
                educational_background,
                emergency_contact_name,
                emergency_contact_relationship,
                emergency_contact_phone,
                employee_id: nextEmployeeId, // Set the generated employee_id
            };
    
            // Add the employee to the database
            const result = await HRModel.addEmployee(employeeData);
            res.status(201).json({ message: "Employee added successfully", ...result });
    
        } catch (error) {
            console.error("❌ Error adding employee:", error);
            res.status(500).json({ message: "Failed to add employee" });
        }
    },

    // 🔹 Get all employees
    getAllEmployees: async (req, res) => {
        try {
            const includeDeleted = req.query.includeDeleted === 'true';
            const employees = await HRModel.getAllEmployees(includeDeleted);
            res.status(200).json(employees);
        } catch (err) {
            console.error("❌ Fetching employees failed:", err);
            res.status(500).json({ message: "Something went wrong", error: err.message });
        }
    },
    


    // 🔹 Get all permissions
    getRoles: async (req, res) => {
        try {

            const roles = await HRModel.getAllRoles();

            if (!roles || roles.length === 0) {
                console.warn("⚠️ [getRoles] No roles found in the system.");
                return res.status(404).json({ error: "No roles found in the system" });
            }

            res.json(roles);
        } catch (error) {
            console.error("❌ [getRoles] Error fetching roles:", error.message || error);
            res.status(500).json({ error: "Failed to fetch roles" });
        }
    },


    // 🔹 Get employee details by ID
    getEmployeeDetails: async (req, res) => {
        try {
            const employeeId = req.params.id;
            const employee = await HRModel.getEmployeeById(employeeId);
            if (!employee) {
                return res.status(404).json({ error: "Employee not found" });
            }
            res.status(200).json(employee);
        } catch (error) {
            console.error("❌ Error fetching employee details:", error);
            res.status(500).json({ error: "Failed to fetch employee details" });
        }
    },


    getAllPermissions: async () => {
        const query = "SELECT * FROM permissions";  // Query to get all permissions
        const [permissions] = await db.query(query);
        return permissions;
    },
    
    // 🔹 Update an existing employee (Manager Only)
    updateEmployee: async (req, res) => {
        try {
            const employeeId = req.params.id;

            if (!req.session?.user) {
                return res.status(401).json({ error: "Unauthorized: No session found" });
            }

            const role = req.session.user.role_name;
            if (role !== "office_administrator") {
                return res.status(403).json({ error: "Forbidden: Only Admin Staff can update employees" });
            }

            const {
                email, full_name, contact, address, birthday,
                employment_status, educational_background, emergency_contact_name,
                emergency_contact_relationship, emergency_contact_phone, role_id
            } = req.body;

            const existing = await HRModel.getEmployeeById(employeeId);
            if (!existing) {
                return res.status(404).json({ error: "Employee not found" });
            }

            const updatedEmployee = await HRModel.updateEmployee(employeeId, {
                email,
                full_name,
                contact,
                address,
                birthday,
                employment_status,
                educational_background,
                emergency_contact_name,
                emergency_contact_relationship,
                emergency_contact_phone,
                role_id
            });

            res.status(200).json({ message: "Employee updated successfully", employee: updatedEmployee });

        } catch (error) {
            console.error("❌ Error updating employee:", error);
            res.status(500).json({ error: "Failed to update employee" });
        }
    },

// 🔹 Archive (soft delete) employee
softDeleteOrRestoreEmployee: async (req, res) => {
    const { employeeId } = req.params;
    const { shouldDelete } = req.body;

    try {
        await HRModel.softDeleteOrRestoreEmployee(employeeId, shouldDelete);  // <-- fixed here
        res.status(200).json({ message: `Employee ${shouldDelete ? 'archived' : 'restored'} successfully` });
    } catch (error) {
        console.error("❌ Soft delete/restore error:", error);
        res.status(500).json({ message: "Something went wrong", error: error.message });
    }
},

    // 🔹 Record attendance (with lat/lng)
   
    // Handle check-in
    checkInAttendance: async (req, res) => {
        const userId = req.params.id;
        const { date, checkInTime, userLat, userLng } = req.body;

        console.log('📝 Check-in request received:', {
            userId,
            date,
            checkInTime,
            userLat,
            userLng
        });

        try {
            // Validate required fields
            if (!userId || !date || !checkInTime || userLat === undefined || userLng === undefined) {
                console.log('❌ Missing required fields:', { userId, date, checkInTime, userLat, userLng });
                return res.status(400).json({ 
                    error: 'Missing required fields',
                    details: {
                        userId: !userId ? 'User ID is required' : null,
                        date: !date ? 'Date is required' : null,
                        checkInTime: !checkInTime ? 'Check-in time is required' : null,
                        userLat: userLat === undefined ? 'Latitude is required' : null,
                        userLng: userLng === undefined ? 'Longitude is required' : null
                    }
                });
            }

            // Validate user ID format
            if (isNaN(parseInt(userId))) {
                console.log('❌ Invalid user ID format:', userId);
                return res.status(400).json({ error: 'Invalid user ID format' });
            }

            // Validate coordinates
            if (isNaN(parseFloat(userLat)) || isNaN(parseFloat(userLng))) {
                console.log('❌ Invalid coordinates:', { userLat, userLng });
                return res.status(400).json({ error: 'Invalid coordinates' });
            }

            // Validate date format
            const dateObj = new Date(date);
            if (isNaN(dateObj.getTime())) {
                console.log('❌ Invalid date format:', date);
                return res.status(400).json({ error: 'Invalid date format' });
            }

            // Validate check-in time format
            const timeObj = new Date(checkInTime);
            if (isNaN(timeObj.getTime())) {
                console.log('❌ Invalid check-in time format:', checkInTime);
                return res.status(400).json({ error: 'Invalid check-in time format' });
            }

            console.log('✅ Input validation passed, proceeding with check-in...');
            const result = await HRModel.checkIn(userId, checkInTime, date, userLat, userLng);
            
            if (result.error) {
                console.log('❌ Check-in validation failed:', result.error);
                return res.status(400).json({ error: result.error });
            }

            console.log('✅ Check-in successful:', result);
            return res.status(200).json(result);
        } catch (error) {
            console.error('❌ Error in checkInAttendance controller:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                sqlMessage: error.sqlMessage,
                sql: error.sql
            });
            
            // Send appropriate error response based on error type
            if (error.code === 'ER_NO_REFERENCED_ROW') {
                return res.status(404).json({ error: 'User not found' });
            } else if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Duplicate check-in attempt' });
            } else if (error.code === 'ER_TRUNCATED_WRONG_VALUE') {
                return res.status(400).json({ error: 'Invalid data format' });
            }
            
            return res.status(500).json({ 
                error: 'Internal Server Error',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },


    // Handle check-out
    checkOutAttendance: async (req, res) => {
        const userId = req.params.id;
        const { date, checkOutTime } = req.body;

        try {
            const result = await HRModel.checkOut(userId, checkOutTime, date);
            if (result.error) {
                return res.status(400).json({ error: result.error });
            }
            return res.status(200).json(result);
        } catch (error) {
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    },


    updateMissedCheckOuts: async (req, res) => {
        const { date } = req.body;
    
        if (!date) {
          return res.status(400).json({ error: "Missing date parameter (format: YYYY-MM-DD)" });
        }
    
        try {
          const result = await HRModel.markMissedCheckOuts(date);
          res.json(result);
        } catch (error) {
          console.error('Error in updateMissedCheckOuts controller:', error);
          res.status(500).json({ error: 'Internal server error' });
        }
      },

    // Request early out
    requestHalfDayRequest: async (req, res) => {
        try {
            const { employeeId } = req.params;
            const { date, reason, type } = req.body;

            if (!employeeId || !date || !reason || !type) {
                return res.status(400).json({ error: 'Employee ID, date, reason, and type are required' });
            }

            const result = await HRModel.requestHalfDay(employeeId, date, reason, type);
            res.json(result);
        } catch (error) {
            console.error('Error submitting half day request:', error);
            res.status(500).json({ error: 'Failed to submit half day request' });
        }
    },
    

    // Handle Early-Out Request Submission
    requestEarlyOutRequest: async (req, res) => {
        try {
            const { employeeId } = req.params;
            const { date, reason } = req.body;

            if (!employeeId || !date || !reason) {
                return res.status(400).json({ error: 'Employee ID, date, and reason are required' });
            }

            const result = await HRModel.requestEarlyOut(employeeId, date, reason);
            res.json(result);
        } catch (error) {
            console.error('Error submitting early out request:', error);
            res.status(500).json({ error: 'Failed to submit early out request' });
        }
    },

    // Handle Approving or Rejecting Requests (Early-out or Half-day)
    getAllPendingRequests: async (req, res) => {
        try {
            const requests = await HRModel.getAllPendingRequests(); // Fetch all pending requests
            res.json({ requests });
        } catch (error) {
            console.error('Error fetching all pending requests:', error);
            res.status(500).json({ message: 'Failed to fetch all pending requests.' });
        }
    },

    // Get all pending requests by user_id (for HR head to view specific user's pending requests)
    getPendingRequestsByUserId: async (req, res) => {
        try {
            const { employeeId } = req.params;
            if (!employeeId) {
                return res.status(400).json({ error: 'Employee ID is required' });
            }

            const requests = await HRModel.getPendingRequestsByEmployeeId(employeeId);
            res.json(requests);
        } catch (error) {
            console.error('Error fetching pending requests:', error);
            res.status(500).json({ error: 'Failed to fetch pending requests' });
        }
    },
    // Handle request approval/rejection (halfDay, earlyOut, overtime)
    handleRequestApproval: async (req, res) => {
        const { userId, requestType, isApproved } = req.body;

        // Log the received data for debugging
        console.log('Received:', { userId, requestType, isApproved });

        // Validate requestType
        const validRequestTypes = ['halfDay', 'earlyOut', 'overtime']; // Valid request types
        if (!validRequestTypes.includes(requestType)) {
            console.error('Invalid requestType:', requestType);
            return res.status(400).json({ message: 'Invalid request type.' });
        }

        // Validate isApproved
        if (typeof isApproved !== 'boolean') {
            console.error('Invalid isApproved value:', isApproved);
            return res.status(400).json({ message: 'Invalid approval status.' });
        }

        // Set the status based on isApproved
        const status = isApproved ? 'approved' : 'rejected';

        try {
            // Call the Model to handle request approval/rejection
            const result = await HRModel.handleRequestApproval(userId, requestType, status);

            if (result.success) {
                res.json({ success: true, affectedRows: result.affectedRows });
            } else {
                res.status(500).json({ message: 'Failed to approve/reject request.' });
            }
        } catch (error) {
            console.error('Error handling request approval:', error);
            res.status(500).json({ message: 'Failed to approve/reject request.' });
        }
    },

    // Controller
    getTodayAttendance: async (req, res) => {
        const employeeId = req.params.id;  // Get employeeId from the route parameter
        const date = new Date().toISOString().slice(0, 10);  // Get today's date in YYYY-MM-DD format
    
        try {
            // Fetch today's attendance data for the employee
            const attendance = await HRModel.getTodayAttendance(employeeId, date);
            return res.status(200).json(attendance);  // Send the data as JSON
        } catch (error) {
            console.error('Error fetching attendance:', error);
            return res.status(500).json({ error: 'Failed to fetch attendance data' });
        }
    },

    
    getAttendanceByUserId: async (req, res) => {
        const { userId } = req.params;
    
        try {
          const attendance = await HRModel.getAttendanceHistory(userId);
          res.status(200).json({ attendance });
        } catch (error) {
          console.error("Error fetching attendance:", error);
          res.status(500).json({ error: "Failed to load attendance history." });
        }
      },

      getAllAttendanceRecords: async (req, res) => {
        try {
            const records = await HRModel.getAllAttendanceRecords();
            res.json(records);
        } catch (error) {
            console.error('Error fetching attendance records:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    getApplicationsByStatus: async (req, res) => {
        const { status } = req.query;  // Get the status from query parameters
        try {
            const applications = await HRModel.getApplicationsByStatus(status);
            res.json(applications);  // Send applications data as JSON
        } catch (error) {
            console.error("Error fetching applications:", error);
            res.status(500).json({ error: "Error fetching applications" });
        }
    },

    // Method to update application status (Pending, Ready for Interview, Accepted, Rejected)
    updateApplicationStatus: async (req, res) => {
        const { id, status } = req.body; // Get the ID and status from the request body
        try {
            // Validate the status value
            if (!['Pending', 'Ready for Interview', 'Accepted', 'Rejected'].includes(status)) {
                return res.status(400).json({ error: "Invalid status value" });
            }

            // Update the status in the database
            await HRModel.updateApplicationStatus(id, status);

            // Fetch the applicant's details using the ID
            const application = await HRModel.getApplicationById(id);

            // Send appropriate email notification
            if (status === 'Ready for Interview') {
                await sendEmailNotification(application.email, status);
            } else if (status === 'Accepted') {
                await sendHireNotification(application.email);
            } else if (status === 'Rejected') {
                await sendRejectNotification(application.email);
            }

            res.status(200).json({ message: `Status updated to ${status}` });
        } catch (error) {
            console.error("Error updating application status:", error);
            res.status(500).json({ error: "Error updating application status" });
        }
    },
    scheduleInterview: async (req, res) => {
        const { id, date, time } = req.body;
    
        try {
            // 1. Schedule the interview
            await HRModel.scheduleInterview(id, date, time);
    
            // 2. Get the applicant's info
            const applicant = await HRModel.getApplicationById(id);
    
            // 3. Send email notification with schedule
            await sendEmailNotification(applicant.email, 'Interview Schedule - M.D. Buendia Construction Inc.', date, time);
    
            res.status(200).json({ message: "Interview scheduled and email sent successfully." });
        } catch (error) {
            console.error("Error in scheduleInterview:", error);
            res.status(500).json({ error: "Failed to schedule interview." });
        }
    },    

    generatePayroll: async (req, res) => {
        try {
            const { month, year, period } = req.body;
            console.log('\n=== PAYROLL GENERATION STARTED ===');
            console.log('1. Input Parameters:', { month, year, period });

            // Convert month and year to numbers
            const monthNum = parseInt(month);
            const yearNum = parseInt(year);

            // Get current date
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-based
            const currentYear = currentDate.getFullYear();

            // Validate if the selected month is the current month
            if (monthNum !== currentMonth || yearNum !== currentYear) {
                return res.status(400).json({ 
                    message: `Payroll can only be generated for the current month (${currentMonth}/${currentYear}). Please select the current month.`
                });
            }

            // Validate month and year
            if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
                return res.status(400).json({ message: 'Invalid month' });
            }
            if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
                return res.status(400).json({ message: 'Invalid year' });
            }

            let startDate, endDate;

            // Helper function to get the last day of the month
            const getLastDayOfMonth = (year, month) => {
                return new Date(year, month, 0).getDate();
            };

            // Helper function to format date with ordinal
            const formatDateWithOrdinal = (date) => {
                const day = date.getDate();
                const suffix = ['th', 'st', 'nd', 'rd'][(day % 10 > 3 || day > 20) ? 0 : day % 10];
                return `${day}${suffix}`;
            };

            if (period === 'first') {
                // First period: 1st to 15th
                startDate = new Date(yearNum, monthNum - 1, 1);
                endDate = new Date(yearNum, monthNum - 1, 15);
            } else {
                // Second period: 16th to last day of month
                startDate = new Date(yearNum, monthNum - 1, 16);
                const lastDay = getLastDayOfMonth(yearNum, monthNum);
                endDate = new Date(yearNum, monthNum - 1, lastDay);
            }

            // Format dates to YYYY-MM-DD
            const formatDate = (date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            const formattedStartDate = formatDate(startDate);
            const formattedEndDate = formatDate(endDate);

            // Get all active employees
            const employees = await HRModel.getEmployeesWithAttendance(
                formattedStartDate,
                formattedEndDate
            );

            if (!employees || employees.length === 0) {
                return res.status(404).json({ 
                    message: 'No active employees found in the system.'
                });
            }

            const records = [];
            for (let e of employees) {
                try {
                    // Get position details
                    const positionInfo = await HRModel.getPositionSalary(e.role_id);
                    if (!positionInfo) {
                        console.log(`No position found for role_id: ${e.role_id}`);
                        continue;
                    }

                    // Base salary calculations
                    const baseSalary = positionInfo.salary || 0;
                    const dailyRate = baseSalary / 22; // Assuming 22 working days per month
                    const hourlyRate = dailyRate / 8; // Assuming 8 hours per day

                    // Calculate regular pay
                    const regularPay = dailyRate * e.days_present;

                    // Calculate half-day pay
                    const halfDayPay = (dailyRate / 2) * e.days_half_day;

                    // Calculate early out deductions
                    const earlyOutDeduction = hourlyRate * e.days_early_out;

                    // Calculate overtime pay (1.25x rate for overtime)
                    const overtimePay = hourlyRate * 1.25 * e.overtime_hours;

                    // Calculate absence deduction
                    const absenceDeduction = dailyRate * e.days_absent;

                    // Calculate total deductions
                    const deductions = await HRModel.getDeductionsBySalary(baseSalary);
                    const totalDeductions = deductions.reduce((sum, deduction) => {
                        const amount = (baseSalary * deduction.employee_percentage) / 100;
                        return sum + amount;
                    }, 0);

                    // Calculate net salary
                    const grossSalary = regularPay + halfDayPay + overtimePay - earlyOutDeduction - absenceDeduction;
                    const netSalary = grossSalary - totalDeductions;

                    records.push({
                        employee_id: e.employee_id,
                        full_name: e.full_name,
                        position: e.position,
                        start_date: formattedStartDate,
                        end_date: formattedEndDate,
                        days_present: e.days_present,
                        days_half_day: e.days_half_day,
                        days_early_out: e.days_early_out,
                        days_absent: e.days_absent,
                        days_holiday_rest: e.days_holiday_rest,
                        days_on_leave: e.days_on_leave,
                        total_hours: e.total_hours,
                        overtime_hours: e.overtime_hours,
                        fixed_salary: baseSalary,
                        regular_pay: regularPay,
                        half_day_pay: halfDayPay,
                        overtime_pay: overtimePay,
                        early_out_deduction: earlyOutDeduction,
                        absence_deduction: absenceDeduction,
                        total_deductions: totalDeductions,
                        gross_salary: grossSalary,
                        net_salary: netSalary,
                        payroll_date: new Date().toISOString().split('T')[0],
                        payroll_period: `${formatDateWithOrdinal(startDate)} to ${formatDateWithOrdinal(endDate)} of ${new Date(yearNum, monthNum - 1).toLocaleString('default', { month: 'long' })}`,
                        status: 'pending'
                    });
                } catch (error) {
                    console.error(`Error processing employee ${e.employee_id}:`, error);
                    continue;
                }
            }

            if (records.length === 0) {
                return res.status(404).json({ 
                    message: 'No payroll records could be generated. Please check if all employees have valid position information.'
                });
            }

            await HRModel.insertPayrollRecords(records);
            
            res.json({ 
                message: `Payroll generated successfully for ${period === 'first' ? '1st to 15th' : '16th to 30th/31st'} of ${new Date(yearNum, monthNum - 1).toLocaleString('default', { month: 'long' })}`,
                payroll: records 
            });
        } catch (err) {
            console.error('Error in generatePayroll:', err);
            res.status(500).json({ 
                message: 'Failed to generate payroll. Please try again later.',
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    },

    getPendingPayroll: async (req, res) => {
        try {
            const rows = await HRModel.getPendingPayroll();  // Get the data from the model

            // Return empty array instead of 404 error
            res.json({ payroll: rows || [] });
        } catch (err) {
            console.error('Error fetching pending payroll:', err);
            res.status(500).json({ message: 'Internal server error' });
        }
    }, 
    getAcceptPayroll: async (req, res) => {
        try {
            const rows = await HRModel.getAcceptPayroll();  // Get the data from the model

            // Return empty array instead of 404 error
            res.json({ payroll: rows || [] });
        } catch (err) {
            console.error('Error fetching approved payroll:', err);
            res.status(500).json({ message: 'Internal server error' });
        }
    }, 

    approveOrRejectPayroll: async (req, res) => {
        try {
            const { payrollId, status, remarks } = req.body;
    
            if (!['approved', 'rejected'].includes(status)) {
                return res.status(400).json({ message: 'Invalid status' });
            }
    
            // If approved, set remarks to NULL
            const finalRemarks = status === 'approved' ? null : remarks || 'No remarks provided';
    
            await HRModel.updatePayrollStatus(payrollId, status, finalRemarks);
            res.json({ message: `Payroll ${status} successfully.` });
        } catch (err) {
            console.error('Error in approveOrRejectPayroll:', err);
            res.status(500).json({ message: 'Internal server error' });
        }
    },
    // Controller to fetch all deductions
    getAllDeductions: async (req, res) => {
        try {
            const deductions = await HRModel.getAllDeductions();
            res.json({ deductions });
        } catch (err) {
            console.error('Error fetching deductions:', err);
            res.status(500).json({ message: 'Internal server error' });
        }
    },
    // HR Controller: Update Deduction
    updateDeduction: async (req, res) => {
        try {
            const { id, deduction_type, salary_min, salary_max, employee_percentage, employer_percentage } = req.body;

            // Validate required fields
            if (!id || !deduction_type || !salary_min || !salary_max || !employee_percentage || !employer_percentage) {
                return res.status(400).json({ error: 'All fields are required' });
            }

            // Validate percentages are not negative
            if (employee_percentage < 0 || employer_percentage < 0) {
                return res.status(400).json({ error: 'Percentages cannot be negative' });
            }

            // Validate salary range
            if (parseFloat(salary_min) >= parseFloat(salary_max)) {
                return res.status(400).json({ error: 'Minimum salary must be less than maximum salary' });
            }

            const result = await HRModel.updateDeduction(
                id,
                deduction_type,
                salary_min,
                salary_max,
                employee_percentage,
                employer_percentage
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Deduction not found' });
            }

            res.json({ message: 'Deduction updated successfully' });
        } catch (error) {
            console.error('Error updating deduction:', error);
            res.status(500).json({ error: 'Failed to update deduction' });
        }
    },
    // Add new deduction
    addDeduction: async (req, res) => {
        try {
            const { deduction_type, salary_min, salary_max, employee_percentage, employer_percentage } = req.body;

            // Validate required fields
            if (!deduction_type || !salary_min || !salary_max || !employee_percentage || !employer_percentage) {
                return res.status(400).json({ error: 'All fields are required' });
            }

            // Validate percentages are not negative
            if (employee_percentage < 0 || employer_percentage < 0) {
                return res.status(400).json({ error: 'Percentages cannot be negative' });
            }

            // Validate salary range
            if (parseFloat(salary_min) >= parseFloat(salary_max)) {
                return res.status(400).json({ error: 'Minimum salary must be less than maximum salary' });
            }

            const result = await HRModel.addDeduction(
                deduction_type,
                salary_min,
                salary_max,
                employee_percentage,
                employer_percentage
            );

            res.status(201).json({
                message: 'Deduction added successfully',
                id: result.insertId
            });
        } catch (error) {
            console.error('Error adding deduction:', error);
            res.status(500).json({ error: 'Failed to add deduction' });
        }
    },

    // Delete deduction
    deleteDeduction: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await HRModel.deleteDeduction(id);

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Deduction not found' });
            }

            res.json({ message: 'Deduction deleted successfully' });
        } catch (err) {
            console.error('Error deleting deduction:', err);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Add this new controller function
    cancelPayroll: async (req, res) => {
        try {
            console.log('Cancelling all pending payroll records...');
            const affectedRows = await HRModel.cancelPendingPayroll();
            
            console.log(`Successfully cancelled ${affectedRows} payroll records`);
            res.json({ 
                message: `Successfully cancelled ${affectedRows} payroll records`,
                cancelledCount: affectedRows
            });
        } catch (error) {
            console.error('Error in cancelPayroll:', error);
            res.status(500).json({ 
                message: 'Failed to cancel payroll records',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Get a single deduction by ID
    getDeductionById: async (req, res) => {
        try {
            const { id } = req.params;
            const deduction = await HRModel.getDeductionById(id);
            
            if (!deduction) {
                return res.status(404).json({ error: 'Deduction not found' });
            }
            
            res.json(deduction);
        } catch (error) {
            console.error('Error getting deduction:', error);
            res.status(500).json({ error: 'Failed to get deduction' });
        }
    },

    // Archive a deduction
    archiveDeduction: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await HRModel.archiveDeduction(id);

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Deduction not found' });
            }

            res.json({ message: 'Deduction archived successfully' });
        } catch (error) {
            console.error('Error archiving deduction:', error);
            res.status(500).json({ error: 'Failed to archive deduction' });
        }
    },

    // Restore a deduction
    restoreDeduction: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await HRModel.restoreDeduction(id);

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Deduction not found' });
            }

            res.json({ message: 'Deduction restored successfully' });
        } catch (error) {
            console.error('Error restoring deduction:', error);
            res.status(500).json({ error: 'Failed to restore deduction' });
        }
    },

    markAbsences: async (req, res) => {
        try {
            const { date } = req.body;
            if (!date) {
                return res.status(400).json({ error: 'Date is required' });
            }

            const result = await HRModel.markAbsences(date);
            if (result.success) {
                res.json({ message: 'Absences marked successfully' });
            } else {
                res.status(500).json({ error: result.error || 'Failed to mark absences' });
            }
        } catch (error) {
            console.error('Error marking absences:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Update employee contact information
    updateEmployeeContact: async (req, res) => {
        try {
            const employeeId = req.params.id;
            const contactData = req.body;

            // Validate required fields
            const requiredFields = ['birthday', 'address', 'contact', 'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone'];
            const missingFields = requiredFields.filter(field => !contactData[field]);
            
            if (missingFields.length > 0) {
                return res.status(400).json({ 
                    error: `Missing required fields: ${missingFields.join(', ')}` 
                });
            }

            // Validate date format for birthday
            const birthdayDate = new Date(contactData.birthday);
            if (isNaN(birthdayDate.getTime())) {
                return res.status(400).json({ error: "Invalid birthday date format" });
            }

            // Validate phone number format (basic validation)
            const phoneRegex = /^[0-9+\-\s()]{10,15}$/;
            if (!phoneRegex.test(contactData.contact) || !phoneRegex.test(contactData.emergency_contact_phone)) {
                return res.status(400).json({ error: "Invalid phone number format" });
            }

            // Update the contact information
            const updatedEmployee = await HRModel.updateEmployeeContact(employeeId, contactData);
            
            res.status(200).json({ 
                message: "Contact information updated successfully",
                employee: updatedEmployee
            });

        } catch (error) {
            console.error("❌ Error updating employee contact:", error);
            if (error.message === "Employee not found") {
                return res.status(404).json({ error: "Employee not found" });
            }
            res.status(500).json({ error: "Failed to update contact information" });
        }
    },

    // Update security questions
    updateSecurityQuestions: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: "Unauthorized: No session found" });
            }

            const userId = req.session.user.id;
            const questions = req.body;

            // Validate required fields
            const requiredFields = ['question1', 'answer1', 'question2', 'answer2', 'question3', 'answer3'];
            const missingFields = requiredFields.filter(field => !questions[field]);
            
            if (missingFields.length > 0) {
                return res.status(400).json({ 
                    error: `Missing required fields: ${missingFields.join(', ')}` 
                });
            }

            // Validate that all questions are different
            const selectedQuestions = new Set([
                questions.question1,
                questions.question2,
                questions.question3
            ]);

            if (selectedQuestions.size !== 3) {
                return res.status(400).json({ 
                    error: "Please select different questions for each security question" 
                });
            }

            await HRModel.updateSecurityQuestions(userId, questions);
            res.json({ message: "Security questions updated successfully" });
        } catch (error) {
            console.error("❌ Error updating security questions:", error);
            res.status(500).json({ error: "Failed to update security questions" });
        }
    },

    // Get security questions
    getSecurityQuestions: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: "Unauthorized: No session found" });
            }

            const userId = req.session.user.id;
            const questions = await HRModel.getSecurityQuestions(userId);
            res.json(questions);
        } catch (error) {
            console.error("❌ Error fetching security questions:", error);
            res.status(500).json({ error: "Failed to fetch security questions" });
        }
    },

    // Verify security questions (for password reset or account recovery)
    verifySecurityQuestions: async (req, res) => {
        try {
            const { userId, answers } = req.body;

            if (!userId || !answers || typeof answers !== 'object') {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid input: userId and answers are required'
                });
            }

            const isValid = await HRModel.verifySecurityAnswers(userId, answers);

            res.json({
                success: true,
                verified: isValid
            });
        } catch (error) {
            console.error('Error in verifySecurityQuestions:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    },

    changePassword: async (req, res) => {
        try {
            // Verify session
            if (!req.session || !req.session.user || !req.session.user.id) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { currentPassword, newPassword } = req.body;

            // Validate input
            if (!currentPassword || !newPassword) {
                return res.status(400).json({ message: 'Current password and new password are required' });
            }

            // Validate password requirements
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
            if (!passwordRegex.test(newPassword)) {
                return res.status(400).json({ 
                    message: 'New password must be at least 8 characters long and contain uppercase, lowercase, number, and special character' 
                });
            }

            // Call model to change password
            await HRModel.changePassword(req.session.user.id, currentPassword, newPassword);

            res.json({ message: 'Password changed successfully' });
        } catch (error) {
            console.error('Error in changePassword controller:', error);
            if (error.message === 'Current password is incorrect') {
                return res.status(400).json({ message: error.message });
            }
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Upload profile picture
    uploadProfilePicture: async (req, res) => {
        upload(req, res, async function(err) {
            if (err instanceof multer.MulterError) {
                // A Multer error occurred when uploading
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'File size too large. Maximum size is 5MB.' });
                }
                return res.status(400).json({ error: err.message });
            } else if (err) {
                // An unknown error occurred
                return res.status(500).json({ error: err.message });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            try {
                const employeeId = req.params.id;
                // Store only the filename in the database, not the full path
                const imagePath = req.file.filename;
                console.log('Storing image path in database:', imagePath);
                
                // Update database with new image path
                await HRModel.updateProfilePicture(employeeId, imagePath);

                res.json({ 
                    message: 'Profile picture uploaded successfully',
                    imagePath: imagePath
                });
            } catch (error) {
                // If database update fails, delete the uploaded file
                if (req.file) {
                    fs.unlinkSync(req.file.path);
                }
                console.error('Error uploading profile picture:', error);
                res.status(500).json({ error: 'Failed to update profile picture' });
            }
        });
    },

    // Forgot Password Controller Functions
    verifyEmailForReset: async (req, res) => {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: 'Email is required'
                });
            }

            const result = await HRModel.getSecurityQuestionsByEmail(email);

            if (!result) {
                return res.status(404).json({
                    success: false,
                    message: 'Email not found or no security questions set'
                });
            }

            res.json({
                success: true,
                userId: result.userId,
                questions: result.questions
            });
        } catch (error) {
            console.error('Error in verifyEmailForReset:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    },

    verifySecurityQuestions: async (req, res) => {
        try {
            const { userId, answers } = req.body;

            if (!userId || !answers || typeof answers !== 'object') {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid input: userId and answers are required'
                });
            }

            const isValid = await HRModel.verifySecurityAnswers(userId, answers);

            res.json({
                success: true,
                verified: isValid
            });
        } catch (error) {
            console.error('Error in verifySecurityQuestions:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    },

    resetPassword: async (req, res) => {
        try {
            const { userId, newPassword } = req.body;

            if (!userId || !newPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'UserId and new password are required'
                });
            }

            // Validate password requirements
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
            if (!passwordRegex.test(newPassword)) {
                return res.status(400).json({
                    success: false,
                    message: 'Password does not meet requirements'
                });
            }

            const success = await HRModel.updateUserPassword(userId, newPassword);

            if (!success) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            res.json({
                success: true,
                message: 'Password reset successfully'
            });
        } catch (error) {
            console.error('Error in resetPassword:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    },

    // Leave Management Controllers
    getLeaveTypesWithBalances: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: "Unauthorized: No session found" });
            }

            const employeeId = req.session.user.employee_id;
            if (!employeeId) {
                return res.status(400).json({ error: "Employee ID not found in session" });
            }

            const leaveTypes = await HRModel.getLeaveTypesWithBalances(employeeId);
            res.json({ leaveTypes });
        } catch (error) {
            console.error("❌ Error in getLeaveTypesWithBalances controller:", error);
            res.status(500).json({ error: "Failed to fetch leave types and balances" });
        }
    },

    getEmployeeLeaveRequests: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: "Unauthorized: No session found" });
            }

            const employeeId = req.session.user.employee_id;
            if (!employeeId) {
                return res.status(400).json({ error: "Employee ID not found in session" });
            }

            const requests = await HRModel.getEmployeeLeaveRequests(employeeId);
            res.json({ requests });
        } catch (error) {
            console.error("❌ Error in getEmployeeLeaveRequests controller:", error);
            res.status(500).json({ error: "Failed to fetch leave requests" });
        }
    },

    applyForLeave: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: "Unauthorized: No session found" });
            }

            const { leaveTypeId, fromDate, toDate, reason } = req.body;
            const employeeId = req.session.user.employee_id;
            if (!employeeId) {
                return res.status(400).json({ error: "Employee ID not found in session" });
            }

            // Validate required fields
            if (!leaveTypeId || !fromDate || !toDate || !reason) {
                return res.status(400).json({ error: "All fields are required" });
            }

            // Validate dates
            const start = new Date(fromDate);
            const end = new Date(toDate);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return res.status(400).json({ error: "Invalid date format" });
            }
            if (start > end) {
                return res.status(400).json({ error: "Start date cannot be after end date" });
            }

            const result = await HRModel.applyForLeave(employeeId, leaveTypeId, fromDate, toDate, reason);
            res.status(201).json({ message: "Leave request submitted successfully", ...result });
        } catch (error) {
            console.error("❌ Error in applyForLeave controller:", error);
            if (error.message === 'Insufficient leave balance') {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to submit leave request" });
        }
    },

    cancelLeaveRequest: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: "Unauthorized: No session found" });
            }

            const { requestId } = req.params;
            const employeeId = req.session.user.employee_id;
            if (!employeeId) {
                return res.status(400).json({ error: "Employee ID not found in session" });
            }

            const result = await HRModel.cancelLeaveRequest(requestId, employeeId);
            res.json({ message: "Leave request cancelled successfully", ...result });
        } catch (error) {
            console.error("❌ Error in cancelLeaveRequest controller:", error);
            if (error.message === 'Leave request not found or cannot be cancelled') {
                return res.status(404).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to cancel leave request" });
        }
    },

    // Restore a leave request
    restoreLeaveRequest: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: "Unauthorized: No session found" });
            }

            const { requestId } = req.params;
            if (!requestId) {
                return res.status(400).json({ error: "Request ID is required" });
            }

            const result = await HRModel.restoreLeaveRequest(requestId);
            res.json({ message: "Leave request restored successfully", ...result });
        } catch (error) {
            console.error("❌ Error in restoreLeaveRequest controller:", error);
            if (error.message === 'Leave request not found or not in cancelled status') {
                return res.status(404).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to restore leave request" });
        }
    },

    // Permanently delete a leave request
    permanentlyDeleteLeaveRequest: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: "Unauthorized: No session found" });
            }

            const { requestId } = req.params;
            if (!requestId) {
                return res.status(400).json({ error: "Request ID is required" });
            }

            const result = await HRModel.permanentlyDeleteLeaveRequest(requestId);
            res.json({ message: "Leave request permanently deleted successfully", ...result });
        } catch (error) {
            console.error("❌ Error in permanentlyDeleteLeaveRequest controller:", error);
            if (error.message === 'Leave request not found') {
                return res.status(404).json({ error: error.message });
            }
            if (error.message === 'Only cancelled or rejected leave requests can be permanently deleted') {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to permanently delete leave request" });
        }
    },

    // Work Adjustment Controller Functions
    getAllWorkAdjustments: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const employeeId = req.params.employeeId;
            if (!employeeId) {
                return res.status(400).json({ error: 'Employee ID is required' });
            }

            const requests = await HRModel.getAllWorkAdjustments(employeeId);
            res.json({ requests });
        } catch (error) {
            console.error('Error fetching work adjustments:', error);
            res.status(500).json({ error: 'Failed to fetch work adjustments' });
        }
    },

    requestHalfDay: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const employeeId = req.params.employeeId;
            const { requestDate, timeSlot, remarks } = req.body;

            if (!employeeId || !requestDate || !timeSlot || !remarks) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const result = await HRModel.requestHalfDay(employeeId, requestDate, timeSlot, remarks);
            res.json(result);
        } catch (error) {
            console.error('Error submitting half-day request:', error);
            res.status(500).json({ error: error.message || 'Failed to submit half-day request' });
        }
    },

    requestOvertime: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const employeeId = req.params.employeeId;
            const { requestDate, overtimeHours, remarks } = req.body;

            if (!employeeId || !requestDate || !overtimeHours || !remarks) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const result = await HRModel.requestOvertime(employeeId, requestDate, overtimeHours, remarks);
            res.json(result);
        } catch (error) {
            console.error('Error submitting overtime request:', error);
            res.status(500).json({ error: error.message || 'Failed to submit overtime request' });
        }
    },

    cancelWorkAdjustment: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { requestId, employeeId } = req.params;
            if (!requestId || !employeeId) {
                return res.status(400).json({ error: 'Request ID and Employee ID are required' });
            }

            const result = await HRModel.cancelWorkAdjustment(requestId, employeeId);
            res.json(result);
        } catch (error) {
            console.error('Error cancelling work adjustment:', error);
            res.status(500).json({ error: error.message || 'Failed to cancel work adjustment' });
        }
    },

    // Restore a work adjustment request
    restoreWorkAdjustment: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { requestId } = req.params;
            if (!requestId) {
                return res.status(400).json({ error: 'Request ID is required' });
            }

            const result = await HRModel.restoreWorkAdjustment(requestId);
            res.json({ message: "Work adjustment request restored successfully", ...result });
        } catch (error) {
            console.error('Error restoring work adjustment:', error);
            if (error.message === 'Work adjustment request not found or not in cancelled status') {
                return res.status(404).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to restore work adjustment request" });
        }
    },

    // Permanently delete a work adjustment request
    permanentlyDeleteWorkAdjustment: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { requestId } = req.params;
            if (!requestId) {
                return res.status(400).json({ error: 'Request ID is required' });
            }

            const result = await HRModel.permanentlyDeleteWorkAdjustment(requestId);
            res.json({ message: "Work adjustment request permanently deleted successfully", ...result });
        } catch (error) {
            console.error('Error permanently deleting work adjustment:', error);
            if (error.message === 'Work adjustment request not found') {
                return res.status(404).json({ error: error.message });
            }
            if (error.message === 'Only cancelled or rejected work adjustment requests can be permanently deleted') {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to permanently delete work adjustment request" });
        }
    },

    // Get user data including employee ID
    getUserData: async (req, res) => {
        try {
            // Check if user is authenticated
            if (!req.session || !req.session.user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            // Get employee ID directly from session
            const employeeId = req.session.user.employee_id;
            if (!employeeId) {
                return res.status(404).json({ error: 'Employee ID not found in session' });
            }

            // Return both IDs
            res.json({
                userId: req.session.user.id,
                employeeId: employeeId
            });
        } catch (error) {
            console.error("❌ Error in getUserData:", error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    getAllLeaveRequests: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const requests = await HRModel.getAllLeaveRequestsWithDetails();
            res.json(requests);
        } catch (error) {
            console.error('Error getting all leave requests:', error);
            // Log the full error details
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                sqlMessage: error.sqlMessage,
                sql: error.sql
            });
            res.status(500).json({ 
                error: 'Failed to fetch leave requests',
                details: error.sqlMessage || error.message 
            });
        }
    },

    getAllWorkAdjustmentRequests: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const requests = await HRModel.getAllWorkAdjustmentRequestsWithDetails();
            res.json(requests);
        } catch (error) {
            console.error('Error getting all work adjustment requests:', error);
            // Log the full error details
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                sqlMessage: error.sqlMessage,
                sql: error.sql
            });
            res.status(500).json({ 
                error: 'Failed to fetch work adjustment requests',
                details: error.sqlMessage || error.message 
            });
        }
    },

    // Get dashboard KPI counts
    getDashboardKPIs: async (req, res) => {
        try {
            const [
                totalEmployees,
                newHires,
                pendingLeaveRequests,
                totalPendingApprovals
            ] = await Promise.all([
                HRModel.getTotalActiveEmployees(),
                HRModel.getNewHiresCount(),
                HRModel.getPendingLeaveRequestsCount(),
                HRModel.getTotalPendingApprovalsCount()
            ]);

            res.json({
                totalEmployees,
                newHires,
                pendingLeaveRequests,
                totalPendingApprovals
            });
        } catch (error) {
            console.error('Error getting dashboard KPIs:', error);
            res.status(500).json({ error: 'Failed to fetch dashboard KPIs' });
        }
    },

    // Developer Management Controllers
    getPendingDevelopers: async (req, res) => {
        try {
            const developers = await HRModel.getPendingDevelopers();
            res.json(developers);
        } catch (error) {
            console.error('Error fetching pending developers:', error);
            res.status(500).json({ error: 'Failed to fetch pending developers' });
        }
    },

    getDeveloperById: async (req, res) => {
        try {
            const { id } = req.params;
            const developer = await HRModel.getDeveloperById(id);
            
            if (!developer) {
                return res.status(404).json({ error: 'Developer not found' });
            }
            
            res.json(developer);
        } catch (error) {
            console.error('Error fetching developer details:', error);
            res.status(500).json({ error: 'Failed to fetch developer details' });
        }
    },

    approveDeveloper: async (req, res) => {
        try {
            const { id } = req.params;
            const developer = await HRModel.getDeveloperById(id);
            
            if (!developer) {
                return res.status(404).json({ error: 'Developer not found' });
            }
            
            if (developer.status !== 'pending') {
                return res.status(400).json({ error: 'Developer is not in pending status' });
            }
            
            await HRModel.approveDeveloper(id);
            res.json({ message: 'Developer approved successfully' });
        } catch (error) {
            console.error('Error approving developer:', error);
            res.status(500).json({ error: 'Failed to approve developer' });
        }
    },

    rejectDeveloper: async (req, res) => {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            
            if (!reason) {
                return res.status(400).json({ error: 'Rejection reason is required' });
            }
            
            const developer = await HRModel.getDeveloperById(id);
            
            if (!developer) {
                return res.status(404).json({ error: 'Developer not found' });
            }
            
            if (developer.status !== 'pending') {
                return res.status(400).json({ error: 'Developer is not in pending status' });
            }
            
            await HRModel.rejectDeveloper(id, reason);
            res.json({ message: 'Developer rejected successfully' });
        } catch (error) {
            console.error('Error rejecting developer:', error);
            res.status(500).json({ error: 'Failed to reject developer' });
        }
    }
};

module.exports = HRController;
