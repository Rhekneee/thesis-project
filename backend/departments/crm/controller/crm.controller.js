<<<<<<< HEAD
const CRMModel = require("../model/crm.model");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require('bcrypt');
const db = require('../../../db');  // Fix the database import path
const pathConfig = require('../../../utils/pathConfig'); // Import path configuration

// ✅ CommonJS-compatible PDF.js import
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/build/pdf.worker.js';

// 📁 Define the upload directory using path configuration
const uploadDir = pathConfig.getUploadPath('resume');

// 📦 Multer storage setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        console.log(`📁 Uploading to: ${uploadDir}`);
        cb(null, uploadDir);
=======
const CRMModel = require("../model/crm.model");  // Remove destructuring
const multer = require("multer");
const path = require("path");

// 🔹 Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../../../uploads/resume/")); 
>>>>>>> 85f9240 (Initial commit)
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

<<<<<<< HEAD
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

// Add developer profile picture upload configuration
const developerUploadDir = pathConfig.getUploadPath('developer_profiles');

// Ensure the upload directory exists
if (!fs.existsSync(developerUploadDir)) {
    fs.mkdirSync(developerUploadDir, { recursive: true });
}

const developerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, developerUploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'developer-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const developerUpload = multer({
    storage: developerStorage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Add property image upload configuration
const propertyUploadDir = pathConfig.getUploadPath('properties');

// Ensure the upload directory exists
if (!fs.existsSync(propertyUploadDir)) {
    fs.mkdirSync(propertyUploadDir, { recursive: true });
}

const propertyStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, propertyUploadDir);
    },
    filename: (req, file, cb) => {
        // Create a more unique filename with timestamp and random number
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `property-${timestamp}-${random}${ext}`);
    }
});

// Create multer instance with specific configuration
const propertyUpload = multer({
    storage: propertyStorage,
    fileFilter: (req, file, cb) => {
        // Only process property_image files
        if (file.fieldname === 'property_image') {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
            if (allowedTypes.includes(file.mimetype)) {
                console.log('File accepted:', file.originalname);
                cb(null, true);
            } else {
                console.log('Invalid file type:', file.mimetype);
                cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'));
            }
        } else {
            console.log('Skipping non-property_image file:', file.fieldname);
            cb(null, false);
        }
    },
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB limit
        files: 1, // Only allow one file
        fieldSize: 2 * 1024 * 1024, // 2MB limit for fields
        fields: 20, // Maximum number of non-file fields
        parts: 30 // Maximum number of parts (fields + files)
    }
}).single('property_image');

// Add error handling for multer
const handlePropertyUpload = (req, res, next) => {
    propertyUpload(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error('Multer error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File size exceeds 5MB limit' });
            }
            return res.status(400).json({ error: err.message });
        } else if (err) {
            console.error('Upload error:', err);
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};

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

// Define upload directories using path configuration
const resumeUploadDir = pathConfig.getUploadPath('resume');
const profilePictureUploadDir = pathConfig.getUploadPath('profile_pictures');
const virtualLocationUploadDir = pathConfig.getUploadPath('virtual_locations');

// Ensure upload directories exist
[resumeUploadDir, profilePictureUploadDir, virtualLocationUploadDir].forEach(dir => {
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

// Virtual location upload middleware (accepts JPG/JPEG/PDF)
const virtualLocationStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, virtualLocationUploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `vtloc-${timestamp}${ext}`);
    }
});

const virtualLocationUpload = multer({
    storage: virtualLocationStorage,
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'application/pdf'];
        if (allowed.includes(file.mimetype)) return cb(null, true);
        return cb(new Error('Only JPEG, JPG or PDF files are allowed.'));
    },
    limits: { fileSize: 10 * 1024 * 1024 }
}).single('picture');

// Virtual scene upload middleware (accepts JPG/JPEG/PNG for 360° images)
const virtualSceneUploadDir = pathConfig.getUploadPath('virtual_scenes');

if (!fs.existsSync(virtualSceneUploadDir)) {
    fs.mkdirSync(virtualSceneUploadDir, { recursive: true });
}

const virtualSceneStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, virtualSceneUploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `vtscene-${timestamp}${ext}`);
    }
});

const virtualSceneUpload = multer({
    storage: virtualSceneStorage,
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
        if (allowed.includes(file.mimetype)) return cb(null, true);
        return cb(new Error('Only JPEG, JPG or PNG files are allowed for 360° images.'));
    },
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit for high-res 360° images
}).single('image');

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

    // List all developers (for Clients page)
    getAllDevelopers: async (req, res) => {
        try {
            const developers = await CRMModel.getAllDevelopers();
            res.json({ success: true, developers });
        } catch (error) {
            console.error('Error fetching developers:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch developers' });
        }
    },

    // Handle the submission of a site visit request
    createVisitRequest: async (req, res) => {
        try {
            const { firstName, lastName, email, contactNumber, preferredDate, property } = req.body;

            const fullName = `${firstName} ${lastName}`;
            console.log("Full Name:", fullName);

            // Validate incoming data
            if (!firstName || !lastName || !email || !contactNumber || !preferredDate || !property ) {
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
                agent: 'Unassigned',  // Default agent value
            });

            res.status(201).json({ message: "Site visit request submitted successfully!" });
        } catch (error) {
            console.error("Error processing site visit request:", error);
            res.status(500).json({ error: `Failed to submit site visit request: ${error.message}` });
        }
    },

    // Handle the submission of a resume (HR functionality)
=======
const upload = multer({ storage });

const CRMController = {
    // 🔹 Handle resume upload and save application
>>>>>>> 85f9240 (Initial commit)
    uploadResume: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "No file uploaded" });
            }

<<<<<<< HEAD
            const { firstname, lastname, middleinitial, email, phone, age, birthdate } = req.body;
            console.log("Received HR data:", { firstname, lastname, middleinitial, email, phone, age, birthdate });

            // Check for missing required fields
            if (!firstname || !lastname || !middleinitial || !email || !phone || !age || !birthdate) {
                return res.status(400).json({ error: "Missing required fields in the form" });
            }

            const full_name = `${lastname}, ${firstname}`;
            const resumeFileName = req.file.filename;

            /* Check if the email already exists in the database (to avoid duplicates)
=======
            const { full_name, email, phone, address } = req.body;
            const resumeFileName = req.file.filename; // Only store filename, not full path

            // 🔥 Check if email already exists
>>>>>>> 85f9240 (Initial commit)
            const emailExists = await CRMModel.checkApplicantEmail(email);
            if (emailExists) {
                return res.status(400).json({ error: "Applicant with this email already exists" });
            }
<<<<<<< HEAD
            */

            const resumeFilePath = path.join(uploadDir, resumeFileName);
            console.log("Resume file path:", resumeFilePath);

            // Check if the uploaded file is a valid resume
            const isResume = await checkIfResume(resumeFilePath);
            if (!isResume) {
                return res.status(400).json({ error: "The uploaded file does not appear to be a valid resume" });
            }

            // Store the application data in the database
=======

            // 🔹 Save application to database
>>>>>>> 85f9240 (Initial commit)
            await CRMModel.storeApplication({
                full_name,
                email,
                phone,
<<<<<<< HEAD
                resume: resumeFileName,
                age,
                birthdate,
                middleinitial,
                role_id: req.body.role_id ? Number(req.body.role_id) : null // Ensure role_id is a number or null
=======
                address,
                resume: resumeFileName  // Change 'resume_path' to 'resume'
>>>>>>> 85f9240 (Initial commit)
            });

            res.status(201).json({ message: "Application submitted successfully!" });

        } catch (error) {
<<<<<<< HEAD
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

    // Developer Registration Controller
    registerDeveloper: async (req, res) => {
        try {
            const {
                username,
                email,
                password,
                first_name,
                middle_name,
                surname,
                position,
                contact_number,
                company_name,
                company_address,
                company_tin
            } = req.body;

            // Validate required fields
            if (!username || !email || !password || !first_name || !surname || 
                !position || !contact_number || !company_name || !company_address || !company_tin) {
                return res.status(400).json({ error: "All required fields must be filled" });
            }

            // Check if email already exists
            const emailExists = await CRMModel.checkDeveloperEmail(email);
            if (emailExists) {
                return res.status(400).json({ error: "Email is already registered" });
            }

            // Check if username already exists
            const usernameExists = await CRMModel.checkDeveloperUsername(username);
            if (usernameExists) {
                return res.status(400).json({ error: "Username is already taken" });
            }

            // Hash password
            const saltRounds = 10;
            const password_hash = await bcrypt.hash(password, saltRounds);

            // Handle profile picture upload
            let profile_picture = null;
            if (req.file) {
                profile_picture = req.file.filename;
            }

            // Store developer data
            const developerId = await CRMModel.storeDeveloper({
                username,
                email,
                profile_picture,
                password_hash,
                surname,
                first_name,
                middle_name: middle_name || null,
                position,
                contact_number,
                company_name,
                company_address,
                company_tin
            });

            res.status(201).json({ 
                success: true, 
                message: "Developer registration successful. Please wait for admin approval.",
                developerId 
            });

        } catch (error) {
            console.error("Error in developer registration:", error);
            res.status(500).json({ error: "Failed to register developer" });
        }
    },

    // Property Management Controller
    createProperty: async (req, res) => {
        try {
            console.log('Received property creation request:', req.body);
            console.log('File:', req.file);

            // Log all incoming data for debugging
            console.log('Processing property data:', {
                body: req.body,
                file: req.file ? {
                    filename: req.file.filename,
                    mimetype: req.file.mimetype,
                    size: req.file.size
                } : 'No file'
            });

            console.log('Received property data:', req.body);
            const {
                propertyName,
                propertyTypeSelect,
                customPropertyType,
                location,
                price,
                parking,
                bedrooms,
                bathrooms,
                floors,
                description
            } = req.body;

            // Validate required fields
            if (!propertyName || !location || !price || !parking || 
                !bedrooms || !bathrooms || !floors || !description) {
                console.log('Missing required fields:', {
                    propertyName, location, price, parking, 
                    bedrooms, bathrooms, floors, description
                });
                return res.status(400).json({ error: "All required fields must be filled" });
            }

            // Check if property image was uploaded
            if (!req.file) {
                console.log('No file uploaded');
                return res.status(400).json({ error: "Property image is required" });
            }

            // Determine property type
            const property_type = propertyTypeSelect === 'Other' ? customPropertyType : propertyTypeSelect;

            // Store property data
            try {
                const propertyId = await CRMModel.storeProperty({
                    property_name: propertyName,
                    property_type: property_type,
                    location: location,
                    price: parseFloat(price),
                    parking_spaces: parseInt(parking),
                    bedrooms: parseInt(bedrooms),
                    bathrooms: parseInt(bathrooms),
                    floors: parseInt(floors),
                    description: description,
                    property_image: req.file.filename,
                    virtual_tour_image: null
                });

                console.log('Property created successfully with ID:', propertyId);

                res.status(201).json({ 
                    success: true, 
                    message: "Property added successfully",
                    propertyId 
                });
            } catch (dbError) {
                console.error('Database error:', dbError);
                // If there's a database error, try to delete the uploaded file
                if (req.file) {
                    try {
                        fs.unlinkSync(path.join(propertyUploadDir, req.file.filename));
                    } catch (unlinkError) {
                        console.error('Error deleting uploaded file:', unlinkError);
                    }
                }
                throw dbError;
            }
        } catch (error) {
            console.error("Error in property creation:", {
                message: error.message,
                code: error.code,
                stack: error.stack,
                storageErrors: error.storageErrors,
                sqlMessage: error.sqlMessage,
                sqlState: error.sqlState
            });

            if (error.code === 'LIMIT_FILE_SIZE') {
                res.status(400).json({ error: "File size exceeds 5MB limit" });
            } else if (error.code === 'ER_DUP_ENTRY') {
                res.status(400).json({ error: "A property with this name already exists" });
            } else {
                res.status(500).json({ 
                    error: "Failed to create property",
                    details: error.message 
                });
            }
        }
    },

    // Get active developer companies for property locations
    getActiveDeveloperCompanies: async (req, res) => {
        try {
            const companies = await CRMModel.getActiveDeveloperCompanies();
            res.json(companies);
        } catch (error) {
            console.error("Error fetching active developer companies:", error);
            res.status(500).json({ error: "Failed to fetch active developer companies" });
        }
    },

    // Get all properties
    getAllProperties: async (req, res) => {
        try {
            const properties = await CRMModel.getAllProperties();
            res.json(properties);
        } catch (error) {
            console.error("Error fetching properties:", error);
            res.status(500).json({ error: "Failed to fetch properties" });
        }
    },

    // Get a single property by ID
    getPropertyById: async (req, res) => {
        try {
            const propertyId = req.params.id;
            const property = await CRMModel.getPropertyById(propertyId);
            
            if (!property) {
                return res.status(404).json({ error: "Property not found" });
            }
            
            res.json(property);
        } catch (error) {
            console.error("Error fetching property:", error);
            res.status(500).json({ error: "Failed to fetch property" });
        }
    },

    // Update property by ID
    updateProperty: async (req, res) => {
        try {
            console.log('BODY:', req.body);
            console.log('FILE:', req.file);
            const propertyId = req.params.id;
            const {
                property_name,
                property_type,
                location,
                price,
                parking_spaces,
                bedrooms,
                bathrooms,
                floors,
                status,
                description
            } = req.body;

            // Validate required fields
            if (!property_name || !property_type || !location || !price || !parking_spaces || !bedrooms || !bathrooms || !floors || !status || !description) {
                return res.status(400).json({ error: "All required fields must be filled" });
            }

            // Prepare update data
            const updateData = {
                property_name,
                property_type,
                location,
                price: parseFloat(price),
                parking_spaces: parseInt(parking_spaces),
                bedrooms: parseInt(bedrooms),
                bathrooms: parseInt(bathrooms),
                floors: parseInt(floors),
                status,
                description
            };
            if (req.file) {
                updateData.property_image = req.file.filename;
            }
            if (req.body.virtual_tour_image) {
                updateData.virtual_tour_image = req.body.virtual_tour_image;
            }

            await CRMModel.updateProperty(propertyId, updateData);
            res.json({ success: true, message: "Property updated successfully" });
        } catch (error) {
            console.error("Error updating property:", error);
            res.status(500).json({ error: "Failed to update property" });
        }
    },

    // Virtual Tour: Locations
    createVirtualLocation: async (req, res) => {
        try {
            const { location_name, description } = req.body;
            if (!location_name || location_name.trim() === '') {
                return res.status(400).json({ error: 'Location name is required' });
            }

            const created_by = req.session?.user?.id || null;
            let picture_path = null;
            
            // Handle file upload if present
            if (req.file) {
                picture_path = req.file.filename;
            }

            const id = await CRMModel.createVirtualLocation({ 
                location_name, 
                description, 
                picture_path, 
                created_by 
            });
            res.status(201).json({ success: true, id });
        } catch (error) {
            console.error('Error creating virtual location:', error);
            res.status(500).json({ error: 'Failed to create virtual location' });
        }
    },

    listVirtualLocations: async (req, res) => {
        try {
            const rows = await CRMModel.listVirtualLocations();
            res.json({ success: true, locations: rows });
        } catch (error) {
            console.error('Error listing virtual locations:', error);
            res.status(500).json({ error: 'Failed to fetch virtual locations' });
        }
    },

    getVirtualLocationById: async (req, res) => {
        try {
            const { id } = req.params;
            const location = await CRMModel.getVirtualLocationById(id);
            
            if (!location) {
                return res.status(404).json({ error: 'Location not found' });
            }
            
            res.json({ success: true, location });
        } catch (error) {
            console.error('Error fetching virtual location:', error);
            res.status(500).json({ error: 'Failed to fetch virtual location' });
        }
    },

    // Virtual Tour: Scenes
    createVirtualScene: async (req, res) => {
        try {
            console.log('📝 Creating virtual scene - Request body:', req.body);
            console.log('📝 Creating virtual scene - Request file:', req.file);
            
            const { scene_name, pitch, yaw, location_id } = req.body;
            
            console.log('📝 Parsed form data:', { scene_name, pitch, yaw, location_id });
            
            if (!scene_name || !location_id) {
                return res.status(400).json({ error: 'Scene name and location ID are required' });
            }

            let image_path = null;
            
            // Handle file upload if present
            if (req.file) {
                image_path = req.file.filename;
                console.log('📝 File uploaded:', image_path);
            } else {
                return res.status(400).json({ error: '360° image is required' });
            }

            const id = await CRMModel.createVirtualScene({ 
                location_id: parseInt(location_id),
                scene_name, 
                image_path, 
                pitch: 0, // Default pitch - will be updated when hotspots are added
                yaw: 0    // Default yaw - will be updated when hotspots are added
            });
            
            console.log('✅ Scene created with ID:', id);
            res.status(201).json({ success: true, id });
        } catch (error) {
            console.error('Error creating virtual scene:', error);
            res.status(500).json({ error: 'Failed to create virtual scene' });
        }
    },

    getVirtualScenesByLocation: async (req, res) => {
        try {
            const { location_id } = req.params;
            const scenes = await CRMModel.getVirtualScenesByLocation(location_id);
            res.json({ success: true, scenes });
        } catch (error) {
            console.error('Error fetching virtual scenes:', error);
            res.status(500).json({ error: 'Failed to fetch virtual scenes' });
        }
    },

    updateVirtualScene: async (req, res) => {
        try {
            const { id } = req.params;
            const { scene_name, pitch, yaw } = req.body;
            
            console.log('📝 Updating virtual scene:', { id, scene_name, pitch, yaw });
            console.log('📝 File received:', req.file);
            
            if (!scene_name) {
                return res.status(400).json({ error: 'Scene name is required' });
            }

            // Prepare update data
            const updateData = {
                scene_name,
                pitch: parseFloat(pitch) || 0,
                yaw: parseFloat(yaw) || 0
            };

            // Handle file upload if present
            if (req.file) {
                updateData.image_path = req.file.filename;
                console.log('📝 New image uploaded:', req.file.filename);
            }

            await CRMModel.updateVirtualScene(id, updateData);
            
            res.json({ success: true, message: 'Scene updated successfully' });
        } catch (error) {
            console.error('Error updating virtual scene:', error);
            res.status(500).json({ error: 'Failed to update virtual scene' });
        }
    },

    deleteVirtualScene: async (req, res) => {
        try {
            const { id } = req.params;
            
            console.log('🗑️ Deleting virtual scene:', id);
            
            // First, delete all hotspots associated with this scene
            await CRMModel.deleteVirtualHotspotsByScene(id);
            
            // Then delete the scene itself
            await CRMModel.deleteVirtualScene(id);
            
            res.json({ success: true, message: 'Scene and associated hotspots deleted successfully' });
        } catch (error) {
            console.error('Error deleting virtual scene:', error);
            res.status(500).json({ error: 'Failed to delete virtual scene' });
        }
    },

    // Virtual Tour: Hotspots
    createVirtualHotspot: async (req, res) => {
        try {
            const { scene_id, target_scene_id, type, pitch, yaw, tooltip, info_text } = req.body;
            
            if (!scene_id || !type || pitch === undefined || yaw === undefined || !tooltip) {
                return res.status(400).json({ error: 'Scene ID, type, pitch, yaw, and tooltip are required' });
            }

            if (type === 'link' && !target_scene_id) {
                return res.status(400).json({ error: 'Target scene ID is required for link hotspots' });
            }

            if (type === 'info' && !info_text) {
                return res.status(400).json({ error: 'Info text is required for info hotspots' });
            }

            const id = await CRMModel.createVirtualHotspot({
                scene_id: parseInt(scene_id),
                target_scene_id: target_scene_id ? parseInt(target_scene_id) : null,
                type,
                pitch: parseFloat(pitch),
                yaw: parseFloat(yaw),
                tooltip,
                info_text: info_text || null
            });
            
            res.status(201).json({ success: true, id });
        } catch (error) {
            console.error('Error creating virtual hotspot:', error);
            res.status(500).json({ error: 'Failed to create virtual hotspot' });
        }
    },

    getVirtualHotspotsByScene: async (req, res) => {
        try {
            const { scene_id } = req.params;
            const hotspots = await CRMModel.getVirtualHotspotsByScene(scene_id);
            res.json({ success: true, hotspots });
        } catch (error) {
            console.error('Error fetching virtual hotspots:', error);
            res.status(500).json({ error: 'Failed to fetch virtual hotspots' });
        }
    },

    updateVirtualHotspot: async (req, res) => {
        try {
            const { id } = req.params;
            const { target_scene_id, type, pitch, yaw, tooltip, info_text } = req.body;
            
            // Check if this is a position-only update (only pitch and yaw provided)
            if (pitch !== undefined && yaw !== undefined && !type && !tooltip) {
                // Position-only update
                await CRMModel.updateVirtualHotspotPosition(id, {
                    pitch: parseFloat(pitch),
                    yaw: parseFloat(yaw)
                });
                res.json({ success: true, message: 'Hotspot position updated successfully' });
                return;
            }
            
            // Full hotspot update - validate all required fields
            if (!type || pitch === undefined || yaw === undefined || !tooltip) {
                return res.status(400).json({ error: 'Type, pitch, yaw, and tooltip are required' });
            }

            if (type === 'link' && !target_scene_id) {
                return res.status(400).json({ error: 'Target scene ID is required for link hotspots' });
            }

            if (type === 'info' && !info_text) {
                return res.status(400).json({ error: 'Info text is required for info hotspots' });
            }

            await CRMModel.updateVirtualHotspot(id, {
                target_scene_id: target_scene_id ? parseInt(target_scene_id) : null,
                type,
                pitch: parseFloat(pitch),
                yaw: parseFloat(yaw),
                tooltip,
                info_text: info_text || null
            });
            
            res.json({ success: true, message: 'Hotspot updated successfully' });
        } catch (error) {
            console.error('Error updating virtual hotspot:', error);
            res.status(500).json({ error: 'Failed to update virtual hotspot' });
        }
    },

    updateVirtualHotspotPosition: async (req, res) => {
        try {
            const { id } = req.params;
            const { pitch, yaw } = req.body;
            
            if (pitch === undefined || yaw === undefined) {
                return res.status(400).json({ error: 'Pitch and yaw coordinates are required' });
            }

            await CRMModel.updateVirtualHotspotPosition(id, {
                pitch: parseFloat(pitch),
                yaw: parseFloat(yaw)
            });
            
            res.json({ success: true, message: 'Hotspot position updated successfully' });
        } catch (error) {
            console.error('Error updating virtual hotspot position:', error);
            res.status(500).json({ error: 'Failed to update virtual hotspot position' });
        }
    },

    deleteVirtualHotspot: async (req, res) => {
        try {
            const { id } = req.params;
            await CRMModel.deleteVirtualHotspot(id);
            res.json({ success: true, message: 'Hotspot deleted successfully' });
        } catch (error) {
            console.error('Error deleting virtual hotspot:', error);
            res.status(500).json({ error: 'Failed to delete virtual hotspot' });
        }
    },

    // Get developer details by ID
    getDeveloperById: async (req, res) => {
        try {
            const { id } = req.params;
            const developer = await CRMModel.getDeveloperById(id);

            if (!developer) {
                return res.status(404).json({ 
                    success: false,
                    error: "Developer not found" 
                });
            }

            // Return developer profile
            res.json({
                success: true,
                profile: {
                    id: developer.id,
                    username: developer.username,
                    email: developer.email,
                    first_name: developer.first_name,
                    middle_name: developer.middle_name,
                    surname: developer.surname,
                    position: developer.position,
                    contact_number: developer.contact_number,
                    company_name: developer.company_name,
                    company_address: developer.company_address,
                    company_tin: developer.company_tin,
                    profile_picture: developer.profile_picture,
                    status: developer.status,
                    role_name: developer.role_name,
                    created_at: developer.created_at,
                    updated_at: developer.updated_at
                }
            });

        } catch (error) {
            console.error('❌ DEBUG: Error in getDeveloperById:', error);
            res.status(500).json({ 
                success: false,
                error: "Failed to fetch developer details" 
            });
        }
    },

    // Handle inquiry submission
    submitInquiry: async (req, res) => {
        try {
            const { name, surname, email, contact, message } = req.body;

            // Validate required fields
            if (!name || !surname || !email || !contact || !message) {
                return res.status(400).json({ 
                    success: false,
                    error: "All fields are required" 
                });
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ 
                    success: false,
                    error: "Please enter a valid email address" 
                });
            }

            // Validate phone number format
            const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
            if (!phoneRegex.test(contact)) {
                return res.status(400).json({ 
                    success: false,
                    error: "Please enter a valid phone number" 
                });
            }

            // Store inquiry in database
            const inquiryId = await CRMModel.storeInquiry({
                name,
                surname,
                email,
                contact,
                message
            });

            res.status(201).json({ 
                success: true, 
                message: "Inquiry submitted successfully",
                inquiryId 
            });

        } catch (error) {
            console.error("Error submitting inquiry:", error);
            res.status(500).json({ 
                success: false,
                error: "Failed to submit inquiry. Please try again later." 
            });
        }
    },

    // Get all inquiries
    getAllInquiries: async (req, res) => {
        try {
            const inquiries = await CRMModel.getAllInquiries();
            res.json({
                success: true,
                inquiries: inquiries
            });
        } catch (error) {
            console.error("Error fetching inquiries:", error);
            res.status(500).json({ 
                success: false,
                error: "Failed to fetch inquiries" 
            });
        }
    },

    // Delete inquiry
    deleteInquiry: async (req, res) => {
        try {
            const { id } = req.params;
            
            if (!id) {
                return res.status(400).json({ 
                    success: false,
                    error: "Inquiry ID is required" 
                });
            }

            await CRMModel.deleteInquiry(id);
            res.json({ 
                success: true, 
                message: "Inquiry deleted successfully" 
            });
        } catch (error) {
            console.error("Error deleting inquiry:", error);
            res.status(500).json({ 
                success: false,
                error: "Failed to delete inquiry" 
            });
        }
    },

    // Get sales marketing coordinators
    getSalesMarketingCoordinators: async (req, res) => {
        try {
            const coordinators = await CRMModel.getSalesMarketingCoordinators();
            res.json({
                success: true,
                coordinators: coordinators
            });
        } catch (error) {
            console.error("Error fetching coordinators:", error);
            res.status(500).json({ 
                success: false,
                error: "Failed to fetch coordinators" 
            });
        }
    },

    // Assign coordinator to inquiry
    assignCoordinator: async (req, res) => {
        try {
            const { inquiryId, coordinatorId } = req.body;

            if (!inquiryId || !coordinatorId) {
                return res.status(400).json({ 
                    success: false,
                    error: "Inquiry ID and Coordinator ID are required" 
                });
            }

            await CRMModel.assignCoordinator(inquiryId, coordinatorId);
            res.json({ 
                success: true, 
                message: "Coordinator assigned successfully" 
            });
        } catch (error) {
            console.error("Error assigning coordinator:", error);
            res.status(500).json({ 
                success: false,
                error: "Failed to assign coordinator" 
            });
        }
    },

    // Get coordinator performance statistics
    getCoordinatorPerformance: async (req, res) => {
        try {
            const { coordinatorId } = req.params;

            if (!coordinatorId) {
                return res.status(400).json({ 
                    success: false,
                    error: "Coordinator ID is required" 
                });
            }

            const performance = await CRMModel.getCoordinatorPerformance(coordinatorId);
            res.json({ 
                success: true, 
                performance 
            });
        } catch (error) {
            console.error("Error fetching coordinator performance:", error);
            res.status(500).json({ 
                success: false,
                error: "Failed to fetch coordinator performance" 
            });
=======
            console.error("❌ Error uploading resume:", error);
            res.status(500).json({ error: "Failed to upload resume" });
>>>>>>> 85f9240 (Initial commit)
        }
    }
};

<<<<<<< HEAD
module.exports = { 
    CRMController, 
    upload,
    developerUpload,
    handlePropertyUpload,
    virtualLocationUpload,
    virtualSceneUpload
};
=======
module.exports = { CRMController, upload };
>>>>>>> 85f9240 (Initial commit)
