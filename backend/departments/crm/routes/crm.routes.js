const express = require("express");
const router = express.Router();
const path = require('path');
const fs = require('fs');
// Import the correct controller and multer upload handler
const { CRMController, upload, developerUpload, handlePropertyUpload } = require("../controller/crm.controller");

// Add route to serve default profile picture
router.get('/default-profile-picture', (req, res) => {
    const uploadsDir = path.join(__dirname, '..', '..', '..', 'uploads', 'profile_pictures');
    const defaultPicturePath = path.join(uploadsDir, 'default-profile.png');
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Check if default picture exists
    if (fs.existsSync(defaultPicturePath)) {
        res.sendFile(defaultPicturePath);
        return;
    }

    // If default picture doesn't exist, try to create it
    try {
        // Check if canvas is installed
        let canvas;
        try {
            canvas = require('canvas');
        } catch (error) {
            console.error('Canvas package not installed:', error);
            // If canvas is not installed, send a simple SVG circle
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
                <circle cx="100" cy="100" r="100" fill="#e0e0e0"/>
            </svg>`;
            res.type('image/svg+xml');
            res.send(svg);
            return;
        }

        // Create a simple gray circle using canvas
        const c = canvas.createCanvas(200, 200);
        const ctx = c.getContext('2d');
        
        // Draw gray circle
        ctx.fillStyle = '#e0e0e0';
        ctx.beginPath();
        ctx.arc(100, 100, 100, 0, Math.PI * 2);
        ctx.fill();
        
        // Save the image
        const buffer = c.toBuffer('image/png');
        fs.writeFileSync(defaultPicturePath, buffer);
        
        // Send the image
        res.type('image/png');
        res.send(buffer);
    } catch (error) {
        console.error('Error creating default profile picture:', error);
        // If anything fails, send a simple SVG circle
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
            <circle cx="100" cy="100" r="100" fill="#e0e0e0"/>
        </svg>`;
        res.type('image/svg+xml');
        res.send(svg);
    }
});

// 🔹 Resume Upload Route
router.post("/upload", upload.single("resume"), CRMController.uploadResume);
router.post('/submitVisitRequest', CRMController.createVisitRequest);

// Job Posting Routes
router.get('/job-postings', CRMController.getAllJobPostings);
router.get('/job-postings/positions', CRMController.getAllPositions);
router.get('/job-postings/:id', CRMController.getJobPostingById);
router.post('/job-postings', CRMController.createJobPosting);
router.put('/job-postings/:id', CRMController.updateJobPosting);
router.delete('/job-postings/:id', CRMController.deleteJobPosting);

// Developer Registration Route
router.post('/developer/register', developerUpload.single('profile_picture'), CRMController.registerDeveloper);
router.get('/developer/check-session', CRMController.checkSession);

// Add route to get developer details by ID
router.get('/developer/:id', CRMController.getDeveloperById);

// Property Management Routes
router.get('/properties', CRMController.getAllProperties);
router.get('/properties/:id', CRMController.getPropertyById);
router.post('/properties', handlePropertyUpload, CRMController.createProperty);
router.put('/properties/:id', handlePropertyUpload, CRMController.updateProperty);
router.get('/active-developers', CRMController.getActiveDeveloperCompanies);

// Developer session check route
router.get('/developer/check-session', (req, res) => {
    if (req.session && req.session.user && req.session.user.is_external) {
        res.json({
            id: req.session.user.id,
            username: req.session.user.username,
            email: req.session.user.email,
            role_name: req.session.user.role_name
        });
    } else {
        res.status(401).json({ error: 'Not logged in as developer' });
    }
});

module.exports = router;
