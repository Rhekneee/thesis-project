const CRMModel = require("../model/crm.model");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = "C:/Users/Maddie/Documents/THESIS PROJECT - copy/uploads/resume";
        console.log("📁 Uploading to:", uploadPath);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});


const upload = multer({ storage });

const CRMController = {
    uploadResume: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "No file uploaded" });
            }

            const { full_name, email, phone, address } = req.body;
            const resumeFileName = req.file.filename;

            // Check if email already exists
            const emailExists = await CRMModel.checkApplicantEmail(email);
            if (emailExists) {
                return res.status(400).json({ error: "Applicant with this email already exists" });
            }

            // Save application to database
            await CRMModel.storeApplication({
                full_name,
                email,
                phone,
                address,
                resume: resumeFileName
            });

            res.status(201).json({ message: "Application submitted successfully!" });

        } catch (error) {
            console.error(" Error uploading resume:", error);
            res.status(500).json({ error: "Failed to upload resume" });
        }
    }
};

module.exports = { CRMController, upload };
