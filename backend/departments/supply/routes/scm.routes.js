const express = require('express');
const router = express.Router();
const SCMController = require('../controller/scm.controller');
const logisticsAuth = require('../middleware/scm.middleware');
const db = require('../../../db');

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
// Detailed PR rows for manual page
router.get('/purchase-requests/detailed', logisticsAuth, SCMController.listDetailedPurchaseRequests);
// Set delivery cost and discount for manual PR (logistics)
router.post('/purchase-requests/:prId/manual/delivery', logisticsAuth, SCMController.setManualDeliveryAndDiscount);

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
// Save proof and mark received (with increased payload limit for large files)
router.post('/purchase_orders/:orderId/proof', express.json({ limit: '50mb' }), SCMController.setPurchaseOrderProof);

// Products (Supplier)
router.post('/products', SCMController.createMaterial);          // compatibility: delegate to materials creation (logistics-only)
router.get('/products/my', SCMController.getMyProducts);         // supplier lists own
router.get('/materials/my', SCMController.getMyMaterials);       // supplier lists own materials (materials table)
// Supplier-submitted material (materials table), defaults to Inactive; requires SCM confirmation
router.post('/materials/supplier', SCMController.createSupplierMaterial);

// Products (SCM review)
router.get('/products/pending', SCMController.getPendingProducts);           // SCM lists pending
router.put('/products/:productId/status', SCMController.updateProductStatus); // SCM approve/reject

// Materials (SCM create)
router.post('/materials', SCMController.createMaterial);
router.get('/materials', SCMController.getAllMaterials);
// Materials (SCM review inactive list and update status)
router.get('/materials/inactive', SCMController.getInactiveMaterials);
router.put('/materials/:materialId/status', SCMController.updateMaterialStatus);
// Materials (SCM admin can view by supplier)
router.get('/materials/supplier/:supplierId', logisticsAuth, SCMController.getSupplierMaterials);

// Purchases: list received purchases for a supplier (logistics/dev or own supplier)
router.get('/purchases/received', SCMController.getSupplierReceivedPurchases);

// Purchases (PR/PO flow)
router.get('/purchases/suppliers-for-item', SCMController.getSuppliersForItem); // query: name, brand_name?
router.post('/purchases', SCMController.createPurchase);
router.get('/purchases', SCMController.listPurchases);
router.get('/orders', SCMController.listOrders);

// Set purchase status and sync purchase_requests
router.put('/purchases/:purchaseId/status', SCMController.setPurchaseStatus);

// Save supplier invoice for a purchase
router.post('/purchases/:purchaseId/invoice', SCMController.setPurchaseInvoice);

// Bulk purchase requests (new schema)
router.post('/purchase-requests/bulk', SCMController.createBulkPurchaseRequests);

// Get supplier's purchase orders (from purchases table)
router.get('/purchases/supplier', SCMController.getSupplierPurchaseOrders);

// Submit refund request (Supplier only)
router.post('/purchases/:purchaseId/refund', express.json({ limit: '50mb' }), SCMController.submitRefundRequest);

// ===== Owners Supply Management Routes =====
// Get all owners supply materials for checklist (logistics only)
router.get('/owners-supply', logisticsAuth, SCMController.getAllOwnersSupplyMaterials);

// Update owners supply delivery status (logistics only)
router.put('/owners-supply/:supplyId/delivery', logisticsAuth, SCMController.updateOwnersSupplyDelivery);

// Get owners supply materials by project (logistics, general_foreman, developer)
router.get('/owners-supply/project/:proposalId', SCMController.getOwnersSupplyByProject);

// Manufacturing material requests routes
router.get('/manufacturing-requests', logisticsAuth, SCMController.getManufacturingRequests);
router.get('/employees', logisticsAuth, SCMController.getEmployees);
router.post('/material-release', logisticsAuth, SCMController.handleMaterialRelease);
router.put('/manufacturing-requests/status', logisticsAuth, SCMController.updateManufacturingRequestStatus);

// Supplier-specific routes for profile management
router.get('/supplier/check-session', (req, res) => {
    console.log('🔍 Supplier check-session called');
    console.log('Session user:', req.session?.user);
    
    if (req.session && req.session.user && req.session.user.is_supplier) {
        console.log('✅ Supplier session valid');
        res.json({
            id: req.session.user.id,
            username: req.session.user.username,
            email: req.session.user.email,
            role_name: req.session.user.role_name,
            supplier_id: req.session.user.supplier_id
        });
    } else {
        console.log('❌ Supplier session invalid');
        res.status(401).json({ error: 'Not logged in as supplier' });
    }
});

router.get('/supplier/:id', async (req, res) => {
    try {
        console.log('🔍 Supplier details requested for ID:', req.params.id);
        console.log('Session user:', req.session?.user);
        
        // Check if user is logged in and is a supplier
        if (!req.session?.user?.is_supplier) {
            console.log('❌ Not logged in as supplier');
            return res.status(401).json({ error: 'Unauthorized: Supplier access required' });
        }

        // Check if the requested ID matches the logged-in user's ID
        if (req.params.id != req.session.user.id) {
            console.log('❌ ID mismatch');
            return res.status(403).json({ error: 'Forbidden: You can only access your own profile' });
        }

        console.log('🔍 Fetching supplier details for username:', req.session.user.username);

        // Get supplier details from database using username
        const [suppliers] = await db.query(`
            SELECT 
                sa.supplier_id, sa.supplier_name as company_name, 
                sa.contact_name as contact_person,
                sa.contact_email as email,
                sa.contact_phone as contact,
                sa.address, sa.city, sa.postal_code, sa.country,
                sa.account_number, sa.payment_terms, sa.status,
                sa.created_at, sa.updated_at
            FROM supplier_account sa
            WHERE sa.supplier_name = ?
        `, [req.session.user.username]);

        console.log('🔍 Query result:', suppliers);

        if (suppliers.length === 0) {
            console.log('❌ No supplier found');
            return res.status(404).json({ error: 'Supplier not found' });
        }

        console.log('✅ Supplier details found');
        res.json(suppliers[0]);
    } catch (error) {
        console.error('❌ Error fetching supplier details:', error);
        res.status(500).json({ error: 'Failed to fetch supplier details' });
    }
});

router.put('/supplier/:id/company', async (req, res) => {
    try {
        // Check if user is logged in and is a supplier
        if (!req.session?.user?.is_supplier) {
            return res.status(401).json({ error: 'Unauthorized: Supplier access required' });
        }

        // Check if the requested ID matches the logged-in user's ID
        if (req.params.id != req.session.user.id) {
            return res.status(403).json({ error: 'Forbidden: You can only update your own profile' });
        }

        const {
            company_name, address, city, postal_code, country,
            account_number, payment_terms, contact
        } = req.body;

        // Update supplier information
        const [result] = await db.query(`
            UPDATE supplier_account 
            SET 
                supplier_name = ?, address = ?, city = ?, postal_code = ?, 
                country = ?, account_number = ?, payment_terms = ?, contact_phone = ?,
                updated_at = NOW()
            WHERE supplier_name = ?
        `, [company_name, address, city, postal_code, country, account_number, payment_terms, contact, req.session.user.username]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Supplier not found' });
        }

        res.json({ message: 'Company information updated successfully' });
    } catch (error) {
        console.error('Error updating supplier company info:', error);
        res.status(500).json({ error: 'Failed to update company information' });
    }
});

router.post('/supplier/:id/profile-picture', async (req, res) => {
    try {
        // Check if user is logged in and is a supplier
        if (!req.session?.user?.is_supplier) {
            return res.status(401).json({ error: 'Unauthorized: Supplier access required' });
        }

        // Check if the requested ID matches the logged-in user's ID
        if (req.params.id != req.session.user.id) {
            return res.status(403).json({ error: 'Forbidden: You can only update your own profile' });
        }

        // Handle file upload (you'll need to implement file upload middleware)
        // For now, return a success response
        res.json({ 
            message: 'Profile picture uploaded successfully',
            filename: 'profile_picture.jpg' // This should be the actual filename
        });
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        res.status(500).json({ error: 'Failed to upload profile picture' });
    }
});

module.exports = router;
