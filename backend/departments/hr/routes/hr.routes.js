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

// 🔹 Attendance Management
router.post('/check-in', authMiddleware.verifySession, HRController.checkInAttendance);       // Employee check-in
router.get('/today/:employeeId', authMiddleware.verifySession, HRController.getTodayAttendance); // Get today's attendance

module.exports = router;
