const CRMModel = require("../model/crm.model");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require('bcrypt');

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

// Add developer profile picture upload configuration
const developerUploadDir = path.resolve("C:/Users/Maddie/Documents/THESIS PROJECT - copy/uploads/developer_profiles");

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
const propertyUploadDir = path.resolve("C:/Users/Maddie/Documents/THESIS PROJECT - copy/uploads/properties");

// Ensure the upload directory exists
if (!fs.existsSync(propertyUploadDir)) {
    fs.mkdirSync(propertyUploadDir, { recursive: true });
}

const propertyStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, propertyUploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'property-' + uniqueSuffix + path.extname(file.originalname));
    }
});

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
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1 // Only allow one file
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
            console.error("Error in property creation:", error);
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
    }
};

module.exports = { 
    CRMController, 
    upload,
    developerUpload,
    handlePropertyUpload
};
