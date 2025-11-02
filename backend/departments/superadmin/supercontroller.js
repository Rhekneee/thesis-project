const SuperadminModel = require('./supermodel');

const SuperadminController = {
    // Get all users except superadmin
    getAllUsers: async (req, res) => {
        try {
            const users = await SuperadminModel.getAllUsersExceptSuperadmin();
            res.json({ success: true, data: users });
        } catch (error) {
            console.error('Error in getAllUsers:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch users',
                error: error.message 
            });
        }
    },

    // Get user by ID
    getUserById: async (req, res) => {
        try {
            const { id } = req.params;
            const user = await SuperadminModel.getUserById(id);
            
            if (!user) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'User not found' 
                });
            }
            
            res.json({ success: true, data: user });
        } catch (error) {
            console.error('Error in getUserById:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch user',
                error: error.message 
            });
        }
    },

    // Get dashboard statistics
    getDashboardStats: async (req, res) => {
        try {
            const stats = await SuperadminModel.getDashboardStats();
            res.json({ success: true, data: stats });
        } catch (error) {
            console.error('Error in getDashboardStats:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch dashboard statistics',
                error: error.message 
            });
        }
    },

    // ========== DEPARTMENT MANAGEMENT ==========

    // Get all departments
    getAllDepartments: async (req, res) => {
        try {
            const departments = await SuperadminModel.getAllDepartments();
            res.json({ success: true, data: departments });
        } catch (error) {
            console.error('Error in getAllDepartments:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch departments',
                error: error.message 
            });
        }
    },

    // Get department by ID
    getDepartmentById: async (req, res) => {
        try {
            const { id } = req.params;
            const department = await SuperadminModel.getDepartmentById(id);
            
            if (!department) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Department not found' 
                });
            }
            
            res.json({ success: true, data: department });
        } catch (error) {
            console.error('Error in getDepartmentById:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch department',
                error: error.message 
            });
        }
    },

    // Create department
    createDepartment: async (req, res) => {
        try {
            const { name } = req.body;
            
            if (!name || !name.trim()) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Department name is required' 
                });
            }

            // Check if department already exists
            const [existing] = await require('../../db').query(
                'SELECT id FROM departments WHERE name = ?',
                [name.trim()]
            );
            
            if (existing.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Department name already exists' 
                });
            }

            const departmentId = await SuperadminModel.createDepartment({ name: name.trim() });
            res.json({ 
                success: true, 
                message: 'Department created successfully',
                data: { id: departmentId, name: name.trim() }
            });
        } catch (error) {
            console.error('Error in createDepartment:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to create department',
                error: error.message 
            });
        }
    },

    // Update department
    updateDepartment: async (req, res) => {
        try {
            const { id } = req.params;
            const { name } = req.body;
            
            if (!name || !name.trim()) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Department name is required' 
                });
            }

            // Check if department exists
            const existing = await SuperadminModel.getDepartmentById(id);
            if (!existing) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Department not found' 
                });
            }

            // Check if new name already exists (excluding current department)
            const [duplicate] = await require('../../db').query(
                'SELECT id FROM departments WHERE name = ? AND id != ?',
                [name.trim(), id]
            );
            
            if (duplicate.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Department name already exists' 
                });
            }

            const updated = await SuperadminModel.updateDepartment(id, { name: name.trim() });
            
            if (!updated) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Failed to update department' 
                });
            }

            res.json({ 
                success: true, 
                message: 'Department updated successfully' 
            });
        } catch (error) {
            console.error('Error in updateDepartment:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to update department',
                error: error.message 
            });
        }
    },

    // Delete department
    deleteDepartment: async (req, res) => {
        try {
            const { id } = req.params;

            // Check if department exists
            const existing = await SuperadminModel.getDepartmentById(id);
            if (!existing) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Department not found' 
                });
            }

            const deleted = await SuperadminModel.deleteDepartment(id);
            
            if (!deleted) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Failed to delete department' 
                });
            }

            res.json({ 
                success: true, 
                message: 'Department deleted successfully' 
            });
        } catch (error) {
            console.error('Error in deleteDepartment:', error);
            res.status(500).json({ 
                success: false, 
                message: error.message || 'Failed to delete department',
                error: error.message 
            });
        }
    },

    // ========== ROLE MANAGEMENT ==========

    // Get all roles
    getAllRoles: async (req, res) => {
        try {
            const roles = await SuperadminModel.getAllRoles();
            res.json({ success: true, data: roles });
        } catch (error) {
            console.error('Error in getAllRoles:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch roles',
                error: error.message 
            });
        }
    },

    // Get role by ID
    getRoleById: async (req, res) => {
        try {
            const { id } = req.params;
            const role = await SuperadminModel.getRoleById(id);
            
            if (!role) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Role not found' 
                });
            }
            
            res.json({ success: true, data: role });
        } catch (error) {
            console.error('Error in getRoleById:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch role',
                error: error.message 
            });
        }
    },

    // Create role
    createRole: async (req, res) => {
        try {
            const { name, department_id } = req.body;
            
            if (!name || !name.trim()) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Role name is required' 
                });
            }

            // Check if role already exists (same name and department)
            const [existing] = await require('../../db').query(
                'SELECT id FROM roles WHERE name = ? AND (department_id = ? OR (? IS NULL AND department_id IS NULL))',
                [name.trim(), department_id || null, department_id || null]
            );
            
            if (existing.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Role name already exists for this department' 
                });
            }

            const roleId = await SuperadminModel.createRole({ 
                name: name.trim(), 
                department_id: department_id || null 
            });
            
            res.json({ 
                success: true, 
                message: 'Role created successfully',
                data: { id: roleId, name: name.trim(), department_id: department_id || null }
            });
        } catch (error) {
            console.error('Error in createRole:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to create role',
                error: error.message 
            });
        }
    },

    // Update role
    updateRole: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, department_id } = req.body;
            
            if (!name || !name.trim()) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Role name is required' 
                });
            }

            // Check if role exists
            const existing = await SuperadminModel.getRoleById(id);
            if (!existing) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Role not found' 
                });
            }

            // Check if new name already exists for this department (excluding current role)
            const [duplicate] = await require('../../db').query(
                'SELECT id FROM roles WHERE name = ? AND (department_id = ? OR (? IS NULL AND department_id IS NULL)) AND id != ?',
                [name.trim(), department_id || null, department_id || null, id]
            );
            
            if (duplicate.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Role name already exists for this department' 
                });
            }

            const updated = await SuperadminModel.updateRole(id, { 
                name: name.trim(), 
                department_id: department_id || null 
            });
            
            if (!updated) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Failed to update role' 
                });
            }

            res.json({ 
                success: true, 
                message: 'Role updated successfully' 
            });
        } catch (error) {
            console.error('Error in updateRole:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to update role',
                error: error.message 
            });
        }
    },

    // Delete role
    deleteRole: async (req, res) => {
        try {
            const { id } = req.params;

            // Check if role exists
            const existing = await SuperadminModel.getRoleById(id);
            if (!existing) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Role not found' 
                });
            }

            const deleted = await SuperadminModel.deleteRole(id);
            
            if (!deleted) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Failed to delete role' 
                });
            }

            res.json({ 
                success: true, 
                message: 'Role deleted successfully' 
            });
        } catch (error) {
            console.error('Error in deleteRole:', error);
            res.status(500).json({ 
                success: false, 
                message: error.message || 'Failed to delete role',
                error: error.message 
            });
        }
    },

    // ========== DATABASE BACKUP MANAGEMENT ==========

    // Create database backup
    createDatabaseBackup: async (req, res) => {
        try {
            const backup = await SuperadminModel.createDatabaseBackup();
            res.json({ 
                success: true, 
                message: 'Database backup created successfully',
                data: backup
            });
        } catch (error) {
            console.error('Error in createDatabaseBackup:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to create database backup',
                error: error.message 
            });
        }
    },

    // Get list of backup files
    getBackupFiles: async (req, res) => {
        try {
            const backups = await SuperadminModel.getBackupFiles();
            res.json({ success: true, data: backups });
        } catch (error) {
            console.error('Error in getBackupFiles:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch backup files',
                error: error.message 
            });
        }
    },

    // Download backup file
    downloadBackupFile: async (req, res) => {
        try {
            const { filename } = req.params;
            
            if (!filename || !filename.endsWith('.sql')) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid filename' 
                });
            }

            const filepath = SuperadminModel.getBackupFilePath(filename);
            const fs = require('fs');

            // Check if file exists
            if (!fs.existsSync(filepath)) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Backup file not found' 
                });
            }

            // Send file for download
            res.download(filepath, filename, (err) => {
                if (err) {
                    console.error('Error downloading backup file:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ 
                            success: false, 
                            message: 'Failed to download backup file' 
                        });
                    }
                }
            });
        } catch (error) {
            console.error('Error in downloadBackupFile:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to download backup file',
                error: error.message 
            });
        }
    },

    // Delete backup file
    deleteBackupFile: async (req, res) => {
        try {
            const { filename } = req.params;

            if (!filename || !filename.endsWith('.sql')) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid filename' 
                });
            }

            await SuperadminModel.deleteBackupFile(filename);
            
            res.json({ 
                success: true, 
                message: 'Backup file deleted successfully' 
            });
        } catch (error) {
            console.error('Error in deleteBackupFile:', error);
            res.status(500).json({ 
                success: false, 
                message: error.message || 'Failed to delete backup file',
                error: error.message 
            });
        }
    }
};

module.exports = SuperadminController;
