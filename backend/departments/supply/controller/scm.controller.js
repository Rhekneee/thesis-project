const SCMModel = require('../model/scm.model');
const { sendSupplierAccountNotification, sendManualSupplierWelcome } = require('../../../utils/emailService');

const SCMController = {
    // Get all suppliers
    getAllSuppliers: async (req, res) => {
        try {
            const suppliers = await SCMModel.getAllSuppliers();
            res.json(suppliers);
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            res.status(500).json({ error: 'Failed to fetch suppliers.' });
        }
    },

    // Return detailed PR rows for manual page table
    listDetailedPurchaseRequests: async (req, res) => {
        try {
            if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
            const u = req.session.user;
            const allowed = (u.role_name === 'logistics') || [1,26].includes(u.role_id);
            if (!allowed) return res.status(403).json({ error: 'Forbidden' });
            const rows = await SCMModel.listDetailedPurchaseRequests();
            res.json({ success: true, rows });
        } catch (e) {
            console.error('Error in listDetailedPurchaseRequests:', e);
            res.status(500).json({ success: false, error: 'Failed to fetch purchase requests' });
        }
    },

    // Logistics submits delivery cost and discount for manual PR after finance approval
    setManualDeliveryAndDiscount: async (req, res) => {
        try {
            if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
            const u = req.session.user;
            const allowed = (u.role_name === 'logistics') || [1,26].includes(u.role_id);
            if (!allowed) return res.status(403).json({ error: 'Forbidden' });
            const { prId } = req.params;
            const { delivery_cost, discount } = req.body;
            const dc = Number(delivery_cost) || 0;
            const dis = Number(discount) || 0;
            // Update purchases rows linked to this PR (manual flow stores adjustments here)
            const result = await SCMModel.updatePurchaseStatus(Number(prId), 'Processed', { delivery_cost: dc, discount: dis });
            if (!result.success) return res.status(404).json({ error: result.error || 'Update failed' });
            return res.json({ success: true });
        } catch (e) {
            console.error('Error in setManualDeliveryAndDiscount:', e);
            res.status(500).json({ error: 'Failed to save delivery/discount' });
        }
    },

    addSupplier: async (req, res) => {
        try {
            const {
                supplier_name,
                contact_name,
                contact_email,
                contact_phone,
                address,
                city,
                postal_code,
                country,
                account_number,
                payment_terms,
                supplier_type,
                categories
            } = req.body;

            // Basic validation
            if (!supplier_name || !contact_name || !contact_email || !contact_phone || 
                !address || !city || !postal_code || !country || !account_number || !payment_terms) {
                return res.status(400).json({ error: 'All fields are required.' });
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contact_email)) {
                return res.status(400).json({ error: 'Invalid email format.' });
            }

            // Validate phone number (11 digits)
            if (!/^\d{11}$/.test(contact_phone)) {
                return res.status(400).json({ error: 'Phone number must be exactly 11 digits.' });
            }

            // Insert supplier and create accounts
            const { supplierId, userId } = await SCMModel.addSupplier({
                supplier_name,
                contact_name,
                contact_email,
                contact_phone,
                address,
                city,
                postal_code,
                country,
                account_number,
                payment_terms,
                status: 'active',
                supplier_type: supplier_type || 'manual',
                categories: categories || []
            });

            // Send supplier email based on type (do not block response if it fails)
            if ((supplier_type || '').toLowerCase() === 'manual') {
                sendManualSupplierWelcome(
                    contact_email,
                    supplier_name
                ).catch(err => console.error('Failed to send manual supplier welcome email:', err));
            } else {
                sendSupplierAccountNotification(
                    contact_email,
                    supplier_name,
                    'default123',
                    'https://mdb-construction-25b433e6e5d5.herokuapp.com/'
                ).catch(err => console.error('Failed to send supplier account email:', err));
            }

            res.status(201).json({ 
                message: 'Supplier and accounts created successfully.',
                supplierId,
                userId,
                defaultPassword: 'default123' // Include this so the frontend can show it
            });
        } catch (error) {
            console.error('Error adding supplier:', error);
            if (error.code === 'ER_DUP_ENTRY') {
                if (error.message.includes('username')) {
                    res.status(400).json({ error: 'A supplier with this name already exists.' });
                } else if (error.message.includes('email')) {
                    res.status(400).json({ error: 'A supplier with this email already exists.' });
                } else {
                    res.status(400).json({ error: 'Duplicate entry found.' });
                }
            } else {
                res.status(500).json({ error: 'Failed to add supplier.' });
            }
        }
    },

    updateSupplier: async (req, res) => {
        try {
            const {
                supplier_id,
                supplier_name,
                contact_name,
                contact_email,
                contact_phone,
                address,
                city,
                postal_code,
                country,
                account_number,
                payment_terms,
                status,
                supplier_type,
                categories
            } = req.body;

            if (!supplier_id || !supplier_name || !contact_name || !contact_email || !contact_phone || !address || !city || !postal_code || !country || !account_number || !payment_terms) {
                return res.status(400).json({ error: 'All fields are required.' });
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contact_email)) {
                return res.status(400).json({ error: 'Invalid email format.' });
            }

            if (!/^\d{11}$/.test(contact_phone)) {
                return res.status(400).json({ error: 'Phone number must be exactly 11 digits.' });
            }

            await SCMModel.updateSupplier(supplier_id, {
                supplier_name,
                contact_name,
                contact_email,
                contact_phone,
                address,
                city,
                postal_code,
                country,
                account_number,
                payment_terms,
                status: status || 'active',
                supplier_type: supplier_type || 'manual',
                categories: categories || []
            });

            res.json({ message: 'Supplier updated successfully.' });
        } catch (error) {
            console.error('Error updating supplier:', error);
            res.status(500).json({ error: 'Failed to update supplier.' });
        }
    },

    addPurchaseRequest: async (req, res) => {
        try {
            const { department, material_type, quantity, unit, justification } = req.body;

            // Authentication check
            if (!req.session?.user?.role_name === 'logistics') {
                return res.status(403).json({ error: 'Forbidden: Logistics access required.' });
            }

            // Input validation
            if (!department || !material_type || !quantity || !unit || !justification) {
                return res.status(400).json({ 
                    error: 'Missing required fields',
                    details: {
                        department: !department ? 'Department is required' : null,
                        material_type: !material_type ? 'Material type is required' : null,
                        quantity: !quantity ? 'Quantity is required' : null,
                        unit: !unit ? 'Unit is required' : null,
                        justification: !justification ? 'Justification is required' : null
                    }
                });
            }

            // Validate quantity is a positive number
            const quantityNum = parseFloat(quantity);
            if (isNaN(quantityNum) || quantityNum <= 0) {
                return res.status(400).json({ error: 'Quantity must be a positive number' });
            }

            // Validate material type
            const validMaterials = [
                'Cement', 'Concrete', 'Steel', 'Rebar', 'Gravel', 'Sand',
                'Wood / Lumber', 'Bricks', 'Tiles', 'Glass', 'Asphalt',
                'PVC Pipes', 'Copper Wiring', 'Aluminum Sheets', 'Paint',
                'Insulation', 'Drywall / Gypsum'
            ];
            if (!validMaterials.includes(material_type)) {
                return res.status(400).json({ error: 'Invalid material type' });
            }

            // Use session username for requested_by
            const requested_by = req.session.user.username;

            const insertId = await SCMModel.addPurchaseRequest({
                requested_by,
                department,
                material_type,
                quantity: quantityNum,
                unit,
                justification,
                status: 'Pending'
            });

            res.status(201).json({ 
                message: 'Purchase request created successfully.',
                request_id: insertId,
                request: {
                    material_type,
                    quantity: quantityNum,
                    unit,
                    justification,
                    status: 'Pending'
                }
            });
        } catch (error) {
            console.error('Error creating purchase request:', error);
            if (error.message === 'Quantity must be a positive number') {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ 
                error: 'Failed to create purchase request.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Get all purchase requests
    getAllPurchaseRequests: async (req, res) => {
        try {
            // Authentication check
            if (!req.session?.user?.role_name === 'logistics') {
                return res.status(403).json({ error: 'Forbidden: Logistics access required.' });
            }

            const requests = await SCMModel.getAllPurchaseRequests();
            
            // Format the response
            const formattedRequests = requests.map(request => ({
                request_id: request.request_id,
                material_type: request.material_type,
                quantity: request.quantity,
                unit: request.unit,
                justification: request.justification,
                status: request.status,
                request_date: request.request_date,
                department: request.department,
                requested_by: request.requested_by,
                approved_by: request.approved_by,
                approved_date: request.approved_date,
                remarks: request.remarks
            }));

            res.json({
                requests: formattedRequests,
                total: formattedRequests.length,
                status_counts: {
                    pending: formattedRequests.filter(r => r.status === 'Pending').length,
                    approved: formattedRequests.filter(r => r.status === 'Approved').length,
                    in_transit: formattedRequests.filter(r => r.status === 'In Transit').length,
                    delivered: formattedRequests.filter(r => r.status === 'Delivered').length,
                    rejected: formattedRequests.filter(r => r.status === 'Rejected').length
                }
            });
        } catch (error) {
            console.error('Error fetching purchase requests:', error);
            res.status(500).json({ 
                error: 'Failed to fetch purchase requests.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Get current user
    getCurrentUser: async (req, res) => {
        if (!req.session?.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        res.json({
            id: req.session.user.id,
            username: req.session.user.username,
            role_name: req.session.user.role_name
        });
    },

    // Create new purchase order
    createPurchaseOrder: async (req, res) => {
        try {
            const {
                pr_id,
                supplier_id,
                material_type,
                quantity,
                unit,
                remarks
            } = req.body;

            // Authentication check
            if (!req.session?.user?.username) {
                return res.status(401).json({ error: 'Unauthorized: User not logged in' });
            }

            // Input validation
            if (!pr_id || !supplier_id || !material_type || !quantity || !unit) {
                return res.status(400).json({ 
                    error: 'Missing required fields',
                    details: {
                        pr_id: !pr_id ? 'Purchase Request ID is required' : null,
                        supplier_id: !supplier_id ? 'Supplier ID is required' : null,
                        material_type: !material_type ? 'Material type is required' : null,
                        quantity: !quantity ? 'Quantity is required' : null,
                        unit: !unit ? 'Unit is required' : null
                    }
                });
            }

            // Create the purchase order using session username
            const orderId = await SCMModel.createPurchaseOrder({
                pr_id,
                supplier_id,
                material_type,
                quantity,
                unit,
                remarks: remarks || '',
                created_by: req.session.user.username  // Use the session username
            });

            res.status(201).json({ 
                message: 'Purchase order created successfully.',
                order_id: orderId
            });
        } catch (error) {
            console.error('Error creating purchase order:', error);
            res.status(500).json({ 
                error: 'Failed to create purchase order.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Get all purchase orders
    getAllPurchaseOrders: async (req, res) => {
        try {
            // Check if user is authenticated
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            // Get all orders
            // Prefer purchases-based listing when present
            let orders = await SCMModel.listPurchases();
            try {
                console.log('🔎 [Orders] listPurchases count:', Array.isArray(orders) ? orders.length : 'not array');
                if (Array.isArray(orders) && orders.length) {
                    console.log('🔎 [Orders] sample row:', {
                        purchase_id: orders[0].purchase_id,
                        supplier_name: orders[0].supplier_name,
                        supplier_type: orders[0].supplier_type
                    });
                }
            } catch (_) {}
            
            // If user is a supplier, filter orders for their supplier_id
            if (req.session.user.role_id === 27) { // 27 is supplier role
                const supplierId = req.session.user.supplier_id; // Get supplier_id from session
                if (!supplierId) {
                    return res.status(403).json({ error: 'Supplier ID not found in user session' });
                }
                orders = orders.filter(order => Number(order.supplier_id) === Number(supplierId));
            }

            // Tag order type based on supplier_account.supplier_type
            const stamped = (orders || []).map(o => {
                const type = (String(o.supplier_type||'').toLowerCase()==='manual') ? 'Manual' : 'Registered';
                try {
                    console.log('🔎 [Orders] map', {
                        purchase_id: o.purchase_id,
                        supplier_name: o.supplier_name,
                        supplier_type: o.supplier_type,
                        computed_type: type
                    });
                } catch (_) {}
                return { ...o, order_type: type, orderType: type };
            });
            res.json(stamped);
        } catch (error) {
            console.error('Error in getAllPurchaseOrders:', error);
            res.status(500).json({ error: 'Failed to fetch purchase orders' });
        }
    },

    // Update purchase order with estimated cost (Supplier stage)
    updatePurchaseOrderCost: async (req, res) => {
        try {
            // Check if user is authorized (Supplier)
            if (!req.session.user || req.session.user.role_id !== 27) {
                return res.status(403).json({ error: 'Unauthorized: Only suppliers can submit cost estimates' });
            }

            const { orderId } = req.params;
            const { estimationCost } = req.body;

            if (!estimationCost || isNaN(estimationCost) || estimationCost <= 0) {
                return res.status(400).json({ error: 'Invalid estimated cost' });
            }

            // Get the order to verify it belongs to this supplier
            const orders = await SCMModel.getAllPurchaseOrders();
            const order = orders.find(o => Number(o.po_id) === Number(orderId));
            
            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }

            // Verify the order belongs to this supplier using supplier_id
            if (Number(order.supplier_id) !== Number(req.session.user.supplier_id)) {
                console.log('Authorization failed:', {
                    orderSupplierId: order.supplier_id,
                    sessionSupplierId: req.session.user.supplier_id,
                    orderId: order.po_id,
                    requestedOrderId: orderId
                });
                return res.status(403).json({ error: 'Unauthorized: You can only update orders assigned to your supplier account' });
            }

            const result = await SCMModel.updatePurchaseOrderCost(orderId, estimationCost);
            
            if (!result.success) {
                return res.status(404).json({ error: result.error });
            }

            res.json({
                message: 'Cost estimate submitted successfully. Waiting for finance approval.',
                status: 'Pending Estimation'
            });
        } catch (error) {
            console.error('Error in updatePurchaseOrderCost:', error);
            res.status(500).json({ error: 'Failed to update purchase order cost' });
        }
    },

    // Update purchase order with invoice details
    updatePurchaseOrderInvoice: async (req, res) => {
        try {
            // Check if user is authorized (Supplier)
            if (!req.session.user || req.session.user.role_id !== 27) {
                return res.status(403).json({ error: 'Unauthorized access' });
            }

            const { orderId } = req.params;
            const invoiceData = req.body;

            // Validate required fields
            const requiredFields = ['invoice_number', 'invoice_date', 'shipping_fee', 'bank_name', 'account_number', 'account_holder'];
            const missingFields = requiredFields.filter(field => !invoiceData[field]);
            
            if (missingFields.length > 0) {
                return res.status(400).json({ 
                    error: 'Missing required fields', 
                    fields: missingFields 
                });
            }

            // Validate numeric fields
            if (isNaN(invoiceData.shipping_fee) || invoiceData.shipping_fee < 0) {
                return res.status(400).json({ error: 'Invalid shipping fee' });
            }

            const result = await SCMModel.updatePurchaseOrderInvoice(orderId, invoiceData);
            
            if (!result.success) {
                return res.status(404).json({ error: result.error });
            }

            res.json({ message: 'Purchase order invoice updated successfully' });
        } catch (error) {
            console.error('Error in updatePurchaseOrderInvoice:', error);
            res.status(500).json({ error: 'Failed to update purchase order invoice' });
        }
    },

    // Update purchase order status (Finance approval and payment)
    updatePurchaseOrderStatus: async (req, res) => {
        try {
            const { orderId } = req.params;
            const { status } = req.body;

            // Validate status
            const validStatuses = ['Pending', 'Pending Estimation', 'Approved', 'Paid', 'Cancelled'];

            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }

            // Check authorization based on status and user role
            if (!req.session.user) {
                return res.status(403).json({ error: 'Unauthorized access' });
            }

            const userRole = req.session.user.role_id;
            const isDeveloper = userRole === 1;
            const isFinance = userRole === 25; // Assuming 25 is finance role
            const isSupplier = userRole === 27;

            // Define allowed status transitions based on role
            const allowedTransitions = {
                1: validStatuses, // Developer can do anything
                25: ['Approved', 'Paid'], // Finance can approve and mark as paid
                26: ['Pending', 'Cancelled'], // SCM Admin can create and cancel
                27: ['Pending Estimation'] // Supplier can only submit estimation
            };

            if (!allowedTransitions[userRole]?.includes(status)) {
                return res.status(403).json({ 
                    error: 'Unauthorized status transition',
                    message: `Role ${userRole} cannot set status to ${status}`
                });
            }

            // Additional role-specific validations
            if (isFinance && status === 'Paid') {
                // Get the order to verify it's approved
                const order = await SCMModel.getPurchaseOrderById(orderId);
                if (!order || order.status !== 'Approved') {
                    return res.status(400).json({ 
                        error: 'Cannot mark as paid. Order must be approved first.' 
                    });
                }

                // Here you would typically integrate with your payment API
                // For now, we'll just update the status
                // TODO: Add payment API integration
            }

            if (isSupplier && status === 'Pending Estimation') {
                // Supplier can only set their own orders to Pending Estimation
                const order = await SCMModel.getPurchaseOrderById(orderId);
                if (!order || order.supplier_name !== req.session.user.username) {
                    return res.status(403).json({ error: 'Unauthorized to update this order' });
                }
            }

            const result = await SCMModel.updatePurchaseOrderStatus(orderId, status);
            
            if (!result.success) {
                return res.status(404).json({ error: result.error });
            }

            // Return appropriate message based on status
            let message = 'Purchase order status updated successfully';
            if (status === 'Approved') {
                message = 'Cost estimate approved. Ready for payment.';
            } else if (status === 'Paid') {
                message = 'Payment processed successfully.';
            } else if (status === 'Pending Estimation') {
                message = 'Cost estimate submitted. Waiting for approval.';
            }

            res.json({ 
                message,
                order: result.order
            });
        } catch (error) {
            console.error('Error in updatePurchaseOrderStatus:', error);
            res.status(500).json({ error: 'Failed to update purchase order status' });
        }
    },

    // Add new inventory item
    addInventoryItem: async (req, res) => {
        try {
            const {
                material_type,
                quantity,
                unit,
                reorder_level,
                supplier_id,
                remarks
            } = req.body;

            // Authentication check - fixed condition
            if (req.session?.user?.role_name !== 'logistics') {
                return res.status(403).json({ error: 'Forbidden: Logistics access required.' });
            }

            // Input validation
            if (!material_type || !quantity || !unit) {
                return res.status(400).json({ 
                    error: 'Missing required fields',
                    details: {
                        material_type: !material_type ? 'Material type is required' : null,
                        quantity: !quantity ? 'Quantity is required' : null,
                        unit: !unit ? 'Unit is required' : null
                    }
                });
            }

            // Validate quantity is a positive number
            const quantityNum = parseFloat(quantity);
            if (isNaN(quantityNum) || quantityNum < 0) {
                return res.status(400).json({ error: 'Quantity must be a non-negative number' });
            }

            // Validate reorder level if provided
            if (reorder_level !== undefined) {
                const reorderLevelNum = parseFloat(reorder_level);
                if (isNaN(reorderLevelNum) || reorderLevelNum < 0) {
                    return res.status(400).json({ error: 'Reorder level must be a non-negative number' });
                }
            }

            const insertId = await SCMModel.addInventoryItem({
                material_type,
                quantity: quantityNum,
                unit,
                reorder_level: reorder_level ? parseFloat(reorder_level) : 0,
                supplier_id: supplier_id || null,
                remarks: remarks || null
            });

            res.status(201).json({ 
                message: 'Inventory item added successfully.',
                inventory_id: insertId
            });
        } catch (error) {
            console.error('Error adding inventory item:', error);
            res.status(500).json({ 
                error: 'Failed to add inventory item.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Get all inventory items
    getAllInventoryItems: async (req, res) => {
        try {
            // Authentication check
            if (!req.session?.user?.role_name === 'logistics') {
                return res.status(403).json({ error: 'Forbidden: Logistics access required.' });
            }

            const items = await SCMModel.getAllInventoryItems();
            res.json({
                items,
                total: items.length
            });
        } catch (error) {
            console.error('Error fetching inventory items:', error);
            res.status(500).json({ 
                error: 'Failed to fetch inventory items.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Update inventory item
    updateInventoryItem: async (req, res) => {
        try {
            const { inventoryId } = req.params;
            const {
                material_type,
                quantity,
                unit,
                reorder_level,
                supplier_id,
                remarks
            } = req.body;

            // Authentication check - fixed condition
            if (req.session?.user?.role_name !== 'logistics') {
                return res.status(403).json({ error: 'Forbidden: Logistics access required.' });
            }

            // Input validation
            if (!material_type || !quantity || !unit) {
                return res.status(400).json({ 
                    error: 'Missing required fields',
                    details: {
                        material_type: !material_type ? 'Material type is required' : null,
                        quantity: !quantity ? 'Quantity is required' : null,
                        unit: !unit ? 'Unit is required' : null
                    }
                });
            }

            // Validate quantity is a positive number
            const quantityNum = parseFloat(quantity);
            if (isNaN(quantityNum) || quantityNum < 0) {
                return res.status(400).json({ error: 'Quantity must be a non-negative number' });
            }

            // Validate reorder level if provided
            if (reorder_level !== undefined) {
                const reorderLevelNum = parseFloat(reorder_level);
                if (isNaN(reorderLevelNum) || reorderLevelNum < 0) {
                    return res.status(400).json({ error: 'Reorder level must be a non-negative number' });
                }
            }

            const success = await SCMModel.updateInventoryItem(inventoryId, {
                material_type,
                quantity: quantityNum,
                unit,
                reorder_level: reorder_level ? parseFloat(reorder_level) : 0,
                supplier_id: supplier_id || null,
                remarks: remarks || null
            });

            if (!success) {
                return res.status(404).json({ error: 'Inventory item not found' });
            }

            res.json({ message: 'Inventory item updated successfully' });
        } catch (error) {
            console.error('Error updating inventory item:', error);
            res.status(500).json({ 
                error: 'Failed to update inventory item.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Delete inventory item
    deleteInventoryItem: async (req, res) => {
        try {
            const { inventoryId } = req.params;

            // Authentication check - fixed condition
            if (req.session?.user?.role_name !== 'logistics') {
                return res.status(403).json({ error: 'Forbidden: Logistics access required.' });
            }

            const success = await SCMModel.deleteInventoryItem(inventoryId);
            if (!success) {
                return res.status(404).json({ error: 'Inventory item not found' });
            }

            res.json({ message: 'Inventory item deleted successfully' });
        } catch (error) {
            console.error('Error deleting inventory item:', error);
            res.status(500).json({ 
                error: 'Failed to delete inventory item.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Get inventory item by ID
    getInventoryItemById: async (req, res) => {
        try {
            const { inventoryId } = req.params;

            // Authentication check - fixed condition
            if (req.session?.user?.role_name !== 'logistics') {
                return res.status(403).json({ error: 'Forbidden: Logistics access required.' });
            }

            const item = await SCMModel.getInventoryItemById(inventoryId);
            if (!item) {
                return res.status(404).json({ error: 'Inventory item not found' });
            }

            res.json(item);
        } catch (error) {
            console.error('Error fetching inventory item:', error);
            res.status(500).json({ 
                error: 'Failed to fetch inventory item.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Get approved purchase orders after cost estimation
    getApprovedPurchaseOrders: async (req, res) => {
        try {
            // Check if user is authenticated
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            // Get approved orders
            let orders = await SCMModel.getApprovedPurchaseOrders();
            
            // If user is a supplier, filter orders for their supplier_id
            if (req.session.user.role_id === 27) { // 27 is supplier role
                const supplierId = req.session.user.supplier_id;
                if (!supplierId) {
                    return res.status(403).json({ error: 'Supplier ID not found in user session' });
                }
                orders = orders.filter(order => Number(order.supplier_id) === Number(supplierId));
            }

            res.json({
                success: true,
                orders: orders
            });
        } catch (error) {
            console.error('Error in getApprovedPurchaseOrders:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to fetch approved purchase orders',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Update purchase order delivery status
    updatePurchaseOrderDelivery: async (req, res) => {
        try {
            const { orderId } = req.params;
            const { receiptData } = req.body;

            // Check if user is authorized (Supplier)
            if (!req.session.user || req.session.user.role_id !== 27) {
                return res.status(403).json({ error: 'Unauthorized: Only suppliers can update delivery status' });
            }

            // Validate receipt data
            if (!receiptData || !receiptData.receipt_number || !receiptData.receipt_date) {
                return res.status(400).json({ error: 'Missing required receipt information' });
            }

            // Get the order to verify it belongs to this supplier
            const orders = await SCMModel.getApprovedPurchaseOrders();
            const order = orders.find(o => Number(o.po_id) === Number(orderId));
            
            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }

            // Verify the order belongs to this supplier
            if (Number(order.supplier_id) !== Number(req.session.user.supplier_id)) {
                return res.status(403).json({ error: 'Unauthorized: You can only update orders assigned to your supplier account' });
            }

            // Update order status to delivered
            const result = await SCMModel.updatePurchaseOrderStatus(orderId, 'Delivered', receiptData);
            
            if (!result.success) {
                return res.status(404).json({ error: result.error });
            }

            res.json({
                success: true,
                message: 'Delivery status updated successfully',
                order: result.order
            });
        } catch (error) {
            console.error('Error in updatePurchaseOrderDelivery:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to update delivery status' 
            });
        }
    },

    // Save proof picture for purchase_order and mark as Received
    setPurchaseOrderProof: async (req, res) => {
        try {
            if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
            const { orderId } = req.params;
            const { proof_picture } = req.body;
            if (!proof_picture) return res.status(400).json({ error: 'proof_picture is required' });
            const result = await SCMModel.setPurchaseOrderProof(Number(orderId), proof_picture);
            if (!result.success) return res.status(404).json({ error: 'Order not found' });
            res.json({ success: true });
        } catch (e) {
            console.error('Error in setPurchaseOrderProof:', e);
            res.status(500).json({ error: 'Failed to save proof picture' });
        }
    },

    // ===== Products (Supplier + SCM Review) =====
    createProduct: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }
            // Logistics-only creation; suppliers cannot create products
            const user = req.session.user;
            const isLogistics = (user.role_name === 'logistics') || user.role_id === 26 || user.role_id === 1;
            if (!isLogistics) {
                return res.status(403).json({ error: 'Forbidden: Logistics access required to create products' });
            }

            const { supplier_id, name, description, size, unit, price, effective_date, price_validity } = req.body;
            if (!supplier_id || !name || !price || !effective_date) {
                return res.status(400).json({ error: 'supplier_id, name, price and effective_date are required' });
            }
            const priceNum = parseFloat(price);
            if (isNaN(priceNum) || priceNum <= 0) {
                return res.status(400).json({ error: 'Invalid price' });
            }

            const insertId = await SCMModel.createProduct({
                supplier_id: Number(supplier_id),
                name,
                description,
                size,
                unit,
                price: priceNum,
                effective_date,
                price_validity
            });
            res.status(201).json({ success: true, product_id: insertId, status: 'Pending' });
        } catch (error) {
            console.error('Error in createProduct:', error);
            res.status(500).json({ error: 'Failed to create product' });
        }
    },

    getMyProducts: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }
            const user = req.session.user;
            const isSupplierRole = user.role_id === 27 || (user.role_name && user.role_name.toLowerCase() === 'supplier');
            const isSupplierFlag = !!user.is_supplier;
            if (!isSupplierRole && !isSupplierFlag) {
                return res.status(403).json({ error: 'Forbidden: Supplier access required' });
            }
            const supplierId = user.supplier_id;
            if (!supplierId) {
                return res.status(400).json({ error: 'Missing supplier_id in session' });
            }
            console.log('🔍 getMyProducts for supplier_id:', supplierId);
            let rows = [];
            try {
                rows = await SCMModel.getProductsForSupplier(supplierId);
            } catch (innerErr) {
                // This path should rarely occur now that the model catches missing table
                console.warn('⚠️ getProductsForSupplier failed, falling back to materials:', innerErr?.message || innerErr);
            }

            // Fallback to materials normalization if products are empty
            if (!rows || rows.length === 0) {
                const mats = await SCMModel.getMaterialsForSupplier(supplierId);
                rows = (mats || []).map(m => ({
                    product_id: m.material_id,
                    supplier_id: m.supplier_id,
                    name: m.name,
                    description: m.description,
                    size: m.variant || null,
                    unit: m.unit || null,
                    price: m.price,
                    effective_date: m.effective_date,
                    price_validity: m.price_validity,
                    status: m.status || 'Active'
                }));
            }
            console.log('📦 Products resolved (with fallback):', rows?.length || 0);
            res.json(rows);
        } catch (error) {
            console.error('Error in getMyProducts:', error);
            res.status(500).json({ error: 'Failed to fetch products' });
        }
    },

    

    getPendingProducts: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }
            // SCM/logistics or developer can review
            const user = req.session.user;
            const allowed = (user.role_name === 'logistics') || [1, 26].includes(user.role_id);
            if (!allowed) {
                return res.status(403).json({ error: 'Forbidden: SCM review access required' });
            }
            const rows = await SCMModel.getPendingProducts();
            res.json(rows);
        } catch (error) {
            console.error('Error in getPendingProducts:', error);
            res.status(500).json({ error: 'Failed to fetch pending products' });
        }
    },

    updateProductStatus: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }
            // SCM/logistics or developer can approve/reject
            const user = req.session.user;
            const allowed = (user.role_name === 'logistics') || [1, 26].includes(user.role_id);
            if (!allowed) {
                return res.status(403).json({ error: 'Forbidden: SCM review access required' });
            }
            const { productId } = req.params;
            const { status } = req.body; // 'Active' or 'Inactive' (or 'Pending')
            const result = await SCMModel.updateProductStatus(productId, status);
            if (!result.success) {
                return res.status(400).json({ error: result.error });
            }
            res.json({ success: true, status });
        } catch (error) {
            console.error('Error in updateProductStatus:', error);
            res.status(500).json({ error: 'Failed to update product status' });
        }
    },
    // Materials: update status (SCM approve/reject)
    updateMaterialStatus: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }
            const user = req.session.user;
            const allowed = (user.role_name === 'logistics') || [1, 26].includes(user.role_id);
            if (!allowed) {
                return res.status(403).json({ error: 'Forbidden: SCM review access required' });
            }
            const { materialId } = req.params;
            const { status } = req.body; // 'Active' or 'Inactive'
            const result = await SCMModel.updateMaterialStatus(materialId, status);
            if (!result.success) {
                return res.status(400).json({ error: result.error });
            }
            res.json({ success: true, status });
        } catch (error) {
            console.error('Error in updateMaterialStatus:', error);
            res.status(500).json({ error: 'Failed to update material status' });
        }
    },

    requestPriceChange: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }
            const user = req.session.user;
            if (user.role_id !== 27) {
                return res.status(403).json({ error: 'Forbidden: Supplier access required' });
            }
            const { productId } = req.params;
            const { price } = req.body;
            const priceNum = parseFloat(price);
            if (isNaN(priceNum) || priceNum <= 0) {
                return res.status(400).json({ error: 'Invalid price' });
            }
            const result = await SCMModel.requestPriceChange(productId, user.supplier_id, priceNum);
            if (!result.success) return res.status(400).json({ error: result.error });
            res.json({ success: true, status: 'Pending' });
        } catch (error) {
            console.error('Error in requestPriceChange:', error);
            res.status(500).json({ error: 'Failed to request price change' });
        }
    },

    // Create material (logistics only): inserts brand (if needed) and materials
    createMaterial: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }
            const user = req.session.user;
            const isLogistics = (user.role_name === 'logistics') || user.role_id === 26 || user.role_id === 1;
            if (!isLogistics) {
                return res.status(403).json({ error: 'Forbidden: Logistics access required' });
            }
            const { supplier_id, brand_name, name, variant, size, type, description, category, unit, price, quantity } = req.body;
            if (!supplier_id || !name || !type || !price) {
                return res.status(400).json({ error: 'supplier_id, name, type, price are required' });
            }
            const priceNum = parseFloat(price);
            const qtyNum = quantity !== undefined ? parseFloat(quantity) : 0;
            if (isNaN(priceNum) || priceNum <= 0) return res.status(400).json({ error: 'Invalid price' });
            if (qtyNum < 0 || isNaN(qtyNum)) return res.status(400).json({ error: 'Invalid quantity' });

            const result = await SCMModel.createMaterial({
                supplier_id: Number(supplier_id),
                brand_name: brand_name || '',
                name,
                variant: variant ?? size ?? null,
                type,
                description,
                category: category || null,
                unit,
                price: priceNum,
                quantity: qtyNum
            });
            res.status(201).json({ success: true, material_id: result.material_id, brand_id: result.brand_id });
        } catch (error) {
            console.error('Error in createMaterial:', error);
            res.status(500).json({ error: 'Failed to create material' });
        }
    },

    // Supplier submits a material → create in materials as Inactive; brand ensured/linked
    createSupplierMaterial: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }
            const user = req.session.user;
            const isSupplierRole = user.role_id === 27 || (user.role_name && user.role_name.toLowerCase() === 'supplier');
            if (!isSupplierRole && !user.is_supplier) {
                return res.status(403).json({ error: 'Forbidden: Supplier access required' });
            }
            const supplierId = user.supplier_id;
            if (!supplierId) {
                return res.status(400).json({ error: 'Missing supplier_id in session' });
            }

            const { brand_name, name, variant, type, description, category, unit, price } = req.body;
            if (!name || !unit || !price) {
                return res.status(400).json({ error: 'name, unit, price are required' });
            }
            const priceNum = parseFloat(price);
            if (isNaN(priceNum) || priceNum <= 0) {
                return res.status(400).json({ error: 'Invalid price' });
            }

            // Ensure non-null type: infer from presence of brand_name if not provided
            const resolvedType = (type && String(type).trim()) ? String(type).trim() : ((brand_name && String(brand_name).trim()) ? 'Branded' : 'Brandless');

            const result = await SCMModel.createMaterialFromSupplier({
                supplier_id: supplierId,
                brand_name: (brand_name || '').trim() || null,
                name: String(name).trim(),
                variant: (variant || '').trim() || null,
                type: resolvedType,
                description: (description || '').trim() || null,
                category: (category || '').trim() || 'General',
                unit: String(unit).trim(),
                price: priceNum
            });

            return res.status(201).json({ success: true, status: 'Inactive', material_id: result.material_id, brand_id: result.brand_id });
        } catch (error) {
            console.error('Error in createSupplierMaterial:', error);
            return res.status(500).json({ error: 'Failed to submit material' });
        }
    },

    getAllMaterials: async (req, res) => {
        try {
            console.log('getAllMaterials - Session user:', req.session?.user);
            if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
            const u = req.session.user;
            console.log('getAllMaterials - User role:', u.role_name, 'Role ID:', u.role_id);
            const allowed = (u.role_name === 'logistics') || (u.role_name === 'manufacturing') || (u.role_name === 'general_foreman') || [1,26].includes(u.role_id);
            console.log('getAllMaterials - Access allowed:', allowed);
            if (!allowed) return res.status(403).json({ error: 'Forbidden' });
            const rows = await SCMModel.getAllMaterials();
            res.json(rows);
        } catch (e) {
            console.error('Error in getAllMaterials:', e);
            res.status(500).json({ error: 'Failed to fetch materials' });
        }
    },
    // Get all inactive materials (SCM/logistics review)
    getInactiveMaterials: async (req, res) => {
        try {
            if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
            const u = req.session.user;
            const allowed = (u.role_name === 'logistics') || [1,26].includes(u.role_id);
            if (!allowed) return res.status(403).json({ error: 'Forbidden: SCM review access required' });
            const rows = await SCMModel.getInactiveMaterials();
            res.json(rows);
        } catch (e) {
            console.error('Error in getInactiveMaterials:', e);
            res.status(500).json({ error: 'Failed to fetch inactive materials' });
        }
    },

    // ===== Purchases (PR/PO flow) =====
    // Find suppliers that offer the same item
    getSuppliersForItem: async (req, res) => {
        try {
            if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
            const u = req.session.user;
            const allowed = (u.role_name === 'logistics') || [1,26].includes(u.role_id);
            if (!allowed) return res.status(403).json({ error: 'Forbidden' });

            const { name, brand_name } = req.query;
            if (!name) return res.status(400).json({ error: 'name is required' });
            const rows = await SCMModel.getSuppliersForItem({ name, brand_name: brand_name || null });
            res.json(rows);
        } catch (e) {
            console.error('Error in getSuppliersForItem:', e);
            res.status(500).json({ error: 'Failed to fetch suppliers for item' });
        }
    },

    // Create purchase
    createPurchase: async (req, res) => {
        try {
            if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
            const u = req.session.user;
            // Allow logistics and developer to create
            const allowed = (u.role_name === 'logistics') || [1,26].includes(u.role_id);
            if (!allowed) return res.status(403).json({ error: 'Forbidden' });

            const { supplier_id, material_id, variant, quantity, unit, unit_price, remarks } = req.body;
            if (!supplier_id || !material_id || !quantity || !unit_price) {
                return res.status(400).json({ error: 'supplier_id, material_id, quantity, unit_price are required' });
            }
            const qty = parseFloat(quantity);
            const price = parseFloat(unit_price);
            if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Invalid quantity' });
            if (isNaN(price) || price <= 0) return res.status(400).json({ error: 'Invalid unit_price' });

            const id = await SCMModel.createPurchase({
                requested_by: u.id,
                supplier_id: Number(supplier_id),
                material_id: Number(material_id),
                variant: variant || null,
                quantity: qty,
                unit: unit || null,
                unit_price: price,
                remarks: remarks || null
            });
            res.status(201).json({ success: true, purchase_id: id });
        } catch (e) {
            console.error('Error in createPurchase:', e);
            res.status(500).json({ error: 'Failed to create purchase' });
        }
    },

    listPurchases: async (_req, res) => {
        try {
            const rows = await SCMModel.listPurchases();
            res.json(rows);
        } catch (e) {
            console.error('Error in listPurchases:', e);
            res.status(500).json({ error: 'Failed to list purchases' });
        }
    },

    // Aggregate orders based on purchases, grouped by purchase_id with materials array
    listOrders: async (_req, res) => {
        try {
            // Return purchases rows first (matches current frontend grouping by purchase_id)
            const rows = await SCMModel.listPurchases();
            if (Array.isArray(rows) && rows.length) {
                // Stamp orderType from supplier_type; targeted debug if missing
                const stamped = rows.map(r => {
                    const st = String(r.supplier_type || '').toLowerCase();
                    const type = st === 'manual' ? 'Manual' : 'Registered';
                    if (!st) {
                        console.log('🔎 OrderType DEBUG (missing supplier_type):', {
                            purchase_id: r.purchase_id,
                            supplier_id: r.supplier_id,
                            supplier_name: r.supplier_name,
                            assumed_type: type
                        });
                    }
                    return { ...r, orderType: type, order_type: type };
                });
                return res.json(stamped);
            }

            // Fallback: map purchase_order rows to a minimal aggregated structure
            const poRows = await SCMModel.getAllPurchaseOrders();
            if (Array.isArray(poRows) && poRows.length) {
                const orders = poRows.map(r => ({
                    id: String(r.po_id),
                    orderType: (String(r.supplier_type||'').toLowerCase()==='manual') ? 'Manual' : 'Registered',
                    requestApproveDate: r.order_date || r.created_at,
                    orderApproveDate: r.order_date || r.created_at,
                    deliverDate: r.order_date || r.created_at,
                    status: r.status,
                    invoice: r.invoice_number || '',
                    materials: [{
                        type: r.material_type,
                        supplier: r.supplier_name,
                        quantity: r.quantity,
                        unit: r.unit,
                        packaging: r.variant || '',
                        pricePerUnit: undefined,
                        attributes: { size: r.variant || '-' },
                        supplierStatus: r.status
                    }]
                }));
                return res.json(orders);
            }

            // Nothing found
            res.json([]);
        } catch (e) {
            console.error('Error in listOrders:', e);
            res.json([]);
        }
    },

    // Update purchase status (sync purchase_requests where applicable)
    setPurchaseStatus: async (req, res) => {
        try {
            if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
            const { purchaseId } = req.params;
            const { status, delivery_cost, discount } = req.body;

            const allowed = ['Pending', 'Processed', 'Out for Delivery', 'Partially Delivered', 'Received', 'Returned', 'Backordered', 'Cancelled'];
            if (!allowed.includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }

            const result = await SCMModel.updatePurchaseStatus(Number(purchaseId), status, {
                delivery_cost,
                discount
            });
            if (!result.success) return res.status(404).json({ error: result.error || 'Update failed' });
            res.json({ success: true });
        } catch (e) {
            console.error('Error in setPurchaseStatus:', e);
            res.status(500).json({ error: 'Failed to update purchase status' });
        }
    },

    // Save supplier invoice (as URL/path or base64) for a purchase
    setPurchaseInvoice: async (req, res) => {
        try {
            if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
            const { purchaseId } = req.params;
            const { supplier_invoice, invoice_date } = req.body;
            if (!supplier_invoice) return res.status(400).json({ error: 'supplier_invoice is required' });
            console.log('📥 setPurchaseInvoice:', { purchaseId, length: supplier_invoice ? String(supplier_invoice).length : 0, hasDataUrl: String(supplier_invoice).startsWith('data:') });
            const result = await SCMModel.updatePurchaseInvoice(Number(purchaseId), supplier_invoice, invoice_date || null);
            if (!result.success) return res.status(404).json({ error: 'Purchase not found or update failed' });
            res.json({ success: true, migrated: !!result.migrated });
        } catch (e) {
            console.error('Error in setPurchaseInvoice:', e);
            res.status(500).json({ error: 'Failed to save supplier invoice' });
        }
    },

    // Create bulk purchase requests (new schema)
    createBulkPurchaseRequests: async (req, res) => {
        try {
            if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
            const u = req.session.user;
            // Allow logistics and developer to create
            const allowed = (u.role_name === 'logistics') || [1,26].includes(u.role_id);
            if (!allowed) return res.status(403).json({ error: 'Forbidden' });

            const { materials, requestDate } = req.body;
            
            if (!materials || !Array.isArray(materials) || materials.length === 0) {
                return res.status(400).json({ error: 'Materials array is required and cannot be empty' });
            }

            // Validate each material
            for (const material of materials) {
                if ((!material.supplier_id && !material.supplier_name) || (!material.material_id && !material.material_name) || !material.quantity || !material.unit_price) {
                    return res.status(400).json({ 
                        error: 'Each material must have supplier (id or name), material (id or name), quantity, and unit_price' 
                    });
                }
            }

            // If supplier_name is provided (Others/custom), ensure/create manual supplier and set supplier_id
            const enriched = [];
            for (const m of materials) {
                let supplierId = m.supplier_id;
                if (!supplierId && m.supplier_name) {
                    try {
                        supplierId = await SCMModel.ensureManualSupplierByName(m.supplier_name);
                    } catch (e) {
                        return res.status(400).json({ error: 'Failed to ensure supplier', details: e.message });
                    }
                }
                enriched.push({ ...m, supplier_id: supplierId });
            }

            const results = await SCMModel.createBulkPurchaseRequests({
                requested_by: u.id,
                materials: enriched,
                request_date: requestDate || new Date()
            });

            res.status(201).json({ 
                success: true, 
                message: 'Purchase requests created successfully',
                request_ids: results
            });
        } catch (e) {
            console.error('Error in createBulkPurchaseRequests:', e);
            res.status(500).json({ error: 'Failed to create purchase requests' });
        }
    },

    // Get supplier's purchase orders (from purchases table)
    getSupplierPurchaseOrders: async (req, res) => {
        try {
            console.log('🔍 getSupplierPurchaseOrders called');
            console.log('📋 Session user:', req.session?.user);
            
            if (!req.session?.user) {
                console.log('❌ No session user');
                return res.status(401).json({ error: 'Not authenticated' });
            }
            
            const user = req.session.user;
            console.log('👤 User role_id:', user.role_id);
            console.log('🏢 Supplier ID:', user.supplier_id);
            
            if (user.role_id !== 27) {
                console.log('❌ Not a supplier role');
                return res.status(403).json({ error: 'Forbidden: Supplier access required' });
            }

            const supplierId = user.supplier_id;
            if (!supplierId) {
                console.log('❌ No supplier_id in session');
                return res.status(400).json({ error: 'Missing supplier_id in session' });
            }

            console.log('🔍 Fetching orders for supplier_id:', supplierId);
            const orders = await SCMModel.getSupplierPurchaseOrders(supplierId);
            console.log('📦 Found orders:', orders.length);
            
            res.json({
                success: true,
                orders: orders
            });
        } catch (error) {
            console.error('💥 Error in getSupplierPurchaseOrders:', error);
            res.status(500).json({ error: 'Failed to fetch supplier purchase orders' });
        }
    },

    // Get materials for the logged-in supplier
    getMyMaterials: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }
            const user = req.session.user;
            const isSupplierRole = user.role_id === 27 || (user.role_name && user.role_name.toLowerCase() === 'supplier');
            const isSupplierFlag = !!user.is_supplier;
            if (!isSupplierRole && !isSupplierFlag) {
                return res.status(403).json({ error: 'Forbidden: Supplier access required' });
            }
            const supplierId = user.supplier_id;
            if (!supplierId) {
                return res.status(400).json({ error: 'Missing supplier_id in session' });
            }

            // 1) Try materials table first
            const mats = await SCMModel.getMaterialsForSupplier(supplierId);
            if (mats && mats.length) {
                return res.json({ success: true, materials: mats });
            }

            // 2) Fallback: use products (supplier catalog) and normalize
            const products = await SCMModel.getProductsForSupplier(supplierId);
            const normalized = (products || []).map(p => ({
                material_id: p.product_id, // use product_id as surrogate
                supplier_id: p.supplier_id,
                supplier_name: undefined,
                brand_id: null,
                brand_name: null,
                name: p.name,
                variant: p.size || null,
                type: null,
                description: p.description || null,
                unit: p.unit || null,
                price: p.price,
                quantity: null,
                effective_date: p.effective_date,
                price_validity: p.price_validity,
                status: p.status
            }));

            return res.json({ success: true, materials: normalized });
        } catch (error) {
            console.error('Error in getMyMaterials:', error);
            res.status(500).json({ error: 'Failed to fetch supplier materials' });
        }
    },

    // Get materials for a specific supplier (SCM admin access)
    getSupplierMaterials: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }
            const user = req.session.user;
            const isLogistics = (user.role_name === 'logistics') || user.role_id === 26 || user.role_id === 1;
            if (!isLogistics) {
                return res.status(403).json({ error: 'Forbidden: Logistics access required' });
            }

            const { supplierId } = req.params;
            if (!supplierId) {
                return res.status(400).json({ error: 'Supplier ID is required' });
            }

            const materials = await SCMModel.getMaterialsForSupplier(supplierId);
            return res.json({ success: true, materials });
        } catch (error) {
            console.error('Error in getSupplierMaterials:', error);
            res.status(500).json({ error: 'Failed to fetch supplier materials' });
        }
    },

    // List purchases with status 'Received' for a supplier
    getSupplierReceivedPurchases: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }
            const user = req.session.user;
            const isLogisticsOrDev = (user.role_name === 'logistics') || [1,26].includes(user.role_id);
            const isSupplierRole = user.role_id === 27 || user.is_supplier;
            const supplierId = req.query.supplierId || (isSupplierRole ? user.supplier_id : null);
            if (!supplierId) {
                return res.status(400).json({ error: 'supplierId is required' });
            }
            // Suppliers can only fetch their own
            if (isSupplierRole && Number(supplierId) !== Number(user.supplier_id)) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            // Logistics/developer can fetch any supplier
            if (!isSupplierRole && !isLogisticsOrDev) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            const rows = await SCMModel.getSupplierReceivedPurchases(Number(supplierId));
            return res.json({ success: true, purchases: rows });
        } catch (e) {
            console.error('Error in getSupplierReceivedPurchases:', e);
            return res.status(500).json({ error: 'Failed to fetch received purchases' });
        }
    },

    // Submit refund request (Logistics/Supply only)
    submitRefundRequest: async (req, res) => {
        try {
            console.log('🔍 submitRefundRequest called');
            console.log('📋 Session user:', req.session?.user);
            
            if (!req.session?.user) {
                console.log('❌ No session user');
                return res.status(401).json({ error: 'Not authenticated' });
            }
            
            const user = req.session.user;
            console.log('👤 User role_id:', user.role_id);
            console.log('👤 User role_name:', user.role_name);
            
            // Only allow logistics/supply users to submit refund requests
            const isLogistics = user.role_name === 'logistics';
            const isDeveloper = user.role_id === 1; // Allow developers for testing
            
            if (!isLogistics && !isDeveloper) {
                console.log('❌ Not a logistics or developer role');
                return res.status(403).json({ error: 'Forbidden: Logistics access required' });
            }

            const { purchaseId } = req.params;
            const { return_reason, return_proof } = req.body;

            // Validate required fields
            if (!return_reason || return_reason.trim() === '') {
                return res.status(400).json({ error: 'Return reason is required' });
            }

            console.log('🔍 Processing refund request for purchase_id:', purchaseId);
            console.log('📝 Return reason:', return_reason);
            console.log('📎 Return proof provided:', !!return_proof);

            // Submit the refund request (logistics can refund any purchase)
            const result = await SCMModel.setPurchaseRefund(
                Number(purchaseId), 
                return_reason.trim(), 
                return_proof || null
            );

            if (!result.success) {
                console.log('❌ Failed to submit refund request');
                return res.status(500).json({ error: 'Failed to submit refund request' });
            }

            console.log('✅ Refund request submitted successfully');
            res.json({
                success: true,
                message: 'Refund request submitted successfully. Waiting for finance approval.',
                status: 'Return Pending'
            });
        } catch (error) {
            console.error('💥 Error in submitRefundRequest:', error);
            res.status(500).json({ error: 'Failed to submit refund request' });
        }
    },

    // ===== Owners Supply Management =====
    // Get all owners supply materials for checklist
    getAllOwnersSupplyMaterials: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            // Check if user has logistics access
            const user = req.session.user;
            const isLogistics = user.role_name === 'logistics';
            const isDeveloper = user.role_id === 1;
            
            if (!isLogistics && !isDeveloper) {
                return res.status(403).json({ error: 'Forbidden: Logistics access required' });
            }

            const materials = await SCMModel.getAllOwnersSupplyMaterials();
            
            res.json({
                success: true,
                materials: materials,
                total: materials.length,
                status_counts: {
                    pending: materials.filter(m => m.status === 'Pending').length,
                    delivered: materials.filter(m => m.status === 'Delivered').length,
                    delayed: materials.filter(m => m.status === 'Delayed').length,
                    cancelled: materials.filter(m => m.status === 'Cancelled').length,
                    replaced: materials.filter(m => m.status === 'Replaced').length
                }
            });
        } catch (error) {
            console.error('Error in getAllOwnersSupplyMaterials:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to fetch owners supply materials' 
            });
        }
    },

    // Update owners supply delivery status
    updateOwnersSupplyDelivery: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            // Check if user has logistics access
            const user = req.session.user;
            const isLogistics = user.role_name === 'logistics';
            const isDeveloper = user.role_id === 1;
            
            if (!isLogistics && !isDeveloper) {
                return res.status(403).json({ error: 'Forbidden: Logistics access required' });
            }

            const { supplyId } = req.params;
            const { is_delivered, delivered_date, status, quantity_used, quantity_remaining } = req.body;

            // Validate required fields
            if (is_delivered === undefined && !status) {
                return res.status(400).json({ error: 'Either delivery status or status update is required' });
            }

            // Validate status if provided
            const validStatuses = ['Pending', 'Delivered', 'Delayed', 'Cancelled', 'Replaced'];
            if (status && !validStatuses.includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }

            // Validate quantities if provided
            if (quantity_used !== undefined && (isNaN(quantity_used) || quantity_used < 0)) {
                return res.status(400).json({ error: 'Invalid quantity used' });
            }
            if (quantity_remaining !== undefined && (isNaN(quantity_remaining) || quantity_remaining < 0)) {
                return res.status(400).json({ error: 'Invalid quantity remaining' });
            }

            const result = await SCMModel.updateOwnersSupplyDelivery(Number(supplyId), {
                is_delivered,
                delivered_date,
                status,
                quantity_used,
                quantity_remaining
            });

            if (!result.success) {
                return res.status(404).json({ error: result.error });
            }

            res.json({
                success: true,
                message: 'Owners supply delivery status updated successfully',
                supply: result.supply
            });
        } catch (error) {
            console.error('Error in updateOwnersSupplyDelivery:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to update owners supply delivery status' 
            });
        }
    },

    // Get owners supply materials by project
    getOwnersSupplyByProject: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

        // Check if user has logistics, general_foreman, or developer access
        const user = req.session.user;
        console.log('getOwnersSupplyByProject - User role:', user.role_name, 'Role ID:', user.role_id);
        const isLogistics = user.role_name === 'logistics';
        const isGeneralForeman = user.role_name === 'general_foreman';
        const isDeveloper = user.role_id === 1;
        
        console.log('getOwnersSupplyByProject - Access checks:', {
            isLogistics,
            isGeneralForeman,
            isDeveloper
        });
        
        if (!isLogistics && !isGeneralForeman && !isDeveloper) {
            return res.status(403).json({ error: 'Forbidden: Logistics, General Foreman, or Developer access required' });
        }

            const { proposalId } = req.params;
            if (!proposalId) {
                return res.status(400).json({ error: 'Project ID is required' });
            }

            const materials = await SCMModel.getOwnersSupplyByProject(Number(proposalId));
            
            res.json({
                success: true,
                materials: materials,
                total: materials.length
            });
        } catch (error) {
            console.error('Error in getOwnersSupplyByProject:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to fetch project supply materials' 
            });
        }
    },

    // Get manufacturing material requests
    getManufacturingRequests: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            // Check if user has logistics access
            const user = req.session.user;
            const isLogistics = user.role_name === 'logistics';
            const isDeveloper = user.role_id === 1;
            
            if (!isLogistics && !isDeveloper) {
                return res.status(403).json({ error: 'Forbidden: Logistics access required' });
            }

            const requests = await SCMModel.getManufacturingRequests();
            
            res.json({
                success: true,
                requests: requests
            });
        } catch (error) {
            console.error('Error in getManufacturingRequests:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to fetch manufacturing requests' 
            });
        }
    },

    // Get employees for driver selection
    getEmployees: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            // Check if user has logistics access
            const user = req.session.user;
            const isLogistics = user.role_name === 'logistics';
            const isDeveloper = user.role_id === 1;
            
            if (!isLogistics && !isDeveloper) {
                return res.status(403).json({ error: 'Forbidden: Logistics access required' });
            }

            const employees = await SCMModel.getEmployees();
            
            res.json({
                success: true,
                employees: employees
            });
        } catch (error) {
            console.error('Error in getEmployees:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to fetch employees' 
            });
        }
    },

    // Handle material release
    handleMaterialRelease: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            // Check if user has logistics access
            const user = req.session.user;
            const isLogistics = user.role_name === 'logistics';
            const isDeveloper = user.role_id === 1;
            
            if (!isLogistics && !isDeveloper) {
                return res.status(403).json({ error: 'Forbidden: Logistics access required' });
            }

            const { request_no, delivery_type, driver_id, vehicle_info, external_driver_name, external_vehicle_details, courier_service, release_notes } = req.body;

            console.log('Material release request data:', req.body);

            if (!request_no || !delivery_type) {
                return res.status(400).json({ error: 'Request number and delivery type are required' });
            }

            const result = await SCMModel.createMaterialRelease({
                request_no,
                delivery_type,
                driver_id,
                vehicle_info,
                external_driver_name,
                external_vehicle_details,
                courier_service,
                release_notes,
                released_by: user.employee_id || user.id
            });

            if (result.success) {
                res.json({
                    success: true,
                    message: 'Material release confirmed successfully',
                    release_id: result.release_id
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('Error in handleMaterialRelease:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to process material release' 
            });
        }
    },

    // Update manufacturing request status
    updateManufacturingRequestStatus: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            // Check if user has logistics access
            const user = req.session.user;
            const isLogistics = user.role_name === 'logistics';
            const isDeveloper = user.role_id === 1;
            
            if (!isLogistics && !isDeveloper) {
                return res.status(403).json({ error: 'Forbidden: Logistics access required' });
            }

            const { request_no, status } = req.body;

            console.log('Updating manufacturing request status:', request_no, 'to:', status);

            if (!request_no || !status) {
                return res.status(400).json({ error: 'Request number and status are required' });
            }

            const result = await SCMModel.updateManufacturingRequestStatus(request_no, status);

            if (result.success) {
                res.json({
                    success: true,
                    message: `Manufacturing request status updated to ${status}`,
                    affectedRows: result.affectedRows
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('Error in updateManufacturingRequestStatus:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to update manufacturing request status' 
            });
        }
    }
};

module.exports = SCMController;

