const express = require('express');
const router = express.Router();
const SuperadminController = require('./supercontroller');
const superadminMiddleware = require('./aupermiddleware');

// Apply session verification to all routes
router.use(superadminMiddleware.verifySession);
router.use(superadminMiddleware.verifySuperadminRole);

// Get dashboard statistics
router.get('/dashboard/stats', SuperadminController.getDashboardStats);

// Get all users except superadmin
router.get('/users', SuperadminController.getAllUsers);

// Get user by ID
router.get('/users/:id', SuperadminController.getUserById);

// ========== DEPARTMENT ROUTES ==========
// Get all departments
router.get('/departments', SuperadminController.getAllDepartments);

// Get department by ID
router.get('/departments/:id', SuperadminController.getDepartmentById);

// Create department
router.post('/departments', SuperadminController.createDepartment);

// Update department
router.put('/departments/:id', SuperadminController.updateDepartment);

// Delete department
router.delete('/departments/:id', SuperadminController.deleteDepartment);

// ========== ROLE ROUTES ==========
// Get all roles
router.get('/roles', SuperadminController.getAllRoles);

// Get role by ID
router.get('/roles/:id', SuperadminController.getRoleById);

// Create role
router.post('/roles', SuperadminController.createRole);

// Update role
router.put('/roles/:id', SuperadminController.updateRole);

// Delete role
router.delete('/roles/:id', SuperadminController.deleteRole);

// ========== DATABASE BACKUP ROUTES ==========
// Create database backup
router.post('/backup/create', SuperadminController.createDatabaseBackup);

// Get list of backup files
router.get('/backup/files', SuperadminController.getBackupFiles);

// Download backup file
router.get('/backup/download/:filename', SuperadminController.downloadBackupFile);

// Delete backup file
router.delete('/backup/files/:filename', SuperadminController.deleteBackupFile);

module.exports = router;
