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


    
};

module.exports = CRMModel;
