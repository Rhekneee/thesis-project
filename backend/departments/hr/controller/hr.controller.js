const nodemailer = require('nodemailer'); 
const HRModel = require("../model/hr.model");
const moment = require('moment');


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

            const permissions = await HRModel.getAllPermissions();
            res.status(200).json({ employee, permissions });
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

        try {
            const result = await HRModel.checkIn(userId, checkInTime, date, userLat, userLng);
            if (result.error) {
                return res.status(400).json({ error: result.error });  // Send error back if validation fails
            }
            return res.status(200).json(result);  // Successful check-in response
        } catch (error) {
            return res.status(500).json({ error: 'Internal Server Error' });
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
        const userId = req.params.id;  // Get userId from the URL parameter
        const { date, remarks } = req.body;  // Get date and remarks from the request body
    
        console.log("Received Half-Day Request:", { userId, date, remarks });
    
        try {
            const result = await HRModel.requestHalfDay(userId, date, remarks);  // Use 'date' instead of 'requestDate'
            res.json({ success: true, message: "Half-day request submitted successfully." });
        } catch (error) {
            console.error('Error submitting half-day request:', error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    },
    

    // Handle Early-Out Request Submission
    requestEarlyOutRequest: async (req, res) => {
        const userId = req.params.id;  // Get userId from the URL parameter
        const { date, remarks } = req.body;  // Get date and remarks from the request body

        console.log("Received Early-Out Request:", { userId, date, remarks });  // Log the data for debugging

        try {
            // Call HRModel to process the early-out request
            const result = await HRModel.requestEarlyOut(userId, date, remarks);
            res.json({ success: true, message: "Early-out request submitted successfully." });
        } catch (error) {
            console.error('Error submitting early-out request:', error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    },

    requestOvertimeRequest: async (req, res) => {
        const userId = req.params.id;  // Get userId from the URL parameter
        const { date, remarks } = req.body;  // Get date and remarks from the request body
    
        console.log("Received Overtime Request:", { userId, date, remarks });  // Log the data for debugging
    
        try {
            // Call HRModel to process the overtime request
            const result = await HRModel.requestOvertime(userId, date, remarks);
            res.json({ success: true, message: "Overtime request submitted successfully." });
        } catch (error) {
            console.error('Error submitting overtime request:', error);
            res.status(500).json({ error: "Internal Server Error" });
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
        const { userId } = req.params;  // Get the userId from URL parameter
        try {
            const requests = await HRModel.getPendingRequestsByUserId(userId); // Fetch pending requests for specific user
            res.json({ requests });
        } catch (error) {
            console.error('Error fetching pending requests by userId:', error);
            res.status(500).json({ message: 'Failed to fetch pending requests by userId.' });
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

            // If the status is 'Ready for Interview', send an email notification
            if (status === 'Ready for Interview') {
                await sendEmailNotification(application.email, status);
            }

            res.status(200).json({ message: `Status updated to ${status}` });
        } catch (error) {
            console.error("Error updating application status:", error);
            res.status(500).json({ error: "Error updating application status" });
        }
    },
    generatePayroll: async (req, res) => {
        try {
          const { startDate, endDate } = req.body;
          const payrollDate = moment().format('YYYY-MM-DD');
    
          // 1) Fetch attendance → now correctly joins on user_id
          const emps = await HRModel.getEmployeesWithAttendance(startDate, endDate);
          if (!emps.length) {
            return res.status(404).json({ message: 'No attendance found for that period.' });
          }
    
          // 2) Build payroll records
          const records = [];
          for (let e of emps) {
            const dailyRate = e.fixed_salary / 22;
            const overtimeRate = (dailyRate / 8) * 1.25;
            const overtimePay = e.overtime_hours * overtimeRate;
            const salaryBeforeTax = (dailyRate * (e.total_hours / 8)) + overtimePay;

    
            // Get deduction percentages by salary range
            const dedRanges = await HRModel.getDeductionsBySalary(e.fixed_salary);
            let totalDed = 0;
            dedRanges.forEach(d => {
              totalDed += salaryBeforeTax * (d.employee_percentage / 100);
            });
    
            // Push record with status as 'pending' and the payroll_period
            records.push({  
              employee_id: e.employee_id,
              period_start: startDate,
              period_end: endDate,
              payroll_date: payrollDate,
              days_present:  e.days_present,   // Assuming 8 hours per work day
              total_hours: e.total_hours,
              overtime_hours: e.overtime_hours,
              fixed_salary: e.fixed_salary,               // store base salary 
              salary_before_tax: salaryBeforeTax,
              deductions: totalDed,
              net_pay: salaryBeforeTax - totalDed,
              payroll_period: `${startDate} to ${endDate}`,  // Payroll period in a readable format
              status: 'pending',  // Default status to 'pending'
            });
          }
    
          // 3) Insert batch into the payroll table
          await HRModel.insertPayrollRecords(records);
    
          // Respond with success message and the payroll records
          res.json({ message: 'Payroll generated successfully', payroll: records });
        } catch (err) {
          console.error('Error in generatePayroll:', err);
          res.status(500).json({ message: 'Internal server error' });
        }
      },

      getPendingPayroll: async (req, res) => {
        try {
            const rows = await HRModel.getPendingPayroll();  // Get the data from the model

            if (!rows || rows.length === 0) {
                return res.status(404).json({ message: 'No pending payroll found.' });
            }

            // If the rows are valid, send the response
            res.json({ payroll: rows });
        } catch (err) {
            console.error('Error fetching pending payroll:', err);
            res.status(500).json({ message: 'Internal server error' });
        }
    }, 
    getAcceptPayroll: async (req, res) => {
        try {
            const rows = await HRModel.getAcceptPayroll();  // Get the data from the model

            if (!rows || rows.length === 0) {
                return res.status(404).json({ message: 'No Approved payroll found.' });
            }

            // If the rows are valid, send the response
            res.json({ payroll: rows });
        } catch (err) {
            console.error('Error fetching pending payroll:', err);
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
            const deductions = await HRModel.getAllDeductions();  // Call the model function
            res.json({ deductions });  // Send the deductions data as response
        } catch (err) {
            console.error('Error fetching deductions:', err);
            res.status(500).json({ message: 'Internal server error' });
        }
    },
    // HR Controller: Update Deduction
updateDeduction: async (req, res) => {
    try {
        const { id, deduction_type, salary_min, salary_max, employee_percentage, employer_percentage } = req.body;

        // Validate input data
        if (!id || !deduction_type || !salary_min || !salary_max || !employee_percentage || !employer_percentage) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Call the model function to update the deduction in the database
        const result = await HRModel.updateDeduction(id, deduction_type, salary_min, salary_max, employee_percentage, employer_percentage);

        // If no rows were affected, return an error message
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Deduction not found' });
        }

        // If successful, return a success message
        res.json({ message: 'Deduction updated successfully', deduction: result });
    } catch (err) {
        console.error('Error updating deduction:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
},  

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
}

    
};

// Method to send an email notification to the applicant
const sendEmailNotification = async (applicantEmail, status) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'reneemadel15@gmail.com',  // Replace with your email
            pass: 'ldcp sknb lfuj kmlf',   // Replace with your email password
        },
    });

    const mailOptions = {
        from: 'reneemadel15@gmail.com',  // Replace with your email
        to: applicantEmail,
        subject: `Your application status has been updated to ${status}`,
        text: `Hello, your application status has been updated to ${status}. Please check your profile for more details.`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

module.exports = HRController;
