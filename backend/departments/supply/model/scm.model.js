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
                sa.supplier_type,
                u.role_id,
                GROUP_CONCAT(sc.category ORDER BY sc.category SEPARATOR ',') as categories
            FROM supplier_account sa
            LEFT JOIN users u ON sa.user_id = u.id
            LEFT JOIN supplier_category sc ON sa.supplier_id = sc.supplier_id
            GROUP BY sa.supplier_id
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
                    payment_terms, status, supplier_type, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
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
                supplierData.status || 'active',
                supplierData.supplier_type || 'manual'
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

            // 2b. Link user to supplier (set supplier_account.user_id)
            await connection.query(
                'UPDATE supplier_account SET user_id = ?, updated_at = NOW() WHERE supplier_id = ?',
                [userResult.insertId, supplierId]
            );

            // 3. Insert supplier categories if provided
            if (supplierData.categories && supplierData.categories.length > 0) {
                const categoryQuery = `
                    INSERT INTO supplier_category (supplier_id, category) VALUES ?
                `;
                const categoryValues = supplierData.categories.map(category => [supplierId, category]);
                await connection.query(categoryQuery, [categoryValues]);
            }

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
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

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
                    supplier_type = ?,
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
                supplierData.supplier_type || 'manual',
                supplierId
            ];
            const [result] = await connection.query(query, values);

            // Update supplier categories
            // First, delete existing categories
            await connection.query('DELETE FROM supplier_category WHERE supplier_id = ?', [supplierId]);
            
            // Then insert new categories if provided
            if (supplierData.categories && supplierData.categories.length > 0) {
                const categoryQuery = `
                    INSERT INTO supplier_category (supplier_id, category) VALUES ?
                `;
                const categoryValues = supplierData.categories.map(category => [supplierId, category]);
                await connection.query(categoryQuery, [categoryValues]);
            }

            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
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

    // Set refund request for a purchase
    setPurchaseRefund: async (purchaseId, returnReason, returnProof = null) => {
        try {
            const [res] = await db.query(
                `UPDATE purchases SET return_reason = ?, return_proof = ?, status = 'Return Pending' WHERE purchase_id = ?`,
                [returnReason, returnProof, purchaseId]
            );
            return { success: res.affectedRows > 0 };
        } catch (err) {
            console.error('Error in setPurchaseRefund:', err);
            throw err;
        }
    },

    // Get refund requests pending finance approval
    getPendingRefunds: async () => {
        const sql = `
            SELECT 
                p.purchase_id,
                p.pr_id,
                p.supplier_id,
                sa.supplier_name,
                p.material_id,
                m.name AS material_name,
                p.variant,
                p.quantity,
                p.unit,
                p.unit_price,
                p.total_price,
                p.delivery_cost,
                p.discount,
                p.invoice_amount,
                p.quantity_received,
                p.quantity_returned,
                p.return_reason,
                p.return_proof,
                p.status,
                DATE_FORMAT(p.created_date, '%Y-%m-%d %H:%i:%s') AS created_date
            FROM purchases p
            LEFT JOIN supplier_account sa ON sa.supplier_id = p.supplier_id
            LEFT JOIN materials m ON m.material_id = p.material_id
            WHERE p.status = 'Return Pending'
            ORDER BY p.created_date DESC
        `;
        try {
            const [rows] = await db.query(sql);
            return rows.map(row => ({
                ...row,
                quantity: parseFloat(row.quantity),
                unit_price: parseFloat(row.unit_price),
                total_price: parseFloat(row.total_price),
                delivery_cost: parseFloat(row.delivery_cost || 0),
                discount: parseFloat(row.discount || 0),
                invoice_amount: parseFloat(row.invoice_amount || 0),
                quantity_received: parseFloat(row.quantity_received || 0),
                quantity_returned: parseFloat(row.quantity_returned || 0)
            }));
        } catch (err) {
            console.error('Error in getPendingRefunds:', err);
            throw err;
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
    },

    // ===== Brands / Materials (new flow) =====
    ensureBrand: async (brandName) => {
        if (!brandName) return null; // brandless
        // Try get existing
        const [rows] = await db.query(`SELECT brand_id FROM brands WHERE name = ?`, [brandName]);
        if (rows && rows.length) return rows[0].brand_id;
        // Insert new
        const [ins] = await db.query(`INSERT INTO brands (name) VALUES (?)`, [brandName]);
        return ins.insertId;
    },

    createMaterial: async (materialData) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            let brandId = null;
            
            // Always create/find brand based on brand_name input, regardless of type
            if (materialData.brand_name) {
                const [rows] = await connection.query(`SELECT brand_id FROM brands WHERE name = ?`, [materialData.brand_name]);
                if (rows && rows.length) {
                    brandId = rows[0].brand_id;
                } else {
                    const [ins] = await connection.query(`INSERT INTO brands (name) VALUES (?)`, [materialData.brand_name]);
                    brandId = ins.insertId;
                }
            }
            
            const matSql = `
                INSERT INTO materials (
                    supplier_id, brand_id, name, variant, type, description, category, unit, price, quantity, effective_date, price_validity, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'Active')
            `;
            const matVals = [
                materialData.supplier_id,
                brandId,
                materialData.name,
                materialData.variant || null,
                materialData.type,
                materialData.description || null,
                materialData.category || 'General',
                materialData.unit || null,
                materialData.price,
                materialData.quantity || 0
            ];
            const [matIns] = await connection.query(matSql, matVals);
            await connection.commit();
            return { material_id: matIns.insertId, brand_id: brandId };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    },

    // Products: get for a supplier (their own)
    getProductsForSupplier: async (supplierId) => {
        try {
            const [rows] = await db.query(
                `SELECT product_id, supplier_id, name, description, size, unit, price, effective_date, price_validity, status
                 FROM products WHERE supplier_id = ? ORDER BY product_id DESC`,
                [supplierId]
            );
            return rows;
        } catch (err) {
            // If products table does not exist (legacy environments), return empty list gracefully
            if (err && (err.code === 'ER_NO_SUCH_TABLE' || /doesn't exist/i.test(String(err.message)))) {
                return [];
            }
            throw err;
        }
    },

    // Products: get all pending (SCM review)
    getPendingProducts: async () => {
        const [rows] = await db.query(
            `SELECT p.product_id, p.supplier_id, sa.supplier_name, p.name, p.description, p.size, p.unit, p.price, p.effective_date, p.price_validity, p.status
             FROM products p
             JOIN supplier_account sa ON p.supplier_id = sa.supplier_id
             WHERE p.status = 'Pending'
             ORDER BY p.product_id DESC`
        );
        return rows;
    },

    // Products: update status (SCM approve/reject -> Active/Inactive)
    updateProductStatus: async (productId, status) => {
        const allowed = ['Active', 'Inactive', 'Pending'];
        if (!allowed.includes(status)) {
            return { success: false, error: 'Invalid status' };
        }
        let result;
        if (status === 'Active') {
            [result] = await db.query(
                `UPDATE products 
                 SET status = 'Active', price_validity = DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                 WHERE product_id = ?`,
                [productId]
            );
        } else {
            [result] = await db.query(
                `UPDATE products SET status = ? WHERE product_id = ?`,
                [status, productId]
            );
        }
        if (result.affectedRows === 0) {
            return { success: false, error: 'Product not found' };
        }
        return { success: true };
    },

    // Products: supplier price change request (creates Pending record version)
    requestPriceChange: async (productId, supplierId, newPrice) => {
        // For simplicity: update price and set status back to Pending for review
        const [chk] = await db.query(`SELECT supplier_id FROM products WHERE product_id = ?`, [productId]);
        if (!chk || chk.length === 0) return { success: false, error: 'Product not found' };
        if (Number(chk[0].supplier_id) !== Number(supplierId)) return { success: false, error: 'Forbidden' };
        const [res] = await db.query(
            `UPDATE products SET price = ?, status = 'Pending', price_validity = NULL WHERE product_id = ?`,
            [newPrice, productId]
        );
        if (res.affectedRows === 0) return { success: false, error: 'Update failed' };
        return { success: true };
    },

    getAllMaterials: async () => {
        const [rows] = await db.query(`
            SELECT 
                m.material_id,
                m.supplier_id,
                sa.supplier_name,
                m.brand_id,
                b.name AS brand_name,
                m.name,
                m.variant,
                m.type,
                m.description,
                m.category,
                m.unit,
                m.price,
                m.quantity,
                m.effective_date,
                m.price_validity,
                m.status,
                CASE 
                    WHEN m.quantity <= 10 THEN 'Low Stock'
                    WHEN m.quantity <= 50 THEN 'Medium Stock'
                    ELSE 'Good Stock'
                END as stock_status
            FROM materials m
            LEFT JOIN brands b ON m.brand_id = b.brand_id
            LEFT JOIN supplier_account sa ON m.supplier_id = sa.supplier_id
            WHERE m.status = 'Active'
            ORDER BY 
                CASE 
                    WHEN m.quantity <= 10 THEN 1
                    WHEN m.quantity <= 50 THEN 2
                    ELSE 3
                END,
                m.name ASC
        `);
        return rows;
    },

    // ===== Purchases (PR/PO flow) =====
    // Find all suppliers that offer the same item (by exact material name, optional brand filter)
    getSuppliersForItem: async ({ name, brand_name = null }) => {
        const where = ["m.status = 'Active'", 'm.name = ?'];
        const vals = [name];
        if (brand_name) {
            where.push('b.name = ?');
            vals.push(brand_name);
        }
        const sql = `
            SELECT 
                m.material_id,
                m.name,
                m.variant,
                m.unit,
                m.price AS unit_price,
                m.supplier_id,
                sa.supplier_name,
                b.name AS brand_name
            FROM materials m
            LEFT JOIN brands b ON m.brand_id = b.brand_id
            JOIN supplier_account sa ON m.supplier_id = sa.supplier_id
            WHERE ${where.join(' AND ')}
            ORDER BY sa.supplier_name ASC, m.unit ASC, m.variant ASC
        `;
        const [rows] = await db.query(sql, vals);
        return rows;
    },

    // Create a purchase row
    createPurchase: async (p) => {
        const sql = `
            INSERT INTO purchases (
                requested_by, supplier_id, material_id, variant, 
                quantity, unit, unit_price, status, remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
        `;
        const vals = [
            p.requested_by,
            p.supplier_id,
            p.material_id,
            p.variant || null,
            p.quantity,
            p.unit || null,
            p.unit_price,
            p.remarks || null
        ];
        const [res] = await db.query(sql, vals);
        return res.insertId;
    },

    // Get purchases for review/listing (basic)
    listPurchases: async () => {
        const sql = `
            SELECT 
                p.purchase_id,
                p.pr_id,
                p.supplier_id,
                sa.supplier_name,
                p.material_id,
                m.name AS material_name,
                p.variant,
                p.quantity,
                p.unit,
                p.unit_price,
                p.total_price,
                p.delivery_cost,
                p.discount,
                p.invoice_amount,
                DATE_FORMAT(p.created_date, '%Y-%m-%d %H:%i:%s') AS created_date,
                p.status
            FROM purchases p
            LEFT JOIN supplier_account sa ON sa.supplier_id = p.supplier_id
            LEFT JOIN materials m ON m.material_id = p.material_id
            ORDER BY p.purchase_id DESC
        `;
        try {
            const [rows] = await db.query(sql);
            try {
                console.log('🔎 [Model] listPurchases count:', rows?.length || 0);
                if (rows && rows.length) console.log('🔎 [Model] listPurchases sample:', rows[0]);
            } catch (_) {}
            return rows;
        } catch (err) {
            console.error('💥 [Model] listPurchases query failed:', err);
            throw err;
        }
    },

    // Update a purchase status and optionally sync the linked purchase_request
    updatePurchaseStatus: async (purchaseId, newStatus, options = {}) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Build dynamic update for purchases (status + optional delivery_cost/discount)
            const updates = ['status = ?'];
            const vals = [newStatus];
            if (Object.prototype.hasOwnProperty.call(options, 'delivery_cost')) {
                updates.push('delivery_cost = ?');
                vals.push(Number(options.delivery_cost) || 0);
            }
            if (Object.prototype.hasOwnProperty.call(options, 'discount')) {
                updates.push('discount = ?');
                vals.push(Number(options.discount) || 0);
            }
            vals.push(purchaseId);
            const sql = `UPDATE purchases SET ${updates.join(', ')} WHERE purchase_id = ?`;
            const [upd] = await connection.query(sql, vals);
            if (upd.affectedRows === 0) {
                await connection.rollback();
                return { success: false, error: 'Purchase not found' };
            }

            // Get pr_id to update purchase_requests if applicable
            const [rows] = await connection.query(
                `SELECT pr_id FROM purchases WHERE purchase_id = ?`,
                [purchaseId]
            );
            const prId = rows && rows[0] ? rows[0].pr_id : null;

            if (prId) {
                // Map purchase status to purchase_requests status
                let prStatus = null;
                if (newStatus === 'Out for Delivery') prStatus = 'Converted to PO';
                if (newStatus === 'Cancelled') prStatus = 'Cancelled';
                // Finance statuses are handled elsewhere
                if (prStatus) {
                    await connection.query(
                        `UPDATE purchase_requests SET status = ? WHERE pr_id = ?`,
                        [prStatus, prId]
                    );
                }
            }

            await connection.commit();
            return { success: true };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    },

    // Update supplier invoice file and date for a purchase
    updatePurchaseInvoice: async (purchaseId, supplierInvoiceData, invoiceDate = null) => {
        try {
            // Normalize date to MySQL DATETIME format
            let mysqlDate = null;
            if (invoiceDate) {
                try {
                    const d = new Date(invoiceDate);
                    if (!isNaN(d.getTime())) {
                        const pad = (n) => String(n).padStart(2, '0');
                        const y = d.getFullYear();
                        const m = pad(d.getMonth() + 1);
                        const day = pad(d.getDate());
                        const hh = pad(d.getHours());
                        const mm = pad(d.getMinutes());
                        const ss = pad(d.getSeconds());
                        mysqlDate = `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
                    }
                } catch (_) { mysqlDate = null; }
            }
            // Attempt direct update first
            const [res] = await db.query(
                `UPDATE purchases SET supplier_invoice = ?, invoice_date = ? WHERE purchase_id = ?`,
                [supplierInvoiceData, mysqlDate, purchaseId]
            );
            return { success: res.affectedRows > 0 };
        } catch (err) {
            // If data too long for column, auto-migrate column to MEDIUMTEXT and retry once
            const msg = String(err && (err.code || err.message || ''));
            if (msg.includes('ER_DATA_TOO_LONG') || /Data too long/i.test(msg)) {
                try {
                    await db.query(`ALTER TABLE purchases MODIFY supplier_invoice MEDIUMTEXT NULL`);
                    const [res2] = await db.query(
                        `UPDATE purchases SET supplier_invoice = ?, invoice_date = ? WHERE purchase_id = ?`,
                        [supplierInvoiceData, invoiceDate || new Date(), purchaseId]
                    );
                    return { success: res2.affectedRows > 0, migrated: true };
                } catch (inner) {
                    console.error('Error migrating supplier_invoice column or updating after migration:', inner);
                    throw inner;
                }
            }
            console.error('Error in updatePurchaseInvoice:', err);
            throw err;
        }
    },

    // Create bulk purchase requests (new schema)
    createBulkPurchaseRequests: async (data) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            
            const results = [];
            
            for (const material of data.materials) {
                const sql = `
                    INSERT INTO purchase_requests (
                        requested_by, supplier_id, material_id, variant, 
                        quantity_requested, unit, unit_price, 
                        created_date, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
                `;
                const vals = [
                    data.requested_by,
                    material.supplier_id,
                    material.material_id,
                    material.variant || null,
                    parseFloat(material.quantity),
                    material.unit || null,
                    parseFloat(material.unit_price),
                    data.request_date
                ];
                
                const [res] = await connection.query(sql, vals);
                results.push(res.insertId);
            }
            
            await connection.commit();
            return results;
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    },

    // Get supplier's purchase orders (from purchases table)
    getSupplierPurchaseOrders: async (supplierId) => {
        console.log('🔍 getSupplierPurchaseOrders model called with supplierId:', supplierId);
        
        const sql = `
            SELECT 
                p.purchase_id,
                p.pr_id,
                p.supplier_id,
                sa.supplier_name,
                p.material_id,
                m.name AS material_name,
                m.category AS material_category,
                p.variant,
                p.quantity,
                p.unit,
                p.unit_price,
                p.total_price,
                p.delivery_cost,
                p.discount,
                p.supplier_invoice,
                p.invoice_date,
                p.invoice_amount,
                p.quantity_received,
                p.quantity_returned,
                p.status,
                p.created_date,
                DATE_FORMAT(p.created_date, '%Y-%m-%d %H:%i:%s') as created_date_formatted,
                pr.requested_by,
                u.username AS requested_by_name
            FROM purchases p
            LEFT JOIN supplier_account sa ON p.supplier_id = sa.supplier_id
            LEFT JOIN materials m ON p.material_id = m.material_id
            LEFT JOIN purchase_requests pr ON p.pr_id = pr.pr_id
            LEFT JOIN users u ON pr.requested_by = u.id
            WHERE p.supplier_id = ?
            ORDER BY p.created_date DESC
        `;
        
        try {
            console.log('📝 Executing SQL query...');
            const [rows] = await db.query(sql, [supplierId]);
            console.log('📊 Raw query result:', rows.length, 'rows');
            console.log('📋 Sample row:', rows[0]);
            
            const processedRows = rows.map(row => ({
                ...row,
                quantity: parseFloat(row.quantity),
                unit_price: parseFloat(row.unit_price),
                total_price: parseFloat(row.total_price),
                delivery_cost: parseFloat(row.delivery_cost || 0),
                discount: parseFloat(row.discount || 0),
                invoice_amount: parseFloat(row.invoice_amount || 0),
                quantity_received: parseFloat(row.quantity_received || 0),
                quantity_returned: parseFloat(row.quantity_returned || 0)
            }));
            
            console.log('✅ Processed rows:', processedRows.length);
            return processedRows;
        } catch (error) {
            console.error('💥 Error in getSupplierPurchaseOrders:', error);
            throw new Error('Failed to fetch supplier purchase orders');
        }
    },

    // Get materials that belong to a specific supplier
    getMaterialsForSupplier: async (supplierId) => {
        const sql = `
            SELECT 
                m.material_id,
                m.supplier_id,
                sa.supplier_name,
                m.brand_id,
                b.name AS brand_name,
                m.name,
                m.variant,
                m.type,
                m.description,
                m.category,
                m.unit,
                m.price,
                m.quantity,
                m.effective_date,
                m.price_validity,
                m.status
            FROM materials m
            LEFT JOIN brands b ON m.brand_id = b.brand_id
            LEFT JOIN supplier_account sa ON m.supplier_id = sa.supplier_id
            WHERE m.supplier_id = ?
            ORDER BY m.name ASC
        `;
        try {
            const [rows] = await db.query(sql, [supplierId]);
            return rows;
        } catch (error) {
            console.error('Error in getMaterialsForSupplier:', error);
            throw new Error('Failed to fetch supplier materials');
        }
    }
};

module.exports = SCMModel;
