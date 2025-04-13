const express = require("express");
const router = express.Router();
const { CRMController, upload } = require("../controller/crm.controller");

// 🔹 Resume Upload Route
router.post("/upload", upload.single("resume"), CRMController.uploadResume);

module.exports = router;
