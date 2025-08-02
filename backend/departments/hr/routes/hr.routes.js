    const express = require('express');
    const router = express.Router();
    const HRController = require('../controller/hr.controller.js');
    const authMiddleware = require('../middleware/hrAuthMiddleware.js');
    const HRModel = require('../model/hr.model.js');
    const bcrypt = require('bcrypt');
    const db = require('../../../db');
    const path = require('path');
    const fs = require('fs');
    const multer = require('multer');

    // Configure multer for onboarding document uploads
    const onboardingStorage = multer.diskStorage({
        destination: function (req, file, cb) {
            const uploadDir = path.join(__dirname, '..', '..', '..', 'uploads', 'onboarding');
            // Create directory if it doesn't exist
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        },
        filename: function (req, file, cb) {
            // Generate unique filename: employeeId_documentType_timestamp.extension
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const documentType = req.params.documentType.replace(/[^a-zA-Z0-9]/g, '_');
            cb(null, `onboarding_${req.params.employeeId}_${documentType}_${uniqueSuffix}${path.extname(file.originalname)}`);
        }
    });

    const onboardingUpload = multer({
        storage: onboardingStorage,
        limits: {
            fileSize: 5 * 1024 * 1024 // 5MB limit
        },
        fileFilter: function (req, file, cb) {
            // Accept only PDF and image files
            if (!file.originalname.match(/\.(pdf|jpg|jpeg|png)$/)) {
                return cb(new Error('Only PDF, JPG, JPEG, and PNG files are allowed!'), false);
            }
            cb(null, true);
        }
    }).single('file');

    // 🔹 Employee Management
    router.get('/employees', authMiddleware.verifySession, HRController.getAllEmployees);         // Get all employees
    router.post('/employees', authMiddleware.verifySession, HRController.addEmployee);            // Add new employee
    router.get('/employees/:id', authMiddleware.verifySession, HRController.getEmployeeDetails);  // Get employee details
    router.put('/employees/:id', authMiddleware.verifySession, HRController.updateEmployee);      // Update employee
    router.put('/employees/:id/contact', authMiddleware.verifySession, HRController.updateEmployeeContact); // Update employee contact info

    // 🔹 Permission Management
    router.get('/roles', authMiddleware.verifySession, HRController.getRoles);    // Get all roles/permissions
    
 // Route to handle soft delete or restore employee
    router.put('/employee/archive/:employeeId', authMiddleware.verifySession, HRController.softDeleteOrRestoreEmployee);

    

    // 🔹 Attendance Management
// 🔹 Check-in attendance for the employee
    router.post('/check-in/:id', HRController.checkInAttendance);

    // 🔹 Check-out attendance for the employee
    router.post('/check-out/:id', HRController.checkOutAttendance);

    router.post('/mark-missed-checkouts', HRController.updateMissedCheckOuts);
    // 🔹 Get today's attendance for the employee
    router.get('/today/:id', HRController.getTodayAttendance);
    router.get('/attendance/:userId', HRController.getAttendanceByUserId);

// Routes for Early Out and Half-Day Requests
    router.post('/earlyOut-request/:employeeId', HRController.requestEarlyOutRequest);
    router.get('/requests', HRController.getAllPendingRequests);
    router.get('/requests/:employeeId', HRController.getPendingRequestsByUserId);
    router.post('/approve', HRController.handleRequestApproval);
    router.post('/payroll/generate', HRController.generatePayroll);
    router.post('/payroll/cancel', HRController.cancelPayroll);
    router.get('/payroll/pending', HRController.getPendingPayroll);
    router.post('/payroll/approve-reject', HRController.approveOrRejectPayroll);
    router.get('/payroll/approved', HRController.getAcceptPayroll);
    router.get('/deductions', HRController.getAllDeductions);
    router.post('/deductions/add', HRController.addDeduction);
    router.put('/deductions/update/:id', HRController.updateDeduction);
    router.put('/deductions/archive/:id', HRController.archiveDeduction);
    router.put('/deductions/restore/:id', HRController.restoreDeduction);
    router.delete('/deductions/delete/:id', HRController.deleteDeduction);
    router.get('/deductions/:id', HRController.getDeductionById);

    router.get('/check-session', (req, res) => {
        if (req.session && req.session.user) {
            res.json({ user: req.session.user });
        } else {
            res.status(401).json({ error: "Unauthorized" });
        }
    });

    // Add session refresh endpoint
    router.post('/refresh-session', (req, res) => {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: "No active session to refresh" });
        }

        try {
            // Touch the session to extend its lifetime
            req.session.touch();
            
            // Update last activity timestamp
            req.session.lastActivity = Date.now();
            
            res.json({ 
                success: true, 
                message: "Session refreshed successfully",
                user: req.session.user
            });
        } catch (error) {
            console.error('Session refresh error:', error);
            res.status(500).json({ error: "Failed to refresh session" });
        }
    });

    router.get('/getApplicationsByStatus', HRController.getApplicationsByStatus);

    // Route to update application status (POST method) 
    router.post('/updateStatus', HRController.updateApplicationStatus);
    router.post('/scheduleInterview', HRController.scheduleInterview);
    router.get('/getAllAttendanceRecords', HRController.getAllAttendanceRecords)

    // Security Questions Routes
    router.post('/update-security-questions', authMiddleware.verifySession, HRController.updateSecurityQuestions);
    router.get('/get-security-questions', authMiddleware.verifySession, HRController.getSecurityQuestions);
    router.post('/verify-security-questions', HRController.verifySecurityQuestions);

    // Add the change password route
    router.post('/change-password', authMiddleware.verifySession, HRController.changePassword);

    // Add profile picture upload route
    router.post('/upload-profile-picture/:id', authMiddleware.verifySession, HRController.uploadProfilePicture);

    // Add route to fix existing profile picture paths
    router.post('/fix-profile-pictures', authMiddleware.verifySession, async (req, res) => {
        try {
            const fixedCount = await HRModel.fixProfilePicturePaths();
            res.json({ message: `Fixed ${fixedCount} profile picture paths` });
        } catch (error) {
            console.error('Error fixing profile picture paths:', error);
            res.status(500).json({ error: 'Failed to fix profile picture paths' });
        }
    });

    // Forgot Password Routes
    router.get('/forgot-password', (req, res) => {
        res.sendFile(path.join(__dirname, '../../../../views/forgot_password.html'));
    });

    router.post('/verify-email', HRController.verifyEmailForReset);
    router.post('/verify-security-questions', HRController.verifySecurityQuestions);
    router.post('/reset-password', HRController.resetPassword);

    // Add route to serve default profile picture
    router.get('/default-profile-picture', (req, res) => {
        const defaultPicturePath = path.join(__dirname, '..', '..', '..', 'uploads', 'profile_pictures', 'default-profile.png');
        
        // Check if default picture exists
        if (fs.existsSync(defaultPicturePath)) {
            res.sendFile(defaultPicturePath);
        } else {
            // If default picture doesn't exist, create a simple gray circle
            const canvas = require('canvas');
            const c = canvas.createCanvas(200, 200);
            const ctx = c.getContext('2d');
            
            // Draw gray circle
            ctx.fillStyle = '#e0e0e0';
            ctx.beginPath();
            ctx.arc(100, 100, 100, 0, Math.PI * 2);
            ctx.fill();
            
            // Save the image
            const buffer = c.toBuffer('image/png');
            fs.writeFileSync(defaultPicturePath, buffer);
            
            // Send the image
            res.type('image/png');
            res.send(buffer);
        }
    });

    // Leave Management Routes
    router.get('/leave-types', HRController.getLeaveTypesWithBalances);
    router.get('/leave-requests', HRController.getEmployeeLeaveRequests);
    router.get('/all-leave-requests', authMiddleware.verifySession, HRController.getAllLeaveRequests);  // New route for all leave requests
    router.post('/leave-requests', HRController.applyForLeave);
    router.delete('/leave-requests/:requestId', HRController.cancelLeaveRequest);
    router.put('/leave-requests/:requestId/restore', HRController.restoreLeaveRequest);
    router.delete('/leave-requests/:requestId/permanent', HRController.permanentlyDeleteLeaveRequest);

    // Work Adjustment Routes
    router.get('/work-adjustments/:employeeId', HRController.getAllWorkAdjustments);
    router.get('/all-work-adjustments', authMiddleware.verifySession, HRController.getAllWorkAdjustmentRequests);  // New route for all work adjustment requests
    router.post('/halfday-request/:employeeId', HRController.requestHalfDay);
    router.post('/overtime-request/:employeeId', HRController.requestOvertime);
    router.delete('/work-adjustments/:requestId', HRController.cancelWorkAdjustment);
    router.put('/work-adjustments/:requestId/restore', HRController.restoreWorkAdjustment);
    router.delete('/work-adjustments/:requestId/permanent', HRController.permanentlyDeleteWorkAdjustment);

    // User data route
    router.get('/user-data', HRController.getUserData);

    // Dashboard KPI route
    router.get('/dashboard-kpis', HRController.getDashboardKPIs);

    // Developer Management Routes
    router.get('/developers/pending', authMiddleware.verifySession, authMiddleware.verifyHRRole, HRController.getPendingDevelopers);
    router.get('/developers/:id', authMiddleware.verifySession, authMiddleware.verifyHRRole, HRController.getDeveloperById);
    router.post('/developers/:id/approve', authMiddleware.verifySession, authMiddleware.verifyHRRole, HRController.approveDeveloper);
    router.post('/developers/:id/reject', authMiddleware.verifySession, authMiddleware.verifyHRRole, HRController.rejectDeveloper);

    // Pre-onboarding Documents Routes
    router.get('/onboarding/documents/:employeeId', authMiddleware.verifySession, HRController.getPreOnboardingDocuments);
    router.post('/onboarding/upload/:employeeId/:documentType', authMiddleware.verifySession, onboardingUpload, HRController.uploadPreOnboardingDocument);
    router.post('/onboarding/review/:employeeId/:documentType', authMiddleware.verifySession, authMiddleware.verifyHRRole, HRController.reviewPreOnboardingDocument);
    router.get('/onboarding/status/:employeeId', authMiddleware.verifySession, HRController.getOnboardingStatus);
    router.post('/onboarding/complete/:employeeId', authMiddleware.verifySession, authMiddleware.verifyHRRole, HRController.completeOnboarding);
    router.get('/onboarding/user-status', authMiddleware.verifySession, HRController.checkUserOnboardingStatus);
    
    // New pre-onboarding detection routes
    router.get('/onboarding/check-needs', authMiddleware.verifySession, HRController.checkIfUserNeedsPreOnboarding);
    router.post('/onboarding/initialize-legacy/:employeeId', authMiddleware.verifySession, authMiddleware.verifyHRRole, HRController.initializePreOnboardingForLegacyEmployee);
    
    // Role-based verification routes
    router.get('/onboarding/verify-permissions/:targetUserId', authMiddleware.verifySession, HRController.checkVerificationPermissions);
    router.get('/onboarding/required-documents/:roleId', authMiddleware.verifySession, HRController.getRequiredDocumentsForRole);
    router.post('/onboarding/initialize-user/:userId', authMiddleware.verifySession, HRController.initializePreOnboardingForUser);
    
    // Initialize pre-onboarding for new employee (automatic)
    router.post('/onboarding/initialize-new-employee', authMiddleware.verifySession, HRController.initializePreOnboardingForNewEmployee);
    
    // Get user data (employee ID)
    router.get('/user-data', authMiddleware.verifySession, HRController.getUserData);
    
    // Get onboarding documents for employee
    router.get('/onboarding/documents/:employeeId', authMiddleware.verifySession, HRController.getOnboardingDocuments);
    
    // Upload onboarding document
    router.post('/onboarding/upload/:employeeId/:documentType', authMiddleware.verifySession, onboardingUpload, HRController.uploadOnboardingDocument);

    // Document Types Management Routes
    router.get('/document-types', authMiddleware.verifySession, authMiddleware.verifyHRRole, HRController.getAllDocumentTypes);
    router.post('/document-types', authMiddleware.verifySession, authMiddleware.verifyHRRole, HRController.addDocumentType);
    router.put('/document-types/:id', authMiddleware.verifySession, authMiddleware.verifyHRRole, HRController.updateDocumentType);
    router.delete('/document-types/:id', authMiddleware.verifySession, authMiddleware.verifyHRRole, HRController.deleteDocumentType);

    // Serve onboarding form
    router.get('/onboarding-form', (req, res) => {
        res.sendFile(path.join(__dirname, '../../../../views/pre_onboarding_form.html'));
    });

    module.exports = router;
