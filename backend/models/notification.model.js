const db = require('../db');

/**
 * Notification Model
 * Columns:
 * id, user_id, department_id, title, message, type, is_read, created_at
 */
class Notifications {
    static async create({ userId = null, departmentId = null, title, message, type = 'info' }) {
        const sql = `
            INSERT INTO notifications (user_id, department_id, title, message, type, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, 0, NOW())
        `;
        const params = [userId, departmentId, title, message, type];
        const [result] = await db.query(sql, params);
        return { id: result.insertId };
    }

    static async getUnreadFor({ userId = null, departmentId = null, limit = 50 }) {
        // General notifications: user_id IS NULL and department matches or is NULL
        // User-specific: matches user_id
        // Department broadcast: matches department_id
        const sql = `
            SELECT id, user_id, department_id, title, message, type, is_read, created_at
            FROM notifications
            WHERE is_read = 0 AND (
                (user_id IS NOT NULL AND user_id = ?) OR
                (user_id IS NULL AND department_id IS NOT NULL AND department_id = ?) OR
                (user_id IS NULL AND department_id IS NULL) -- truly general
            )
            ORDER BY created_at DESC
            LIMIT ?
        `;
        const [rows] = await db.query(sql, [userId, departmentId, Number(limit) || 50]);
        return rows;
    }

    static async markAsRead(id) {
        const [result] = await db.query(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [id]);
        return result.affectedRows > 0;
    }

    static async markAllAsRead({ userId = null, departmentId = null }) {
        const sql = `
            UPDATE notifications
            SET is_read = 1
            WHERE is_read = 0 AND (
                (user_id IS NOT NULL AND user_id = ?) OR
                (user_id IS NULL AND department_id IS NOT NULL AND department_id = ?) OR
                (user_id IS NULL AND department_id IS NULL)
            )
        `;
        const [result] = await db.query(sql, [userId, departmentId]);
        return result.affectedRows;
    }
}

module.exports = Notifications;


