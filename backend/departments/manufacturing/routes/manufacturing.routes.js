const express = require("express");
const router = express.Router();
const { ManufacturingController, projectUpload, signatureUpload, constructionWorkerUpload } = require("../controller/manu.controller");
const { divisionProgressUpload } = require("../controller/manu.controller");

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
// Owners supply arrival (quantity_arrive + status update)
router.post('/owners-supply/mark-received', ManufacturingController.markOwnerSupplyArrival);

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
// Projects with billing status for payment overview
router.get('/projects-with-billing-status', ManufacturingController.getProjectsWithBillingStatus);

// Get completed projects for developer
router.get('/completed-projects', ManufacturingController.getCompletedProjectsByDeveloper);
router.get('/developers/:developerId/completed-projects', ManufacturingController.getCompletedProjectsForDeveloperId);

router.post('/save-division-progress', divisionProgressUpload.single('picture'), ManufacturingController.saveDivisionProgress);
router.post('/save-daily-log-progress', ManufacturingController.saveDailyLogProgress);
router.get('/daily-logs/:projectId', ManufacturingController.getDailyLogsProgress);
router.get('/unbilled-date-range/:projectId', ManufacturingController.getUnbilledDateRange);
router.get('/project-materials/:projectId', ManufacturingController.getProjectMaterialsProgress);
router.get('/project-material-releases/:projectId', ManufacturingController.getProjectMaterialReleases);
// Monitoring table for used supply (INTENDED: For Requested Materials section)
router.get('/monitoring-table/:projectId', ManufacturingController.getMonitoringTableForUsedSupply);
router.get('/division-progress/:projectId', ManufacturingController.getDivisionProgressByProject);
router.put('/division-progress/:entryId', divisionProgressUpload.single('picture'), ManufacturingController.updateDivisionProgress);
// Owner supply materials for request form (by proposal)
router.get('/owners-supply/project/:proposalId', ManufacturingController.getOwnerSupplyMaterialsByProposal);
// Aggregated project tracking (developer view)
router.get('/project-tracking/:projectId', ManufacturingController.getProjectTrackingDetail);
// INTENDED: Developer view daily logs and details
router.get('/dev-progress/daily/:projectId', ManufacturingController.getDeveloperDailyLogs);
router.get('/dev-progress/daily/detail/:logId', ManufacturingController.getDeveloperDailyLogDetail);
// Stage billing summary
router.post('/stage-billing', ManufacturingController.createStageBilling);
router.get('/stage-billing/labor-cost/:projectId', ManufacturingController.getLaborCostForRange);
router.get('/stage-billing/labor-cost-breakdown/:projectId', ManufacturingController.getLaborCostBreakdownByRole);
router.get('/stage-billings/:projectId', ManufacturingController.getStageBillingsByProject);
router.get('/stage-billing/detail/:billingId', ManufacturingController.getStageBillingDetail);

// Payment routes
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for payment proof uploads
const paymentProofStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', '..', '..', 'uploads', 'payment_proofs');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'payment-proof-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const paymentProofUpload = multer({
    storage: paymentProofStorage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF are allowed.'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.post('/process-payment', paymentProofUpload.single('proof'), ManufacturingController.processPayment);
router.post('/create-payment-intent', ManufacturingController.createPaymentIntent);

// PayMongo webhook endpoint (must be before body parsing middleware)
router.post('/paymongo-webhook', express.raw({type: 'application/json'}), ManufacturingController.paymongoWebhook);

// Payment callback routes
router.get('/payments/success', ManufacturingController.paymentSuccess);
router.get('/payments/cancel', ManufacturingController.paymentCancel);

// ===== VTOUR SUPPORT (INTENDED) =====
// Approved projects for Virtual Tour Portal typing dropdown
router.get('/vtour/approved-projects', ManufacturingController.getApprovedVtourProjects);

// ========== ATTENDANCE ROUTES ==========
router.post('/attendance/scan-qr', ManufacturingController.scanQRCode);
router.post('/attendance/record', ManufacturingController.recordAttendance);
router.get('/attendance/worker/:workerId', ManufacturingController.getWorkerAttendance);
router.get('/attendance/project/:projectId', ManufacturingController.getProjectAttendance);
router.get('/attendance/today', ManufacturingController.getTodayAttendance);

// ==================== PROJECT RATINGS (appended feature) ====================
router.post('/projects/:projectId/rating', ManufacturingController.submitProjectRating);
router.get('/projects/:projectId/rating', ManufacturingController.getProjectRating);
router.get('/ratings/summary', ManufacturingController.getRatingsSummary);

// =============================================
// DASHBOARD KPIs (Manufacturing) - Dedicated Endpoint
// =============================================
router.get('/dashboard/kpis', ManufacturingController.getDashboardKpis);

// ==================== VTOUR PERMISSIONS ====================
router.post('/vtour-permissions', ManufacturingController.submitVtourPermission);
router.get('/vtour-permissions/developer', ManufacturingController.getVtourPermissionsByDeveloper);
router.put('/vtour-permissions/:permissionId/status', ManufacturingController.updateVtourPermissionStatus);

// ===== FOREMAN DASHBOARD ROUTES (INTENDED) =====
// Total projects by foreman_code (employee_id)
router.get('/dashboard/foreman/project-count', ManufacturingController.getForemanProjectCount);

// Total construction workers for foreman's projects
router.get('/dashboard/foreman/workers-count', ManufacturingController.getForemanWorkersCount);

// Recent planning projects for foreman (limit 5)
router.get('/dashboard/foreman/planning-projects', ManufacturingController.getForemanPlanningProjects);

// Material usage trend (company vs owner) for foreman
router.get('/dashboard/foreman/material-usage-trend', ManufacturingController.getForemanMaterialUsageTrend);

module.exports = router;
