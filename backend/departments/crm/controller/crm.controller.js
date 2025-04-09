<<<<<<< HEAD
const CRMModel = require("../model/crm.model");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = "C:/Users/Maddie/Documents/THESIS PROJECT - copy/uploads/resume";
        console.log("📁 Uploading to:", uploadPath);
        cb(null, uploadPath);
=======
const CRMModel = require("../model/crm.model");  // Remove destructuring
const multer = require("multer");
const path = require("path");

// 🔹 Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../../../uploads/resume/")); 
>>>>>>> development
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

<<<<<<< HEAD

const upload = multer({ storage });

const CRMController = {
=======
const upload = multer({ storage });

const CRMController = {
    // 🔹 Handle resume upload and save application
>>>>>>> development
    uploadResume: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "No file uploaded" });
            }

            const { full_name, email, phone, address } = req.body;
<<<<<<< HEAD
            const resumeFileName = req.file.filename;

            // Check if email already exists
=======
            const resumeFileName = req.file.filename; // Only store filename, not full path

            // 🔥 Check if email already exists
>>>>>>> development
            const emailExists = await CRMModel.checkApplicantEmail(email);
            if (emailExists) {
                return res.status(400).json({ error: "Applicant with this email already exists" });
            }

<<<<<<< HEAD
            // Save application to database
=======
            // 🔹 Save application to database
>>>>>>> development
            await CRMModel.storeApplication({
                full_name,
                email,
                phone,
                address,
<<<<<<< HEAD
                resume: resumeFileName
=======
                resume: resumeFileName  // Change 'resume_path' to 'resume'
>>>>>>> development
            });

            res.status(201).json({ message: "Application submitted successfully!" });

        } catch (error) {
<<<<<<< HEAD
            console.error(" Error uploading resume:", error);
=======
            console.error("❌ Error uploading resume:", error);
>>>>>>> development
            res.status(500).json({ error: "Failed to upload resume" });
        }
    }
};

module.exports = { CRMController, upload };
