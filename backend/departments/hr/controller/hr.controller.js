const nodemailer = require('nodemailer'); 
const HRModel = require("../model/hr.model");
const moment = require('moment');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendEmailNotification, sendHireNotification, sendRejectNotification, sendSupplierAccountNotification, sendEmployeeAccountNotification, sendDeveloperApprovalNotification, sendOnboardingApprovalNotification } = require('../../../utils/emailService');
const Notifications = require('../../../models/notification.model');

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

// Configure multer for construction worker picture uploads
const constructionWorkerStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', '..', '..', 'uploads', 'construction_workers');
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename: construction-worker_timestamp.extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `construction-worker-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const constructionWorkerUpload = multer({
    storage: constructionWorkerStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        // Accept only image files (case-insensitive)
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
}).single('picture');

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

            // Check if the user exists, create user if not
            let user_id = await HRModel.getUserIdByEmail(email);
            console.log("🔹 Checking if user exists for email:", email, "User ID found:", user_id);
            
            let tempPassword = null;
            if (!user_id) {
                console.log("🔹 Creating new user with onboarding pending status:", full_name);
                console.log("🔹 Role ID:", role_id, "Type:", typeof role_id);
                try {
                    // Use createUserWithOnboardingPending to set onboarding_completed = 0
                    const userResult = await HRModel.createUserWithOnboardingPending(email, role_id, nextEmployeeId);
                    user_id = userResult.userId;
                    tempPassword = userResult.tempPassword;
                    console.log("✅ User created successfully with onboarding pending, ID:", user_id);
                    
                    // Verify the user was actually created
                    const verifyUser = await HRModel.getUserIdByEmail(email);
                    if (!verifyUser) {
                        throw new Error("User creation verification failed");
                    }
                    console.log("✅ User creation verified, User ID:", verifyUser);
                } catch (error) {
                    console.error("❌ Error creating user:", error);
                    console.error("❌ Error details:", {
                        message: error.message,
                        stack: error.stack,
                        sqlMessage: error.sqlMessage,
                        code: error.code
                    });
                    throw new Error("Failed to create user account: " + error.message);
                }
            } else {
                console.log("🔹 User already exists with ID:", user_id);
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
            
            // Send email notification with temporary credentials if new user was created
            if (tempPassword) {
                try {
                    await sendEmployeeAccountNotification(
                        email,
                        email, // Use email as login credential for onboarding
                        tempPassword,
                        'https://mdb-construction-25b433e6e5d5.herokuapp.com/'
                    );
                    console.log("✅ Temporary account email sent successfully");
                } catch (emailError) {
                    console.error("❌ Error sending email notification:", emailError);
                    // Don't fail the entire operation if email fails
                }
            }
            
            res.status(201).json({ 
                message: "Employee added successfully", 
                ...result,
                tempCredentials: tempPassword ? {
                    username: email,
                    password: tempPassword,
                    loginUrl: 'https://mdb-construction-25b433e6e5d5.herokuapp.com/'
                } : null
            });
    
        } catch (error) {
            console.error("❌ Error adding employee:", error);
            res.status(500).json({ message: "Failed to add employee" });
        }
    },

    // 🔹 Update employee role (from edit modal)
    updateEmployeeRole: async (req, res) => {
        try {
            const { id, role_name, salary, department_id } = req.body;
            if (!id) return res.status(400).json({ error: 'Missing role id' });
            await HRModel.updateEmployeeRole({ id, role_name, salary, department_id });
            res.json({ success: true });
        } catch (e) {
            console.error('❌ updateEmployeeRole failed:', e);
            res.status(500).json({ error: 'Failed to update role' });
        }
    },

    // 🔹 Update construction role (from edit modal)
    updateConstructionRole: async (req, res) => {
        try {
            const { id, role_name, daily_rate, department_id } = req.body;
            if (!id) return res.status(400).json({ error: 'Missing construction role id' });
            await HRModel.updateConstructionRole({ id, role_name, daily_rate, department_id });
            res.json({ success: true });
        } catch (e) {
            console.error('❌ updateConstructionRole failed:', e);
            res.status(500).json({ error: 'Failed to update construction role' });
        }
    },
    // 🔹 Get departments for dropdown
    getDepartments: async (req, res) => {
        try {
            const rows = await HRModel.getAllDepartments();
            res.json(rows);
        } catch (e) {
            console.error('❌ getDepartments failed:', e);
            res.status(500).json({ error: 'Failed to fetch departments' });
        }
    },

    // Check payroll status for role changes effectiveness
    checkPayrollStatus: async (req, res) => {
        try {
            const payrollStatus = await HRModel.checkPayrollStatus();
            res.json(payrollStatus);
        } catch (error) {
            console.error("❌ [checkPayrollStatus] Error checking payroll status:", error.message || error);
            res.status(500).json({ error: "Failed to check payroll status" });
        }
    },

    // Get all documents with status 'uploaded' (pending verification)
    getAllPendingOnboardingDocuments: async (req, res) => {
        try {
            if (process.env.NODE_ENV === 'development') console.debug('🔍 HR Controller: getAllPendingOnboardingDocuments called');
            const rows = await HRModel.getPendingOnboardingDocuments();
            if (process.env.NODE_ENV === 'development') console.debug('🔍 HR Controller: pending docs count =', rows.length);
            res.json({ success: true, documents: rows });
        } catch (error) {
            console.error('❌ HR Controller: Error getting pending onboarding documents:', error);
            res.status(500).json({ success: false, error: 'Failed to get pending onboarding documents' });
        }
    },

    // 🔹 Complete onboarding for an employee
    completeOnboarding: async (req, res) => {
        try {
            const { userId, employeeId } = req.body;

            if (!userId || !employeeId) {
                return res.status(400).json({ error: "User ID and Employee ID are required" });
            }

            // Complete onboarding in the model
            await HRModel.completeOnboarding(userId, employeeId);

            res.status(200).json({ 
                message: "Onboarding completed successfully",
                permanentUsername: employeeId
            });
        } catch (error) {
            console.error("❌ Error completing onboarding:", error);
            res.status(500).json({ error: "Failed to complete onboarding" });
        }
    },

    // 🔹 Submit all onboarding documents at once
    submitAllOnboardingDocuments: async (req, res) => {
        try {
            const { employeeId } = req.body;
            
            if (!employeeId) {
                return res.status(400).json({ error: "Employee ID is required" });
            }

            // Get all uploaded files
            const files = req.files || [];
            
            if (files.length === 0) {
                return res.status(400).json({ error: "No files uploaded" });
            }

            // Process each file
            const uploadResults = [];
            
            for (const file of files) {
                try {
                    // Get document type from field name
                    const documentType = file.fieldname;
                    
                    // Save file info to database
                    const result = await HRModel.uploadOnboardingDocument(
                        employeeId,
                        documentType,
                        file.filename,
                        file.originalname,
                        file.size,
                        file.mimetype
                    );
                    
                    uploadResults.push({
                        documentType,
                        success: true,
                        filename: file.filename
                    });
                    
                } catch (error) {
                    console.error(`Error uploading ${file.fieldname}:`, error);
                    uploadResults.push({
                        documentType: file.fieldname,
                        success: false,
                        error: error.message
                    });
                }
            }

            // Check if all uploads were successful
            const failedUploads = uploadResults.filter(result => !result.success);
            
            if (failedUploads.length > 0) {
                return res.status(500).json({ 
                    error: "Some files failed to upload",
                    details: failedUploads
                });
            }

            res.status(200).json({ 
                message: "All documents uploaded successfully",
                uploadedDocuments: uploadResults.length
            });

        } catch (error) {
            console.error("❌ Error submitting onboarding documents:", error);
            res.status(500).json({ error: "Failed to submit onboarding documents" });
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

    // 🔹 Get all construction roles with basic salary information
    getConstructionRoles: async (req, res) => {
        try {
            const constructionRoles = await HRModel.getAllConstructionRoles();

            if (!constructionRoles || constructionRoles.length === 0) {
                console.warn("⚠️ [getConstructionRoles] No construction roles found in the system.");
                return res.status(404).json({ error: "No construction roles found in the system" });
            }

            res.json(constructionRoles);
        } catch (error) {
            console.error("❌ [getConstructionRoles] Error fetching construction roles:", error.message || error);
            res.status(500).json({ error: "Failed to fetch construction roles" });
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
        return await HRModel.getAllPermissions();
    },

    // 🔹 Enroll employee face (upload image → call Face API → store encoding)
    enrollEmployeeFace: async (req, res) => {
        try {
            const employeeId = req.params.employeeId;

            if (!employeeId) {
                return res.status(400).json({ error: 'employeeId is required' });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No image file uploaded' });
            }

            // Ensure employee exists
            const employee = await HRModel.getEmployeeById(employeeId);
            if (!employee) {
                return res.status(404).json({ error: 'Employee not found' });
            }

            // Call Face API service to extract encoding
            const faceService = require('../../../utils/faceService');
            const encoding = await faceService.extractEncodingFromImage(req.file.path);

            if (!encoding || (Array.isArray(encoding) && encoding.length === 0)) {
                return res.status(422).json({ error: 'No face detected or encoding failed' });
            }

            // Save to DB
            await HRModel.saveEmployeeFace(employeeId, encoding);

            return res.status(200).json({ success: true, message: 'Face enrolled successfully' });
        } catch (error) {
            console.error('❌ Error enrolling employee face:', error);
            return res.status(500).json({ error: 'Failed to enroll employee face' });
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
   
    // Handle check-in
    checkInAttendance: async (req, res) => {
        const userId = req.params.id;
        const { date, checkInTime, userLat, userLng, facialVerification } = req.body;

        try {
            // Validate required fields
            if (!userId || !date || !checkInTime || userLat === undefined || userLng === undefined) {
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
                return res.status(400).json({ error: 'Invalid user ID format' });
            }

            // Validate coordinates
            if (isNaN(parseFloat(userLat)) || isNaN(parseFloat(userLng))) {
                return res.status(400).json({ error: 'Invalid coordinates' });
            }

            // Validate date format
            const dateObj = new Date(date);
            if (isNaN(dateObj.getTime())) {
                return res.status(400).json({ error: 'Invalid date format' });
            }

            // Validate check-in time format
            const timeObj = new Date(checkInTime);
            if (isNaN(timeObj.getTime())) {
                return res.status(400).json({ error: 'Invalid check-in time format' });
            }

            // ===== COMMENTED OUT: Facial Recognition Logic =====
            // if (req.file && (req.file.buffer || req.file.path)) {
            //     try {
            //         const faceService = require('../../../utils/faceService');
            //         const encoding = await faceService.extractEncodingFromImage(req.file.buffer || req.file.path);
            //         if (!encoding || (Array.isArray(encoding) && encoding.length === 0)) {
            //             return res.status(400).json({ error: 'Face not detected' });
            //         }
            //         const db = require('../../../db');
            //         const [empRows] = await db.query('SELECT employee_id FROM employees WHERE user_id = ?', [userId]);
            //         if (!empRows || empRows.length === 0) {
            //             return res.status(404).json({ error: 'Employee record not found for user' });
            //         }
            //         const employeeId = empRows[0].employee_id;
            //         const [faces] = await db.query('SELECT face_encoding FROM employee_faces WHERE employee_id = ?', [employeeId]);
            //         if (!faces || faces.length === 0) {
            //             return res.status(401).json({ error: 'No enrolled face found. Please register facial data first.' });
            //         }
            //         const toArray = (v) => Array.isArray(v) ? v : (typeof v === 'string' ? JSON.parse(v) : null);
            //         const cosSim = (a, b) => {
            //             if (!a || !b || a.length !== b.length) return -1;
            //             let dot = 0, na = 0, nb = 0;
            //             for (let i = 0; i < a.length; i++) {
            //                 dot += a[i] * b[i];
            //                 na += a[i] * a[i];
            //                 nb += b[i] * b[i];
            //             }
            //             na = Math.sqrt(na); nb = Math.sqrt(nb);
            //             return na > 0 && nb > 0 ? dot / (na * nb) : -1;
            //         };
            //         const matched = faces.some(row => {
            //             const stored = toArray(row.face_encoding);
            //             return cosSim(stored, encoding) >= 0.85;
            //         });
            //         if (!matched) {
            //             return res.status(401).json({ error: 'Face verification failed' });
            //         }
            //     } catch (err) {
            //         console.error('❌ Facial verification error:', err);
            //         return res.status(400).json({ error: 'Facial verification error' });
            //     }
            // }

            // ===== COMMENTED OUT: Facial Verification Flow =====
            // Facial verification routes and logic have been commented out
            
            // First, perform check-in (this will handle radius check and all validations)
            const result = await HRModel.checkIn(userId, checkInTime, date, userLat, userLng);
            
            if (result.error) {
                return res.status(400).json({ error: result.error });
            }
            
            // After successful check-in, save the photo if image was provided
            if (req.file && (req.file.buffer || req.file.path)) {
                try {
                    const db = require('../../../db');
                    const fs = require('fs');
                    const path = require('path');
                    
                    // Create uploads/attendance_photos directory if it doesn't exist
                    const uploadDir = path.join(__dirname, '../../../uploads/attendance_photos');
                    if (!fs.existsSync(uploadDir)) {
                        fs.mkdirSync(uploadDir, { recursive: true });
                    }
                    
                    // Generate unique filename
                    const timestamp = Date.now();
                    const filename = `attendance_${userId}_${timestamp}.jpg`;
                    const filePath = path.join(uploadDir, filename);
                    
                    // Save image to disk
                    fs.writeFileSync(filePath, req.file.buffer);
                    
                    // Get the attendance_id from the check-in
                    const [attendanceRecord] = await db.query(
                        'SELECT attendance_id FROM attendance WHERE user_id = ? AND date = ? ORDER BY attendance_id DESC LIMIT 1',
                        [userId, date]
                    );
                    
                    if (attendanceRecord.length > 0) {
                        const attendanceId = attendanceRecord[0].attendance_id;
                        
                        // Save to attendance_photos table
                        await db.query(
                            'INSERT INTO attendance_photos (attendance_id, image_path) VALUES (?, ?)',
                            [attendanceId, `attendance_photos/${filename}`]
                        );
                    }
                    
                } catch (photoErr) {
                    // Log error but don't fail the check-in
                    console.error('Error saving attendance photo:', photoErr);
                }
            }

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

    // Handle facial verification for attendance
    verifyFaceForAttendance: async (req, res) => {
        const userId = req.params.userId;

        console.log('📝 Facial verification request received for user:', userId);

        try {
            if (!req.file || (!req.file.buffer && !req.file.path)) {
                return res.status(400).json({ error: 'No image file provided' });
            }

            // Extract face encoding from uploaded image
            const faceService = require('../../../utils/faceService');
            const encoding = await faceService.extractEncodingFromImage(req.file.buffer || req.file.path);
            
            if (!encoding || (Array.isArray(encoding) && encoding.length === 0)) {
                return res.status(400).json({ error: 'Face not detected in image' });
            }

            // Fetch stored encodings for this user (by employee_id)
            const db = require('../../../db');
            const [empRows] = await db.query('SELECT employee_id FROM employees WHERE user_id = ?', [userId]);
            
            if (!empRows || empRows.length === 0) {
                return res.status(404).json({ error: 'Employee record not found for user' });
            }
            
            const employeeId = empRows[0].employee_id;
            const [faces] = await db.query('SELECT face_encoding FROM employee_faces WHERE employee_id = ?', [employeeId]);
            
            if (!faces || faces.length === 0) {
                return res.status(400).json({ 
                    error: 'No enrolled face found. Please contact HR to enroll your facial data first.',
                    code: 'NO_FACE_ENROLLED'
                });
            }

            // Compare encodings using cosine similarity
            const toArray = (v) => Array.isArray(v) ? v : (typeof v === 'string' ? JSON.parse(v) : null);
            const cosSim = (a, b) => {
                if (!a || !b || a.length !== b.length) return -1;
                let dot = 0, na = 0, nb = 0;
                for (let i = 0; i < a.length; i++) {
                    dot += a[i] * b[i];
                    na += a[i] * a[i];
                    nb += b[i] * b[i];
                }
                na = Math.sqrt(na); 
                nb = Math.sqrt(nb);
                return na > 0 && nb > 0 ? dot / (na * nb) : -1;
            };

            let bestMatch = 0;
            let matched = false;
            
            for (const row of faces) {
                const stored = toArray(row.face_encoding);
                const similarity = cosSim(stored, encoding);
                console.log('🔍 Face similarity score:', similarity);
                
                if (similarity > bestMatch) {
                    bestMatch = similarity;
                }
                
                // Set threshold to 0.03 for practical use (3% similarity required)
                if (similarity >= 0.03) {
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                console.log('❌ Face verification failed. Best match score:', bestMatch);
                let errorMessage = 'Face verification failed. ';
                
                if (bestMatch < 0.03) {
                    errorMessage += 'Face not recognized. Please ensure you are the enrolled employee and your face is clearly visible.';
                } else if (bestMatch < 0.1) {
                    errorMessage += 'Face similarity is low. Please position your face directly in front of the camera with good lighting.';
                } else {
                    errorMessage += 'Face verification failed. Please try again or contact HR if this persists.';
                }
                
                return res.status(401).json({ 
                    error: errorMessage,
                    similarity: bestMatch,
                    code: 'FACE_MATCH_FAILED'
                });
            }

            console.log('✅ Facial verification successful for user:', userId);
            return res.status(200).json({ 
                success: true, 
                message: 'Face verified successfully' 
            });

        } catch (error) {
            console.error('❌ Error in facial verification:', error);
            return res.status(500).json({ error: 'Facial verification failed' });
        }
    },

    // Complete attendance after successful facial verification
    completeAttendanceAfterVerification: async (req, res) => {
        const userId = req.params.userId;
        const { date, checkInTime, userLat, userLng } = req.body;

        console.log('📝 Completing attendance after facial verification for user:', userId);

        try {
            // Validate required fields
            if (!userId || !date || !checkInTime || userLat === undefined || userLng === undefined) {
                return res.status(400).json({ 
                    error: 'Missing required fields for attendance completion'
                });
            }

            // Validate user ID format
            if (isNaN(parseInt(userId))) {
                return res.status(400).json({ error: 'Invalid user ID format' });
            }

            // Validate coordinates
            if (isNaN(parseFloat(userLat)) || isNaN(parseFloat(userLng))) {
                return res.status(400).json({ error: 'Invalid coordinates' });
            }

            // Validate date format
            const dateObj = new Date(date);
            if (isNaN(dateObj.getTime())) {
                return res.status(400).json({ error: 'Invalid date format' });
            }

            // Validate check-in time format
            const timeObj = new Date(checkInTime);
            if (isNaN(timeObj.getTime())) {
                return res.status(400).json({ error: 'Invalid check-in time format' });
            }

            // Now record the attendance (facial verification already completed)
            console.log('✅ Recording attendance after successful facial verification...');
            const result = await HRModel.checkIn(userId, checkInTime, date, userLat, userLng);
            
            if (result.error) {
                console.log('❌ Attendance recording failed:', result.error);
                return res.status(400).json({ error: result.error });
            }

            console.log('✅ Attendance recorded successfully after facial verification');
            return res.status(200).json(result);

        } catch (error) {
            console.error('❌ Error completing attendance after verification:', error);
            return res.status(500).json({ 
                error: 'Failed to complete attendance',
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
        const { id, status, remarks } = req.body; // Get the ID, status, and remarks from the request body
        try {
            // Validate the status value
            if (!['Pending', 'Ready for Interview', 'Accepted', 'Rejected'].includes(status)) {
                return res.status(400).json({ error: "Invalid status value" });
            }

            // If status is Rejected, remarks are required
            if (status === 'Rejected' && (!remarks || remarks.trim() === '')) {
                return res.status(400).json({ error: "Remarks are required when rejecting an application" });
            }

            // Update the status in the database (with remarks if provided)
            await HRModel.updateApplicationStatus(id, status, remarks || null);

            // Fetch the applicant's details using the ID
            const application = await HRModel.getApplicationById(id);

            // --- NEW: Auto-create user and employee on hire ---
            if (status === 'Accepted' && application) {
                // 1. Generate employee_id first (needed for username)
                const year = new Date().getFullYear();
                const lastEmployee = await HRModel.getLastEmployeeId();
                const lastEmployeeId = lastEmployee ? lastEmployee.employee_id : null;
                let nextEmployeeId;
                if (lastEmployeeId) {
                    nextEmployeeId = `${year}-${(parseInt(lastEmployeeId.split('-')[1]) + 1).toString().padStart(4, '0')}`;
                } else {
                    nextEmployeeId = `${year}-1000`;
                }

                // 2. Use application's role_id
                const roleId = application.role_id;

                // 3. Check if user already exists
                let user_id = await HRModel.getUserIdByEmail(application.email);
                let isNewUser = false;
                let tempPassword = null;
                if (!user_id) {
                    // Create user with email as temporary username and random password
                    const userResult = await HRModel.createUserWithOnboardingPending(application.email, roleId, nextEmployeeId);
                    user_id = userResult.userId;
                    tempPassword = userResult.tempPassword;
                    isNewUser = true;
                }

                // 4. Prepare employee data (fill missing fields with defaults)
                const employeeData = {
                    user_id,
                    email: application.email,
                    role_id: roleId,
                    full_name: application.full_name,
                    contact: application.phone || '',
                    address: '',
                    birthday: application.birthdate || null,
                    employment_status: 'Full-time', // Default to Full-time for hired applicants
                    educational_background: '',
                    emergency_contact_name: '',
                    emergency_contact_relationship: '',
                    emergency_contact_phone: '',
                    employee_id: nextEmployeeId,
                };
                await HRModel.addEmployee(employeeData);

                // 6. Send credentials email to the applicant (employee onboarding)
                if (tempPassword) {
                    await sendEmployeeAccountNotification(
                        application.email,
                        application.email, // Use email as login credential for onboarding
                        tempPassword,
                        'https://mdb-construction-25b433e6e5d5.herokuapp.com/'
                    );
                }

                // 5. Add credentials to response (like SCM)
                if (isNewUser && tempPassword) {
                    return res.status(200).json({
                        message: `Status updated to ${status}`,
                        tempCredentials: {
                            username: application.email,
                            password: tempPassword,
                            loginUrl: 'https://mdb-construction-25b433e6e5d5.herokuapp.com/'
                        }
                    });
                }
            }
            // --- END NEW ---

            // Send appropriate email notification
            if (status === 'Ready for Interview') {
                await sendEmailNotification(application.email, status);
            } else if (status === 'Accepted') {
                await sendHireNotification(application.email);
            } else if (status === 'Rejected') {
                await sendRejectNotification(application.email, remarks || null);
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

    // Updated payroll generation to use periods
    generatePayroll: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Unauthorized: No session found' });
            }

            const { month, year, period } = req.body;
            if (!month || !year || !period) {
                return res.status(400).json({ error: 'month, year, and period are required' });
            }

            // Calculate start and end dates based on period
            const startDate = period === 'first' 
                ? `${year}-${month.padStart(2, '0')}-01`
                : `${year}-${month.padStart(2, '0')}-16`;
            
            const endDate = period === 'first'
                ? `${year}-${month.padStart(2, '0')}-15`
                : new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month

            // Check if payroll period already exists
            let periodId = await HRModel.checkPayrollPeriodExists(startDate, endDate);
            
            if (!periodId) {
                // Create new payroll period
                const periodName = `${new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                periodId = await HRModel.createPayrollPeriod(periodName, startDate, endDate);
                console.log(`✅ Created new payroll period: ${periodName} (ID: ${periodId})`);
            } else {
                console.log(`✅ Using existing payroll period ID: ${periodId}`);
            }

            // Get employees with attendance data
            const employees = await HRModel.getEmployeesWithAttendance(startDate, endDate);

            if (!employees || employees.length === 0) {
                return res.json({
                    success: true,
                    message: 'No employees found for the selected period.',
                    payrollData: []
                });
            }


            // Process each employee's payroll
            const payrollRecords = [];
            for (const employee of employees) {
                // If employee has no attendance (0 days present), net pay should be 0
                if (employee.days_present === 0) {
                    payrollRecords.push({
                        employee_id: employee.employee_id,
                        employee_name: employee.full_name,
                        position: employee.position,
                        start_date: startDate,
                        end_date: endDate,
                        days_present: employee.days_present,
                        days_absent: employee.days_absent,
                        days_half_day: employee.days_half_day,
                        days_early_out: employee.days_early_out,
                        total_hours: employee.total_hours,
                        overtime_hours: employee.overtime_hours,
                        monthly_salary: employee.monthly_salary,
                        semi_monthly_payout: employee.monthly_salary / 2,
                        daily_rate: employee.monthly_salary / 26,
                        total_deductions: 0,
                        absence_deduction: 0,
                        net_pay: 0,
                        payroll_period: `${period === 'first' ? 'First' : 'Second'} Half ${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
                        status: 'pending'
                    });
                    continue;
                }

                // Calculate deductions using the enhanced system with period-specific logic
                const deductionCalculation = await HRModel.calculateDeductions(employee.monthly_salary, period);
                const totalDeductions = deductionCalculation.totalDeductions;
                
                // Calculate absence deduction
                const absenceDeduction = employee.days_absent * (employee.monthly_salary / 26);
                
                // Calculate net pay
                const netPay = employee.monthly_salary - totalDeductions - absenceDeduction;

                payrollRecords.push({
                    employee_id: employee.employee_id,
                    employee_name: employee.full_name,
                    position: employee.position,
                    start_date: startDate,
                    end_date: endDate,
                    days_present: employee.days_present,
                    days_absent: employee.days_absent,
                    days_half_day: employee.days_half_day,
                    days_early_out: employee.days_early_out,
                    total_hours: employee.total_hours,
                    overtime_hours: employee.overtime_hours,
                    monthly_salary: employee.monthly_salary,
                    semi_monthly_payout: employee.monthly_salary / 2,
                    daily_rate: employee.monthly_salary / 26,
                    total_deductions: totalDeductions,
                    taxable_deductions: deductionCalculation.taxableDeductions,
                    non_taxable_deductions: deductionCalculation.nonTaxableDeductions,
                    deduction_details: deductionCalculation.deductionDetails,
                    next_period_deductions: deductionCalculation.nextPeriodDeductions,
                    absence_deduction: absenceDeduction,
                    net_pay: netPay,
                    payroll_period: `${period === 'first' ? 'First' : 'Second'} Half ${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
                    status: 'pending'
                });
            }

            // Return calculated payroll data for preview (no database insert)
            console.log(`✅ Generated payroll preview for ${payrollRecords.length} employees with period ID: ${periodId}`);

            res.json({
                success: true,
                message: `Payroll preview generated successfully for ${payrollRecords.length} employees. Review and submit when ready.`,
                payrollData: payrollRecords,
                periodId: periodId,
                periodName: `${period === 'first' ? 'First' : 'Second'} Half ${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
                startDate: startDate,
                endDate: endDate
            });

        } catch (error) {
            console.error('Error in generatePayroll:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Failed to generate payroll' 
            });
        }
    },

    // Get all payroll periods
    getAllPayrollPeriods: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Unauthorized: No session found' });
            }

            const periods = await HRModel.getAllPayrollPeriods();
            res.json({
                success: true,
                periods: periods
            });
        } catch (error) {
            console.error('Error in getAllPayrollPeriods:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Failed to fetch payroll periods' 
            });
        }
    },

    // Get payroll period by ID
    getPayrollPeriodById: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Unauthorized: No session found' });
            }

            const { periodId } = req.params;
            const period = await HRModel.getPayrollPeriodById(periodId);
            
            if (!period) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Payroll period not found' 
                });
            }
            
            res.json({
                success: true,
                period: period
            });
        } catch (error) {
            console.error('Error in getPayrollPeriodById:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch payroll period' 
            });
        }
    },

    // Get payroll entries for a specific period
    getPayrollEntriesByPeriod: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Unauthorized: No session found' });
            }

            const { periodId } = req.params;
            const entries = await HRModel.getPayrollEntriesByPeriod(periodId);

            res.json({ 
                success: true, 
                entries: entries
            });
        } catch (error) {
            console.error('Error in getPayrollEntriesByPeriod:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Failed to fetch payroll entries' 
            });
        }
    },

    // Update payroll period status
    updatePayrollPeriodStatus: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Unauthorized: No session found' });
            }

            const { periodId } = req.params;
            const { status } = req.body;

            if (!['pending', 'approved', 'rejected', 'processed'].includes(status)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid status. Must be pending, approved, rejected, or processed.' 
                });
            }

            const success = await HRModel.updatePayrollPeriodStatus(periodId, status);
            
            if (!success) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Payroll period not found' 
                });
            }

            res.json({
                success: true,
                message: `Payroll period status updated to ${status}`
            });
        } catch (error) {
            console.error('Error in updatePayrollPeriodStatus:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Failed to update payroll period status' 
            });
        }
    },

    // Approve payroll period (HR can approve periods)
    approvePayrollPeriod: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Unauthorized: No session found' });
            }

            const { periodId } = req.params;
            const success = await HRModel.updatePayrollPeriodStatus(periodId, 'approved');
            
            if (!success) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Payroll period not found' 
                });
            }

            res.json({
                success: true,
                message: 'Payroll period approved successfully'
            });
        } catch (error) {
            console.error('Error in approvePayrollPeriod:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Failed to approve payroll period' 
            });
        }
    },

    // Get payroll period summary
    getPayrollPeriodSummary: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Unauthorized: No session found' });
            }

            const { periodId } = req.params;
            const summary = await HRModel.getPayrollPeriodSummary(periodId);
            
            if (!summary) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Payroll period not found' 
                });
            }

            res.json({
                success: true,
                summary: summary
            });
        } catch (error) {
            console.error('Error in getPayrollPeriodSummary:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Failed to fetch payroll period summary' 
            });
        }
    },

    // Migration endpoint to create periods from existing payroll data
    migratePayrollToPeriods: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Unauthorized: No session found' });
            }

            // Check if user has admin privileges
            if (req.session.user.role_name !== 'office_administrator') {
                return res.status(403).json({ error: 'Forbidden: Only administrators can perform migration' });
            }

            const result = await HRModel.migrateExistingPayrollToPeriods();
            
            res.json({
                success: true,
                message: 'Payroll periods migration completed successfully',
                result: result
            });
        } catch (error) {
            console.error('Error in migratePayrollToPeriods:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Failed to migrate payroll to periods' 
            });
        }
    },

    // Get pending payroll periods
    getPendingPayrollPeriods: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Unauthorized: No session found' });
            }

            const periods = await HRModel.getPendingPayrollPeriods();
            res.json({
                success: true,
                periods: periods
            });
        } catch (error) {
            console.error('Error in getPendingPayrollPeriods:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Failed to fetch pending payroll periods' 
            });
        }
    },

    // Get approved payroll periods
    getApprovedPayrollPeriods: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Unauthorized: No session found' });
            }

            const periods = await HRModel.getApprovedPayrollPeriods();
            res.json({
                success: true,
                periods: periods
            });
        } catch (error) {
            console.error('Error in getApprovedPayrollPeriods:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Failed to fetch approved payroll periods' 
            });
        }
    },

    // Notify finance managers for follow-up
    notifyFinanceFollowUp: async (req, res) => {
        try {
            console.log('🔔 HR Follow-up notification requested for period:', req.params.periodId);
            
            if (!req.session?.user) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const { periodId } = req.params;

            // Get period details
            const period = await HRModel.getPayrollPeriodById(periodId);
            if (!period) {
                console.log('❌ Period not found:', periodId);
                return res.status(404).json({ success: false, error: 'Payroll period not found' });
            }
            console.log('✅ Period found:', period.period_name);

            // Get entries to compute pending count
            const entries = await HRModel.getPayrollEntriesByPeriod(periodId);
            const pendingCount = Array.isArray(entries) ? entries.filter(e => e.status !== 'approved').length : 0;
            console.log('📊 Entries found:', entries.length, 'Pending:', pendingCount);

            // Find finance_accounting role id and all users under it
            const roleRow = await (async () => {
                const [rows] = await require('../../../db').query(`SELECT id FROM roles WHERE name = 'finance_accounting' LIMIT 1`);
                return rows && rows[0] ? rows[0] : null;
            })();
            if (!roleRow) {
                console.log('❌ finance_accounting role not found');
                return res.status(400).json({ success: false, error: 'finance_accounting role not found' });
            }
            console.log('✅ Finance manager role ID:', roleRow.id);

            const [financeUsers] = await require('../../../db').query(`SELECT id FROM users WHERE role_id = ? AND is_active = 1`, [roleRow.id]);
            console.log('👥 Finance users found:', financeUsers.length, financeUsers.map(u => u.id));

            const title = `Payroll Follow-up: ${new Date(period.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${new Date(period.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
            const message = `HR requested follow-up on this period. Pending entries: ${pendingCount}.`;
            console.log('📝 Notification title:', title);
            console.log('📝 Notification message:', message);

            // Create a notification per finance user
            let notificationsCreated = 0;
            for (const u of financeUsers) {
                try {
                    console.log('🔄 Creating notification for user', u.id, 'with data:', {
                        userId: u.id,
                        departmentId: null,
                        title: title.substring(0, 50) + '...',
                        message: message.substring(0, 50) + '...',
                        type: 'info'
                    });
                    
                    const result = await Notifications.create({ userId: u.id, departmentId: null, title, message, type: 'info' });
                    console.log('✅ Notification created for user', u.id, 'with ID:', result.id);
                    notificationsCreated++;
                } catch (notifError) {
                    console.error('❌ Failed to create notification for user', u.id, ':', notifError);
                    console.error('❌ Error details:', {
                        message: notifError.message,
                        code: notifError.code,
                        sqlMessage: notifError.sqlMessage
                    });
                }
            }

            console.log('🎉 Total notifications created:', notificationsCreated);
            
            // Test: Try to query notifications table to verify it exists
            try {
                const [testQuery] = await require('../../../db').query('SELECT COUNT(*) as count FROM notifications');
                console.log('📊 Total notifications in database:', testQuery[0].count);
            } catch (testError) {
                console.error('❌ Error querying notifications table:', testError);
            }
            
            return res.json({ success: true, notified: notificationsCreated });
        } catch (error) {
            console.error('❌ Error notifying finance follow-up:', error);
            return res.status(500).json({ success: false, error: error.message || 'Failed to notify finance' });
        }
    },

    

    // Get detailed salary breakdown for all employees
    getSalaryBreakdown: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Unauthorized: No session found' });
            }

            const detailedBreakdown = await HRModel.getDetailedSalaryBreakdown();
            const summary = await HRModel.getTotalBaseCostByIndividualSalaries();

            res.json({ 
                success: true, 
                detailedBreakdown: detailedBreakdown,
                summary: summary
            });
        } catch (error) {
            console.error('Error in getSalaryBreakdown:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch salary breakdown' });
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
            const { id, deduction_type, fixed_amount, description, category, is_active } = req.body;

            // Validate required fields
            if (!id || !deduction_type || fixed_amount === undefined || fixed_amount === null) {
                return res.status(400).json({ error: 'ID, deduction type, and fixed amount are required' });
            }

            // Validate fixed amount is not negative
            if (parseFloat(fixed_amount) < 0) {
                return res.status(400).json({ error: 'Fixed amount cannot be negative' });
            }

            const result = await HRModel.updateDeduction({
                id: parseInt(id),
                deduction_type,
                fixed_amount: parseFloat(fixed_amount),
                description,
                category: category || 'government',
                is_active: is_active !== undefined ? is_active : true
            });

            if (!result) {
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
            const { deduction_type, fixed_amount, description, category, is_active } = req.body;

            // Validate required fields
            if (!deduction_type || fixed_amount === undefined || fixed_amount === null) {
                return res.status(400).json({ error: 'Deduction type and fixed amount are required' });
            }

            // Validate fixed amount is not negative
            if (parseFloat(fixed_amount) < 0) {
                return res.status(400).json({ error: 'Fixed amount cannot be negative' });
            }

            const result = await HRModel.addDeduction({
                deduction_type,
                fixed_amount: parseFloat(fixed_amount),
                description,
                category: category || 'government',
                is_active: is_active !== undefined ? is_active : true
            });

            res.status(201).json({
                message: 'Deduction added successfully',
                id: result
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

    // Submit temporary payroll data to database
    submitPayroll: async (req, res) => {
        try {
            const { month, year, period, payrollData } = req.body;
            console.log('\n=== PAYROLL SUBMISSION STARTED ===');
            console.log('1. Input Parameters:', { month, year, period });
            console.log('2. Payroll Records Count:', payrollData ? payrollData.length : 0);

            // Validate required fields
            if (!month || !year || !period || !payrollData || !Array.isArray(payrollData)) {
                return res.status(400).json({ 
                    message: 'Missing required fields: month, year, period, and payrollData array are required' 
                });
            }

            // Validate payroll data structure (with normalization before checks)
            const requiredFields = ['employee_id', 'start_date', 'end_date', 'days_present', 'days_absent', 
                                  'total_hours', 'overtime_hours', 'monthly_salary', 'total_deductions', 
                                  'absence_deduction', 'net_pay'];
            
            for (const record of payrollData) {
                // Normalize numeric fields to prevent type/format issues from the client
                const coerceNumber = (v) => {
                    if (v === null || v === undefined) return 0;
                    if (typeof v === 'number') return v;
                    const s = String(v).trim();
                    // If value looks like concatenated numbers (e.g., "0100.00450.00"), split and sum
                    const parts = s.match(/\d+(?:\.\d+)?/g);
                    if (parts && parts.length > 1 && s.replace(/\d|\.|\s/g, '').length === 0) {
                        return parts.reduce((sum, p) => sum + parseFloat(p || '0'), 0);
                    }
                    const n = parseFloat(s);
                    return isNaN(n) ? 0 : n;
                };
                
                record.total_hours = coerceNumber(record.total_hours);
                record.overtime_hours = coerceNumber(record.overtime_hours);
                record.monthly_salary = coerceNumber(record.monthly_salary);
                record.semi_monthly_payout = coerceNumber(record.semi_monthly_payout);
                record.daily_rate = coerceNumber(record.daily_rate);
                record.absence_deduction = coerceNumber(record.absence_deduction);
                record.total_deductions = coerceNumber(record.total_deductions);
                
                // If net_pay is missing or null, recompute server-side for safety
                if (record.net_pay === null || record.net_pay === undefined || record.net_pay === '') {
                    record.net_pay = record.monthly_salary - record.total_deductions - record.absence_deduction;
                }
                // Ensure net_pay is numeric
                record.net_pay = coerceNumber(record.net_pay);

                // Debug: Log the record to see what fields are present
                console.log(`Validating record for employee ${record.employee_id}:`, {
                    employee_id: record.employee_id,
                    has_net_pay: 'net_pay' in record,
                    net_pay_value: record.net_pay,
                    all_fields: Object.keys(record)
                });
                
                for (const field of requiredFields) {
                    if (record[field] === undefined || record[field] === null) {
                        console.error(`Missing field ${field} for employee ${record.employee_id}:`, record);
                        return res.status(400).json({ 
                            message: `Missing required field: ${field} in payroll record for employee ${record.employee_id}` 
                        });
                    }
                }
                
                // Log the record for debugging
                console.log(`Record for employee ${record.employee_id}:`, {
                    employee_id: record.employee_id,
                    start_date: record.start_date,
                    end_date: record.end_date,
                    days_present: record.days_present,
                    days_absent: record.days_absent,
                    days_half_day: record.days_half_day,
                    days_early_out: record.days_early_out,
                    total_hours: record.total_hours,
                    overtime_hours: record.overtime_hours,
                    monthly_salary: record.monthly_salary,
                    total_deductions: record.total_deductions,
                    absence_deduction: record.absence_deduction,
                    net_pay: record.net_pay
                });
            }

            // Create payroll period first (with duplicate check)
            const startDate = payrollData[0]?.start_date;
            const endDate = payrollData[0]?.end_date;
            const periodName = `${month} ${year} - ${period}`;
            
            // Use findOrCreatePayrollPeriod to avoid duplicates
            const periodId = await HRModel.findOrCreatePayrollPeriod(startDate, endDate, periodName);
            console.log('Created/found payroll period with ID:', periodId);
            
            // Insert payroll records into database with period ID
            const insertedIds = await HRModel.insertPayrollRecordsWithPeriod(payrollData, periodId);
            
            // Save deduction overrides for entries that have them
            const overridePromises = payrollData
                .filter(record => record.deduction_overrides && record.deduction_overrides.length > 0)
                .map(async (record, index) => {
                    try {
                        // Get the payroll ID from the inserted record
                        const payrollId = insertedIds[index];
                        
                        if (payrollId) {
                            await HRModel.saveDeductionOverrides(payrollId, record.employee_id, record.deduction_overrides);
                        }
                    } catch (error) {
                        console.error(`Failed to save overrides for employee ${record.employee_id}:`, error);
                        // Don't fail the entire submission for override errors
                    }
                });

            // Wait for all overrides to be saved
            if (overridePromises.length > 0) {
                await Promise.all(overridePromises);
                console.log('✅ Deduction overrides saved successfully');
            }
            
            console.log('✅ Payroll records submitted successfully');
            res.json({ 
                message: `Payroll submitted successfully for ${period === 'first' ? '1st to 15th' : '16th to 30th/31st'} of ${new Date(year, month - 1).toLocaleString('default', { month: 'long' })}`,
                submittedCount: payrollData.length
            });
        } catch (err) {
            console.error('Error in submitPayroll:', err);
            res.status(500).json({ 
                message: 'Failed to submit payroll. Please try again later.',
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
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

    // Pre-onboarding Documents Controllers
    getPreOnboardingDocuments: async (req, res) => {
        try {
            const { employeeId } = req.params;
            
            if (!employeeId) {
                return res.status(400).json({ error: 'Employee ID is required' });
            }

            const documents = await HRModel.getPreOnboardingDocuments(employeeId);
            res.json({ documents });
        } catch (error) {
            console.error('Error fetching pre-onboarding documents:', error);
            res.status(500).json({ error: 'Failed to fetch pre-onboarding documents' });
        }
    },

    uploadPreOnboardingDocument: async (req, res) => {
        try {
            const { employeeId, documentType } = req.params;

            if (!employeeId || !documentType) {
                return res.status(400).json({ error: 'Employee ID and document type are required' });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            // Generate file path
            const filePath = req.file.filename;

            await HRModel.uploadPreOnboardingDocument(employeeId, documentType, filePath);
            res.json({ message: 'Document uploaded successfully', filePath });
        } catch (error) {
            console.error('Error uploading pre-onboarding document:', error);
            res.status(500).json({ error: 'Failed to upload document' });
        }
    },

    reviewPreOnboardingDocument: async (req, res) => {
        try {
            const { employeeId, documentType } = req.params;
            const { status, remarks } = req.body;
            const reviewedBy = req.session?.user?.id;

            if (!employeeId || !documentType || !status) {
                return res.status(400).json({ error: 'Employee ID, document type, and status are required' });
            }

            if (!['approved', 'rejected'].includes(status)) {
                return res.status(400).json({ error: 'Status must be either "approved" or "rejected"' });
            }

            await HRModel.reviewPreOnboardingDocument(employeeId, documentType, status, remarks, reviewedBy);
            res.json({ message: 'Document reviewed successfully' });
        } catch (error) {
            console.error('Error reviewing pre-onboarding document:', error);
            res.status(500).json({ error: 'Failed to review document' });
        }
    },

    getOnboardingStatus: async (req, res) => {
        try {
            const { employeeId } = req.params;
            
            if (!employeeId) {
                return res.status(400).json({ error: 'Employee ID is required' });
            }

            const status = await HRModel.getOnboardingStatus(employeeId);
            res.json(status);
        } catch (error) {
            console.error('Error getting onboarding status:', error);
            res.status(500).json({ error: 'Failed to get onboarding status' });
        }
    },

    completeOnboarding: async (req, res) => {
        try {
            const { employeeId } = req.params;
            
            if (!employeeId) {
                return res.status(400).json({ error: 'Employee ID is required' });
            }

            await HRModel.completeOnboarding(employeeId);
            res.json({ message: 'Onboarding completed successfully' });
        } catch (error) {
            console.error('Error completing onboarding:', error);
            res.status(500).json({ error: error.message || 'Failed to complete onboarding' });
        }
    },

    // Check user onboarding status (for frontend to show/hide onboarding form)
    checkUserOnboardingStatus: async (req, res) => {
        try {
            if (!req.session?.user?.id) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const userId = req.session.user.id;
            
            const onboardingCompleted = await HRModel.checkUserOnboardingStatus(userId);
            
            const response = { 
                onboardingCompleted,
                showOnboardingForm: !onboardingCompleted
            };
            
            res.json(response);
        } catch (error) {
            console.error('Error checking user onboarding status:', error);
            res.status(500).json({ error: 'Failed to check onboarding status' });
        }
    },

    // Document Types Management
    getAllDocumentTypes: async (req, res) => {
        try {
            const types = await HRModel.getAllDocumentTypes();
            res.json({ types });
        } catch (error) {
            console.error('Error fetching document types:', error);
            res.status(500).json({ error: 'Failed to fetch document types' });
        }
    },

    addDocumentType: async (req, res) => {
        try {
            const { documentType, requiredForRoleId, requiredForDepartmentId, isRequired } = req.body;

            if (!documentType) {
                return res.status(400).json({ error: 'Document type is required' });
            }

            const id = await HRModel.addDocumentType(documentType, requiredForRoleId, requiredForDepartmentId, isRequired);
            res.status(201).json({ message: 'Document type added successfully', id });
        } catch (error) {
            console.error('Error adding document type:', error);
            res.status(500).json({ error: 'Failed to add document type' });
        }
    },

    updateDocumentType: async (req, res) => {
        try {
            const { id } = req.params;
            const { documentType, requiredForRoleId, requiredForDepartmentId, isRequired } = req.body;

            if (!documentType) {
                return res.status(400).json({ error: 'Document type is required' });
            }

            const success = await HRModel.updateDocumentType(id, documentType, requiredForRoleId, requiredForDepartmentId, isRequired);
            
            if (!success) {
                return res.status(404).json({ error: 'Document type not found' });
            }

            res.json({ message: 'Document type updated successfully' });
        } catch (error) {
            console.error('Error updating document type:', error);
            res.status(500).json({ error: 'Failed to update document type' });
        }
    },

    deleteDocumentType: async (req, res) => {
        try {
            const { id } = req.params;

            const success = await HRModel.deleteDocumentType(id);
            
            if (!success) {
                return res.status(404).json({ error: 'Document type not found' });
            }

            res.json({ message: 'Document type deleted successfully' });
        } catch (error) {
            console.error('Error deleting document type:', error);
            res.status(500).json({ error: 'Failed to delete document type' });
        }
    },

    // Check if user needs pre-onboarding
    checkIfUserNeedsPreOnboarding: async (req, res) => {
        try {
            console.log('🔍 HR Controller: checkIfUserNeedsPreOnboarding called');
            
            if (!req.session?.user?.id) {
                console.log('🔍 HR Controller: No user ID in session');
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const userId = req.session.user.id;
            console.log('🔍 HR Controller: User ID:', userId);
            
            const onboardingStatus = await HRModel.checkIfUserNeedsPreOnboarding(userId);
            if (process.env.NODE_ENV === 'development') {
                console.debug('🔍 HR Controller: Onboarding status:', onboardingStatus);
            }
            
            res.json(onboardingStatus);
        } catch (error) {
            console.error('🔍 HR Controller: Error checking if user needs pre-onboarding:', error);
            res.status(500).json({ error: 'Failed to check pre-onboarding status' });
        }
    },

    // Initialize pre-onboarding for legacy employee (admin function)
    initializePreOnboardingForLegacyEmployee: async (req, res) => {
        try {
            console.log('🔍 HR Controller: initializePreOnboardingForLegacyEmployee called');
            
            if (!req.session?.user?.id) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const { employeeId } = req.params;
            
            if (!employeeId) {
                return res.status(400).json({ error: 'Employee ID is required' });
            }

            const result = await HRModel.initializePreOnboardingForLegacyEmployee(employeeId);
            res.json({ 
                success: true, 
                message: 'Pre-onboarding initialized for legacy employee',
                employeeId 
            });
        } catch (error) {
            console.error('🔍 HR Controller: Error initializing pre-onboarding for legacy employee:', error);
            res.status(500).json({ error: 'Failed to initialize pre-onboarding' });
        }
    },

    // Check if current user can verify onboarding for target user
    checkVerificationPermissions: async (req, res) => {
        try {
            console.log('🔍 HR Controller: checkVerificationPermissions called');
            
            if (!req.session?.user?.id) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const currentUserId = req.session.user.id;
            const { targetUserId } = req.params;
            
            if (!targetUserId) {
                return res.status(400).json({ error: 'Target user ID is required' });
            }

            const canVerify = await HRModel.canVerifyOnboarding(currentUserId, targetUserId);
            const verifierRole = await HRModel.getVerifierRoleForUser(targetUserId);
            
            res.json({
                canVerify,
                verifierRole,
                currentUserId,
                targetUserId
            });
        } catch (error) {
            console.error('🔍 HR Controller: Error checking verification permissions:', error);
            res.status(500).json({ error: 'Failed to check verification permissions' });
        }
    },

    // Get required documents for a specific role
    getRequiredDocumentsForRole: async (req, res) => {
        try {
            console.log('🔍 HR Controller: getRequiredDocumentsForRole called');
            
            const { roleId } = req.params;
            
            if (!roleId) {
                return res.status(400).json({ error: 'Role ID is required' });
            }

            const documents = await HRModel.getRequiredDocumentsForRole(roleId);
            
            res.json({
                roleId,
                documents,
                count: documents.length
            });
        } catch (error) {
            console.error('🔍 HR Controller: Error fetching required documents:', error);
            res.status(500).json({ error: 'Failed to fetch required documents' });
        }
    },

    // Initialize pre-onboarding for a specific user (with role-based documents)
    initializePreOnboardingForUser: async (req, res) => {
        try {
            console.log('🔍 HR Controller: initializePreOnboardingForUser called');
            
            if (!req.session?.user?.id) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const { userId } = req.params;
            
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            // Check if current user can verify this user
            const canVerify = await HRModel.canVerifyOnboarding(req.session.user.id, userId);
            
            if (!canVerify) {
                return res.status(403).json({ 
                    error: 'Insufficient permissions to initialize pre-onboarding for this user' 
                });
            }

            // Get user details using model
            const user = await HRModel.getUserDetailsWithRole(userId);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            // Get required documents for this role
            const requiredDocuments = await HRModel.getRequiredDocumentsForRole(user.role_id);
            
            if (requiredDocuments.length === 0) {
                return res.json({ 
                    message: 'No required documents for this role',
                    roleName: user.role_name,
                    roleId: user.role_id
                });
            }

            // Initialize documents for this user using model
            await HRModel.initializeDocumentsForUser(userId, user.employee_id || userId, requiredDocuments);
            
            res.json({
                success: true,
                message: `Initialized ${requiredDocuments.length} pre-onboarding documents`,
                roleName: user.role_name,
                roleId: user.role_id,
                documents: requiredDocuments
            });
        } catch (error) {
            console.error('🔍 HR Controller: Error initializing pre-onboarding:', error);
            res.status(500).json({ error: 'Failed to initialize pre-onboarding' });
        }
    },

    // Initialize pre-onboarding documents for new employee (automatic)
    initializePreOnboardingForNewEmployee: async (req, res) => {
        try {
            console.log('🔍 HR Controller: initializePreOnboardingForNewEmployee called');
            
            if (!req.session?.user?.id) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const userId = req.session.user.id;
            
            // Get user details using model
            const user = await HRModel.getUserDetailsWithRole(userId);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            // Check if documents already exist using model
            const documentsExist = await HRModel.checkDocumentsExist(user.employee_id);

            if (documentsExist) {
                return res.json({ 
                    message: 'Pre-onboarding documents already initialized',
                    roleName: user.role_name,
                    roleId: user.role_id
                });
            }
            
            // Get required documents for this role
            const requiredDocuments = await HRModel.getRequiredDocumentsForRole(user.role_id);
            
            if (requiredDocuments.length === 0) {
                // Use default documents if no role-specific documents
                const defaultDocs = await HRModel.getDefaultDocuments();
                
                if (defaultDocs.length === 0) {
                    return res.json({ 
                        message: 'No required documents found for this role',
                        roleName: user.role_name,
                        roleId: user.role_id
                    });
                }
                
                // Initialize default documents using model
                await HRModel.initializeDocumentsForUser(userId, user.employee_id, defaultDocs);
                
                res.json({
                    success: true,
                    message: `Initialized ${defaultDocs.length} default pre-onboarding documents`,
                    roleName: user.role_name,
                    roleId: user.role_id,
                    documents: defaultDocs
                });
            } else {
                // Initialize role-specific documents using model
                await HRModel.initializeDocumentsForUser(userId, user.employee_id, requiredDocuments);
                
                res.json({
                    success: true,
                    message: `Initialized ${requiredDocuments.length} role-specific pre-onboarding documents`,
                    roleName: user.role_name,
                    roleId: user.role_id,
                    documents: requiredDocuments
                });
            }
        } catch (error) {
            console.error('🔍 HR Controller: Error initializing pre-onboarding for new employee:', error);
            res.status(500).json({ error: 'Failed to initialize pre-onboarding' });
        }
    },

    // Get user data (employee ID)
    getUserData: async (req, res) => {
        try {
            if (!req.session?.user?.id) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const userId = req.session.user.id;
            
            // Get user details using model
            const user = await HRModel.getUserData(userId);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            res.json({
                userId: user.id,
                employeeId: user.employee_id
            });
        } catch (error) {
            console.error('Error getting user data:', error);
            res.status(500).json({ error: 'Failed to get user data' });
        }
    },

    // Get onboarding documents for employee
    getOnboardingDocuments: async (req, res) => {
        try {
            console.log('🔍 HR Controller: getOnboardingDocuments called');
            
            if (!req.session?.user?.id) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const { employeeId } = req.params;
            
            // Get documents using model
            const documents = await HRModel.getOnboardingDocuments(employeeId);

            res.json({
                documents: documents
            });
        } catch (error) {
            console.error('🔍 HR Controller: Error getting onboarding documents:', error);
            res.status(500).json({ error: 'Failed to get documents' });
        }
    },

    // Upload onboarding document
    uploadOnboardingDocument: async (req, res) => {
        try {
            console.log('🔍 HR Controller: uploadOnboardingDocument called');
            
            if (!req.session?.user?.id) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const { employeeId, documentType } = req.params;
            
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const file = req.file;
            
            // Validate file type
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
            if (!allowedTypes.includes(file.mimetype)) {
                return res.status(400).json({ error: 'Invalid file type. Only PDF, JPG, and PNG files are allowed.' });
            }

            // Validate file size (5MB limit)
            if (file.size > 5 * 1024 * 1024) {
                return res.status(400).json({ error: 'File size must be less than 5MB' });
            }

            // Update document status using model
            await HRModel.updateDocumentStatus(employeeId, documentType, file.filename);

            res.json({
                success: true,
                message: 'Document uploaded successfully',
                filename: file.filename
            });
        } catch (error) {
            console.error('🔍 HR Controller: Error uploading document:', error);
            res.status(500).json({ error: 'Failed to upload document' });
        }
    },

    // 🔹 Onboarding Document Controllers
    // Upload document
    uploadDocument: async (req, res) => {
        try {
            console.log('🔍 HR Controller: uploadDocument called');
            
            if (!req.session?.user?.id) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const userId = req.session.user.id;
            const { documentType, remarks } = req.body;
            
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const file = req.file;
            
            // Validate file type
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
            if (!allowedTypes.includes(file.mimetype)) {
                return res.status(400).json({ error: 'Invalid file type. Only PDF, JPG, and PNG files are allowed.' });
            }

            // Validate file size (5MB limit)
            if (file.size > 5 * 1024 * 1024) {
                return res.status(400).json({ error: 'File size must be less than 5MB' });
            }

            // Get employee ID from user data
            const userData = await HRModel.getUserData(userId);
            if (!userData || !userData.employee_id) {
                return res.status(400).json({ error: 'Employee ID not found' });
            }

            // Create document data
            const documentData = {
                user_id: userId,
                employee_id: userData.employee_id,
                document_type: documentType,
                file_path: file.filename,
                remarks: remarks || null
            };

            // Create document using model
            const result = await HRModel.createOnboardingDocument(documentData);

            // Immediately mark status as 'uploaded' so it doesn't remain pending
            try {
                await HRModel.updateOnboardingDocumentStatus(result.documentId, 'uploaded', userId, remarks || null);
            } catch (e) {
                // Non-fatal: proceed even if status update fails
                console.warn('Unable to set document status to uploaded:', e?.message || e);
            }

            res.json({
                success: true,
                message: 'Document uploaded successfully',
                documentId: result.documentId,
                filename: file.filename
            });
        } catch (error) {
            console.error('❌ HR Controller: Error uploading document:', error);
            res.status(500).json({ error: 'Failed to upload document' });
        }
    },

    // Get documents for employee
    getDocuments: async (req, res) => {
        try {
            console.log('🔍 HR Controller: getDocuments called');
            
            if (!req.session?.user?.id) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const { employeeId } = req.params;
            
            // Get documents using model
            const result = await HRModel.getOnboardingDocumentsByEmployee(employeeId);

            res.json({
                success: true,
                documents: result.documents
            });
        } catch (error) {
            console.error('❌ HR Controller: Error getting documents:', error);
            res.status(500).json({ error: 'Failed to get documents' });
        }
    },

    // Update document status
    updateDocumentStatus: async (req, res) => {
        try {
            if (process.env.NODE_ENV === 'development') console.debug('🔍 HR Controller: updateDocumentStatus called');
            
            if (!req.session?.user?.id) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const { documentId } = req.params;
            const { status, remarks } = req.body;
            const reviewedBy = req.session.user.id;

            // Update document status using model
            await HRModel.updateOnboardingDocumentStatus(documentId, status, reviewedBy, remarks);

            // If document was approved, check if employee is eligible for onboarding email
            if (status === 'approved') {
                try {
                    // Get employee ID from the document
                    const { employee_id } = await HRModel.getEmployeeEmailAndIdByDocumentId(documentId);
                    if (employee_id) {
                        // Check eligibility and send email if conditions are met
                        await HRModel.sendOnboardingEmailIfEligible(employee_id);
                    }
                } catch (e) {
                    console.error('Error checking eligibility for onboarding email:', e);
                    // Non-fatal error, don't fail the approval
                }
            }

            res.json({
                success: true,
                message: 'Document status updated successfully'
            });
        } catch (error) {
            console.error('❌ HR Controller: Error updating document status:', error);
            res.status(500).json({ error: 'Failed to update document status' });
        }
    },

    // Delete document
    deleteDocument: async (req, res) => {
        try {
            console.log('🔍 HR Controller: deleteDocument called');
            
            if (!req.session?.user?.id) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const { documentId } = req.params;

            // Delete document using model
            await HRModel.deleteOnboardingDocument(documentId);

            res.json({
                success: true,
                message: 'Document deleted successfully'
            });
        } catch (error) {
            console.error('❌ HR Controller: Error deleting document:', error);
            res.status(500).json({ error: 'Failed to delete document' });
        }
    },

    // Get required documents for employee
    getRequiredDocuments: async (req, res) => {
        try {
            console.log('🔍 HR Controller: getRequiredDocuments called');
            
            if (!req.session?.user?.id) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const userId = req.session.user.id;
            
            // Get required documents using model
            const result = await HRModel.getRequiredDocumentsForEmployee(userId);

            res.json({
                success: true,
                documents: result.documents
            });
        } catch (error) {
            console.error('❌ HR Controller: Error getting required documents:', error);
            res.status(500).json({ error: 'Failed to get required documents' });
        }
    },

    // Check onboarding status
    checkOnboardingStatus: async (req, res) => {
        try {
            console.log('🔍 HR Controller: checkOnboardingStatus called');
            
            if (!req.session?.user?.id) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const userId = req.session.user.id;
            
            // Get user data to get employee ID
            const userData = await HRModel.getUserData(userId);
            if (!userData || !userData.employee_id) {
                return res.status(400).json({ error: 'Employee ID not found' });
            }

            // Check onboarding status using model
            const status = await HRModel.checkOnboardingStatus(userData.employee_id);

            res.json({
                success: true,
                needsOnboarding: status.needsOnboarding,
                totalDocuments: status.totalDocuments,
                approvedDocuments: status.approvedDocuments
            });
        } catch (error) {
            console.error('❌ HR Controller: Error checking onboarding status:', error);
            res.status(500).json({ error: 'Failed to check onboarding status' });
        }
    },

    // Initialize payroll deductions table with sample data
    initializePayrollDeductions: async (req, res) => {
        try {
            // Create the table first
            await HRModel.createDeductionsTable();
            
            // Create the overrides table
            await HRModel.createDeductionOverridesTable();
            
            // Check if table already has data
            const [existingDeductions] = await db.query('SELECT COUNT(*) as count FROM payroll_deductions');
            
            if (existingDeductions[0].count === 0) {
                // Insert sample government deductions with tax status and percentage calculations
                const sampleDeductions = [
                    { 
                        deduction_type: 'SSS Premium', 
                        fixed_amount: 0.00, 
                        percentage: 11.00,
                        min_salary_range: 0.00,
                        max_salary_range: 30000.00,
                        tax_status: 'non_taxable',
                        description: 'Social Security System Premium (11% of salary)', 
                        category: 'government' 
                    },
                    { 
                        deduction_type: 'PhilHealth', 
                        fixed_amount: 0.00, 
                        percentage: 3.00,
                        min_salary_range: 0.00,
                        max_salary_range: 999999.99,
                        tax_status: 'non_taxable',
                        description: 'Philippine Health Insurance Corporation (3% of salary)', 
                        category: 'government' 
                    },
                    { 
                        deduction_type: 'Pag-IBIG', 
                        fixed_amount: 100.00, 
                        percentage: 0.00,
                        min_salary_range: 0.00,
                        max_salary_range: 999999.99,
                        tax_status: 'non_taxable',
                        description: 'Pag-IBIG Fund Contribution (Fixed ₱100)', 
                        category: 'government' 
                    },
                    { 
                        deduction_type: 'Income Tax', 
                        fixed_amount: 0.00, 
                        percentage: 0.00,
                        min_salary_range: 0.00,
                        max_salary_range: 999999.99,
                        tax_status: 'taxable',
                        description: 'Income Tax (calculated based on tax brackets)', 
                        category: 'government' 
                    },
                    { 
                        deduction_type: 'Company Loan', 
                        fixed_amount: 0.00, 
                        percentage: 5.00,
                        min_salary_range: 15000.00,
                        max_salary_range: 50000.00,
                        tax_status: 'taxable',
                        description: 'Company Loan Deduction (5% of salary)', 
                        category: 'company' 
                    }
                ];

                for (const deduction of sampleDeductions) {
                    await HRModel.addDeduction(deduction);
                }
                
                res.json({ 
                    success: true, 
                    message: 'Payroll deductions table initialized with sample data',
                    deductions: sampleDeductions
                });
            } else {
                res.json({ 
                    success: true, 
                    message: 'Payroll deductions table already exists with data',
                    count: existingDeductions[0].count
                });
            }
        } catch (error) {
            console.error('❌ Error initializing payroll deductions:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to initialize payroll deductions' 
            });
        }
    },

    // Get detailed deduction breakdown for an employee
    getEmployeeDeductionsBreakdown: async (req, res) => {
        try {
            const { employeeId } = req.params;
            const { salary } = req.query;
            
            const breakdown = await HRModel.getEmployeeDeductionsBreakdown(employeeId, salary);
            
            res.json({
                success: true,
                breakdown: breakdown
            });
        } catch (error) {
            console.error('❌ Error getting employee deductions breakdown:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get deductions breakdown'
            });
        }
    },

    // Get payroll entry with detailed deductions
    getPayrollEntryWithDeductions: async (req, res) => {
        try {
            const { payrollId, employeeId } = req.params;
            
            const result = await HRModel.getPayrollEntryWithDeductions(payrollId, employeeId);
            
            if (!result) {
                return res.status(404).json({
                    success: false,
                    error: 'Payroll entry not found'
                });
            }
            
            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('❌ Error getting payroll entry with deductions:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get payroll entry details'
            });
        }
    },

    // Save deduction overrides for a payroll entry
    saveDeductionOverrides: async (req, res) => {
        try {
            const { payrollId, employeeId } = req.params;
            const { overrides } = req.body;
            
            if (!overrides || !Array.isArray(overrides)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid overrides data'
                });
            }
            
            await HRModel.saveDeductionOverrides(payrollId, employeeId, overrides);
            
            res.json({
                success: true,
                message: 'Deduction overrides saved successfully'
            });
        } catch (error) {
            console.error('❌ Error saving deduction overrides:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to save deduction overrides'
            });
        }
    },

    // Payslip Management Controllers (for HR to view payslips)
    getAllPayslips: async (req, res) => {
        try {
            console.log('🔍 HR Controller: getAllPayslips called');
            
            const payslips = await HRModel.getAllPayslips();
            console.log('🔍 HR Controller: Model returned payslips:', payslips.length);

            // Format the data for frontend
            const formattedPayslips = payslips.map(payslip => ({
                id: payslip.id,
                payslip_number: payslip.payslip_number,
                payslip_date: payslip.payslip_date,
                payslip_period: payslip.payslip_period,
                employee_id: payslip.employee_id,
                name: payslip.full_name,
                position: payslip.position,
                profile_picture: payslip.profile_picture || '',
                basic_salary: parseFloat(payslip.basic_salary),
                salary_before_tax: parseFloat(payslip.salary_before_tax),
                total_deductions: parseFloat(payslip.total_deductions),
                absence_deduction: parseFloat(payslip.absence_deduction),
                net_salary: parseFloat(payslip.net_salary),
                start_date: payslip.start_date,
                end_date: payslip.end_date,
                days_present: payslip.days_present,
                days_absent: payslip.days_absent,
                total_hours: parseFloat(payslip.total_hours),
                overtime_hours: parseFloat(payslip.overtime_hours),
                payment_method: payslip.payment_method,
                status: payslip.status,
                approved_date: payslip.approved_date,
                approved_by_name: payslip.approved_by_name
            }));

            console.log('🔍 HR Controller: Sending response with', formattedPayslips.length, 'payslips');
            return res.status(200).json({
                success: true,
                data: formattedPayslips
            });

        } catch (error) {
            console.error("❌ HR Controller: Error fetching payslips:", error);
            console.error("❌ HR Controller: Error details:", {
                message: error.message,
                stack: error.stack
            });
            return res.status(500).json({
                success: false,
                message: "Internal server error while fetching payslips"
            });
        }
    },

    getPayslipById: async (req, res) => {
        try {
            const { payslipId } = req.params;

            if (!payslipId) {
                return res.status(400).json({
                    success: false,
                    message: "Payslip ID is required"
                });
            }

            // Get payslip details
            const payslip = await HRModel.getPayslipById(payslipId);
            
            if (!payslip) {
                return res.status(404).json({
                    success: false,
                    message: "Payslip not found"
                });
            }

            // Format the data
            const formattedPayslip = {
                id: payslip.id,
                payslip_number: payslip.payslip_number,
                payslip_date: payslip.payslip_date,
                payslip_period: payslip.payslip_period,
                employee_id: payslip.employee_id,
                name: payslip.full_name,
                position: payslip.position,
                profile_picture: payslip.profile_picture || '',
                basic_salary: parseFloat(payslip.basic_salary),
                salary_before_tax: parseFloat(payslip.salary_before_tax),
                total_deductions: parseFloat(payslip.total_deductions),
                absence_deduction: parseFloat(payslip.absence_deduction),
                net_salary: parseFloat(payslip.net_salary),
                start_date: payslip.start_date,
                end_date: payslip.end_date,
                days_present: payslip.days_present,
                days_absent: payslip.days_absent,
                total_hours: parseFloat(payslip.total_hours),
                overtime_hours: parseFloat(payslip.overtime_hours),
                payment_method: payslip.payment_method,
                status: payslip.status,
                approved_date: payslip.approved_date,
                approved_by_name: payslip.approved_by_name
            };

            return res.status(200).json({
                success: true,
                data: formattedPayslip
            });

        } catch (error) {
            console.error("Error fetching payslip details:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error while fetching payslip details"
            });
        }
    },

    // Sign employment contract (policies acknowledgment)
    signContract: async (req, res) => {
        try {
            if (!req.session?.user?.id) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            const userId = req.session.user.id;
            const employeeId = req.session.user.employee_id;
            if (!employeeId) {
                return res.status(400).json({ error: 'Employee ID not found in session' });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No signature file uploaded' });
            }

            const signaturePath = req.file.filename;
            const signedAt = new Date();

            // Persist contract status/signature via model
            await HRModel.saveContractSignature({ userId, employeeId, signaturePath, signedAt });

            res.json({ success: true, message: 'Contract signed successfully', signaturePath, signedAt });
        } catch (error) {
            console.error('Error signing contract:', error);
            res.status(500).json({ error: 'Failed to sign contract' });
        }
    },

    getContractStatus: async (req, res) => {
        try {
            if (!req.session?.user?.id) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            const employeeId = req.session.user.employee_id;
            const status = await HRModel.getContractStatus(employeeId);
            res.json(status || { contract_status: 'pending', signature_path: null, signed_at: null });
        } catch (e) {
            console.error('Error getting contract status:', e);
            res.status(500).json({ error: 'Failed to get contract status' });
        }
    },

    // HR validate contract (not approve/reject)
    validateContract: async (req, res) => {
        try {
            if (!req.session?.user?.id) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            const { documentId } = req.params;
            if (!documentId) return res.status(400).json({ error: 'Document ID is required' });
            const ok = await HRModel.validateContract(documentId, req.session.user.id);
            if (!ok) return res.status(404).json({ error: 'Contract not found' });
            try {
                // Get employee ID from the document
                const { employee_id } = await HRModel.getEmployeeEmailAndIdByDocumentId(documentId);
                if (employee_id) {
                    // Check eligibility and send email if conditions are met
                    await HRModel.sendOnboardingEmailIfEligible(employee_id);
                }
            } catch (e) { 
                console.error('Error checking eligibility for onboarding email:', e);
                /* non-fatal */ 
            }
            res.json({ success: true, message: 'Contract validated' });
        } catch (e) {
            console.error('Error validating contract:', e);
            res.status(500).json({ error: 'Failed to validate contract' });
        }
    },

    getContractStatusByEmployee: async (req, res) => {
        try {
            if (!req.session?.user?.id) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            const { employeeId } = req.params;
            if (!employeeId) return res.status(400).json({ error: 'Employee ID is required' });
            const status = await HRModel.getContractStatus(employeeId);
            res.json(status || { contract_status: 'pending', signature_path: null, signed_at: null });
        } catch (e) {
            console.error('Error getting contract status by employee:', e);
            res.status(500).json({ error: 'Failed to get contract status' });
        }
    },

    notifyOnboardingApproved: async (req, res) => {
        try {
            if (!req.session?.user?.id) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            const { employeeId } = req.params;
            if (!employeeId) return res.status(400).json({ error: 'Employee ID is required' });
            // Check eligibility and send email if conditions are met
            const emailSent = await HRModel.sendOnboardingEmailIfEligible(employeeId);
            if (!emailSent) {
                return res.status(400).json({ 
                    error: 'Email not sent - employee not eligible. Contract must be validated and at least one ID document must be approved.' 
                });
            }
            res.json({ success: true });
        } catch (e) {
            console.error('Error notifying onboarding approved:', e);
            res.status(500).json({ error: 'Failed to send notification' });
        }
    },

    // Employee distribution by department (via roles)
    getEmployeeDistribution: async (req, res) => {
        try {
            const data = await HRModel.getEmployeeDistributionByDepartment();
            res.json({ success: true, data });
        } catch (error) {
            console.error('Error getting employee distribution:', error);
            res.status(500).json({ success: false, error: 'Failed to get employee distribution' });
        }
    },

    // Attendance trend from Attendance table
    getAttendanceTrend: async (req, res) => {
        try {
            const period = (req.query.period || 'week').toLowerCase();
            const allowed = new Set(['week','month','year']);
            const eff = allowed.has(period) ? period : 'week';
            const trend = await HRModel.getAttendanceTrend(eff);
            res.json(trend);
        } catch (error) {
            console.error('Error getting attendance trend:', error);
            res.status(500).json({ error: 'Failed to get attendance trend' });
        }
    },

    // Payroll approval progress (donut)
    getPayrollApprovalProgress: async (req, res) => {
        try {
            const progress = await HRModel.getPayrollApprovalProgress();
            res.json({ success: true, progress });
        } catch (error) {
            console.error('Error getting payroll approval progress:', error);
            res.status(500).json({ success: false, error: 'Failed to get payroll approval progress' });
        }
    },

    // Employee attendance summary for pie chart
    getEmployeeAttendanceSummary: async (req, res) => {
        try {
            const { employeeId } = req.params;
            const { period = 'all' } = req.query;
            const summary = await HRModel.getEmployeeAttendanceSummary(employeeId, { period });
            res.json(summary);
        } catch (error) {
            console.error('Error getting employee attendance summary:', error);
            res.status(500).json({ error: 'Failed to get attendance summary' });
        }
    },

    // Employee attendance history
    getEmployeeAttendanceHistory: async (req, res) => {
        try {
            const { employeeId } = req.params;
            const { page = 1, limit = 20, startDate, endDate, period = 'all' } = req.query;
            const history = await HRModel.getEmployeeAttendanceHistory(employeeId, {
                page: parseInt(page),
                limit: parseInt(limit),
                startDate,
                endDate,
                period
            });
            res.json(history);
        } catch (error) {
            console.error('Error getting employee attendance history:', error);
            res.status(500).json({ error: 'Failed to get attendance history' });
        }
    },

    // ========== CONSTRUCTION WORKERS CONTROLLERS ==========

    getAllConstructionWorkers: async (req, res) => {
        try {
            const workers = await HRModel.getAllConstructionWorkers();
            res.json(workers);
        } catch (error) {
            console.error('Error getting all construction workers:', error);
            res.status(500).json({ error: 'Failed to get construction workers' });
        }
    },

    getConstructionWorkerById: async (req, res) => {
        try {
            const { workerId } = req.params;
            const worker = await HRModel.getConstructionWorkerById(workerId);
            
            if (!worker) {
                return res.status(404).json({ error: 'Construction worker not found' });
            }
            
            res.json(worker);
        } catch (error) {
            console.error('Error getting construction worker by ID:', error);
            res.status(500).json({ error: 'Failed to get construction worker' });
        }
    },

    addConstructionWorker: async (req, res) => {
        try {
            const workerData = req.body;
            
            // Add picture filename if uploaded
            if (req.file) {
                workerData.picture = req.file.filename;
            }
            
            // Validate required fields
            const requiredFields = ['firstname', 'lastname', 'role_id', 'project_id'];
            for (const field of requiredFields) {
                if (!workerData[field]) {
                    return res.status(400).json({ error: `Missing required field: ${field}` });
                }
            }

            const newWorker = await HRModel.addConstructionWorker(workerData);
            res.status(201).json(newWorker);
        } catch (error) {
            console.error('Error adding construction worker:', error);
            
            // Check for specific error types
            if (error.message === 'No available manpower for this role in the selected project') {
                return res.status(400).json({ error: 'No available manpower for this role in the selected project' });
            }
            
            // Handle multer errors
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
            }
            
            if (error.message === 'Only image files are allowed!') {
                return res.status(400).json({ error: 'Only image files (JPG, PNG, GIF) are allowed.' });
            }
            
            res.status(500).json({ error: 'Failed to add construction worker' });
        }
    },

    updateConstructionWorker: async (req, res) => {
        try {
            const { workerId } = req.params;
            const workerData = req.body;
            
            const updated = await HRModel.updateConstructionWorker(workerId, workerData);
            
            if (!updated) {
                return res.status(404).json({ error: 'Construction worker not found' });
            }
            
            res.json({ message: 'Construction worker updated successfully' });
        } catch (error) {
            console.error('Error updating construction worker:', error);
            res.status(500).json({ error: 'Failed to update construction worker' });
        }
    },

    deleteConstructionWorker: async (req, res) => {
        try {
            const { workerId } = req.params;
            
            const deleted = await HRModel.deleteConstructionWorker(workerId);
            
            if (!deleted) {
                return res.status(404).json({ error: 'Construction worker not found' });
            }
            
            res.json({ message: 'Construction worker deleted successfully' });
        } catch (error) {
            console.error('Error deleting construction worker:', error);
            res.status(500).json({ error: 'Failed to delete construction worker' });
        }
    },

    getAllConstructionRoles: async (req, res) => {
        try {
            const roles = await HRModel.getAllConstructionRoles();
            res.json(roles);
        } catch (error) {
            console.error('Error getting all construction roles:', error);
            res.status(500).json({ error: 'Failed to get construction roles' });
        }
    },

    getAllProjects: async (req, res) => {
        try {
            const projects = await HRModel.getAllProjects();
            res.json(projects);
        } catch (error) {
            console.error('Error getting all projects:', error);
            res.status(500).json({ error: 'Failed to get projects' });
        }
    },

    getProjectLaborRoles: async (req, res) => {
        try {
            const { projectId } = req.params;
            const roles = await HRModel.getProjectLaborRoles(projectId);
            res.json(roles);
        } catch (error) {
            console.error('Error getting project labor roles:', error);
            res.status(500).json({ error: 'Failed to get project labor roles' });
        }
    },

    // Get pending construction workers
    getPendingConstructionWorkers: async (req, res) => {
        try {
            const workers = await HRModel.getPendingConstructionWorkers();
            res.json(workers);
        } catch (error) {
            console.error('Error getting pending construction workers:', error);
            res.status(500).json({ error: 'Failed to get pending construction workers' });
        }
    },

    // Approve construction worker
    approveConstructionWorker: async (req, res) => {
        try {
            const { workerId } = req.params;
            
            const approved = await HRModel.approveConstructionWorker(workerId);
            
            if (!approved) {
                return res.status(404).json({ error: 'Pending construction worker not found' });
            }
            
            res.json({ message: 'Construction worker approved successfully' });
        } catch (error) {
            console.error('Error approving construction worker:', error);
            res.status(500).json({ error: 'Failed to approve construction worker' });
        }
    },

    // Reject construction worker
    rejectConstructionWorker: async (req, res) => {
        try {
            const { workerId } = req.params;
            
            const rejected = await HRModel.rejectConstructionWorker(workerId);
            
            if (!rejected) {
                return res.status(404).json({ error: 'Pending construction worker not found' });
            }
            
            res.json({ message: 'Construction worker rejected successfully' });
        } catch (error) {
            console.error('Error rejecting construction worker:', error);
            res.status(500).json({ error: 'Failed to reject construction worker' });
        }
    },

    // Get active construction workers with QR codes for printing
    getActiveConstructionWorkersWithQR: async (req, res) => {
        try {
            const workers = await HRModel.getActiveConstructionWorkersWithQR();
            res.json(workers);
        } catch (error) {
            console.error('Error getting active construction workers with QR:', error);
            res.status(500).json({ error: 'Failed to get active construction workers with QR' });
        }
    },

    // ========== CONSTRUCTION PAYROLL CONTROLLERS ==========

    // Generate construction payroll
    generateConstructionPayroll: async (req, res) => {
        try {
            const { payrollStart, payrollEnd } = req.body;

            if (!payrollStart || !payrollEnd) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Payroll start and end dates are required' 
                });
            }

            // Validate date format
            const startDate = new Date(payrollStart);
            const endDate = new Date(payrollEnd);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid date format' 
                });
            }

            if (startDate >= endDate) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Start date must be before end date' 
                });
            }

            const payrollRecords = await HRModel.generateConstructionPayroll(payrollStart, payrollEnd);

            res.json({
                success: true,
                message: 'Construction payroll generated successfully',
                records: payrollRecords,
                totalWorkers: payrollRecords.length,
                totalPayroll: payrollRecords.reduce((sum, record) => sum + record.net_salary, 0)
            });
        } catch (error) {
            console.error('Error generating construction payroll:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to generate construction payroll' 
            });
        }
    },

    // Save construction payroll
    saveConstructionPayroll: async (req, res) => {
        try {
            const { payrollRecords } = req.body;

            if (!payrollRecords || !Array.isArray(payrollRecords)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Payroll records are required' 
                });
            }

            await HRModel.saveConstructionPayroll(payrollRecords);

            res.json({
                success: true,
                message: 'Construction payroll saved successfully'
            });
        } catch (error) {
            console.error('Error saving construction payroll:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to save construction payroll' 
            });
        }
    },

    // Get construction payroll records
    getConstructionPayroll: async (req, res) => {
        try {
            const { status, limit = 100 } = req.query;

            const records = await HRModel.getConstructionPayroll(status, parseInt(limit));

            res.json({
                success: true,
                records,
                totalRecords: records.length
            });
        } catch (error) {
            console.error('Error getting construction payroll:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to get construction payroll records' 
            });
        }
    },

    // Update construction payroll status
    updateConstructionPayrollStatus: async (req, res) => {
        try {
            const { payrollIds, status } = req.body;
            const approvedBy = req.session.user?.id;

            if (!payrollIds || !Array.isArray(payrollIds) || !status) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Payroll IDs and status are required' 
                });
            }

            const validStatuses = ['pending', 'approved', 'released'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid status. Must be pending, approved, or released' 
                });
            }

            await HRModel.updateConstructionPayrollStatus(payrollIds, status, approvedBy);

            res.json({
                success: true,
                message: `Construction payroll status updated to ${status} successfully`
            });
        } catch (error) {
            console.error('Error updating construction payroll status:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to update construction payroll status' 
            });
        }
    },

    // Delete construction payroll records
    deleteConstructionPayroll: async (req, res) => {
        try {
            const { payrollIds } = req.body;

            if (!payrollIds || !Array.isArray(payrollIds)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Payroll IDs are required' 
                });
            }

            await HRModel.deleteConstructionPayroll(payrollIds);

            res.json({
                success: true,
                message: 'Construction payroll records deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting construction payroll:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to delete construction payroll records' 
            });
        }
    }
};

// ==================== JOB POSTINGS (moved from CRM) ====================
// These handlers were moved from CRM to HR. Keep logic identical, now using HRModel.
HRController.getAllJobPostings = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const p = Math.max(1, parseInt(page, 10) || 1);
        const l = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
        const offset = (p - 1) * l;
        const rows = await HRModel.getAllJobPostings({ limit: l, offset, search });
        const total = await HRModel.countJobPostings({ search });
        res.json({ success: true, data: rows, page: p, limit: l, total });
    } catch (err) {
        console.error('getAllJobPostings error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch job postings' });
    }
};

HRController.getJobPostingById = async (req, res) => {
    try {
        const row = await HRModel.getJobPostingById(req.params.id);
        if (!row) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, data: row });
    } catch (err) {
        console.error('getJobPostingById error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch job posting' });
    }
};

HRController.createJobPosting = async (req, res) => {
    try {
        const payload = req.body || {};
        const id = await HRModel.createJobPosting(payload);
        res.status(201).json({ success: true, id });
    } catch (err) {
        console.error('createJobPosting error:', err);
        res.status(500).json({ success: false, error: 'Failed to create job posting' });
    }
};

HRController.updateJobPosting = async (req, res) => {
    try {
        const ok = await HRModel.updateJobPosting(req.params.id, req.body || {});
        if (!ok) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true });
    } catch (err) {
        console.error('updateJobPosting error:', err);
        res.status(500).json({ success: false, error: 'Failed to update job posting' });
    }
};

HRController.deleteJobPosting = async (req, res) => {
    try {
        const ok = await HRModel.deleteJobPosting(req.params.id);
        if (!ok) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true });
    } catch (err) {
        console.error('deleteJobPosting error:', err);
        res.status(500).json({ success: false, error: 'Failed to delete job posting' });
    }
};

HRController.getAllPositions = async (_req, res) => {
    try {
        const rows = await HRModel.getAllPositions();
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('getAllPositions error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch positions' });
    }
};

module.exports = { HRController, constructionWorkerUpload };
