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

// Get all purchase requests (logistics role only)
router.get('/purchase_requests', logisticsAuth, SCMController.getAllPurchaseRequests);

// Add purchase order (logistics role only)
router.post('/purchase_orders', logisticsAuth, SCMController.createPurchaseOrder);

// Get all purchase orders (logistics role only)
router.get('/purchase_orders', logisticsAuth, SCMController.getAllPurchaseOrders);

// Update purchase order status (logistics role only)
router.put('/purchase_orders/:orderId/status', logisticsAuth, SCMController.updatePurchaseOrderStatus);

// Get current user
router.get('/current-user', SCMController.getCurrentUser);

// Inventory routes (logistics role only)
router.post('/api/inventory', logisticsAuth, SCMController.addInventoryItem);
router.get('/api/inventory', logisticsAuth, SCMController.getAllInventoryItems);
router.get('/api/inventory/:inventoryId', logisticsAuth, SCMController.getInventoryItemById);
router.put('/api/inventory/:inventoryId', logisticsAuth, SCMController.updateInventoryItem);
router.delete('/api/inventory/:inventoryId', logisticsAuth, SCMController.deleteInventoryItem);

// Purchase Order Routes - Allow supplier access
router.get('/purchase-orders', SCMController.getAllPurchaseOrders);
router.put('/purchase-orders/:orderId/cost', SCMController.updatePurchaseOrderCost);
router.put('/purchase-orders/:orderId/invoice', SCMController.updatePurchaseOrderInvoice);
router.put('/purchase-orders/:orderId/status', SCMController.updatePurchaseOrderStatus);

// Keep logistics-only routes with middleware
router.get('/purchase_orders', logisticsAuth, SCMController.getAllPurchaseOrders);
router.post('/purchase_orders', logisticsAuth, SCMController.createPurchaseOrder);
router.put('/purchase_orders/:orderId/status', logisticsAuth, SCMController.updatePurchaseOrderStatus);

// Get approved purchase orders after cost estimation
router.get('/approved-orders', SCMController.getApprovedPurchaseOrders);

// Update purchase order delivery status (supplier only)
router.put('/orders/:orderId/delivery', SCMController.updatePurchaseOrderDelivery);

module.exports = router;
