const express = require("express");
const router = express.Router();
// Import the correct controller and multer upload handler
const { CRMController, upload, developerUpload, propertyUpload } = require("../controller/crm.controller");

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
router.post('/properties', propertyUpload, CRMController.createProperty);

module.exports = router;
