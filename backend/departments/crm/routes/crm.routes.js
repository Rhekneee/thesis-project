const express = require("express");
const router = express.Router();
// Import the correct controller and multer upload handler
const { CRMController, upload, developerUpload, handlePropertyUpload } = require("../controller/crm.controller");

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

// Property Management Routes
router.get('/properties', CRMController.getAllProperties);
router.get('/properties/:id', CRMController.getPropertyById);
router.post('/properties', handlePropertyUpload, CRMController.createProperty);
router.put('/properties/:id', handlePropertyUpload, CRMController.updateProperty);
router.get('/active-developers', CRMController.getActiveDeveloperCompanies);

module.exports = router;
