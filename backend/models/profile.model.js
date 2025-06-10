const path = require('path');
const db = require("../db");
const bcrypt = require('bcrypt');

const ProfileModel = {
    // Get user profile based on user type
    async getProfile(userId, userType) {
        try {
            let query;
            let params = [userId];

            switch (userType) {
                case 'employee':
                    query = `
                        SELECT 
                            u.id, u.email, u.is_active,
                            e.employee_id, e.full_name, e.birthday, e.address, e.contact,
                            e.educational_background, e.employment_status,
                            e.emergency_contact_name, e.emergency_contact_relationship, e.emergency_contact_phone,
                            e.profile_picture, r.role_name, d.department_name
                        FROM users u
                        LEFT JOIN employees e ON u.id = e.user_id
                        LEFT JOIN roles r ON e.role_id = r.id
                        LEFT JOIN departments d ON r.department_id = d.id
                        WHERE u.id = ?
                    `;
                    break;

                case 'supplier':
                    query = `
                        SELECT 
                            u.id, u.email, u.is_active,
                            s.supplier_id, s.company_name, s.contact_person, s.birthday,
                            s.address, s.contact, s.profile_picture
                        FROM users u
                        LEFT JOIN suppliers s ON u.id = s.user_id
                        WHERE u.id = ?
                    `;
                    break;

                case 'developer':
                    query = `
                        SELECT 
                            u.id, u.email, u.is_active,
                            d.developer_id, d.full_name, d.birthday, d.address,
                            d.contact, d.profile_picture, d.status
                        FROM users u
                        LEFT JOIN developers d ON u.id = d.user_id
                        WHERE u.id = ?
                    `;
                    break;

                default:
                    throw new Error('Invalid user type');
            }

            const [rows] = await db.query(query, params);
            return rows[0] || null;
        } catch (error) {
            console.error('Error in getProfile:', error);
            throw error;
        }
    },

    // Update contact information based on user type
    async updateContactInfo(userId, userType, contactData) {
        try {
            let query;
            let params = [];

            switch (userType) {
                case 'employee':
                    query = `
                        UPDATE employees 
                        SET birthday = ?, address = ?, contact = ?,
                            emergency_contact_name = ?, emergency_contact_relationship = ?, emergency_contact_phone = ?
                        WHERE user_id = ?
                    `;
                    params = [
                        contactData.birthday,
                        contactData.address,
                        contactData.contact,
                        contactData.emergency_contact_name,
                        contactData.emergency_contact_relationship,
                        contactData.emergency_contact_phone,
                        userId
                    ];
                    break;

                case 'supplier':
                    query = `
                        UPDATE suppliers 
                        SET birthday = ?, address = ?, contact = ?
                        WHERE user_id = ?
                    `;
                    params = [
                        contactData.birthday,
                        contactData.address,
                        contactData.contact,
                        userId
                    ];
                    break;

                case 'developer':
                    query = `
                        UPDATE developers 
                        SET birthday = ?, address = ?, contact = ?
                        WHERE user_id = ?
                    `;
                    params = [
                        contactData.birthday,
                        contactData.address,
                        contactData.contact,
                        userId
                    ];
                    break;

                default:
                    throw new Error('Invalid user type');
            }

            const [result] = await db.query(query, params);
            if (result.affectedRows === 0) {
                throw new Error('Profile not found');
            }

            // Return updated profile
            return await this.getProfile(userId, userType);
        } catch (error) {
            console.error('Error in updateContactInfo:', error);
            throw error;
        }
    },

    // Update profile picture based on user type
    async updateProfilePicture(userId, userType, imagePath) {
        try {
            let query;
            let params = [imagePath, userId];

            switch (userType) {
                case 'employee':
                    query = 'UPDATE employees SET profile_picture = ? WHERE user_id = ?';
                    break;
                case 'supplier':
                    query = 'UPDATE suppliers SET profile_picture = ? WHERE user_id = ?';
                    break;
                case 'developer':
                    query = 'UPDATE developers SET profile_picture = ? WHERE user_id = ?';
                    break;
                default:
                    throw new Error('Invalid user type');
            }

            const [result] = await db.query(query, params);
            if (result.affectedRows === 0) {
                throw new Error('Profile not found');
            }

            return true;
        } catch (error) {
            console.error('Error in updateProfilePicture:', error);
            throw error;
        }
    },

    // Get security questions
    async getSecurityQuestions(userId) {
        try {
            const query = `
                SELECT question1, question2, question3
                FROM security_questions
                WHERE user_id = ?
            `;
            const [rows] = await db.query(query, [userId]);
            return rows[0] || null;
        } catch (error) {
            console.error('Error in getSecurityQuestions:', error);
            throw error;
        }
    },

    // Update security questions
    async updateSecurityQuestions(userId, questions) {
        try {
            const query = `
                INSERT INTO security_questions (user_id, question1, answer1, question2, answer2, question3, answer3)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    question1 = VALUES(question1),
                    answer1 = VALUES(answer1),
                    question2 = VALUES(question2),
                    answer2 = VALUES(answer2),
                    question3 = VALUES(question3),
                    answer3 = VALUES(answer3)
            `;

            const params = [
                userId,
                questions.question1,
                questions.answer1,
                questions.question2,
                questions.answer2,
                questions.question3,
                questions.answer3
            ];

            await db.query(query, params);
            return true;
        } catch (error) {
            console.error('Error in updateSecurityQuestions:', error);
            throw error;
        }
    },

    // Change password
    async changePassword(userId, currentPassword, newPassword) {
        try {
            // Get current password hash
            const [rows] = await db.query(
                'SELECT password FROM users WHERE id = ?',
                [userId]
            );

            if (rows.length === 0) {
                throw new Error('User not found');
            }

            // Verify current password
            const isValid = await bcrypt.compare(currentPassword, rows[0].password);
            if (!isValid) {
                throw new Error('Current password is incorrect');
            }

            // Hash new password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            // Update password
            await db.query(
                'UPDATE users SET password = ? WHERE id = ?',
                [hashedPassword, userId]
            );

            return true;
        } catch (error) {
            console.error('Error in changePassword:', error);
            throw error;
        }
    }
};

module.exports = ProfileModel;