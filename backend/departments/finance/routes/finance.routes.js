const express = require('express');
const router = express.Router();
const financeController = require('../controller/finance.controller');
const { isFinanceAdmin } = require('../middleware/finance.middleware');

// Apply finance admin middleware to all routes
router.use(isFinanceAdmin);

// Payroll routes
router.get('/payrolls', financeController.getAllPayrolls);
router.get('/pending-payrolls', financeController.getPendingPayrolls);

// Add more routes here as needed
// Example:
// router.post('/approve-payroll/:id', financeController.approvePayroll);
// router.post('/reject-payroll/:id', financeController.rejectPayroll);
// router.get('/payroll-history', financeController.getPayrollHistory);

module.exports = router;
