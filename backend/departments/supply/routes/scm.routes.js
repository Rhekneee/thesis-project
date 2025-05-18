const express = require('express');
const router = express.Router();
const SCMController = require('../controller/scm.controller');
const logisticsAuth = require('../middleware/scm.middleware');

// Get all suppliers (logistics role only)
router.get('/suppliers', logisticsAuth, SCMController.getAllSuppliers);

// Add supplier (logistics role only)
router.post('/suppliers', logisticsAuth, SCMController.addSupplier);

// Update supplier (logistics role only)
router.put('/suppliers', logisticsAuth, SCMController.updateSupplier);

// Add purchase request (logistics role only)
router.post('/purchase_requests', logisticsAuth, SCMController.addPurchaseRequest);

module.exports = router;
