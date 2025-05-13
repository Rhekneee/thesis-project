const CRMModel = require("../model/crm.model");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ✅ CommonJS-compatible PDF.js import
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/build/pdf.worker.js';

// 📁 Define the upload directory
const uploadDir = path.resolve("C:/Users/Maddie/Documents/THESIS PROJECT - copy/uploads/resume");

// 📦 Multer storage setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        console.log(`📁 Uploading to: ${uploadDir}`);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// 📎 Multer middleware for file filtering and upload
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
            return cb(new Error('Only PDF files are allowed.'));
        }
        cb(null, true);
    }
});

// 📄 Helper function: Check if uploaded file is a valid resume
const checkIfResume = async (filePath) => {
    try {
        const data = new Uint8Array(fs.readFileSync(filePath));
        const pdfDocument = await pdfjsLib.getDocument({ data }).promise;

        let content = '';
        for (let i = 1; i <= pdfDocument.numPages; i++) {
            const page = await pdfDocument.getPage(i);
            const textContent = await page.getTextContent();
            textContent.items.forEach(item => {
                content += item.str.toLowerCase();
            });
        }

        console.log("Extracted content from PDF:", content);

        const resumeKeywords = ['experience', 'education', 'skills', 'references'];
        return resumeKeywords.some(keyword => content.includes(keyword));

    } catch (error) {
        console.error("Error parsing PDF:", error);
        return false;
    }
};

// 📤 Controller logic for handling resume uploads
const CRMController = {
    // Handle the submission of a site visit request
    createVisitRequest: async (req, res) => {
        try {
            const { firstName, lastName, email, contactNumber, preferredDate, pickUpLocation, property } = req.body;

            const fullName = `${firstName} ${lastName}`;
            console.log("Full Name:", fullName);

            // Validate incoming data
            if (!firstName || !lastName || !email || !contactNumber || !preferredDate || !pickUpLocation || !property ) {
                return res.status(400).json({ error: "Missing required fields in the form" });
            }

            // Check if the email already exists
            const emailExists = await CRMModel.checkVisitRequestEmail(email);
            if (emailExists) {
                return res.status(400).json({ error: "Email is already registered for a site visit request" });
            }

            // Store the site visit request in the database
            await CRMModel.storeVisitRequest({
                name: fullName,
                email,
                contact: contactNumber,
                property: property || 'Unknown',  // Default property if not provided
                preferredDate,
                pickUpLocation,
                agent: 'Unassigned',  // Default agent value
            });

            res.status(201).json({ message: "Site visit request submitted successfully!" });
        } catch (error) {
            console.error("Error processing site visit request:", error);
            res.status(500).json({ error: `Failed to submit site visit request: ${error.message}` });
        }
    },

    // Handle the submission of a resume (HR functionality)
    uploadResume: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "No file uploaded" });
            }

            const { firstname, lastname, middleinitial, email, phone, age, birthdate } = req.body;
            console.log("Received HR data:", { firstname, lastname, middleinitial, email, phone, age, birthdate });

            // Check for missing required fields
            if (!firstname || !lastname || !middleinitial || !email || !phone || !age || !birthdate) {
                return res.status(400).json({ error: "Missing required fields in the form" });
            }

            const full_name = `${lastname}, ${firstname}`;
            const resumeFileName = req.file.filename;

            /* Check if the email already exists in the database (to avoid duplicates)
            const emailExists = await CRMModel.checkApplicantEmail(email);
            if (emailExists) {
                return res.status(400).json({ error: "Applicant with this email already exists" });
            }
            */

            const resumeFilePath = path.join(uploadDir, resumeFileName);
            console.log("Resume file path:", resumeFilePath);

            // Check if the uploaded file is a valid resume
            const isResume = await checkIfResume(resumeFilePath);
            if (!isResume) {
                return res.status(400).json({ error: "The uploaded file does not appear to be a valid resume" });
            }

            // Store the application data in the database
            await CRMModel.storeApplication({
                full_name,
                email,
                phone,
                resume: resumeFileName,
                age,
                birthdate,
                middleinitial
            });

            res.status(201).json({ message: "Application submitted successfully!" });

        } catch (error) {
            console.error("Error uploading resume:", error);
            res.status(500).json({ error: `Failed to upload resume: ${error.message}` });
        }
    },

    // Job Posting Controllers
    getAllJobPostings: async (req, res) => {
        try {
            const { page = 1, search = '' } = req.query;
            const result = await CRMModel.getAllJobPostings(parseInt(page), 10, search);
            res.json(result);
        } catch (error) {
            console.error("Error fetching job postings:", error);
            res.status(500).json({ error: "Failed to fetch job postings" });
        }
    },

    getJobPostingById: async (req, res) => {
        try {
            const jobId = req.params.id;
            const jobPosting = await CRMModel.getJobPostingById(jobId);
            
            if (!jobPosting) {
                return res.status(404).json({ error: "Job posting not found" });
            }
            
            res.json(jobPosting);
        } catch (error) {
            console.error("Error fetching job posting:", error);
            res.status(500).json({ error: "Failed to fetch job posting" });
        }
    },

    createJobPosting: async (req, res) => {
        try {
            const {
                position_id,
                job_description,
                qualifications,
                location,
                application_deadline,
                how_to_apply
            } = req.body;

            // Validate required fields
            if (!position_id || !job_description || !qualifications || !location || 
                !application_deadline || !how_to_apply) {
                return res.status(400).json({ error: "All fields are required" });
            }

            const jobId = await CRMModel.createJobPosting({
                position_id,
                job_description,
                qualifications,
                location,
                application_deadline,
                how_to_apply
            });

            res.status(201).json({ 
                success: true, 
                message: "Job posting created successfully",
                jobId 
            });
        } catch (error) {
            console.error("Error creating job posting:", error);
            res.status(500).json({ error: "Failed to create job posting" });
        }
    },

    updateJobPosting: async (req, res) => {
        try {
            const jobId = req.params.id;
            const {
                position_id,
                job_description,
                qualifications,
                location,
                application_deadline,
                how_to_apply
            } = req.body;

            // Validate required fields
            if (!position_id || !job_description || !qualifications || !location || 
                !application_deadline || !how_to_apply) {
                return res.status(400).json({ error: "All fields are required" });
            }

            await CRMModel.updateJobPosting(jobId, {
                position_id,
                job_description,
                qualifications,
                location,
                application_deadline,
                how_to_apply
            });

            res.json({ 
                success: true, 
                message: "Job posting updated successfully" 
            });
        } catch (error) {
            console.error("Error updating job posting:", error);
            res.status(500).json({ error: "Failed to update job posting" });
        }
    },

    deleteJobPosting: async (req, res) => {
        try {
            const jobId = req.params.id;
            await CRMModel.deleteJobPosting(jobId);
            res.json({ 
                success: true, 
                message: "Job posting deleted successfully" 
            });
        } catch (error) {
            console.error("Error deleting job posting:", error);
            res.status(500).json({ error: "Failed to delete job posting" });
        }
    },

    getAllPositions: async (req, res) => {
        try {
            const positions = await CRMModel.getAllPositions();
            res.json(positions);
        } catch (error) {
            console.error("Error fetching positions:", error);
            res.status(500).json({ error: "Failed to fetch positions" });
        }
    }
};

module.exports = { CRMController, upload };
