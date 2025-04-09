const HRModel = require("../model/hr.model");

const HRController = {
    // 🔹 Add a new employee (Manager Only)
    addEmployee: async (req, res) => {
        try {
            console.log("🔹 Received Request Body:", req.body);

            if (!req.session || !req.session.user) {
                return res.status(401).json({ error: "Unauthorized: No session found" });
            }

            console.log("🔹 Session User Role Name:", req.session.user.role_name);

            if (req.session.user.role_name !== "office_administrator") {
                return res.status(403).json({ error: "Forbidden: Only Admin Staff can add employees" });
            }

            const {
                email, full_name, contact, address, birthday,
                employment_status, educational_background, emergency_contact_name,
                emergency_contact_relationship, emergency_contact_phone, permission_id
            } = req.body;

            if (!email || !full_name || !contact || !address || !birthday ||
                !employment_status || !educational_background || !emergency_contact_name ||
                !emergency_contact_relationship || !emergency_contact_phone || !permission_id) {
                return res.status(400).json({ error: "Missing required fields" });
            }
            
            // 🔥 Check if employee email already exists
            const emailExists = await HRModel.checkEmployeeEmailExists(email);
            if (emailExists) {
                return res.status(400).json({ error: "Employee with this email already exists" });
            }

            let permissionExists = await HRModel.getPermissionById(permission_id);
            if (!permissionExists) {
                return res.status(400).json({ error: "Invalid permission ID provided" });
            }

            console.log("🔹 Valid Permission ID for New Employee:", permission_id);

            let user_id = await HRModel.getUserIdByEmail(email);
            console.log("🔹 Retrieved user_id:", user_id);

            if (!user_id) {
                console.log("🔹 User not found, creating a new user...");
                user_id = await HRModel.createUser(email, permission_id, full_name);
                console.log("✅ New user created with ID:", user_id);
            }

            // 🔥 Include email in employeeData
            const employeeData = {
                user_id,
                email,  // ✅ Add email here
                permission_id: parseInt(permission_id),
                full_name,
                contact,
                address,
                birthday,
                employment_status,
                educational_background,
                emergency_contact_name,
                emergency_contact_relationship,
                emergency_contact_phone,
            };

            console.log("🔹 Employee Data Before Insert:", employeeData);

            await HRModel.addEmployee(employeeData);

            res.status(201).json({ message: "Employee added successfully" });

        } catch (error) {
            console.error("❌ Error adding employee:", error);
            res.status(500).json({ success: false, message: "Failed to add employee" });
        }
    },
    
    getAllEmployees: async (req, res) => {
        try {
            const employees = await HRModel.getAllEmployees();
            res.json(employees);
        } catch (error) {
            console.error("❌ Error fetching employees:", error);
            res.status(500).json({ error: "Failed to fetch employees" });
        }
    },    

    // 🔹 Get all employees (Manager Only)
    getPermissions: async (req, res) => {
        try {
            const permissions = await HRModel.getAllPermissions();

            if (!permissions || permissions.length === 0) {
                return res.status(404).json({ error: "No roles found in the system" });
            }

            res.json(permissions); // Respond with only the role names
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch permissions" });
        }
    },
    getEmployeeDetails: async (req, res) => {
        try {
            const employeeId = req.params.id;
    
            // 🔹 Fetch employee details
            const employee = await HRModel.getEmployeeById(employeeId);
            if (!employee) {
                return res.status(404).json({ error: "Employee not found" });
            }
    
            // 🔹 Fetch all available permissions
            const permissions = await HRModel.getAllPermissions();
    
            res.status(200).json({ employee, permissions });
        } catch (error) {
            console.error("❌ Error fetching employee details:", error);
            res.status(500).json({ error: "Failed to fetch employee details" });
        }
    },
    updateEmployee: async (req, res) => {
        try {
            const employeeId = req.body.employeeId;
            console.log(`🔹 Updating Employee ID: ${employeeId}`);

            if (!req.session || !req.session.user) {
                return res.status(401).json({ error: "Unauthorized: No session found" });
            }

            if (req.session.user.role_name !== "office_administrator") {
                return res.status(403).json({ error: "Forbidden: Only Admin Staff can update employees" });
            }

            const {
                email, full_name, contact, address, birthday,
                employment_status, educational_background, emergency_contact_name,
                emergency_contact_relationship, emergency_contact_phone, permission_id
            } = req.body;

            const employeeExists = await HRModel.getEmployeeById(employeeId);
            if (!employeeExists) {
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
                permission_id
            });

            console.log("✅ Employee updated successfully:", updatedEmployee);
            res.status(200).json({ message: "Employee updated successfully", employee: updatedEmployee });

        } catch (error) {
            console.error("❌ Error updating employee:", error);
            res.status(500).json({ error: "Failed to update employee" });
        }
    },
    checkInAttendance: async (req, res) => {
        console.log("🔹 Check-in function triggered!");  // Add this line
        try {
            if (!req.session || !req.session.user) {
                console.log("❌ No session found!");
                return res.status(401).json({ error: "Unauthorized: No session found" });
            }
            
            const employeeId = req.session.user.employee_id;
            const { latitude, longitude } = req.body;
    
            console.log(`🔹 Employee ID: ${employeeId}`);
            console.log(`🔹 Received Location: lat=${latitude}, lng=${longitude}`);
    
            // Proceed with attendance logic...
        } catch (error) {
            console.error("❌ Error in check-in:", error);
            res.status(500).json({ error: "Failed to check in" });
        }
    },    

    // 🔹 Fetch today's attendance for an employee
    getTodayAttendance: async (req, res) => {
        try {
            const { employeeId } = req.params;
            const attendance = await HRModel.getTodayAttendance(employeeId);

            if (!attendance) {
                return res.status(404).json({ message: "No attendance record found for today." });
            }

            res.json(attendance);
        } catch (error) {
            console.error("❌ Error fetching today's attendance:", error);
            res.status(500).json({ error: "Failed to fetch attendance" });
        }
    }
    
};

module.exports = HRController;
