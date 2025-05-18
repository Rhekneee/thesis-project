const db = require("../../../db");
const bcrypt = require('bcrypt');

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
    }
};

module.exports = CRMModel;
