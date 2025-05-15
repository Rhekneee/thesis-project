const CRMModel = require("../model/crm.model");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");

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

// Define upload directories
const resumeUploadDir = path.resolve("C:/Users/Maddie/Documents/THESIS PROJECT - copy/uploads/resume");
const profilePictureUploadDir = path.resolve("C:/Users/Maddie/Documents/THESIS PROJECT - copy/uploads/profile_pictures");

// Ensure upload directories exist
[resumeUploadDir, profilePictureUploadDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Resume upload storage
const resumeStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, resumeUploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// Profile picture upload storage
const profilePictureStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, profilePictureUploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// Resume upload middleware
const uploadResume = multer({
    storage: resumeStorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
            return cb(new Error('Only PDF files are allowed.'));
        }
        cb(null, true);
    }
});

// Profile picture upload middleware
const uploadProfilePicture = multer({
    storage: profilePictureStorage,
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed.'));
        }
        cb(null, true);
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// 📤 Controller logic for handling resume uploads
const CRMController = {
    // Check developer session
    checkSession: async (req, res) => {
        try {
            if (!req.session || !req.session.user) {
                return res.status(401).json({ 
                    success: false,
                    error: "Unauthorized: Please log in." 
                });
            }

            // Check if user is a developer
            if (req.session.user.role_name !== 'developer') {
                return res.status(403).json({ 
                    success: false,
                    error: "Forbidden: Developer access required." 
                });
            }

            // Return session data
            res.json({
                success: true,
                id: req.session.user.id,
                username: req.session.user.username,
                email: req.session.user.email,
                role_name: req.session.user.role_name
            });
        } catch (error) {
            console.error('Error in checkSession:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to check session' 
            });
        }
    },

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
    },

    // Register a new developer
    registerDeveloper: async (req, res) => {
        try {
            const {
                username,
                email,
                password,
                surname,
                first_name,
                middle_name,
                position,
                contact_number,
                company_name,
                company_address,
                company_tin
            } = req.body;

            // Validate required fields
            if (!username || !email || !password || !surname || !first_name) {
                return res.status(400).json({
                    error: 'Missing required fields. Please provide username, email, password, surname, and first name.'
                });
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    error: 'Invalid email format'
                });
            }

            // Validate password strength
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
            if (!passwordRegex.test(password)) {
                return res.status(400).json({
                    error: 'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character'
                });
            }

            // Hash password
            const saltRounds = 10;
            const password_hash = await bcrypt.hash(password, saltRounds);

            // Prepare developer data
            const developerData = {
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
                company_tin
            };

            // Register developer
            const result = await CRMModel.registerDeveloper(developerData);

            res.status(201).json({
                success: true,
                message: 'Developer registration successful. Account is pending approval.',
                developer_id: result.developer_id,
                user_id: result.user_id
            });

        } catch (error) {
            console.error('Error in registerDeveloper:', error);
            
            if (error.message === 'Email or username already exists') {
                return res.status(400).json({
                    error: 'Email or username already exists'
                });
            }

            res.status(500).json({
                error: 'An error occurred during registration'
            });
        }
    },

    // Project Controllers
    getAllProjects: async (req, res) => {
        try {
            const userId = req.session.user.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { page = 1, limit = 10, search = '' } = req.query;
            const projects = await CRMModel.getAllProjects(
                userId,
                parseInt(page),
                parseInt(limit),
                search
            );

            res.json({
                success: true,
                projects,
                page: parseInt(page),
                limit: parseInt(limit)
            });
        } catch (error) {
            console.error('Error in getAllProjects:', error);
            res.status(500).json({ error: 'Failed to fetch projects' });
        }
    },

    getProjectById: async (req, res) => {
        try {
            const userId = req.session.user.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const projectId = req.params.id;
            const project = await CRMModel.getProjectById(projectId, userId);

            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }

            res.json({
                success: true,
                project
            });
        } catch (error) {
            console.error('Error in getProjectById:', error);
            res.status(500).json({ error: 'Failed to fetch project' });
        }
    },

    createProject: async (req, res) => {
        try {
            const userId = req.session.user.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const projectData = {
                ...req.body,
                user_id: userId
            };

            const projectId = await CRMModel.createProject(projectData);
            res.status(201).json({
                success: true,
                message: 'Project created successfully',
                project_id: projectId
            });
        } catch (error) {
            console.error('Error in createProject:', error);
            res.status(500).json({ error: 'Failed to create project' });
        }
    },

    updateProject: async (req, res) => {
        try {
            const userId = req.session.user.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const projectId = req.params.id;
            const projectData = req.body;

            await CRMModel.updateProject(projectId, projectData, userId);
            res.json({
                success: true,
                message: 'Project updated successfully'
            });
        } catch (error) {
            console.error('Error in updateProject:', error);
            if (error.message === 'Project not found or unauthorized') {
                return res.status(404).json({ error: error.message });
            }
            res.status(500).json({ error: 'Failed to update project' });
        }
    },

    deleteProject: async (req, res) => {
        try {
            const userId = req.session.user.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const projectId = req.params.id;
            await CRMModel.deleteProject(projectId, userId);
            res.json({
                success: true,
                message: 'Project deleted successfully'
            });
        } catch (error) {
            console.error('Error in deleteProject:', error);
            if (error.message === 'Project not found or unauthorized') {
                return res.status(404).json({ error: error.message });
            }
            res.status(500).json({ error: 'Failed to delete project' });
        }
    },

    // Get developer profile
    getDeveloperProfile: async (req, res) => {
        try {
            const userId = req.params.id;
            
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'User ID is required'
                });
            }

            const profile = await CRMModel.getDeveloperProfile(userId);
            
            if (!profile) {
                return res.status(404).json({
                    success: false,
                    error: 'Developer profile not found'
                });
            }

            return res.json({
                success: true,
                profile: profile
            });
        } catch (error) {
            console.error('Error in getDeveloperProfile controller:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch developer profile'
            });
        }
    },

    // Upload profile picture
    uploadProfilePicture: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "No file uploaded" });
            }

            const userId = req.params.id;
            if (!userId) {
                return res.status(400).json({ error: "User ID is required" });
            }

            const filename = req.file.filename;
            
            // Update the profile picture in the database
            const query = `
                UPDATE developer_accounts 
                SET profile_picture = ? 
                WHERE id = ?
            `;
            
            await db.execute(query, [filename, userId]);

            res.json({
                success: true,
                message: "Profile picture uploaded successfully",
                filename: filename
            });

        } catch (error) {
            console.error("Error uploading profile picture:", error);
            res.status(500).json({ error: `Failed to upload profile picture: ${error.message}` });
        }
    }
};

module.exports = { 
    CRMController, 
    upload: uploadResume,
    uploadProfilePicture 
};
