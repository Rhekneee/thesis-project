const express = require('express');
const router = express.Router();
const SCMController = require('../controller/scm.controller');
const logisticsAuth = require('../middleware/scm.middleware');

// Get all suppliers (logistics role only)
router.get('/suppliers', logisticsAuth, SCMController.getAllSuppliers);

// Add supplier (logistics role only)
router.post('/suppliers', logisticsAuth, SCMController.addSupplier);

module.exports = router;
