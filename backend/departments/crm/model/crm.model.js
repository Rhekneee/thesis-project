const db = require("../../../db");

const CRMModel = {
    // 🔹 Check if an applicant email already exists
    checkApplicantEmail: async (email) => {
        const query = "SELECT COUNT(*) AS count FROM applications WHERE email = ?";
        const [rows] = await db.execute(query, [email]);
        return rows[0].count > 0;
    },

    // 🔹 Store application
    storeApplication: async (data) => {
        const query = `
            INSERT INTO applications (full_name, email, phone, address, resume, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'Pending', NOW())`;
        await db.execute(query, [data.full_name, data.email, data.phone, data.address, data.resume]); // Change 'resume_path' to 'resume'
    },


    // 🔹 Get all applications
    getAllApplications: async () => {
        const query = "SELECT * FROM applications";
        const [rows] = await db.execute(query);
        return rows;
    },

    // 🔹 Get application by ID
    getApplicationById: async (id) => {
        const query = "SELECT * FROM applications WHERE id = ?";
        const [rows] = await db.execute(query, [id]);
        return rows[0] || null;
    }
};

module.exports = CRMModel;
