const express = require('express');
const router = express.Router();
const PayrollController = require('../controller/finance.controller');
const authMiddleware = require('../middleware/finance.middleware');

// Apply session verification to all routes
router.use(authMiddleware.verifySession);

// Get all pending payrolls
router.get('/payrolls/pending', PayrollController.getPendingPayrolls);

// Get specific payroll details
router.get('/payrolls/:payrollId', PayrollController.getPayrollDetails);

// Update payroll status
router.put('/payrolls/:payrollId/status', PayrollController.updatePayrollStatus);

module.exports = router;
