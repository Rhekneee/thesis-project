const db = require("../../../db");
const bcrypt = require('bcrypt');

const SCMModel = {
    // Get all suppliers
    getAllSuppliers: async () => {
        const query = `
            SELECT 
                sa.supplier_id,
                sa.supplier_name,
                sa.contact_name,
                sa.contact_email,
                sa.contact_phone,
                sa.address,
                sa.city,
                sa.postal_code,
                sa.country,
                sa.account_number,
                sa.payment_terms,
                sa.status,
                u.role_id
            FROM supplier_account sa
            LEFT JOIN users u ON sa.supplier_name = u.username
            ORDER BY sa.created_at DESC
        `;
        const [rows] = await db.query(query);
        return rows;
    },

    // Add a new supplier and return the inserted supplier_id
    addSupplier: async (supplierData) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Insert into supplier_account table (contains supplier details)
            const supplierQuery = `
                INSERT INTO supplier_account (
                    supplier_name, contact_name, contact_email, contact_phone,
                    address, city, postal_code, country, account_number,
                    payment_terms, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `;
            const supplierValues = [
                supplierData.supplier_name,
                supplierData.contact_name,
                supplierData.contact_email,
                supplierData.contact_phone,
                supplierData.address,
                supplierData.city,
                supplierData.postal_code,
                supplierData.country,
                supplierData.account_number,
                supplierData.payment_terms,
                supplierData.status || 'active'
            ];
            const [supplierResult] = await connection.query(supplierQuery, supplierValues);
            const supplierId = supplierResult.insertId;

            // 2. Create user account (contains login credentials)
            const defaultPassword = 'default123';
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);
            
            const userQuery = `
                INSERT INTO users (
                    username, email, password, role_id, created_at, is_active
                ) VALUES (?, ?, ?, 27, NOW(), 1)
            `;
            const userValues = [
                supplierData.supplier_name,  // username is the supplier_name
                supplierData.contact_email,
                hashedPassword
            ];
            const [userResult] = await connection.query(userQuery, userValues);

            await connection.commit();
            return { supplierId, userId: userResult.insertId };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },

    // Create a user for the supplier (username = supplier_name)
    createSupplierUser: async (supplier_name, contact_email) => {
        const defaultPassword = 'default123';
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);
        const query = `
            INSERT INTO users (username, email, password, role_id, created_at, is_active)
            VALUES (?, ?, ?, 27, NOW(), 1)
        `;
        const values = [supplier_name, contact_email, hashedPassword];
        const [result] = await db.query(query, values);
        return result.insertId;
    },

    // Update supplier details
    updateSupplier: async (supplierId, supplierData) => {
        const query = `
            UPDATE supplier_account SET
                supplier_name = ?,
                contact_name = ?,
                contact_email = ?,
                contact_phone = ?,
                address = ?,
                city = ?,
                postal_code = ?,
                country = ?,
                account_number = ?,
                payment_terms = ?,
                status = ?,
                updated_at = NOW()
            WHERE supplier_id = ?
        `;
        const values = [
            supplierData.supplier_name,
            supplierData.contact_name,
            supplierData.contact_email,
            supplierData.contact_phone,
            supplierData.address,
            supplierData.city,
            supplierData.postal_code,
            supplierData.country,
            supplierData.account_number,
            supplierData.payment_terms,
            supplierData.status || 'active',
            supplierId
        ];
        const [result] = await db.query(query, values);
        return result;
    },

    // Get all purchase requests
    getAllPurchaseRequests: async () => {
        const query = `
            SELECT 
                request_id,
                DATE_FORMAT(request_date, '%Y-%m-%d %H:%i:%s') as request_date,
                requested_by,
                department,
                material_type,
                CAST(quantity AS DECIMAL(10,2)) as quantity,
                unit,
                justification,
                status,
                approved_by,
                DATE_FORMAT(approved_date, '%Y-%m-%d %H:%i:%s') as approved_date,
                remarks
            FROM purchase_requests
            WHERE status != 'Deleted'
            ORDER BY 
                CASE 
                    WHEN status = 'Pending' THEN 1
                    WHEN status = 'Approved' THEN 2
                    WHEN status = 'In Transit' THEN 3
                    WHEN status = 'Delivered' THEN 4
                    WHEN status = 'Rejected' THEN 5
                    ELSE 6
                END,
                request_date DESC
        `;
        try {
            const [rows] = await db.query(query);
            return rows.map(row => ({
                ...row,
                quantity: parseFloat(row.quantity),
                status: row.status || 'Pending'
            }));
        } catch (error) {
            console.error('Error in getAllPurchaseRequests:', error);
            throw new Error('Failed to fetch purchase requests');
        }
    },

    // Add a new purchase request
    addPurchaseRequest: async (requestData) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Validate quantity is a positive number
            const quantity = parseFloat(requestData.quantity);
            if (isNaN(quantity) || quantity <= 0) {
                throw new Error('Quantity must be a positive number');
            }

            const query = `
                INSERT INTO purchase_requests (
                    request_date,
                    requested_by,
                    department,
                    material_type,
                    quantity,
                    unit,
                    justification,
                    status
                ) VALUES (
                    NOW(),
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?
                )
            `;
            const values = [
                requestData.requested_by,
                requestData.department,
                requestData.material_type,
                quantity,
                requestData.unit,
                requestData.justification,
                requestData.status || 'Pending'
            ];

            const [result] = await connection.query(query, values);
            await connection.commit();
            return result.insertId;
        } catch (error) {
            await connection.rollback();
            console.error('Error in addPurchaseRequest:', error);
            throw error;
        } finally {
            connection.release();
        }
    },

    // Add new purchase order
    createPurchaseOrder: async (orderData) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const query = `
                INSERT INTO purchase_order (
                    pr_id,
                    supplier_id,
                    order_date,
                    status,
                    material_type,
                    quantity,
                    unit,
                    remarks,
                    created_by,
                    created_at,
                    updated_at
                ) VALUES (
                    ?,
                    ?,
                    NOW(),
                    'Pending',
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    NOW(),
                    NOW()
                )
            `;
            const values = [
                orderData.pr_id,
                orderData.supplier_id,
                orderData.material_type,
                orderData.quantity,
                orderData.unit,
                orderData.remarks,
                orderData.created_by
            ];

            const [result] = await connection.query(query, values);
            await connection.commit();
            return result.insertId;
        } catch (error) {
            await connection.rollback();
            console.error('Error in createPurchaseOrder:', error);
            throw error;
        } finally {
            connection.release();
        }
    },

    // Get all purchase orders
    getAllPurchaseOrders: async () => {
        const query = `
            SELECT 
                po.po_id,
                po.pr_id,
                po.supplier_id,
                sa.supplier_name,
                DATE_FORMAT(po.order_date, '%Y-%m-%d %H:%i:%s') as order_date,
                po.status,
                po.material_type,
                CAST(po.quantity AS DECIMAL(10,2)) as quantity,
                po.unit,
                po.estimation_cost,
                po.remarks,
                po.created_by,
                DATE_FORMAT(po.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
                DATE_FORMAT(po.updated_at, '%Y-%m-%d %H:%i:%s') as updated_at,
                DATE_FORMAT(po.estimation_submitted_at, '%Y-%m-%d %H:%i:%s') as estimation_submitted_at
            FROM purchase_order po
            LEFT JOIN supplier_account sa ON po.supplier_id = sa.supplier_id
            ORDER BY 
                CASE 
                    WHEN po.status = 'Pending' THEN 1
                    WHEN po.status = 'Pending Estimation' THEN 2
                    WHEN po.status = 'Approved' THEN 3
                    WHEN po.status = 'Paid' THEN 4
                    WHEN po.status = 'Cancelled' THEN 5
                    ELSE 6
                END,
                po.order_date DESC
        `;
        try {
            const [rows] = await db.query(query);
            return rows.map(row => ({
                ...row,
                quantity: parseFloat(row.quantity),
                estimation_cost: parseFloat(row.estimation_cost || 0),
                status: row.status || 'Pending'
            }));
        } catch (error) {
            console.error('Error in getAllPurchaseOrders:', error);
            throw new Error('Failed to fetch purchase orders');
        }
    },

    // Update purchase order with estimated cost (Supplier stage)
    updatePurchaseOrderCost: async (orderId, estimationCost) => {
        const query = `
            UPDATE purchase_order 
            SET 
                estimation_cost = ?,
                status = 'Pending Estimation',
                estimation_submitted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE po_id = ?
        `;
        try {
            const [result] = await db.query(query, [estimationCost, orderId]);
            
            if (result.affectedRows === 0) {
                return { success: false, error: 'Order not found' };
            }

            return { success: true };
        } catch (error) {
            console.error('Error in updatePurchaseOrderCost:', error);
            throw new Error('Failed to update purchase order cost');
        }
    },

    // Update purchase order with invoice details
    updatePurchaseOrderInvoice: async (orderId, invoiceData) => {
        const query = `
            UPDATE purchase_order 
            SET 
                invoice_number = ?,
                invoice_date = ?,
                shipping_fee = ?,
                bank_name = ?,
                account_number = ?,
                account_holder = ?,
                status = 'Pending Payment',
                updated_at = CURRENT_TIMESTAMP
            WHERE po_id = ?
        `;
        try {
            const [result] = await db.query(query, [
                invoiceData.invoice_number,
                invoiceData.invoice_date,
                invoiceData.shipping_fee,
                invoiceData.bank_name,
                invoiceData.account_number,
                invoiceData.account_holder,
                orderId
            ]);
            
            if (result.affectedRows === 0) {
                return { success: false, error: 'Order not found' };
            }

            return { success: true };
        } catch (error) {
            console.error('Error in updatePurchaseOrderInvoice:', error);
            throw new Error('Failed to update purchase order invoice');
        }
    },

    // Update purchase order status and receipt
    updatePurchaseOrderStatus: async (orderId, status, receiptData = null) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            let query;
            let values;

            if (status === 'Delivered' && receiptData) {
                // Update status to 'Delivered with Receipt' and store receipt info
                query = `
                    UPDATE purchase_order 
                    SET 
                        status = 'Delivered with Receipt',
                        receipt_number = ?,
                        receipt_date = ?,
                        receipt_file = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE po_id = ? AND status = 'Approved'
                `;
                values = [
                    receiptData.receipt_number,
                    receiptData.receipt_date,
                    receiptData.receipt_file,
                    orderId
                ];
            } else {
                // Regular status update
                query = `
                    UPDATE purchase_order 
                    SET 
                        status = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE po_id = ?
                `;
                values = [status, orderId];
            }
            
            const [result] = await connection.query(query, values);
            
            if (result.affectedRows === 0) {
                await connection.rollback();
                return { 
                    success: false, 
                    error: 'Order not found or cannot be updated in current status' 
                };
            }

            // Get updated order
            const [updatedOrder] = await connection.query(`
                SELECT 
                    po.po_id,
                    po.pr_id,
                    po.supplier_id,
                    sa.supplier_name,
                    DATE_FORMAT(po.order_date, '%Y-%m-%d %H:%i:%s') as order_date,
                    po.status,
                    po.material_type,
                    CAST(po.quantity AS DECIMAL(10,2)) as quantity,
                    po.unit,
                    po.estimation_cost,
                    po.remarks,
                    po.payment_type,
                    po.receipt_number,
                    po.receipt_date,
                    po.receipt_file,
                    po.created_by,
                    DATE_FORMAT(po.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
                    DATE_FORMAT(po.updated_at, '%Y-%m-%d %H:%i:%s') as updated_at
                FROM purchase_order po
                LEFT JOIN supplier_account sa ON po.supplier_id = sa.supplier_id
                WHERE po.po_id = ?
            `, [orderId]);

            await connection.commit();

            return { 
                success: true, 
                order: updatedOrder[0] ? {
                    ...updatedOrder[0],
                    quantity: parseFloat(updatedOrder[0].quantity),
                    estimation_cost: parseFloat(updatedOrder[0].estimation_cost || 0)
                } : null
            };
        } catch (error) {
            await connection.rollback();
            console.error('Error in updatePurchaseOrderStatus:', error);
            throw new Error('Failed to update purchase order status');
        } finally {
            connection.release();
        }
    },

    // Add new inventory item
    addInventoryItem: async (inventoryData) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const query = `
                INSERT INTO inventory (
                    material_type,
                    quantity,
                    unit,
                    reorder_level,
                    supplier_id,
                    remarks,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
            `;
            const values = [
                inventoryData.material_type,
                inventoryData.quantity,
                inventoryData.unit,
                inventoryData.reorder_level || 0,
                inventoryData.supplier_id || null,
                inventoryData.remarks || null
            ];

            const [result] = await connection.query(query, values);
            await connection.commit();
            return result.insertId;
        } catch (error) {
            await connection.rollback();
            console.error('Error in addInventoryItem:', error);
            throw error;
        } finally {
            connection.release();
        }
    },

    // Get all inventory items
    getAllInventoryItems: async () => {
        const query = `
            SELECT 
                i.inventory_id,
                i.material_type,
                i.quantity,
                i.unit,
                i.reorder_level,
                i.supplier_id,
                sa.supplier_name,
                i.remarks,
                DATE_FORMAT(i.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
                DATE_FORMAT(i.updated_at, '%Y-%m-%d %H:%i:%s') as updated_at
            FROM inventory i
            LEFT JOIN supplier_account sa ON i.supplier_id = sa.supplier_id
            ORDER BY i.material_type ASC
        `;
        try {
            const [rows] = await db.query(query);
            return rows;
        } catch (error) {
            console.error('Error in getAllInventoryItems:', error);
            throw new Error('Failed to fetch inventory items');
        }
    },

    // Update inventory item
    updateInventoryItem: async (inventoryId, inventoryData) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const query = `
                UPDATE inventory SET
                    material_type = ?,
                    quantity = ?,
                    unit = ?,
                    reorder_level = ?,
                    supplier_id = ?,
                    remarks = ?,
                    updated_at = NOW()
                WHERE inventory_id = ?
            `;
            const values = [
                inventoryData.material_type,
                inventoryData.quantity,
                inventoryData.unit,
                inventoryData.reorder_level || 0,
                inventoryData.supplier_id || null,
                inventoryData.remarks || null,
                inventoryId
            ];

            const [result] = await connection.query(query, values);
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            console.error('Error in updateInventoryItem:', error);
            throw error;
        } finally {
            connection.release();
        }
    },

    // Delete inventory item
    deleteInventoryItem: async (inventoryId) => {
        const query = 'DELETE FROM inventory WHERE inventory_id = ?';
        try {
            const [result] = await db.query(query, [inventoryId]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error in deleteInventoryItem:', error);
            throw new Error('Failed to delete inventory item');
        }
    },

    // Get inventory item by ID
    getInventoryItemById: async (inventoryId) => {
        const query = `
            SELECT 
                i.inventory_id,
                i.material_type,
                i.quantity,
                i.unit,
                i.reorder_level,
                i.supplier_id,
                sa.supplier_name,
                i.remarks,
                DATE_FORMAT(i.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
                DATE_FORMAT(i.updated_at, '%Y-%m-%d %H:%i:%s') as updated_at
            FROM inventory i
            LEFT JOIN supplier_account sa ON i.supplier_id = sa.supplier_id
            WHERE i.inventory_id = ?
        `;
        try {
            const [rows] = await db.query(query, [inventoryId]);
            return rows[0] || null;
        } catch (error) {
            console.error('Error in getInventoryItemById:', error);
            throw new Error('Failed to fetch inventory item');
        }
    },

    // Get approved purchase orders after cost estimation
    getApprovedPurchaseOrders: async () => {
        const query = `
            SELECT 
                po.po_id,
                po.pr_id,
                po.supplier_id,
                sa.supplier_name,
                DATE_FORMAT(po.order_date, '%Y-%m-%d %H:%i:%s') as order_date,
                po.status,
                po.material_type,
                CAST(po.quantity AS DECIMAL(10,2)) as quantity,
                po.unit,
                po.estimation_cost,
                po.remarks,
                po.created_by,
                DATE_FORMAT(po.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
                DATE_FORMAT(po.updated_at, '%Y-%m-%d %H:%i:%s') as updated_at,
                DATE_FORMAT(po.estimation_submitted_at, '%Y-%m-%d %H:%i:%s') as estimation_submitted_at,
                po.invoice_number,
                po.invoice_date,
                po.shipping_fee,
                po.bank_name,
                po.account_number,
                po.account_holder,
                po.payment_type,
                po.receipt_number,
                po.receipt_date,
                po.receipt_file
            FROM purchase_order po
            LEFT JOIN supplier_account sa ON po.supplier_id = sa.supplier_id
            WHERE po.status IN ('Approved', 'Paid')
            ORDER BY 
                CASE 
                    WHEN po.status = 'Approved' THEN 1
                    WHEN po.status = 'Paid' THEN 2
                END,
                po.order_date DESC
        `;
        try {
            const [rows] = await db.query(query);
            return rows.map(row => ({
                ...row,
                quantity: parseFloat(row.quantity),
                estimation_cost: parseFloat(row.estimation_cost || 0),
                shipping_fee: parseFloat(row.shipping_fee || 0),
                status: row.status || 'Pending'
            }));
        } catch (error) {
            console.error('Error in getApprovedPurchaseOrders:', error);
            throw new Error('Failed to fetch approved purchase orders');
        }
    }
};

module.exports = SCMModel;
