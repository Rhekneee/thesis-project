    const express = require('express');
    const router = express.Router();
    const HRController = require('../controller/hr.controller.js');
    const authMiddleware = require('../middleware/hrAuthMiddleware.js');

    // 🔹 Employee Management
    router.get('/employees', authMiddleware.verifySession, HRController.getAllEmployees);         // Get all employees
    router.post('/employees', authMiddleware.verifySession, HRController.addEmployee);            // Add new employee
    router.get('/employees/:id', authMiddleware.verifySession, HRController.getEmployeeDetails);  // Get employee details
    router.put('/employees/:id', authMiddleware.verifySession, HRController.updateEmployee);      // Update employee

    // 🔹 Permission Management
    router.get('/roles', authMiddleware.verifySession, HRController.getRoles);    // Get all roles/permissions
    
 // Route to handle soft delete or restore employee
    router.put('/employee/archive/:employeeId', authMiddleware.verifySession, HRController.softDeleteOrRestoreEmployee);

    

    // 🔹 Attendance Management
// 🔹 Check-in attendance for the employee
    router.post('/check-in/:id', HRController.checkInAttendance);

    // 🔹 Check-out attendance for the employee
    router.post('/check-out/:id', HRController.checkOutAttendance);

    // 🔹 Get today's attendance for the employee
    router.get('/today/:id', HRController.getTodayAttendance);

// Routes for Early Out and Half-Day Requests
    router.post('/early-out-request/:id', HRController.requestEarlyOutRequest); // Submit early out request
    router.post('/half-day-request/:id', HRController.requestHalfDayRequest); // Submit half-day request
    router.post('/approve-request/:id', HRController.approveRequest); // Approve or reject requests


    router.get('/check-session', (req, res) => {
        if (req.session && req.session.user) {
            res.json({ user: req.session.user });
        } else {
            res.status(401).json({ error: "Unauthorized" });
        }
    });

    router.get('/getApplicationsByStatus', HRController.getApplicationsByStatus);

    // Route to update application status (POST method)
    router.post('/updateStatus', HRController.updateApplicationStatus);
    
    module.exports = router;
