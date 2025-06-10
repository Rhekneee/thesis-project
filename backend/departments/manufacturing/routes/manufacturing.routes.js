const express = require("express");
const router = express.Router();
const { ManufacturingController, projectUpload } = require("../controller/manu.controller");

// Project Routes
router.post('/projects', projectUpload.single('project_image'), ManufacturingController.createProject);
router.get('/projects', ManufacturingController.getAllProjects);
router.get('/projects/:id', ManufacturingController.getProjectById);
router.put('/projects/:id', projectUpload.single('project_image'), ManufacturingController.updateProject);
router.patch('/projects/:id/status', ManufacturingController.updateProjectStatus);
router.patch('/projects/:id/manufacturing-cost', ManufacturingController.updateManufacturingCost);
router.get('/projects/developer/:developerId', ManufacturingController.getProjectsByDeveloper);
router.get('/projects/status/:status', ManufacturingController.getProjectsByStatus);

module.exports = router;
