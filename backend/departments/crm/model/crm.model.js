const db = require("../../../db");
<<<<<<< HEAD
const bcrypt = require('bcrypt');

const CRMModel = {
    // Check if the applicant's email already exists in the database
    checkVisitRequestEmail: async (email) => {
        const query = "SELECT COUNT(*) AS count FROM site_visit_requests WHERE email = ?";
=======

const CRMModel = {
    // 🔹 Check if an applicant email already exists
    checkApplicantEmail: async (email) => {
        const query = "SELECT COUNT(*) AS count FROM applications WHERE email = ?";
>>>>>>> 85f9240 (Initial commit)
        const [rows] = await db.execute(query, [email]);
        return rows[0].count > 0;
    },

<<<<<<< HEAD
    // Developers: list all developer accounts
    getAllDevelopers: async () => {
        const query = `
            SELECT 
                id,
                username,
                email,
                contact_number,
                first_name,
                middle_name,
                surname,
                position,
                company_name,
                status,
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as created_at
            FROM developer_accounts
            ORDER BY created_at DESC
        `;
        const [rows] = await db.execute(query);
        return rows;
    },

    // Store the site visit request in the database
    storeVisitRequest: async (data) => {
        const query = `
            INSERT INTO site_visit_requests (name, email, contact, property, preferred_date, agent, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'new', NOW())`;

        await db.execute(query, [
            data.name,            // Full Name (first + last)
            data.email,
            data.contact,
            data.property,        // Property value
            data.preferredDate,    // Time slot (e.g., "09:00:00")
            data.agent            // Default agent or provided agent
        ]);
    },

    // Get all applications from the database
=======
    // 🔹 Store application
    storeApplication: async (data) => {
        const query = `
            INSERT INTO applications (full_name, email, phone, address, resume, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'Pending', NOW())`;
        await db.execute(query, [data.full_name, data.email, data.phone, data.address, data.resume]); // Change 'resume_path' to 'resume'
    },


    // 🔹 Get all applications
>>>>>>> 85f9240 (Initial commit)
    getAllApplications: async () => {
        const query = "SELECT * FROM applications";
        const [rows] = await db.execute(query);
        return rows;
    },

<<<<<<< HEAD
    // Get a specific application by its ID
=======
    // 🔹 Get application by ID
>>>>>>> 85f9240 (Initial commit)
    getApplicationById: async (id) => {
        const query = "SELECT * FROM applications WHERE id = ?";
        const [rows] = await db.execute(query, [id]);
        return rows[0] || null;
<<<<<<< HEAD
    },

    // Store applicant data into the database
    storeApplication: async (data) => {
        const query = `
            INSERT INTO applications (full_name, email, phone, resume, age, birthdate, middleinitial, role_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        await db.execute(query, [
            data.full_name,
            data.email,
            data.phone,
            data.resume,
            data.age,
            data.birthdate,
            data.middleinitial,
            data.role_id // <-- Add role_id here
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
        const countQuery = `
            SELECT COUNT(*) as total
            FROM job_postings jp
            JOIN positions p ON jp.position_id = p.position_id
            JOIN roles r ON p.role_id = r.id
            WHERE 1=1
            ${search ? 'AND (p.position_name LIKE ? OR r.name LIKE ? OR jp.location LIKE ?)' : ''}
        `;
        const [countResult] = await db.execute(countQuery, params);
        const total = countResult[0]?.total || 0;

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

    // Developer Registration Methods
    checkDeveloperEmail: async (email) => {
        const query = "SELECT COUNT(*) AS count FROM developer_accounts WHERE email = ?";
        const [rows] = await db.execute(query, [email]);
        return rows[0].count > 0;
    },

    checkDeveloperUsername: async (username) => {
        const query = "SELECT COUNT(*) AS count FROM developer_accounts WHERE username = ?";
        const [rows] = await db.execute(query, [username]);
        return rows[0].count > 0;
    },

    storeDeveloper: async (data) => {
        const query = `
            INSERT INTO developer_accounts (
                username, 
                email, 
                profile_picture, 
                password_hash, 
                surname, 
                first_name, 
                middle_name, 
                position, 
                contact_number, 
                company_name, 
                company_address, 
                company_tin, 
                created_at, 
                updated_at, 
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 'pending')
        `;

        const [result] = await db.execute(query, [
            data.username,
            data.email,
            data.profile_picture,
            data.password_hash,
            data.surname,
            data.first_name,
            data.middle_name,
            data.position,
            data.contact_number,
            data.company_name,
            data.company_address,
            data.company_tin
        ]);

        return result.insertId;
    },

    // Property Management Methods
    storeProperty: async (data) => {
        const query = `
            INSERT INTO properties (
                property_name,
                property_type,
                location,
                price,
                parking_spaces,
                bedrooms,
                bathrooms,
                floors,
                description,
                property_image,
                virtual_tour_image,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;

        const [result] = await db.execute(query, [
            data.property_name,
            data.property_type,
            data.location,
            data.price,
            data.parking_spaces,
            data.bedrooms,
            data.bathrooms,
            data.floors,
            data.description,
            data.property_image,
            data.virtual_tour_image || null  // Handle null virtual tour image
        ]);

        return result.insertId;
    },

    // Get active developer companies for property locations
    getActiveDeveloperCompanies: async () => {
        const query = `
            SELECT DISTINCT company_name 
            FROM developer_accounts 
            WHERE status = 'active' 
            ORDER BY company_name ASC
        `;
        try {
            const [rows] = await db.execute(query);
            return rows.map(row => row.company_name);
        } catch (error) {
            console.error('Error in getActiveDeveloperCompanies:', error);
            throw error;
        }
    },

    // Get all properties from the database
    getAllProperties: async () => {
        const query = `
            SELECT 
                property_id as id,
                property_name as name,
                location,
                CONCAT('₱', FORMAT(price, 2)) as price,
                property_type as type,
                status,
                DATE_FORMAT(created_at, '%Y-%m-%d') as addedDate,
                description,
                parking_spaces as parking,
                bedrooms,
                bathrooms,
                floors,
                property_image as imageUrl
            FROM properties 
            ORDER BY created_at DESC
        `;
        try {
            const [rows] = await db.execute(query);
            return rows;
        } catch (error) {
            console.error('Error in getAllProperties:', error);
            throw error;
        }
    },

    // Get a single property by ID
    getPropertyById: async (propertyId) => {
        const query = `
            SELECT 
                property_id,
                property_name,
                property_type,
                location,
                price,
                parking_spaces,
                bedrooms,
                bathrooms,
                floors,
                description,
                property_image,
                virtual_tour_image,
                status,
                DATE_FORMAT(created_at, '%Y-%m-%d') as added_date
            FROM properties 
            WHERE property_id = ?
        `;
        try {
            const [rows] = await db.execute(query, [propertyId]);
            return rows[0] || null;
        } catch (error) {
            console.error('Error in getPropertyById:', error);
            throw error;
        }
    },

    // Update property by ID
    updateProperty: async (propertyId, data) => {
        let query = `
            UPDATE properties SET
                property_name = ?,
                property_type = ?,
                location = ?,
                price = ?,
                parking_spaces = ?,
                bedrooms = ?,
                bathrooms = ?,
                floors = ?,
                description = ?,
                status = ?,
                updated_at = NOW()`;
        const params = [
            data.property_name,
            data.property_type,
            data.location,
            data.price,
            data.parking_spaces,
            data.bedrooms,
            data.bathrooms,
            data.floors,
            data.description,
            data.status
        ];
        if (data.property_image) {
            query += ', property_image = ?';
            params.push(data.property_image);
        }
        if (data.virtual_tour_image) {
            query += ', virtual_tour_image = ?';
            params.push(data.virtual_tour_image);
        }
        query += ' WHERE property_id = ?';
        params.push(propertyId);
        await db.execute(query, params);
    },

    // Get developer by ID
    getDeveloperById: async (id) => {
        try {
            const query = `
                SELECT 
                    da.*,
                    u.email,
                    u.username,
                    u.role_id,
                    r.name as role_name
                FROM developer_accounts da
                JOIN users u ON da.id = u.id
                JOIN roles r ON u.role_id = r.id
                WHERE da.id = ?
            `;

            const [developers] = await db.query(query, [id]);
            return developers[0] || null;
        } catch (error) {
            console.error('Error in getDeveloperById model:', error);
            throw error;
        }
    },

    // Virtual Tour: Locations
    createVirtualLocation: async (data) => {
        const query = `
            INSERT INTO virtual_locations (location_name, description, picture_path, created_by)
            VALUES (?, ?, ?, ?)
        `;
        const [result] = await db.execute(query, [
            data.location_name,
            data.description || null,
            data.picture_path || null,
            data.created_by || null
        ]);
        return result.insertId;
    },

    listVirtualLocations: async () => {
        const query = `
            SELECT id, location_name, description, picture_path,
                   DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as created_at
            FROM virtual_locations
            ORDER BY created_at DESC
        `;
        const [rows] = await db.execute(query);
        return rows;
    },

    getVirtualLocationById: async (id) => {
        const query = `
            SELECT id, location_name, description, picture_path,
                   DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as created_at
            FROM virtual_locations
            WHERE id = ?
        `;
        const [rows] = await db.execute(query, [id]);
        return rows[0] || null;
    },

    // Virtual Tour: Scenes
    createVirtualScene: async (data) => {
        const query = `
            INSERT INTO virtual_scenes (location_id, scene_name, image_path, pitch, yaw)
            VALUES (?, ?, ?, ?, ?)
        `;
        const [result] = await db.execute(query, [
            data.location_id,
            data.scene_name,
            data.image_path,
            data.pitch || 0,
            data.yaw || 0
        ]);
        return result.insertId;
    },

    getVirtualScenesByLocation: async (location_id) => {
        const query = `
            SELECT id, scene_name, image_path, pitch, yaw,
                   DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as created_at
            FROM virtual_scenes
            WHERE location_id = ?
            ORDER BY created_at ASC
        `;
        const [rows] = await db.execute(query, [location_id]);
        return rows;
    },

    updateVirtualScene: async (id, data) => {
        let query = `
            UPDATE virtual_scenes SET
                scene_name = ?,
                pitch = ?,
                yaw = ?
        `;
        const params = [data.scene_name, data.pitch, data.yaw];

        // Add image_path to update if provided
        if (data.image_path) {
            query += ', image_path = ?';
            params.push(data.image_path);
        }

        query += ' WHERE id = ?';
        params.push(id);

        await db.execute(query, params);
    },

    deleteVirtualScene: async (id) => {
        const query = "DELETE FROM virtual_scenes WHERE id = ?";
        await db.execute(query, [id]);
    },

    deleteVirtualHotspotsByScene: async (scene_id) => {
        const query = "DELETE FROM virtual_hotspots WHERE scene_id = ?";
        await db.execute(query, [scene_id]);
    },

    // Virtual Tour: Hotspots
    createVirtualHotspot: async (data) => {
        const query = `
            INSERT INTO virtual_hotspots (scene_id, target_scene_id, type, pitch, yaw, tooltip, info_text)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await db.execute(query, [
            data.scene_id,
            data.target_scene_id || null,
            data.type,
            data.pitch,
            data.yaw,
            data.tooltip,
            data.info_text || null
        ]);
        return result.insertId;
    },

    getVirtualHotspotsByScene: async (scene_id) => {
        const query = `
            SELECT id, scene_id, target_scene_id, type, pitch, yaw, tooltip, info_text,
                   DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as created_at
            FROM virtual_hotspots
            WHERE scene_id = ?
            ORDER BY created_at ASC
        `;
        const [rows] = await db.execute(query, [scene_id]);
        return rows;
    },

    updateVirtualHotspot: async (id, data) => {
        let query = `
            UPDATE virtual_hotspots SET
                target_scene_id = ?,
                type = ?,
                pitch = ?,
                yaw = ?,
                tooltip = ?,
                info_text = ?
        `;
        const params = [
            data.target_scene_id || null,
            data.type,
            data.pitch,
            data.yaw,
            data.tooltip,
            data.info_text || null
        ];

        query += ' WHERE id = ?';
        params.push(id);

        await db.execute(query, params);
    },

    updateVirtualHotspotPosition: async (id, data) => {
        const query = `
            UPDATE virtual_hotspots SET
                pitch = ?,
                yaw = ?
            WHERE id = ?
        `;
        const params = [
            data.pitch,
            data.yaw,
            id
        ];

        await db.execute(query, params);
    },

    deleteVirtualHotspot: async (id) => {
        const query = "DELETE FROM virtual_hotspots WHERE id = ?";
        await db.execute(query, [id]);
    },

    // Inquiry Management Methods
    storeInquiry: async (data) => {
        const query = `
            INSERT INTO inquiries (name, surname, email, contact, message, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        `;
        const [result] = await db.execute(query, [
            data.name,
            data.surname,
            data.email,
            data.contact,
            data.message
        ]);
        return result.insertId;
    },

    getAllInquiries: async () => {
        const query = `
            SELECT 
                i.id,
                CONCAT(i.name, ' ', i.surname) as full_name,
                i.name,
                i.surname,
                i.email,
                i.contact,
                i.message,
                i.assigned_to,
                i.status,
                e.full_name as assigned_coordinator_name,
                DATE_FORMAT(i.created_at, '%Y-%m-%d %H:%i') as created_at
            FROM inquiries i
            LEFT JOIN employees e ON i.assigned_to = e.employee_id
            ORDER BY i.created_at DESC
        `;
        const [rows] = await db.execute(query);
        return rows;
    },

    deleteInquiry: async (id) => {
        const query = "DELETE FROM inquiries WHERE id = ?";
        await db.execute(query, [id]);
    },

    // Get sales marketing coordinators
    getSalesMarketingCoordinators: async () => {
        const query = `
            SELECT 
                e.employee_id,
                e.full_name,
                e.email,
                e.contact,
                r.name as position
            FROM employees e
            JOIN roles r ON e.role_id = r.id
            JOIN users u ON e.user_id = u.id
            WHERE r.name = 'sales_marketing_coordinator' 
            AND e.is_deleted = 0
            AND u.is_active = 1
            ORDER BY e.full_name
        `;
        const [rows] = await db.execute(query);
        return rows;
    },

    // Assign coordinator to inquiry
    assignCoordinator: async (inquiryId, coordinatorId) => {
        const query = `
            UPDATE inquiries 
            SET assigned_to = ?, status = 'Assigned' 
            WHERE id = ?
        `;
        await db.execute(query, [coordinatorId, inquiryId]);
    },

    // Get coordinator performance statistics
    getCoordinatorPerformance: async (coordinatorId) => {
        const query = `
            SELECT 
                COUNT(*) as total_inquiries,
                COALESCE(SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END), 0) as completed_inquiries,
                COALESCE(SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END), 0) as cancelled_inquiries,
                COALESCE(SUM(CASE WHEN status = 'Assigned' THEN 1 ELSE 0 END), 0) as assigned_inquiries,
                COALESCE(SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END), 0) as pending_inquiries
            FROM inquiries 
            WHERE assigned_to = ?
        `;
        const [rows] = await db.execute(query, [coordinatorId]);
        const result = rows[0] || {};
        
        // Ensure all values are numbers, not null
        return {
            total_inquiries: parseInt(result.total_inquiries) || 0,
            completed_inquiries: parseInt(result.completed_inquiries) || 0,
            cancelled_inquiries: parseInt(result.cancelled_inquiries) || 0,
            assigned_inquiries: parseInt(result.assigned_inquiries) || 0,
            pending_inquiries: parseInt(result.pending_inquiries) || 0
        };
=======
>>>>>>> 85f9240 (Initial commit)
    }
};

module.exports = CRMModel;
