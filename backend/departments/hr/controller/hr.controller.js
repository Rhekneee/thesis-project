const nodemailer = require('nodemailer'); 
const HRModel = require("../model/hr.model");

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
    checkInAttendance: async (req, res) => {
        try {
            const userId = req.params.id;  // Get user_id from URL params
            const { checkInTime } = req.body;  // Check-in time passed in request body
            const date = new Date(checkInTime).toISOString().split('T')[0];  // Format the date as 'YYYY-MM-DD'

            // Call the HRModel to check in the user
            const result = await HRModel.checkIn(userId, checkInTime, date);

            if (result.error) {
                return res.status(400).json({ error: result.error });
            }
            res.status(200).json({ message: 'Check-in successful!' });
        } catch (error) {
            console.error("❌ Error during check-in:", error);
            return res.status(500).json({ error: "Failed to check in" });
        }
    },

    // Check-out attendance for the user
    checkOutAttendance: async (req, res) => {
        try {
            const userId = req.params.id;  // Get user_id from URL params
            const { checkOutTime } = req.body;  // Check-out time passed in request body
            const date = new Date(checkOutTime).toISOString().split('T')[0];  // Format the date as 'YYYY-MM-DD'

            // Call the HRModel to check out the user
            const result = await HRModel.checkOut(userId, checkOutTime, date);

            if (result.error) {
                return res.status(400).json({ error: result.error });
            }

            res.status(200).json({ message: 'Check-out successful!', result });
        } catch (err) {
            console.error("❌ Error during check-out:", err);
            res.status(500).json({ error: 'Failed to check out' });
        }
    },

    // Fetch today's attendance for the user
    getTodayAttendance: async (req, res) => {
        try {
            const userId = req.params.id;  // Get user_id from URL params
            const date = new Date().toISOString().split('T')[0];  // Get today's date (YYYY-MM-DD)

            // Call the HRModel to fetch the user's attendance for today
            const attendance = await HRModel.getTodayAttendance(userId, date);

            res.status(200).json(attendance);  // Return the attendance data
        } catch (err) {
            console.error('❌ Fetch attendance error:', err);
            res.status(500).json({ error: 'Failed to fetch attendance' });
        }
    },

    // Submit an early out request for the user
    requestEarlyOutRequest: async (req, res) => {
        try {
            const userId = req.params.id;  // Get user_id from URL params
            const { date, remarks } = req.body;  // Date and remarks passed in the request body

            if (!remarks || !date) {
                return res.status(400).json({ error: "Please provide both date and remarks for early out request." });
            }

            const result = await HRModel.requestEarlyOut(userId, date, remarks);
            res.status(200).json({ message: 'Early out request submitted successfully' });
        } catch (error) {
            console.error("❌ Error submitting early out request:", error);
            return res.status(500).json({ error: 'Failed to submit early out request' });
        }
    },

    // Submit a half-day request for the user
    requestHalfDayRequest: async (req, res) => {
        try {
            const userId = req.params.id;  // Get user_id from URL params
            const { date, remarks } = req.body;  // Date and remarks passed in the request body

            if (!remarks || !date) {
                return res.status(400).json({ error: "Please provide both date and remarks for half-day request." });
            }

            const result = await HRModel.requestHalfDay(userId, date, remarks);
            res.status(200).json({ message: 'Half day request submitted successfully' });
        } catch (error) {
            console.error("❌ Error submitting half day request:", error);
            return res.status(500).json({ error: 'Failed to submit half day request' });
        }
    },

    // Approve or reject the early out or half day request by HR
    approveRequest: async (req, res) => {
        try {
            const { requestId, requestType, isApproved } = req.body;  // Get request details and approval status

            // HR approves or rejects the request
            const result = await HRModel.approveRequest(req.params.id, requestId, requestType, isApproved);

            res.status(200).json({ message: 'Request approved/rejected successfully' });
        } catch (error) {
            console.error("❌ Error approving/rejecting request:", error);
            res.status(500).json({ error: 'Failed to approve/reject request' });
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
