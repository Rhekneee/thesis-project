const express = require('express');
const router = express.Router();
const HRController = require('../controller/hr.controller.js');  // Ensure this path is correct
const authMiddleware = require('../middleware/hrAuthMiddleware.js');

router.get('/employees', authMiddleware.verifySession, HRController.getAllEmployees);
router.post('/employees', authMiddleware.verifySession, HRController.addEmployee);
router.get('/permissions', authMiddleware.verifySession, HRController.getPermissions);
router.get("/employees/:id", authMiddleware.verifySession, HRController.getEmployeeDetails);
router.put('/employees/:id', authMiddleware.verifySession, HRController.updateEmployee);

// 🔹 Attendance Routes
router.post("/check-in", authMiddleware.verifySession, (req, res, next) => {
    console.log("✅ Check-in API hit!");
    next();
}, HRController.checkInAttendance);

router.get("/today/:employeeId", authMiddleware.verifySession, HRController.getTodayAttendance);

module.exports = router;
