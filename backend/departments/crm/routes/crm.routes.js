const express = require("express");
const router = express.Router();
const path = require('path');
const fs = require('fs');
// Import the correct controller and multer upload handlers
const { CRMController, upload, uploadProfilePicture } = require("../controller/crm.controller");
const verifySession = require("../middleware/crmAuthMiddleware");

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
router.post('/register/developer', CRMController.registerDeveloper);
router.get('/developer/check-session', CRMController.checkSession);

// Developer Profile Route
router.get('/developer/:id', verifySession, CRMController.getDeveloperProfile);

// Project Routes
router.get('/projects', verifySession, CRMController.getAllProjects);
router.get('/projects/:id', verifySession, CRMController.getProjectById);
router.post('/projects', verifySession, upload.fields([
    { name: 'project_image', maxCount: 1 },
    { name: 'documents', maxCount: 5 }
]), CRMController.createProject);
router.put('/projects/:id', verifySession, upload.fields([
    { name: 'project_image', maxCount: 1 },
    { name: 'documents', maxCount: 5 }
]), CRMController.updateProject);
router.delete('/projects/:id', verifySession, CRMController.deleteProject);

// Profile Picture Upload Route
router.post('/developer/:id/profile-picture', verifySession, uploadProfilePicture.single('profile_picture'), CRMController.uploadProfilePicture);

// Add route to serve default profile picture
router.get('/default-profile-picture', (req, res) => {
    const defaultPicturePath = path.join(__dirname, '..', '..', '..', 'uploads', 'profile_pictures', 'default-profile.png');
    
    // Check if default picture exists
    if (fs.existsSync(defaultPicturePath)) {
        res.sendFile(defaultPicturePath);
    } else {
        // If default picture doesn't exist, create a simple gray circle
        const canvas = require('canvas');
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
    }
});

module.exports = router;
