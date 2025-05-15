const db = require("../../../db");

const CRMModel = {
    // Check if the applicant's email already exists in the database
    checkVisitRequestEmail: async (email) => {
        const query = "SELECT COUNT(*) AS count FROM site_visit_requests WHERE email = ?";
        const [rows] = await db.execute(query, [email]);
        return rows[0].count > 0;
    },

    // Store the site visit request in the database
    storeVisitRequest: async (data) => {
        const query = `
            INSERT INTO site_visit_requests (name, email, contact, property, preferred_date, pickup, agent, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'new', NOW())`;

        await db.execute(query, [
            data.name,            // Full Name (first + last)
            data.email,
            data.contact,
            data.property,        // Property value
            data.preferredDate,    // Time slot (e.g., "09:00:00")
            data.pickUpLocation,
            data.agent            // Default agent or provided agent
        ]);
    },

    // Get all applications from the database
    getAllApplications: async () => {
        const query = "SELECT * FROM applications";
        const [rows] = await db.execute(query);
        return rows;
    },

    // Get a specific application by its ID
    getApplicationById: async (id) => {
        const query = "SELECT * FROM applications WHERE id = ?";
        const [rows] = await db.execute(query, [id]);
        return rows[0] || null;
    },

    // Store applicant data into the database
    storeApplication: async (data) => {
        const query = `
            INSERT INTO applications (full_name, email, phone, resume, age, birthdate, middleinitial, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        await db.execute(query, [
            data.full_name,
            data.email,
            data.phone,
            data.resume,
            data.age,
            data.birthdate,
            data.middleinitial
        ]);
    },

    // Job Posting Queries
    getAllJobPostings: async (page = 1, limit = 10, search = '') => {
        const offset = (page - 1) * limit;
        let query = `
            SELECT 
                jp.*, 
                p.position_name, 
                p.salary, 
                r.name as role_name, 
                r.id as role_id
            FROM job_postings jp
            JOIN positions p ON jp.position_id = p.position_id
            JOIN roles r ON p.role_id = r.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (p.position_name LIKE ? OR r.name LIKE ? OR jp.location LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        // Get total count for pagination
        const countQuery = query.replace('jp.*, p.position_name, p.salary, r.name as role_name, r.id as role_id', 'COUNT(*) as total');
        const [countResult] = await db.execute(countQuery, params);
        const total = countResult[0].total;

        // Add pagination and ordering
        query += ` ORDER BY jp.date_posted DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

        try {
            const [rows] = await db.execute(query, params);
            return {
                jobPostings: rows,
                totalPages: Math.ceil(total / limit)
            };
        } catch (error) {
            console.error('Error in getAllJobPostings:', error);
            throw error;
        }
    },

    getJobPostingById: async (jobId) => {
        const query = `
            SELECT 
                jp.*, 
                p.position_name, 
                p.salary, 
                r.name as role_name, 
                r.id as role_id
            FROM job_postings jp
            JOIN positions p ON jp.position_id = p.position_id
            JOIN roles r ON p.role_id = r.id
            WHERE jp.job_id = ?
        `;
        try {
            const [rows] = await db.execute(query, [jobId]);
            return rows[0] || null;
        } catch (error) {
            console.error('Error in getJobPostingById:', error);
            throw error;
        }
    },

    createJobPosting: async (data) => {
        const query = `
            INSERT INTO job_postings (
                position_id,
                job_description, 
                qualifications, 
                location, 
                application_deadline, 
                how_to_apply
            ) VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const [result] = await db.execute(query, [
            data.position_id,
            data.job_description,
            data.qualifications,
            data.location,
            data.application_deadline,
            data.how_to_apply
        ]);
        
        return result.insertId;
    },

    updateJobPosting: async (jobId, data) => {
        const query = `
            UPDATE job_postings 
            SET 
                position_id = ?,
                job_description = ?,
                qualifications = ?,
                location = ?,
                application_deadline = ?,
                how_to_apply = ?
            WHERE job_id = ?
        `;
        
        await db.execute(query, [
            data.position_id,
            data.job_description,
            data.qualifications,
            data.location,
            data.application_deadline,
            data.how_to_apply,
            jobId
        ]);
    },

    deleteJobPosting: async (jobId) => {
        const query = "DELETE FROM job_postings WHERE job_id = ?";
        await db.execute(query, [jobId]);
    },

    // Get all positions for dropdown
    getAllPositions: async () => {
        const query = `
            SELECT 
                p.position_id, 
                p.position_name, 
                p.salary, 
                r.name as role_name, 
                r.id as role_id
            FROM positions p
            JOIN roles r ON p.role_id = r.id
            ORDER BY r.name, p.position_name
        `;
        try {
            const [rows] = await db.execute(query);
            return rows || [];
        } catch (error) {
            console.error('Error in getAllPositions:', error);
            throw error;
        }
    },

    // Register a new developer
    registerDeveloper: async (developerData) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // First check if email or username already exists in either table
            const checkExistingSQL = `
                SELECT 
                    (SELECT COUNT(*) FROM developer_accounts WHERE email = ? OR username = ?) as dev_count,
                    (SELECT COUNT(*) FROM users WHERE email = ? OR username = ?) as user_count
            `;
            
            const [existingCounts] = await connection.query(checkExistingSQL, [
                developerData.email, 
                developerData.username,
                developerData.email,
                developerData.username
            ]);

            if (existingCounts[0].dev_count > 0 || existingCounts[0].user_count > 0) {
                throw new Error("Email or username already exists");
            }

            // First insert into users table to get the id
            const insertUserSQL = `
                INSERT INTO users (
                    username,
                    email,
                    password,
                    role_id,
                    created_at,
                    is_active
                ) VALUES (?, ?, ?, 25, NOW(), 1)
            `;

            const [userResult] = await connection.query(insertUserSQL, [
                developerData.username,
                developerData.email,
                developerData.password_hash
            ]);

            const userId = userResult.insertId;

            // Then insert into developer_accounts table with the same id
            const insertDeveloperSQL = `
                INSERT INTO developer_accounts (
                    id,
                    username,
                    email,
                    password_hash,
                    surname,
                    first_name,
                    middle_name,
                    position,
                    contact_number,
                    company_name,
                    company_address,
                    company_tin,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            `;

            const [developerResult] = await connection.query(insertDeveloperSQL, [
                userId,  // Use the same id from users table
                developerData.username,
                developerData.email,
                developerData.password_hash,
                developerData.surname,
                developerData.first_name,
                developerData.middle_name || null,
                developerData.position || null,
                developerData.contact_number || null,
                developerData.company_name || null,
                developerData.company_address || null,
                developerData.company_tin || null
            ]);

            await connection.commit();
            return {
                developer_id: developerResult.insertId,
                id: userId
            };

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },

    // Project Model Methods
    getAllProjects: async (userId, page = 1, limit = 10, search = '') => {
        const offset = (page - 1) * limit;
        let query = `
            SELECT p.*, 
                   GROUP_CONCAT(pd.document_path) as documents
            FROM projects p
            LEFT JOIN project_documents pd ON p.id = pd.project_id
            JOIN developer_accounts da ON p.developer_id = da.id
            WHERE da.user_id = ?
        `;
        const params = [userId];

        if (search) {
            query += ` AND (p.project_name LIKE ? OR p.location LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ` GROUP BY p.id ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        try {
            const [rows] = await db.execute(query, params);
            return rows.map(row => ({
                ...row,
                documents: row.documents ? row.documents.split(',') : []
            }));
        } catch (error) {
            console.error('Error in getAllProjects:', error);
            throw error;
        }
    },

    getProjectById: async (projectId, userId) => {
        const query = `
            SELECT p.*, 
                   GROUP_CONCAT(pd.document_path) as documents
            FROM projects p
            LEFT JOIN project_documents pd ON p.id = pd.project_id
            JOIN developer_accounts da ON p.developer_id = da.id
            WHERE p.id = ? AND da.user_id = ?
            GROUP BY p.id
        `;
        try {
            const [rows] = await db.execute(query, [projectId, userId]);
            if (rows.length === 0) return null;
            
            const project = rows[0];
            return {
                ...project,
                documents: project.documents ? project.documents.split(',') : []
            };
        } catch (error) {
            console.error('Error in getProjectById:', error);
            throw error;
        }
    },

    createProject: async (projectData) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Get developer_id from user_id
            const [developer] = await connection.execute(
                'SELECT id FROM developer_accounts WHERE user_id = ?',
                [projectData.user_id]
            );

            if (developer.length === 0) {
                throw new Error('Developer account not found');
            }

            const developerId = developer[0].id;

            // Insert project
            const projectQuery = `
                INSERT INTO projects (
                    developer_id,
                    project_name,
                    project_image,
                    location,
                    deadline
                ) VALUES (?, ?, ?, ?, ?)
            `;
            
            const [result] = await connection.execute(projectQuery, [
                developerId,
                projectData.project_name,
                projectData.project_image,
                projectData.location,
                projectData.deadline
            ]);

            const projectId = result.insertId;

            // Insert project documents if any
            if (projectData.documents && projectData.documents.length > 0) {
                const docQuery = `
                    INSERT INTO project_documents (project_id, document_path)
                    VALUES (?, ?)
                `;
                
                for (const doc of projectData.documents) {
                    await connection.execute(docQuery, [projectId, doc]);
                }
            }

            await connection.commit();
            return projectId;
        } catch (error) {
            await connection.rollback();
            console.error('Error in createProject:', error);
            throw error;
        } finally {
            connection.release();
        }
    },

    updateProject: async (projectId, projectData, userId) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Get developer_id from user_id
            const [developer] = await connection.execute(
                'SELECT id FROM developer_accounts WHERE user_id = ?',
                [userId]
            );

            if (developer.length === 0) {
                throw new Error('Developer account not found');
            }

            const developerId = developer[0].id;

            // Verify project ownership
            const [existingProject] = await connection.execute(
                'SELECT id FROM projects WHERE id = ? AND developer_id = ?',
                [projectId, developerId]
            );

            if (existingProject.length === 0) {
                throw new Error('Project not found or unauthorized');
            }

            // Update project
            const projectQuery = `
                UPDATE projects 
                SET project_name = ?,
                    project_image = ?,
                    location = ?,
                    deadline = ?
                WHERE id = ? AND developer_id = ?
            `;
            
            await connection.execute(projectQuery, [
                projectData.project_name,
                projectData.project_image,
                projectData.location,
                projectData.deadline,
                projectId,
                developerId
            ]);

            // Update documents if provided
            if (projectData.documents) {
                // Delete existing documents
                await connection.execute(
                    'DELETE FROM project_documents WHERE project_id = ?',
                    [projectId]
                );

                // Insert new documents
                if (projectData.documents.length > 0) {
                    const docQuery = `
                        INSERT INTO project_documents (project_id, document_path)
                        VALUES (?, ?)
                    `;
                    
                    for (const doc of projectData.documents) {
                        await connection.execute(docQuery, [projectId, doc]);
                    }
                }
            }

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            console.error('Error in updateProject:', error);
            throw error;
        } finally {
            connection.release();
        }
    },

    deleteProject: async (projectId, userId) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Get developer_id from user_id
            const [developer] = await connection.execute(
                'SELECT id FROM developer_accounts WHERE user_id = ?',
                [userId]
            );

            if (developer.length === 0) {
                throw new Error('Developer account not found');
            }

            const developerId = developer[0].id;

            // Verify project ownership
            const [existingProject] = await connection.execute(
                'SELECT id FROM projects WHERE id = ? AND developer_id = ?',
                [projectId, developerId]
            );

            if (existingProject.length === 0) {
                throw new Error('Project not found or unauthorized');
            }

            // Delete project (cascade will handle project_documents)
            await connection.execute(
                'DELETE FROM projects WHERE id = ? AND developer_id = ?',
                [projectId, developerId]
            );

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            console.error('Error in deleteProject:', error);
            throw error;
        } finally {
            connection.release();
        }
    },

    // Get developer profile by user ID
    getDeveloperProfile: async (userId) => {
        try {
            const query = `
                SELECT 
                    da.id as developer_id,
                    da.id,
                    u.username,
                    u.email,
                    u.created_at,
                    u.is_active,
                    da.surname,
                    da.first_name,
                    da.middle_name,
                    da.position,
                    da.contact_number,
                    da.company_name,
                    da.company_address,
                    da.company_tin,
                    da.status,
                    da.profile_picture
                FROM users u
                LEFT JOIN developer_accounts da ON u.id = da.id
                WHERE u.id = ?
            `;
            
            const [rows] = await db.execute(query, [userId]);
            
            if (rows.length === 0) {
                return null;
            }

            const profile = rows[0];
            
            // Remove sensitive information
            delete profile.password_hash;
            
            // Ensure fields are not null
            profile.username = profile.username || '';
            profile.email = profile.email || '';
            profile.surname = profile.surname || '';
            profile.first_name = profile.first_name || '';
            profile.middle_name = profile.middle_name || '';
            profile.position = profile.position || 'Developer';
            profile.status = profile.status || 'active';
            profile.company_name = profile.company_name || '';
            profile.company_address = profile.company_address || '';
            profile.company_tin = profile.company_tin || '';
            profile.contact_number = profile.contact_number || '';
            profile.profile_picture = profile.profile_picture || null;
            
            return profile;
        } catch (error) {
            console.error('Error in getDeveloperProfile:', error);
            throw error;
        }
    }
};

module.exports = CRMModel;
