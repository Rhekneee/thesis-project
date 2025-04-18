const HRModel = require("../model/hr.model");

const HRController = {
    // 🔹 Add a new employee (Manager Only)
        addEmployee: async (req, res) => {
            try {
                console.log("🔹 Received Request Body:", req.body);

                if (!req.session?.user) {
                    return res.status(401).json({ error: "Unauthorized: No session found" });
                }

                const role = req.session.user.role_name;
                if (role !== "office_administrator") {
                    return res.status(403).json({ error: "Forbidden: Only Admin Staff can add employees" });
                }

                const {
                    email, full_name, contact, address, birthday,
                    employment_status, educational_background, emergency_contact_name,
                    emergency_contact_relationship, emergency_contact_phone, role_id 
                } = req.body;            

                if (!email || !full_name || !contact || !address || !birthday ||
                    !employment_status || !educational_background || !emergency_contact_name ||
                    !emergency_contact_relationship || !emergency_contact_phone || !role_id) {
                    return res.status(400).json({ error: "Missing required fields" });
                }

                // 🔍 Email Check
                const emailExists = await HRModel.checkEmployeeEmailExists(email);
                if (emailExists) {
                    return res.status(400).json({ error: "Employee with this email already exists" });
                }

                // 🔍 Permission Check
                const roleExists = await HRModel.getRoleById(role_id);
                if (!roleExists) {
                    return res.status(400).json({ error: "Invalid role ID provided" });
                }            

                console.log("🔹 Valid Permission ID:", role_id);

                let user_id = await HRModel.getUserIdByEmail(email);
                if (!user_id) {
                    console.log("🔹 Creating new user...");
                    user_id = await HRModel.createUser(email, role_id, full_name);
                }

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
                    emergency_contact_phone
                };

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
        console.log("🔹 Check-in triggered");

        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: "Unauthorized: No session found" });
            }

            const employeeId = req.session.user.employee_id;
            const { latitude, longitude } = req.body;

            if (!latitude || !longitude) {
                return res.status(400).json({ error: "Missing coordinates for attendance" });
            }

            await HRModel.recordAttendance(employeeId, latitude, longitude);
            res.status(200).json({ message: "Attendance recorded successfully" });

        } catch (error) {
            console.error("❌ Error during check-in:", error);
            res.status(500).json({ error: "Failed to record attendance" });
        }
    },

    // 🔹 Get today's attendance
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
