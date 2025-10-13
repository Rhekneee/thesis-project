const express = require("express");
const router = express.Router();
const { ManufacturingController, projectUpload, signatureUpload } = require("../controller/manu.controller");

// Project Routes
router.post('/projects', projectUpload.fields([
  { name: 'blueprint_files', maxCount: 10 }
]), ManufacturingController.createProject);
router.get('/projects', ManufacturingController.getAllProjects);
router.get('/projects/:id', ManufacturingController.getProjectById);
router.put('/projects/:id', projectUpload.single('project_image'), ManufacturingController.updateProject);
router.patch('/projects/:id/status', ManufacturingController.updateProjectStatus);
router.patch('/projects/:id/manufacturing-cost', ManufacturingController.updateManufacturingCost);

// Supply materials routes
router.post('/projects/:id/supply-materials', ManufacturingController.addSupplyMaterial);
router.get('/projects/:id/supply-materials', ManufacturingController.getSupplyMaterials);
router.put('/supply-materials/:supplyId', ManufacturingController.updateSupplyMaterial);
router.delete('/supply-materials/:supplyId', ManufacturingController.deleteSupplyMaterial);

// Labor routes
router.post('/projects/:id/labor', ManufacturingController.addLabor);
router.get('/projects/:id/labor', ManufacturingController.getLaborByProposal);
router.put('/labor/:laborId', ManufacturingController.updateLabor);
router.delete('/labor/:laborId', ManufacturingController.deleteLabor);

// Construction types (dropdown for labor)
router.get('/worker-types', ManufacturingController.getWorkerTypes);

router.get('/projects/developer/:developerId', ManufacturingController.getProjectsByDeveloper);
router.get('/projects/status/:status', ManufacturingController.getProjectsByStatus);

// Contract routes
router.post('/contracts', ManufacturingController.createContract);
router.get('/contracts', ManufacturingController.getAllContracts);
router.get('/contract-clauses', ManufacturingController.getContractClauses);
router.get('/contracts/developer/:developerId', ManufacturingController.getContractsByDeveloper);
router.get('/contracts/:contractId', ManufacturingController.getContractById);
router.post('/contracts/sign', signatureUpload.single('signature'), ManufacturingController.signContract);
router.post('/contracts/manufacturing-sign', signatureUpload.single('signature'), ManufacturingController.manufacturingSignContract);

// Foremen routes
router.get('/foremen', ManufacturingController.getForemen);

// Material request routes
router.post('/request-materials', ManufacturingController.createMaterialRequest);
router.get('/gather-request-material', ManufacturingController.getManufacturingRequestMaterials);
router.put('/mark-materials-received', ManufacturingController.markMaterialsReceived);

// Email notification routes
router.post('/send-labor-notification', ManufacturingController.sendLaborSubmissionEmail);

// Cost negotiation routes
router.post('/negotiate-cost', ManufacturingController.negotiateCost);

// Notification routes
router.get('/notifications/unread', ManufacturingController.getUnreadNotifications);
router.post('/notifications/:id/read', ManufacturingController.markNotificationAsRead);
router.post('/notifications/read-all', ManufacturingController.markAllNotificationsAsRead);

module.exports = router;
