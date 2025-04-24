const express = require("express");
const router = express.Router();
// Import the correct controller and multer upload handler
const { HRController, upload } = require("../controller/crm.controller");

// 🔹 Resume Upload Route
router.post("/upload", upload.single("resume"), HRController.uploadResume);

module.exports = router;
