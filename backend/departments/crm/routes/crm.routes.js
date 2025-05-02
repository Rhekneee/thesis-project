const express = require("express");
const router = express.Router();
// Import the correct controller and multer upload handler
module.exports = { CRMController, upload }= require("../controller/crm.controller");

// 🔹 Resume Upload Route
router.post("/upload", upload.single("resume"), CRMController.uploadResume);
router.post('/submitVisitRequest', CRMController.createVisitRequest);

module.exports = router;
