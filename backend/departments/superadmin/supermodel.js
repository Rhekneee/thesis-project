const db = require('../../db');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs').promises;
const execPromise = util.promisify(exec);

const SuperadminModel = {
    // Get all users except superadmin
    getAllUsersExceptSuperadmin: async () => {
        try {
            const query = `
                SELECT 
                    u.id,
                    u.username,
                    u.email,
                    u.is_active,
                    u.created_at,
                    u.onboarding_completed,
                    r.id as role_id,
                    r.name as role_name,
                    e.employee_id,
                    e.full_name,
                    d.name as department_name
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                LEFT JOIN employees e ON u.id = e.user_id
                LEFT JOIN departments d ON r.department_id = d.id
                WHERE u.username != 'superadmin'
                ORDER BY u.created_at DESC
            `;
            
            const [rows] = await db.query(query);
            return rows;
        } catch (error) {
            console.error('Error in getAllUsersExceptSuperadmin:', error);
            throw error;
        }
    },

    // Get user by ID
    getUserById: async (userId) => {
        try {
            const query = `
                SELECT 
                    u.id,
                    u.username,
                    u.email,
                    u.is_active,
                    u.created_at,
                    u.onboarding_completed,
                    r.id as role_id,
                    r.name as role_name,
                    e.employee_id,
                    e.full_name,
                    d.name as department_name
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                LEFT JOIN employees e ON u.id = e.user_id
                LEFT JOIN departments d ON r.department_id = d.id
                WHERE u.id = ? AND u.username != 'superadmin'
            `;
            
            const [rows] = await db.query(query, [userId]);
            return rows[0] || null;
        } catch (error) {
            console.error('Error in getUserById:', error);
            throw error;
        }
    },

    // Get dashboard statistics
    getDashboardStats: async () => {
        try {
            // Get total users count (excluding superadmin)
            const [usersCount] = await db.query(`
                SELECT COUNT(*) as count FROM users WHERE username != 'superadmin'
            `);

            // Get total departments count
            const [departmentsCount] = await db.query(`
                SELECT COUNT(*) as count FROM departments
            `);

            // Get total roles count
            const [rolesCount] = await db.query(`
                SELECT COUNT(*) as count FROM roles
            `);

            // Get total permissions count (distinct permissions from role_permission)
            const [permissionsCount] = await db.query(`
                SELECT COUNT(DISTINCT permission_name) as count FROM role_permission
            `);

            return {
                totalUsers: usersCount[0].count,
                totalDepartments: departmentsCount[0].count,
                totalRoles: rolesCount[0].count,
                totalPermissions: permissionsCount[0].count
            };
        } catch (error) {
            console.error('Error in getDashboardStats:', error);
            throw error;
        }
    },

    // ========== DEPARTMENT MANAGEMENT ==========
    
    // Get all departments
    getAllDepartments: async () => {
        try {
            const query = `
                SELECT id, name
                FROM departments
                ORDER BY name ASC
            `;
            const [rows] = await db.query(query);
            return rows;
        } catch (error) {
            console.error('Error in getAllDepartments:', error);
            throw error;
        }
    },

    // Get department by ID
    getDepartmentById: async (departmentId) => {
        try {
            const query = `
                SELECT id, name
                FROM departments
                WHERE id = ?
            `;
            const [rows] = await db.query(query, [departmentId]);
            return rows[0] || null;
        } catch (error) {
            console.error('Error in getDepartmentById:', error);
            throw error;
        }
    },

    // Create department
    createDepartment: async (departmentData) => {
        try {
            const query = `
                INSERT INTO departments (name)
                VALUES (?)
            `;
            const [result] = await db.query(query, [departmentData.name]);
            return result.insertId;
        } catch (error) {
            console.error('Error in createDepartment:', error);
            throw error;
        }
    },

    // Update department
    updateDepartment: async (departmentId, departmentData) => {
        try {
            const query = `
                UPDATE departments
                SET name = ?
                WHERE id = ?
            `;
            const [result] = await db.query(query, [departmentData.name, departmentId]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error in updateDepartment:', error);
            throw error;
        }
    },

    // Delete department
    deleteDepartment: async (departmentId) => {
        try {
            // Check if department is being used by roles
            const [rolesCheck] = await db.query(`
                SELECT COUNT(*) as count FROM roles WHERE department_id = ?
            `, [departmentId]);
            
            if (rolesCheck[0].count > 0) {
                throw new Error('Cannot delete department. It is being used by existing roles.');
            }

            const query = `
                DELETE FROM departments
                WHERE id = ?
            `;
            const [result] = await db.query(query, [departmentId]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error in deleteDepartment:', error);
            throw error;
        }
    },

    // ========== ROLE MANAGEMENT ==========
    
    // Get all roles except superadmin
    getAllRoles: async () => {
        try {
            const query = `
                SELECT r.id, r.name, r.department_id, d.name as department_name
                FROM roles r
                LEFT JOIN departments d ON r.department_id = d.id
                WHERE r.name != 'superadmin'
                ORDER BY d.name ASC, r.name ASC
            `;
            const [rows] = await db.query(query);
            return rows;
        } catch (error) {
            console.error('Error in getAllRoles:', error);
            throw error;
        }
    },

    // Get role by ID
    getRoleById: async (roleId) => {
        try {
            const query = `
                SELECT r.id, r.name, r.department_id, d.name as department_name
                FROM roles r
                LEFT JOIN departments d ON r.department_id = d.id
                WHERE r.id = ?
            `;
            const [rows] = await db.query(query, [roleId]);
            return rows[0] || null;
        } catch (error) {
            console.error('Error in getRoleById:', error);
            throw error;
        }
    },

    // Create role
    createRole: async (roleData) => {
        try {
            const query = `
                INSERT INTO roles (name, department_id)
                VALUES (?, ?)
            `;
            const [result] = await db.query(query, [
                roleData.name,
                roleData.department_id || null
            ]);
            return result.insertId;
        } catch (error) {
            console.error('Error in createRole:', error);
            throw error;
        }
    },

    // Update role
    updateRole: async (roleId, roleData) => {
        try {
            const query = `
                UPDATE roles
                SET name = ?, department_id = ?
                WHERE id = ?
            `;
            const [result] = await db.query(query, [
                roleData.name,
                roleData.department_id || null,
                roleId
            ]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error in updateRole:', error);
            throw error;
        }
    },

    // Delete role
    deleteRole: async (roleId) => {
        try {
            // Check if role is being used by users
            const [usersCheck] = await db.query(`
                SELECT COUNT(*) as count FROM users WHERE role_id = ?
            `, [roleId]);
            
            if (usersCheck[0].count > 0) {
                throw new Error('Cannot delete role. It is being used by existing users.');
            }

            // Check if role is being used in role_permission
            const [permissionsCheck] = await db.query(`
                SELECT COUNT(*) as count FROM role_permission WHERE role_id = ?
            `, [roleId]);
            
            if (permissionsCheck[0].count > 0) {
                throw new Error('Cannot delete role. It has assigned permissions.');
            }

            const query = `
                DELETE FROM roles
                WHERE id = ?
            `;
            const [result] = await db.query(query, [roleId]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error in deleteRole:', error);
            throw error;
        }
    },

    // ========== DATABASE BACKUP MANAGEMENT ==========
    
    // Create database backup
    createDatabaseBackup: async () => {
        try {
            const dbHost = process.env.DB_HOST || 'localhost';
            const dbUser = process.env.DB_USER || 'root';
            const dbPassword = process.env.DB_PASSWORD || '';
            const dbName = process.env.DB_NAME || 'md_buendia';
            const dbPort = process.env.DB_PORT || 3306;

            // Create backups directory if it doesn't exist
            const backupsDir = path.join(__dirname, '../../../backups');
            try {
                await fs.access(backupsDir);
            } catch {
                await fs.mkdir(backupsDir, { recursive: true });
            }

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                             new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0];
            const filename = `backup_${dbName}_${timestamp}.sql`;
            const filepath = path.join(backupsDir, filename);

            // Build mysqldump command
            let mysqldumpCommand = `mysqldump -h ${dbHost} -P ${dbPort} -u ${dbUser}`;
            
            if (dbPassword) {
                mysqldumpCommand += ` -p${dbPassword}`;
            }
            
            mysqldumpCommand += ` ${dbName} > "${filepath}"`;

            // Execute mysqldump
            await execPromise(mysqldumpCommand);

            // Verify file was created
            const stats = await fs.stat(filepath);
            
            return {
                success: true,
                filename: filename,
                filepath: filepath,
                size: stats.size,
                createdAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error in createDatabaseBackup:', error);
            throw error;
        }
    },

    // Get list of backup files
    getBackupFiles: async () => {
        try {
            const backupsDir = path.join(__dirname, '../../../backups');
            
            try {
                await fs.access(backupsDir);
            } catch {
                // Directory doesn't exist, return empty array
                return [];
            }

            const files = await fs.readdir(backupsDir);
            const backupFiles = [];

            for (const file of files) {
                if (file.endsWith('.sql')) {
                    const filepath = path.join(backupsDir, file);
                    const stats = await fs.stat(filepath);
                    
                    backupFiles.push({
                        filename: file,
                        size: stats.size,
                        createdAt: stats.birthtime,
                        modifiedAt: stats.mtime
                    });
                }
            }

            // Sort by creation date (newest first)
            backupFiles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            return backupFiles;
        } catch (error) {
            console.error('Error in getBackupFiles:', error);
            throw error;
        }
    },

    // Delete backup file
    deleteBackupFile: async (filename) => {
        try {
            const backupsDir = path.join(__dirname, '../../../backups');
            const filepath = path.join(backupsDir, filename);

            // Security check: ensure file is in backups directory
            const resolvedPath = path.resolve(filepath);
            const resolvedDir = path.resolve(backupsDir);
            
            if (!resolvedPath.startsWith(resolvedDir)) {
                throw new Error('Invalid file path');
            }

            await fs.unlink(filepath);
            return true;
        } catch (error) {
            console.error('Error in deleteBackupFile:', error);
            throw error;
        }
    },

    // Get backup file path for download
    getBackupFilePath: (filename) => {
        const backupsDir = path.join(__dirname, '../../../backups');
        const filepath = path.join(backupsDir, filename);

        // Security check: ensure file is in backups directory
        const resolvedPath = path.resolve(filepath);
        const resolvedDir = path.resolve(backupsDir);
        
        if (!resolvedPath.startsWith(resolvedDir)) {
            throw new Error('Invalid file path');
        }

        return filepath;
    }
};

module.exports = SuperadminModel;
