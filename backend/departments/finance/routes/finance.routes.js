const express = require('express');
const router = express.Router();
const financeController = require('../controller/finance.controller');
const { isFinanceAdmin } = require('../middleware/finance.middleware');

// Public webhook (must not require session/middleware)
router.post('/webhooks/paymongo', express.json({ type: '*/*' }), (req, res, next) => {
  // Preserve raw body for signature verification
  req.rawBody = JSON.stringify(req.body || {});
  next();
}, financeController.paymongoWebhook);

// Apply finance admin middleware to all routes
router.use(isFinanceAdmin);

// Payroll Periods Management Routes
router.get('/payroll-periods', isFinanceAdmin, financeController.getAllPayrollPeriods);
router.get('/payroll-periods/pending', isFinanceAdmin, financeController.getPendingPayrollPeriods);
router.get('/payroll-periods/approved', isFinanceAdmin, financeController.getApprovedPayrollPeriods);
router.get('/payroll-periods/:periodId', isFinanceAdmin, financeController.getPayrollPeriodById);
router.get('/payroll-periods/:periodId/entries', isFinanceAdmin, financeController.getPayrollEntriesByPeriod);
router.get('/payroll-periods/:periodId/summary', isFinanceAdmin, financeController.getPayrollPeriodSummary);
router.put('/payroll-periods/:periodId/status', isFinanceAdmin, financeController.updatePayrollPeriodStatus);
router.post('/payroll-periods/:periodId/create-payslips', isFinanceAdmin, financeController.createPayslipsFromPeriod);
// Attempt to approve period (will remain pending if not all entries approved)
router.post('/payroll-periods/:periodId/approve', isFinanceAdmin, financeController.attemptApprovePayrollPeriod);

// Approve a single payroll entry
router.post('/payrolls/:payrollId/approve', isFinanceAdmin, financeController.approvePayrollEntry);

// Submit remarks to a payroll entry (for pending entries)
router.post('/payrolls/:payrollId/remarks', isFinanceAdmin, financeController.submitPayrollRemarks);

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

// Purchases: pending supplier estimations (delivery cost/discount) awaiting finance
router.get('/purchases/pending-estimations', financeController.getPendingPurchaseEstimations);

// Approve a purchase estimation (set purchases.status='Processed')
router.post('/purchases/:purchaseId/approve-estimation', financeController.approvePurchaseEstimation);

// Update purchase estimation status (approve/reject with delivery cost and discount)
router.post('/purchases/:purchaseId/estimation', financeController.updatePurchaseEstimation);

// =============================================
// PURCHASE ORDER PAYMENTS
// These routes handle payment processing for delivered orders
// =============================================

// Get all purchase orders pending payment
router.get('/purchase-orders/pending-payment', financeController.getPurchaseOrdersPendingPayment);

// Process payment for delivered order
router.post('/purchase-orders/:poId/payment', financeController.processPurchaseOrderPayment);

// Update purchase order payment status
router.put('/purchase-orders/:poId/payment-status', financeController.updatePurchaseOrderPayment);

// =============================================
// REFUND MANAGEMENT
// These routes handle refund operations
// =============================================

// Get pending refund requests
router.get('/refunds/pending', financeController.getPendingRefunds);

// Approve or reject refund request
router.put('/refunds/:purchaseId/status', financeController.updateRefundStatus);

// Redeliver returned order
router.put('/purchases/:purchaseId/redeliver', financeController.redeliverOrder);

// Get all purchase orders from purchases table
router.get('/purchases/all', financeController.getAllPurchaseOrders);

// =============================================
// PAYSLIP MANAGEMENT ROUTES
// These routes handle payslip operations
// =============================================

// Create payslip from approved payroll
router.post('/payrolls/:payrollId/create-payslip', financeController.createPayslipFromPayroll);

// Get all payslips
router.get('/payslips', financeController.getAllPayslips);

// Get all payrolls
router.get('/payrolls', financeController.getAllPayrolls);

// Get payslip by ID with details
router.get('/payslips/:payslipId', financeController.getPayslipById);

// Update payslip status
router.put('/payrolls/:payslipId/status', financeController.updatePayslipStatus);

// Submit payroll to bank (individual entry)
router.post('/payrolls/:payrollId/submit-to-bank', financeController.submitPayrollEntryToBank);


// =============================================
// CASH MONITORING / PAYMONGO
// =============================================

// Create payment link
router.post('/payments/create-link', financeController.createPaymentLink);

// Manual insert inflow (admin tool)
router.post('/cash-monitoring/inflow', financeController.insertCashInflow);

// =============================================
// BANK ACCOUNT MANAGEMENT ROUTES
// These routes handle bank account operations
// =============================================

// Create new bank account
router.post('/bank-accounts', financeController.createBankAccount);

// Get all bank accounts
router.get('/bank-accounts', financeController.getAllBankAccounts);

// Get bank account by ID
router.get('/bank-accounts/:accountId', financeController.getBankAccountById);

// Update bank account
router.put('/bank-accounts/:accountId', financeController.updateBankAccount);

// Delete bank account
router.delete('/bank-accounts/:accountId', financeController.deleteBankAccount);

// =============================================
// NOTIFICATION MANAGEMENT ROUTES
// =============================================

// Get unread notifications for finance users
router.get('/notifications/unread', financeController.getUnreadNotifications);

// Mark notification as read
router.post('/notifications/:id/read', financeController.markNotificationAsRead);

// Mark all notifications as read
router.post('/notifications/read-all', financeController.markAllNotificationsAsRead);

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

// =============================================
// BANK DOCUMENT SUBMISSION ROUTES
// These routes handle bank document submission for payroll periods
// =============================================

// Submit bank documents for payroll period
router.post('/payroll-periods/:payrollPeriodId/submit-bank-documents', isFinanceAdmin, financeController.submitBankDocuments);

// Get bank submissions for a payroll period
router.get('/payroll-periods/:payrollPeriodId/bank-submissions', isFinanceAdmin, financeController.getBankSubmissions);

// Check if bank documents have been submitted
router.get('/payroll-periods/:payrollPeriodId/check-bank-submission', isFinanceAdmin, financeController.checkBankSubmission);

// Check if payroll period has approved payrolls
router.get('/payroll-periods/:payrollPeriodId/check-approved-payrolls', isFinanceAdmin, financeController.checkApprovedPayrolls);

module.exports = router;
