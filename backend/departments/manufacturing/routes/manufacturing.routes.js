const express = require("express");
const router = express.Router();
const { ManufacturingController, projectUpload, signatureUpload, constructionWorkerUpload } = require("../controller/manu.controller");

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
router.get('/projects-for-material-request', ManufacturingController.getProjectsForMaterialRequest);
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

// ========== CONSTRUCTION WORKERS ROUTES ==========

// Construction workers CRUD operations
router.get('/construction-workers', ManufacturingController.getAllConstructionWorkers);
router.get('/construction-workers/:workerId', ManufacturingController.getConstructionWorkerById);
router.post('/construction-workers', constructionWorkerUpload, ManufacturingController.addConstructionWorker);
router.put('/construction-workers/:workerId', ManufacturingController.updateConstructionWorker);
router.delete('/construction-workers/:workerId', ManufacturingController.deleteConstructionWorker);

// Supporting data for construction workers
router.get('/construction-roles', ManufacturingController.getAllConstructionRoles);
router.get('/projects', ManufacturingController.getAllProjects);
router.get('/projects/:projectId/labor-roles', ManufacturingController.getProjectLaborRoles);
router.get('/projects/:projectId/planning-labor-roles', ManufacturingController.getLaborRolesForPlanningProjects);
router.get('/projects-for-construction-workers', ManufacturingController.getProjectsForConstructionWorkers);

// Divisions endpoint
router.get('/divisions', ManufacturingController.getAllDivisions);

// Projects for progress tracking
router.get('/projects-for-progress', ManufacturingController.getProjectsForProgress);
router.post('/save-division-progress', ManufacturingController.saveDivisionProgress);
router.post('/save-daily-log-progress', ManufacturingController.saveDailyLogProgress);
router.get('/daily-logs/:projectId', ManufacturingController.getDailyLogsProgress);
router.get('/project-materials/:projectId', ManufacturingController.getProjectMaterialsProgress);
router.get('/division-progress/:projectId', ManufacturingController.getDivisionProgressByProject);

// ========== ATTENDANCE ROUTES ==========

// QR code scanning and attendance recording
router.post('/attendance/scan-qr', ManufacturingController.scanQRCode);
router.post('/attendance/record', ManufacturingController.recordAttendance);
router.get('/attendance/worker/:workerId', ManufacturingController.getWorkerAttendance);
router.get('/attendance/project/:projectId', ManufacturingController.getProjectAttendance);
router.get('/attendance/today', ManufacturingController.getTodayAttendance);

module.exports = router;
