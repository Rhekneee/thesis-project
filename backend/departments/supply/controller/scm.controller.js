const SCMModel = require('../model/scm.model');
const { sendSupplierAccountNotification } = require('../../../utils/emailService');

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
                payment_terms
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
                status: 'active'
            });

            // Send supplier account email (do not block response if it fails)
            sendSupplierAccountNotification(
                contact_email,
                supplier_name,
                'default123',
                'https://mdb-construction-25b433e6e5d5.herokuapp.com/'
            ).catch(err => console.error('Failed to send supplier account email:', err));

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
                status
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
                status: status || 'active'
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
            let orders = await SCMModel.getAllPurchaseOrders();
            
            // If user is a supplier, filter orders for their supplier_id
            if (req.session.user.role_id === 27) { // 27 is supplier role
                const supplierId = req.session.user.supplier_id; // Get supplier_id from session
                if (!supplierId) {
                    return res.status(403).json({ error: 'Supplier ID not found in user session' });
                }
                orders = orders.filter(order => Number(order.supplier_id) === Number(supplierId));
            }

            res.json(orders);
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
    }
};

module.exports = SCMController;

