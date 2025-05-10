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

    router.post('/mark-missed-checkouts', HRController.updateMissedCheckOuts);
    // 🔹 Get today's attendance for the employee
    router.get('/today/:id', HRController.getTodayAttendance);
    router.get('/attendance/:userId', HRController.getAttendanceByUserId);

// Routes for Early Out and Half-Day Requests
    router.post('/earlyOut-request/:id', HRController.requestEarlyOutRequest); // Submit early out request
    router.post('/halfDay-request/:id', HRController.requestHalfDayRequest);    // Submit half-day request
    router.post('/overtime-request/:id', HRController.requestOvertimeRequest);
    router.get('/requests', HRController.getAllPendingRequests);
    router.get('/requests/:userId', HRController.getPendingRequestsByUserId);
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

    router.get('/getApplicationsByStatus', HRController.getApplicationsByStatus);

    // Route to update application status (POST method) 
    router.post('/updateStatus', HRController.updateApplicationStatus);
    router.post('/scheduleInterview', HRController.scheduleInterview);
    router.get('/getAllAttendanceRecords', HRController.getAllAttendanceRecords)
    module.exports = router;
