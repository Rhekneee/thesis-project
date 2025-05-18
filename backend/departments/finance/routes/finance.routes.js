const express = require('express');
const router = express.Router();
const financeController = require('../controller/finance.controller');
const { isFinanceAdmin } = require('../middleware/finance.middleware');

// Apply finance admin middleware to all routes
router.use(isFinanceAdmin);

// Payroll routes
router.get('/payrolls', financeController.getAllPayrolls);
router.get('/pending-payrolls', financeController.getPendingPayrolls);

// =============================================
// PURCHASE REQUESTS - Connected to Supply Department
// These routes handle purchase request operations from the supply department
// =============================================

// Get all purchase requests
router.get('/purchase-requests', financeController.getAllPurchaseRequests);

// Get approved purchase requests
router.get('/purchase-requests/approved', financeController.getApprovedPurchaseRequests);

// Approve purchase request
router.post('/purchase-requests/:requestId/approve', financeController.approvePurchaseRequest);

// Update purchase request status (approve/reject/transfer/deliver)
router.post('/purchase-requests/:requestId/status', financeController.updatePurchaseRequestStatus);

// =============================================
// PURCHASE ORDER ESTIMATIONS
// These routes handle purchase order estimations from suppliers
// =============================================

// Get all purchase orders with supplier estimations
router.get('/purchase-orders/estimations', financeController.getPurchaseOrdersWithEstimations);

// Update purchase order estimation status (approve/reject)
router.post('/purchase-orders/:poId/estimation', financeController.updatePurchaseOrderEstimation);

// Process payment for delivered order
router.post('/purchase-orders/:poId/payment', financeController.processPurchaseOrderPayment);

// =============================================
// PURCHASE ORDER PAYMENTS
// These routes handle payment processing for delivered orders
// =============================================

// Get all purchase orders pending payment
router.get('/purchase-orders/pending-payment', financeController.getPurchaseOrdersPendingPayment);

// Update purchase order payment status
router.post('/purchase-orders/:poId/payment', financeController.updatePurchaseOrderPayment);

// Add more routes here as needed
// Example:
// router.post('/approve-payroll/:id', financeController.approvePayroll);
// router.post('/reject-payroll/:id', financeController.rejectPayroll);
// router.get('/payroll-history', financeController.getPayrollHistory);

module.exports = router;
