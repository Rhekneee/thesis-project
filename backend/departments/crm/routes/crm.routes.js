const express = require("express");
const router = express.Router();
const path = require("path"); // ✅ THIS IS THE FIX
const { CRMController, upload } = require("../controller/crm.controller");

// Serve Resume Upload Form
router.get("/upload", (req, res) => {
  res.sendFile(path.join(__dirname, "../../../../views/customer.html"));
});

// Handle Resume Upload POST
router.post("/upload", upload.single("resume"), CRMController.uploadResume);

module.exports = router;
