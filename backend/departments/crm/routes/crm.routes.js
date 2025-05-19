const express = require("express");
const router = express.Router();
const path = require('path');
const fs = require('fs');
// Import the correct controller and multer upload handler
const { CRMController, upload, developerUpload, handlePropertyUpload } = require("../controller/crm.controller");

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

// Property Management Routes
router.get('/properties', CRMController.getAllProperties);
router.get('/properties/:id', CRMController.getPropertyById);
router.post('/properties', handlePropertyUpload, CRMController.createProperty);
router.put('/properties/:id', handlePropertyUpload, CRMController.updateProperty);
router.get('/active-developers', CRMController.getActiveDeveloperCompanies);

module.exports = router;
