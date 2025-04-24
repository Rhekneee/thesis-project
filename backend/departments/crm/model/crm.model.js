const db = require("../../../db");

const CRMModel = {
    // Check if the applicant's email already exists in the database
    checkApplicantEmail: async (email) => {
        const query = "SELECT COUNT(*) AS count FROM applications WHERE email = ?";
        const [rows] = await db.execute(query, [email]);
        return rows[0].count > 0;
    },

    // Store application data in the database
    storeApplication: async (data) => {
        const query = `
            INSERT INTO applications (full_name, email, phone, resume, age, birthdate, middleinitial, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())`;

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
    }
};

module.exports = CRMModel;
