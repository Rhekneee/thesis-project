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

    // Detailed PR rows (new schema): supplier + material joins
    listDetailedPurchaseRequests: async () => {
        const sql = `
            SELECT 
                pr.pr_id,
                pr.created_date,
                pr.status,
                pr.quantity_requested,
                pr.unit,
                pr.unit_price,
                (pr.quantity_requested * pr.unit_price) AS total_price,
                pr.variant,
                pr.supplier_id,
                pr.material_id,
                sa.supplier_name,
                m.name AS material_name,
                m.category AS material_category
            FROM purchase_requests pr
            LEFT JOIN supplier_account sa ON pr.supplier_id = sa.supplier_id
            LEFT JOIN materials m ON pr.material_id = m.material_id
            WHERE pr.supplier_id IS NOT NULL 
              AND pr.material_id IS NOT NULL
              AND COALESCE(sa.supplier_type,'manual') = 'manual'
            ORDER BY pr.created_date DESC, pr.pr_id DESC
        `;
        try {
            const [rows] = await db.query(sql);
            return rows.map(r => ({
                pr_id: r.pr_id,
                created_date: r.created_date,
                status: r.status,
                quantity_requested: Number(r.quantity_requested || 0),
                unit: r.unit,
                unit_price: Number(r.unit_price || 0),
                total_price: Number(r.total_price || 0),
                variant: r.variant,
                supplier_name: r.supplier_name || '',
                material_name: r.material_name || '',
                material_category: r.material_category || ''
            }));
        } catch (e) {
            console.error('Error in listDetailedPurchaseRequests:', e);
            throw e;
        }
    },

    // Ensure a manual supplier exists by name; create if missing
    ensureManualSupplierByName: async (supplierName) => {
        const name = String(supplierName || '').trim();
        if (!name) throw new Error('supplier_name is required');
        // Try find existing by exact name
        const [found] = await db.query(
            `SELECT supplier_id FROM supplier_account WHERE supplier_name = ? LIMIT 1`,
            [name]
        );
        if (found && found.length) return found[0].supplier_id;
        // Insert minimal manual supplier record
        const [ins] = await db.query(
            `INSERT INTO supplier_account (supplier_name, status, supplier_type, created_at, updated_at)
             VALUES (?, 'active', 'manual', NOW(), NOW())`,
            [name]
        );
        return ins.insertId;
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
                sa.supplier_type,
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
                sa.supplier_type,
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

    // Supplier-submitted material: create as Inactive (await SCM confirmation)
    createMaterialFromSupplier: async (materialData) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            let brandId = null;
            // Always create/link a brand. If brand_name missing/brandless, use material name as brand.
            const targetBrandName = (materialData.brand_name && String(materialData.brand_name).trim())
                ? String(materialData.brand_name).trim()
                : String(materialData.name).trim();
            const [rows] = await connection.query(`SELECT brand_id FROM brands WHERE name = ?`, [targetBrandName]);
            if (rows && rows.length) {
                brandId = rows[0].brand_id;
            } else {
                const [ins] = await connection.query(`INSERT INTO brands (name) VALUES (?)`, [targetBrandName]);
                brandId = ins.insertId;
            }

            const matSql = `
                INSERT INTO materials (
                    supplier_id, brand_id, name, variant, type, description, category, unit, price, effective_date, price_validity, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'Inactive')
            `;
            const matVals = [
                materialData.supplier_id,
                brandId,
                materialData.name,
                materialData.variant || null,
                materialData.type || null,
                materialData.description || null,
                materialData.category || 'General',
                materialData.unit || null,
                materialData.price
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

    // Products: create pending product submitted by supplier
    createProduct: async ({ supplier_id, name, description = null, size = null, unit = null, price, effective_date = null, price_validity = null }) => {
        try {
            const sql = `
                INSERT INTO products (supplier_id, name, description, size, unit, price, effective_date, price_validity, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
            `;
            const values = [
                supplier_id,
                name,
                description,
                size,
                unit,
                Number(price),
                effective_date || new Date(),
                price_validity || null
            ];
            const [ins] = await db.query(sql, values);
            return ins.insertId;
        } catch (err) {
            // Auto-create products table if missing (best-effort)
            const msg = String(err && (err.code || err.message || ''));
            if (msg.includes('ER_NO_SUCH_TABLE') || /doesn't exist/i.test(msg)) {
                await db.query(`
                    CREATE TABLE IF NOT EXISTS products (
                        product_id INT AUTO_INCREMENT PRIMARY KEY,
                        supplier_id INT NOT NULL,
                        name VARCHAR(255) NOT NULL,
                        description VARCHAR(512) NULL,
                        size VARCHAR(128) NULL,
                        unit VARCHAR(32) NULL,
                        price DECIMAL(12,2) NOT NULL,
                        effective_date DATETIME NULL,
                        price_validity DATE NULL,
                        status ENUM('Pending','Active','Inactive') DEFAULT 'Pending',
                        INDEX (supplier_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                `);
                const [ins2] = await db.query(
                    `INSERT INTO products (supplier_id, name, description, size, unit, price, effective_date, price_validity, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
                    [supplier_id, name, description, size, unit, Number(price), new Date(), null]
                );
                return ins2.insertId;
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

    // Get all inactive materials (awaiting SCM confirmation)
    getInactiveMaterials: async () => {
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
                m.status
            FROM materials m
            LEFT JOIN brands b ON m.brand_id = b.brand_id
            LEFT JOIN supplier_account sa ON m.supplier_id = sa.supplier_id
            WHERE m.status = 'Inactive'
            ORDER BY sa.supplier_name ASC, m.name ASC
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

    // Materials: update status (SCM approve/reject -> Active/Inactive)
    updateMaterialStatus: async (materialId, status) => {
        const allowed = ['Active', 'Inactive'];
        if (!allowed.includes(status)) {
            return { success: false, error: 'Invalid status' };
        }
        let result;
        if (status === 'Active') {
            [result] = await db.query(
                `UPDATE materials 
                 SET status = 'Active', price_validity = DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                 WHERE material_id = ?`,
                [materialId]
            );
        } else {
            [result] = await db.query(
                `UPDATE materials SET status = ? WHERE material_id = ?`,
                [status, materialId]
            );
        }
        if (result.affectedRows === 0) {
            return { success: false, error: 'Material not found' };
        }
        return { success: true };
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
                sa.supplier_type,
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

            // Fetch current purchase to detect status transition and collect material linkage
            const [currentRows] = await connection.query(
                `SELECT material_id, quantity, quantity_received, status FROM purchases WHERE purchase_id = ?`,
                [purchaseId]
            );
            if (!currentRows || currentRows.length === 0) {
                await connection.rollback();
                return { success: false, error: 'Purchase not found' };
            }
            const currentPurchase = currentRows[0];
            const wasReceived = String(currentPurchase.status) === 'Received';

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

            // If transitioning to Received for the first time, increment materials.quantity
            if (!wasReceived && newStatus === 'Received' && currentPurchase.material_id) {
                const qtyToAdd = Number.isFinite(Number(currentPurchase.quantity_received)) && Number(currentPurchase.quantity_received) > 0
                    ? Number(currentPurchase.quantity_received)
                    : Number(currentPurchase.quantity) || 0;
                if (qtyToAdd > 0) {
                    await connection.query(
                        `UPDATE materials SET quantity = COALESCE(quantity, 0) + ? WHERE material_id = ?`,
                        [qtyToAdd, currentPurchase.material_id]
                    );
                }
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
                if (newStatus === 'Received') prStatus = 'Completed';
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
                    material.supplier_id || null,
                    material.material_id || null,
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
                p.remarks,
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
    },

    // List purchases with status 'Received' for a supplier
    getSupplierReceivedPurchases: async (supplierId) => {
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
                p.invoice_amount,
                DATE_FORMAT(p.created_date, '%Y-%m-%d %H:%i:%s') AS created_date,
                p.status
            FROM purchases p
            LEFT JOIN supplier_account sa ON sa.supplier_id = p.supplier_id
            LEFT JOIN materials m ON m.material_id = p.material_id
            WHERE p.supplier_id = ? AND p.status = 'Received'
            ORDER BY p.created_date DESC
        `;
        try {
            const [rows] = await db.query(sql, [supplierId]);
            return rows.map(row => ({
                ...row,
                quantity: parseFloat(row.quantity),
                unit_price: parseFloat(row.unit_price),
                total_price: parseFloat(row.total_price),
                delivery_cost: parseFloat(row.delivery_cost || 0),
                discount: parseFloat(row.discount || 0),
                invoice_amount: parseFloat(row.invoice_amount || 0)
            }));
        } catch (err) {
            console.error('Error in getSupplierReceivedPurchases:', err);
            throw err;
        }
    },

    // Set proof picture for purchase and mark as Received
    setPurchaseOrderProof: async (orderId, proofPicture) => {
        try {
            // First check if the purchase exists and capture linkage/quantities
            const [orderCheck] = await db.query(
                'SELECT purchase_id, status, pr_id, material_id, quantity, quantity_received FROM purchases WHERE purchase_id = ?',
                [orderId]
            );
            
            if (!orderCheck || orderCheck.length === 0) {
                return { success: false, error: 'Purchase not found' };
            }
            const prevStatus = String(orderCheck[0].status);

            // Update the purchase with proof picture and mark as Received
            const [result] = await db.query(
                `UPDATE purchases 
                 SET 
                     proof_picture = ?,
                     status = 'Received'
                 WHERE purchase_id = ?`,
                [proofPicture, orderId]
            );

            if (result.affectedRows === 0) {
                return { success: false, error: 'Failed to update purchase' };
            }

            // If first time becoming Received, increment material stock
            if (prevStatus !== 'Received' && orderCheck[0].material_id) {
                const qtyToAdd = Number.isFinite(Number(orderCheck[0].quantity_received)) && Number(orderCheck[0].quantity_received) > 0
                    ? Number(orderCheck[0].quantity_received)
                    : Number(orderCheck[0].quantity) || 0;
                if (qtyToAdd > 0) {
                    await db.query(
                        `UPDATE materials SET quantity = COALESCE(quantity, 0) + ? WHERE material_id = ?`,
                        [qtyToAdd, orderCheck[0].material_id]
                    );
                }
            }

            // Sync purchase_requests: when Received, mark Completed
            const prId = orderCheck[0].pr_id || null;
            if (prevStatus !== 'Received' && prId) {
                await db.query(`UPDATE purchase_requests SET status = 'Completed' WHERE pr_id = ?`, [prId]);
            }

            return { success: true };
        } catch (error) {
            console.error('Error in setPurchaseOrderProof:', error);
            throw new Error('Failed to save proof picture');
        }
    },

    // ===== Owners Supply Management =====
    // Get all owners supply materials with delivery status
    getAllOwnersSupplyMaterials: async () => {
        const query = `
            SELECT 
                os.supply_id,
                os.material_id,
                os.proposal_id,
                os.developer_id,
                os.material_name,
                os.unit,
                os.quantity,
                os.quantity_used,
                os.quantity_remaining,
                os.is_delivered,
                os.delivered_date,
                os.status,
                os.material_status,
                p.project_name,
                p.location,
                u.username as developer_name,
                mr.driver_id,
                mr.vehicle_info,
                mr.external_driver_name as driver_name,
                mr.external_vehicle_details as vehicle_details,
                mr.courier_service,
                mr.released_at as release_date,
                mr.status as release_status
            FROM owners_supply os
            LEFT JOIN proposals p ON os.proposal_id = p.proposal_id
            LEFT JOIN users u ON os.developer_id = u.id
            LEFT JOIN material_releases mr ON os.supply_id = mr.owner_supply_id
            ORDER BY os.supply_id DESC
        `;
        try {
            const [rows] = await db.query(query);
            return rows.map(row => ({
                ...row,
                quantity: parseFloat(row.quantity || 0),
                quantity_used: parseFloat(row.quantity_used || 0),
                quantity_remaining: parseFloat(row.quantity_remaining || 0),
                is_delivered: Boolean(row.is_delivered),
                material_status: Boolean(row.material_status),
                vehicle_info: row.vehicle_info || row.vehicle_details
            }));
        } catch (error) {
            console.error('Error in getAllOwnersSupplyMaterials:', error);
            throw new Error('Failed to fetch owners supply materials');
        }
    },

    // Update owners supply delivery status
    updateOwnersSupplyDelivery: async (supplyId, deliveryData) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const { is_delivered, delivered_date, status, quantity_used, quantity_remaining } = deliveryData;
            
            // Calculate remaining quantity if not provided
            let finalQuantityRemaining = quantity_remaining;
            if (quantity_used !== undefined && !quantity_remaining) {
                const [currentSupply] = await connection.query(
                    'SELECT quantity FROM owners_supply WHERE supply_id = ?',
                    [supplyId]
                );
                if (currentSupply && currentSupply.length > 0) {
                    finalQuantityRemaining = currentSupply[0].quantity - (quantity_used || 0);
                }
            }

            const query = `
                UPDATE owners_supply 
                SET 
                    is_delivered = ?,
                    delivered_date = ?,
                    status = ?,
                    quantity_used = ?,
                    quantity_remaining = ?,
                    material_status = 1
                WHERE supply_id = ?
            `;
            
            const values = [
                is_delivered ? 1 : 0,
                delivered_date || null,
                status || 'Pending',
                quantity_used || 0,
                finalQuantityRemaining || 0,
                supplyId
            ];

            const [result] = await connection.query(query, values);
            
            if (result.affectedRows === 0) {
                await connection.rollback();
                return { success: false, error: 'Supply material not found' };
            }

            // Get updated supply material
            const [updatedSupply] = await connection.query(`
                SELECT 
                    os.supply_id,
                    os.material_id,
                    os.proposal_id,
                    os.developer_id,
                    os.material_name,
                    os.unit,
                    os.quantity,
                    os.quantity_used,
                    os.quantity_remaining,
                    os.is_delivered,
                    os.delivered_date,
                    os.status,
                    os.material_status,
                    p.project_name,
                    p.location,
                    u.username as developer_name
                FROM owners_supply os
                LEFT JOIN proposals p ON os.proposal_id = p.proposal_id
                LEFT JOIN users u ON os.developer_id = u.id
                WHERE os.supply_id = ?
            `, [supplyId]);

            await connection.commit();

            return { 
                success: true, 
                supply: updatedSupply[0] ? {
                    ...updatedSupply[0],
                    quantity: parseFloat(updatedSupply[0].quantity || 0),
                    quantity_used: parseFloat(updatedSupply[0].quantity_used || 0),
                    quantity_remaining: parseFloat(updatedSupply[0].quantity_remaining || 0),
                    is_delivered: Boolean(updatedSupply[0].is_delivered),
                    material_status: Boolean(updatedSupply[0].material_status)
                } : null
            };
        } catch (error) {
            await connection.rollback();
            console.error('Error in updateOwnersSupplyDelivery:', error);
            throw new Error('Failed to update owners supply delivery status');
        } finally {
            connection.release();
        }
    },

    // Get owners supply materials by project
    getOwnersSupplyByProject: async (proposalId) => {
        const query = `
            SELECT 
                os.supply_id,
                os.material_id,
                os.proposal_id,
                os.developer_id,
                os.material_name,
                os.unit,
                os.quantity,
                os.quantity_used,
                os.quantity_remaining,
                os.is_delivered,
                os.delivered_date,
                os.status,
                os.material_status,
                p.project_name,
                p.location,
                u.username as developer_name
            FROM owners_supply os
            LEFT JOIN proposals p ON os.proposal_id = p.proposal_id
            LEFT JOIN users u ON os.developer_id = u.id
            WHERE os.proposal_id = ?
                AND os.status = 'Delivered'
                AND (os.material_status = 1 OR os.material_status = true)
            ORDER BY os.supply_id ASC
        `;
        try {
            const [rows] = await db.query(query, [proposalId]);
            return rows.map(row => ({
                ...row,
                quantity: parseFloat(row.quantity || 0),
                quantity_used: parseFloat(row.quantity_used || 0),
                quantity_remaining: parseFloat(row.quantity_remaining || 0),
                is_delivered: Boolean(row.is_delivered),
                material_status: Boolean(row.material_status)
            }));
        } catch (error) {
            console.error('Error in getOwnersSupplyByProject:', error);
            throw new Error('Failed to fetch project supply materials');
        }
    },

    // Get manufacturing material requests (optionally filter by project_id)
    getManufacturingRequests: async (projectId = null) => {
        const query = `
            SELECT 
                rm.request_no,
                rm.project_id,
                rm.requested_by,
                rm.department_id,
                rm.source_type,
                rm.purpose,
                rm.status,
                rm.requested_at,
                rm.approved_by,
                rm.approved_at,
                p.project_name,
                e.full_name as requested_by_name,
                d.name as department_name
            FROM request_material rm
            LEFT JOIN projects p ON rm.project_id = p.id
            LEFT JOIN employees e ON rm.requested_by = e.employee_id
            LEFT JOIN departments d ON rm.department_id = d.id
            WHERE rm.department_id = 3
              ${projectId ? 'AND rm.project_id = ?' : ''}
            ORDER BY rm.requested_at DESC
        `;
        try {
            const [rows] = projectId ? await db.query(query, [projectId]) : await db.query(query);
            
            // Group materials by request_no
            const requestMap = new Map();
            
            for (const row of rows) {
                const requestNo = row.request_no;
                
                if (!requestMap.has(requestNo)) {
                    requestMap.set(requestNo, {
                        request_no: requestNo,
                        project_id: row.project_id,
                        project_name: row.project_name,
                        requested_by: row.requested_by,
                        requested_by_name: row.requested_by_name,
                        department_id: row.department_id,
                        department_name: row.department_name,
                        source_type: row.source_type,
                        purpose: row.purpose,
                        status: row.status,
                        requested_at: row.requested_at,
                        approved_by: row.approved_by,
                        approved_at: row.approved_at,
                        materials: []
                    });
                }
                
                // Get materials for this request
                // Show quantity_supplied (what's being supplied), with backorder quantity if applicable
                const materialQuery = `
                    SELECT 
                        rm.material_id,
                        rm.owner_supply_id,
                        rm.project_id,
                        rm.price,
                        CASE 
                            -- If quantity_backorder > 0, show the backordered quantity
                            WHEN rm.quantity_backorder IS NOT NULL AND rm.quantity_backorder > 0 
                            THEN rm.quantity_backorder
                            -- If quantity_supplied exists, show it (what's being supplied)
                            WHEN rm.quantity_supplied IS NOT NULL AND rm.quantity_supplied > 0
                            THEN rm.quantity_supplied
                            -- Otherwise show original requested quantity
                            ELSE rm.quantity
                        END as quantity,
                        rm.unit,
                        rm.source_type,
                        rm.quantity as original_quantity,
                        rm.quantity_supplied,
                        rm.quantity_backorder,
                        CASE 
                            WHEN rm.source_type = 'owner_supply' THEN os.material_name
                            WHEN rm.source_type = 'company_supply' THEN m.name
                            ELSE 'Unknown Material'
                        END as material_name
                    FROM request_material rm
                    LEFT JOIN owners_supply os ON rm.owner_supply_id = os.supply_id
                    LEFT JOIN materials m ON rm.material_id = m.material_id
                    WHERE rm.request_no = ?
                `;
                
                const [materials] = await db.query(materialQuery, [requestNo]);
                requestMap.get(requestNo).materials = materials;
            }
            
            return Array.from(requestMap.values());
        } catch (error) {
            console.error('Error in getManufacturingRequests:', error);
            throw new Error('Failed to fetch manufacturing requests');
        }
    },

    // Get approved material requests for delivery (status = 'approved')
    getApprovedManufacturingRequests: async () => {
        const query = `
            SELECT 
                rm.request_no,
                rm.project_id,
                rm.requested_by,
                rm.department_id,
                rm.source_type,
                rm.purpose,
                rm.status,
                rm.requested_at,
                rm.approved_at,
                p.project_name,
                e.full_name as requested_by_name,
                d.name as department_name
            FROM request_material rm
            LEFT JOIN projects p ON rm.project_id = p.id
            LEFT JOIN employees e ON rm.requested_by = e.employee_id
            LEFT JOIN departments d ON rm.department_id = d.id
            WHERE rm.department_id = 3 AND rm.status = 'approved'
            ORDER BY rm.approved_at DESC
        `;
        try {
            const [rows] = await db.query(query);
            
            // Group materials by request_no and attach materials
            const requestMap = new Map();
            
            for (const row of rows) {
                const requestNo = row.request_no;
                
                if (!requestMap.has(requestNo)) {
                    requestMap.set(requestNo, {
                        request_no: requestNo,
                        project_id: row.project_id,
                        project_name: row.project_name,
                        requested_by: row.requested_by,
                        requested_by_name: row.requested_by_name,
                        department_id: row.department_id,
                        department_name: row.department_name,
                        source_type: row.source_type,
                        purpose: row.purpose,
                        status: row.status,
                        requested_at: row.requested_at,
                        approved_at: row.approved_at,
                        materials: []
                    });
                }
                
                // Get materials for this request
                // Show quantity_supplied (what's being supplied), with backorder quantity if applicable
                const materialQuery = `
                    SELECT 
                        rm.material_id,
                        rm.owner_supply_id,
                        rm.price,
                        CASE 
                            -- If quantity_backorder > 0, show the backordered quantity
                            WHEN rm.quantity_backorder IS NOT NULL AND rm.quantity_backorder > 0 
                            THEN rm.quantity_backorder
                            -- If quantity_supplied exists, show it (what's being supplied)
                            WHEN rm.quantity_supplied IS NOT NULL AND rm.quantity_supplied > 0
                            THEN rm.quantity_supplied
                            -- Otherwise show original requested quantity
                            ELSE rm.quantity
                        END as quantity,
                        rm.unit,
                        rm.source_type,
                        rm.quantity as original_quantity,
                        rm.quantity_supplied,
                        rm.quantity_backorder,
                        CASE 
                            WHEN rm.source_type = 'owner_supply' THEN os.material_name
                            WHEN rm.source_type = 'company_supply' THEN m.name
                            ELSE 'Unknown Material'
                        END as material_name
                    FROM request_material rm
                    LEFT JOIN owners_supply os ON rm.owner_supply_id = os.supply_id
                    LEFT JOIN materials m ON rm.material_id = m.material_id
                    WHERE rm.request_no = ?
                `;
                
                const [materials] = await db.query(materialQuery, [requestNo]);
                requestMap.get(requestNo).materials = materials;
            }
            
            return Array.from(requestMap.values());
        } catch (error) {
            console.error('Error in getApprovedManufacturingRequests:', error);
            throw new Error('Failed to fetch approved manufacturing requests');
        }
    },

    // Get employees for driver selection
    getEmployees: async () => {
        const query = `
            SELECT 
                e.employee_id,
                e.full_name,
                e.employment_status,
                e.role_id
            FROM employees e
            LEFT JOIN users u ON e.user_id = u.id
            WHERE u.is_active = 1 
                AND e.is_deleted = 0
            ORDER BY e.full_name
        `;
        try {
            const [rows] = await db.query(query);
            return rows;
        } catch (error) {
            console.error('Error in getEmployees:', error);
            throw new Error('Failed to fetch employees');
        }
    },

    // Get drivers only (role_id 17 or 18)
    getDrivers: async () => {
        const query = `
            SELECT 
                e.employee_id,
                e.full_name,
                e.employment_status,
                e.role_id
            FROM employees e
            LEFT JOIN users u ON e.user_id = u.id
            WHERE (e.role_id = 17 OR e.role_id = 18) 
                AND u.is_active = 1
                AND e.is_deleted = 0
            ORDER BY e.role_id, e.full_name
        `;
        try {
            const [rows] = await db.query(query);
            return rows;
        } catch (error) {
            console.error('Error in getDrivers:', error);
            throw new Error('Failed to fetch drivers');
        }
    },

    // Create material release
    createMaterialRelease: async (releaseData) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const { request_no, delivery_type, driver_id, vehicle_info, external_driver_name, external_vehicle_details, courier_service, release_notes, released_by, quantities } = releaseData;

            // Get the request materials
            const [requestMaterials] = await connection.query(`
                SELECT * FROM request_material WHERE request_no = ?
            `, [request_no]);

            console.log('Found request materials:', requestMaterials.length, 'for request_no:', request_no);

            if (requestMaterials.length === 0) {
                await connection.rollback();
                return { success: false, error: 'Request not found' };
            }

            // Update request_material with quantities for each material
            // Store quantity_supplied (what's being released) and quantity_backorder (what's left)
            // Keep the original quantity (requested amount) unchanged
            const updatePromises = requestMaterials.map((material, index) => {
                const quantityInfo = quantities && quantities[index] ? quantities[index] : { released: material.quantity, backordered: 0 };
                const releasedQty = parseFloat(quantityInfo.released) || material.quantity;
                const backorderedQty = parseFloat(quantityInfo.backordered) || 0;
                
                // Determine status: if there's backorder, mark as 'backordered', otherwise 'released'
                const recordStatus = backorderedQty > 0 ? 'backordered' : 'released';
                
                // Update quantity_supplied and quantity_backorder while keeping original quantity
                const updateQuery = `
                    UPDATE request_material 
                    SET quantity_supplied = ?,
                        quantity_backorder = ?,
                        status = ?
                    WHERE id = ? AND request_no = ?
                `;

                return connection.query(updateQuery, [
                    releasedQty,      // quantity_supplied: amount being released
                    backorderedQty,   // quantity_backorder: amount left to be delivered
                    recordStatus,     // status: 'released' or 'backordered'
                    material.id,
                    request_no
                ]);
            });

            await Promise.all(updatePromises);

            // Create material release records (without quantity columns)
            // Note: Status in material_releases is always 'released' for tracking physical release
            // Backorder information is stored in request_material table
            const releasePromises = requestMaterials.map((material, index) => {
                const releaseQuery = `
                    INSERT INTO material_releases (
                        material_id,
                        request_id,
                        project_id,
                        status,
                        source_type,
                        driver_id,
                        vehicle_info,
                        external_driver_name,
                        external_vehicle_details,
                        courier_service,
                        released_at
                    ) VALUES (?, ?, ?, 'released', ?, ?, ?, ?, ?, ?, NOW())
                `;

                return connection.query(releaseQuery, [
                    material.material_id,
                    material.id,
                    material.project_id,
                    material.source_type,
                    delivery_type === 'internal' ? driver_id : null,
                    delivery_type === 'internal' ? vehicle_info : null,
                    delivery_type === 'external' ? external_driver_name : null,
                    delivery_type === 'external' ? external_vehicle_details : null,
                    delivery_type === 'courier' ? courier_service : null
                ]);
            });

            await Promise.all(releasePromises);

            // Update quantity_requested in owners_supply table for owner_supply materials
            for (let i = 0; i < requestMaterials.length; i++) {
                const material = requestMaterials[i];
                const quantityInfo = quantities && quantities[i] ? quantities[i] : { released: material.quantity, backordered: 0 };
                const releasedQty = parseFloat(quantityInfo.released) || material.quantity;
                
                if (material.source_type === 'owner_supply' && material.owner_supply_id) {
                    // Update quantity_requested (amount requested from owner) and recalculate remaining
                    await connection.query(`
                        UPDATE owners_supply 
                        SET quantity_requested = COALESCE(quantity_requested, 0) + ?,
                            quantity_remaining = quantity - (COALESCE(quantity_requested, 0) + ?)
                        WHERE supply_id = ?
                    `, [releasedQty, releasedQty, material.owner_supply_id]);
                    
                    console.log('Updated owners_supply quantity_requested for supply_id:', material.owner_supply_id, 'quantity:', releasedQty);
                }
            }

            // Update request approved_at timestamp (status is already updated per material with released/backordered)
            const updateResult = await connection.query(`
                UPDATE request_material 
                SET approved_at = NOW()
                WHERE request_no = ?
            `, [request_no]);

            console.log('Updated request_material approved_at for request_no:', request_no, 'affected rows:', updateResult[0].affectedRows);
            console.log('Quantities and backorder info stored in request_material table');

            await connection.commit();
            return { success: true, release_id: Date.now() };
        } catch (error) {
            await connection.rollback();
            console.error('Error in createMaterialRelease:', error);
            throw new Error('Failed to create material release');
        } finally {
            connection.release();
        }
    },

    // Update manufacturing request status to approved
    updateManufacturingRequestStatus: async (requestNo, newStatus) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            console.log('Updating manufacturing request status:', requestNo, 'to:', newStatus);

            // If status is 'approved', deduct quantity from owner_supply
            if (newStatus === 'approved') {
                // Get all materials for this request
                const [requestMaterials] = await connection.query(`
                    SELECT owner_supply_id, material_id, quantity, source_type 
                    FROM request_material 
                    WHERE request_no = ?
                `, [requestNo]);

                console.log('Request materials:', requestMaterials);

                // Deduct quantity from owner_supply for owner_supply materials
                for (const material of requestMaterials) {
                    if (material.source_type === 'owner_supply' && material.owner_supply_id) {
                        const deducted = parseFloat(material.quantity) || 0;
                        
                        console.log('Deducting quantity:', deducted, 'from supply_id:', material.owner_supply_id);
                        
                        // Update owner_supply to subtract quantity
                        await connection.query(`
                            UPDATE owners_supply 
                            SET quantity_remaining = GREATEST(0, quantity_remaining - ?),
                                material_status = 0
                            WHERE supply_id = ?
                        `, [deducted, material.owner_supply_id]);
                        
                        console.log('Deducted from owner_supply successfully');
                    }
                }
            }

            // Update request status
            const updateResult = await connection.query(`
                UPDATE request_material 
                SET status = ?, approved_at = NOW()
                WHERE request_no = ?
            `, [newStatus, requestNo]);

            console.log('Updated request_material status:', updateResult[0].affectedRows, 'rows affected for request_no:', requestNo);

            await connection.commit();
            return { success: true, affectedRows: updateResult[0].affectedRows };
        } catch (error) {
            await connection.rollback();
            console.error('Error in updateManufacturingRequestStatus:', error);
            throw new Error('Failed to update manufacturing request status');
        } finally {
            connection.release();
        }
    },

    // Set delivery information for a purchase
    setPurchaseDeliveryInfo: async (purchaseId, deliveryData) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Check if purchase exists
            const [purchaseRows] = await connection.query(
                'SELECT purchase_id, status FROM purchases WHERE purchase_id = ?',
                [purchaseId]
            );

            if (purchaseRows.length === 0) {
                await connection.rollback();
                return { success: false, error: 'Purchase not found' };
            }

            // FIRST: Store delivery information in material_releases table
            try {
                console.log('🔍 Checking for existing material_releases record for purchase_id:', purchaseId);
                
                // Check if there's already a record for this purchase_id
                const [existingRecords] = await connection.query(
                    'SELECT id FROM material_releases WHERE purchase_id = ?',
                    [purchaseId]
                );

                console.log('📋 Existing records found:', existingRecords.length);

                if (existingRecords.length > 0) {
                    // Update existing record with delivery information
                    console.log('🔄 Updating existing material_releases record');
                    await connection.query(`
                        UPDATE material_releases 
                        SET 
                            external_driver_name = ?,
                            external_vehicle_details = ?,
                            courier_service = ?,
                            expected_delivery_date = ?,
                            released_at = NOW(),
                            status = 'released'
                        WHERE purchase_id = ?
                    `, [
                        deliveryData.external_driver_name,
                        deliveryData.external_vehicle_details,
                        deliveryData.courier_service || null,
                        deliveryData.expected_delivery_date,
                        purchaseId
                    ]);
                    console.log('✅ Successfully updated existing record');
                } else {
                    // Insert new record - get required fields from purchases table
                    console.log('➕ Inserting new material_releases record');
                    
                    const [purchaseRows] = await connection.query(
                        'SELECT material_id, pr_id FROM purchases WHERE purchase_id = ?',
                        [purchaseId]
                    );

                    console.log('📦 Purchase data found:', purchaseRows.length > 0 ? purchaseRows[0] : 'None');

                    if (purchaseRows.length > 0) {
                        const { material_id, pr_id } = purchaseRows[0];
                        
                        // For company supply procurement, project_id is always null
                        const project_id = null;
                        
                        // For request_id, we need to use NULL since this is company procurement, not a request_material
                        const request_id = null;
                        
                        console.log('🏗️ Project ID set to null for company supply');
                        console.log('📋 Request ID set to null for company procurement');
                        
                        // Insert new record into material_releases
                        console.log('🔧 Inserting with values:', {
                            material_id,
                            request_id,
                            purchaseId,
                            project_id,
                            expected_delivery_date: deliveryData.expected_delivery_date,
                            external_driver_name: deliveryData.external_driver_name,
                            external_vehicle_details: deliveryData.external_vehicle_details,
                            courier_service: deliveryData.courier_service || null
                        });
                        
                        const insertResult = await connection.query(`
                            INSERT INTO material_releases (
                                material_id, request_id, purchase_id, project_id, expected_delivery_date,
                                external_driver_name, external_vehicle_details, courier_service,
                                released_at, status, source_type
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'released', 'company_procured')
                        `, [
                            material_id,
                            request_id,
                            purchaseId,
                            project_id,
                            deliveryData.expected_delivery_date,
                            deliveryData.external_driver_name,
                            deliveryData.external_vehicle_details,
                            deliveryData.courier_service || null
                        ]);
                        
                        console.log('🔧 Insert result:', insertResult[0]);
                        console.log('✅ Successfully inserted new record');
                    } else {
                        console.error('❌ No purchase data found for purchase_id:', purchaseId);
                    }
                }
            } catch (deliveryInfoError) {
                console.error('❌ Could not store delivery info in material_releases table:', deliveryInfoError);
                
                // Fallback: Try a simpler insert without project_id if the first attempt failed
                try {
                    console.log('🔄 Attempting fallback insert without project_id...');
                    const [purchaseRows] = await connection.query(
                        'SELECT material_id, pr_id FROM purchases WHERE purchase_id = ?',
                        [purchaseId]
                    );
                    
                    if (purchaseRows.length > 0) {
                        const { material_id, pr_id } = purchaseRows[0];
                        
                        await connection.query(`
                            INSERT INTO material_releases (
                                material_id, request_id, purchase_id, expected_delivery_date,
                                external_driver_name, external_vehicle_details, courier_service,
                                released_at, status, source_type
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'released', 'company_procured')
                        `, [
                            material_id,
                            null, // request_id = null for company procurement
                            purchaseId,
                            deliveryData.expected_delivery_date,
                            deliveryData.external_driver_name,
                            deliveryData.external_vehicle_details,
                            deliveryData.courier_service || null
                        ]);
                        console.log('✅ Fallback insert successful');
                    }
                } catch (fallbackError) {
                    console.error('❌ Fallback insert also failed:', fallbackError);
                }
                // Continue without failing the main operation
            }

            // SECOND: Update purchase status and delivery information
            const updates = [
                'status = ?',
                'delivery_cost = ?',
                'discount = ?'
            ];
            const values = [
                deliveryData.status,
                deliveryData.delivery_cost,
                deliveryData.discount,
                purchaseId
            ];

            const updateQuery = `UPDATE purchases SET ${updates.join(', ')} WHERE purchase_id = ?`;
            const [updateResult] = await connection.query(updateQuery, values);

            if (updateResult.affectedRows === 0) {
                await connection.rollback();
                return { success: false, error: 'Failed to update purchase' };
            }

            console.log('✅ Purchase status updated successfully');

            await connection.commit();
            return { success: true, affectedRows: updateResult.affectedRows };
        } catch (error) {
            await connection.rollback();
            console.error('Error in setPurchaseDeliveryInfo:', error);
            return { success: false, error: 'Failed to save delivery information' };
        } finally {
            connection.release();
        }
    },

    // Get delivery information for a purchase
    getPurchaseDeliveryInfo: async (purchaseId) => {
        try {
            console.log('🔍 Getting delivery info for purchase_id:', purchaseId);
            
            // First, check if any material_releases exist for this purchase
            const [checkRows] = await db.query(`
                SELECT COUNT(*) as count FROM material_releases WHERE purchase_id = ?
            `, [purchaseId]);
            
            console.log('📊 Total material_releases for this purchase:', checkRows[0].count);
            
            const [rows] = await db.query(`
                SELECT 
                    external_driver_name,
                    external_vehicle_details,
                    courier_service,
                    expected_delivery_date,
                    released_at,
                    status
                FROM material_releases 
                WHERE purchase_id = ?
                ORDER BY released_at DESC
                LIMIT 1
            `, [purchaseId]);

            console.log('📋 Query result:', rows.length > 0 ? rows[0] : 'No records found');
            console.log('🔍 Purchase ID used:', purchaseId);

            if (rows.length > 0) {
                console.log('✅ Delivery info found:', {
                    driver: rows[0].external_driver_name,
                    vehicle: rows[0].external_vehicle_details,
                    courier: rows[0].courier_service,
                    date: rows[0].expected_delivery_date
                });
                return { 
                    success: true, 
                    deliveryInfo: rows[0] 
                };
            } else {
                console.log('⚠️ No delivery information found for purchase_id:', purchaseId);
                
                // Try to find if there are any releases for this purchase (without delivery info)
                const [allRows] = await db.query(`
                    SELECT purchase_id, status, released_at FROM material_releases WHERE purchase_id = ?
                `, [purchaseId]);
                
                if (allRows.length > 0) {
                    console.log('⚠️ Material releases exist but no delivery information', allRows);
                    return { 
                        success: false, 
                        error: 'Material releases exist but delivery information is missing' 
                    };
                } else {
                    return { 
                        success: false, 
                        error: 'No delivery information or material releases found for this purchase' 
                    };
                }
            }
        } catch (error) {
            console.error('Error in getPurchaseDeliveryInfo:', error);
            return { 
                success: false, 
                error: 'Failed to get delivery information' 
            };
        }
    },

    // ===== DRIVER API: Get material releases assigned to a specific driver =====
    // This API is specifically for drivers to view their assigned material deliveries
    // Returns materials with status 'released' or 'backordered' that need to be delivered
    // Displays backordered quantity if material was partially released
    getDriverMaterialReleases: async (driverId) => {
        try {
            const query = `
                SELECT DISTINCT
                    mr.id as release_id,
                    mr.material_id,
                    mr.request_id,
                    mr.project_id,
                    mr.status as release_status,
                    mr.source_type,
                    mr.driver_id,
                    mr.vehicle_info,
                    mr.released_at,
                    rm.request_no,
                    rm.quantity as original_quantity,
                    rm.quantity_supplied,
                    rm.quantity_backorder,
                    rm.unit,
                    rm.status as material_status,
                    rm.id as material_record_id,
                    CASE 
                        WHEN mr.source_type = 'owner_supply' THEN os.material_name
                        WHEN mr.source_type = 'company_supply' THEN m.name
                        ELSE 'Unknown Material'
                    END as material_name,
                    p.project_name,
                    p.location as project_location,
                    -- Show quantity_supplied (what's being delivered to driver), fallback to original quantity
                    -- This preserves the original requested quantity while tracking what's actually supplied
                    COALESCE(rm.quantity_supplied, rm.quantity) as display_quantity
                FROM material_releases mr
                INNER JOIN request_material rm ON mr.request_id = rm.id
                LEFT JOIN owners_supply os ON mr.source_type = 'owner_supply' AND rm.owner_supply_id = os.supply_id
                LEFT JOIN materials m ON mr.source_type = 'company_supply' AND mr.material_id = m.material_id
                LEFT JOIN projects p ON mr.project_id = p.id
                WHERE mr.driver_id = ?
                    AND mr.status = 'released'
                    AND rm.status != 'received'
                ORDER BY mr.released_at DESC
            `;
            
            const [rows] = await db.query(query, [driverId]);
            
            console.log(`📦 [Driver API] Found ${rows.length} material releases for driver_id: ${driverId}`);
            
            return rows.map(row => ({
                release_id: row.release_id,
                request_no: row.request_no,
                material_id: row.material_id,
                material_name: row.material_name,
                quantity: parseFloat(row.display_quantity),
                original_quantity: parseFloat(row.original_quantity),
                quantity_supplied: parseFloat(row.quantity_supplied || 0),
                quantity_backorder: parseFloat(row.quantity_backorder || 0),
                unit: row.unit,
                release_status: row.release_status,
                material_status: row.material_status,
                source_type: row.source_type,
                project_name: row.project_name,
                project_location: row.project_location,
                vehicle_info: row.vehicle_info,
                released_at: row.released_at,
                is_backordered: row.quantity_backorder > 0,
                material_record_id: row.material_record_id,
                request_id: row.request_id
            }));
        } catch (error) {
            console.error('❌ [Driver API] Error fetching driver material releases:', error);
            throw new Error('Failed to fetch driver material releases');
        }
    },

    // ===== DRIVER API: Mark material release as received by driver =====
    // This API allows drivers to confirm delivery and mark materials as received
    // - material_releases: status = 'received' (physical delivery complete)
    // - request_material: status = 'backordered' (if still has backorder) or 'received' (if fully delivered)
    updateMaterialReleaseStatus: async (releaseId, driverId) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            console.log(`📦 [Driver API] Updating release ${releaseId} status to received for driver ${driverId}`);

            // Verify the release belongs to this driver
            const [releaseCheck] = await connection.query(
                'SELECT id, request_id FROM material_releases WHERE id = ? AND driver_id = ?',
                [releaseId, driverId]
            );

            if (releaseCheck.length === 0) {
                await connection.rollback();
                return { success: false, error: 'Release not found or not assigned to this driver' };
            }

            const requestId = releaseCheck[0].request_id;

            // Check if there's still a backorder for this material
            const [materialCheck] = await connection.query(
                'SELECT quantity_backorder FROM request_material WHERE id = ?',
                [requestId]
            );

            const hasBackorder = materialCheck.length > 0 && parseFloat(materialCheck[0].quantity_backorder || 0) > 0;

            // Update material_releases status to 'received' (physical delivery complete)
            await connection.query(
                'UPDATE material_releases SET status = "received" WHERE id = ?',
                [releaseId]
            );

            // Update request_material status: 'backordered' if still has backorder, 'received' if fully delivered
            const newStatus = hasBackorder ? 'backordered' : 'received';
            await connection.query(
                'UPDATE request_material SET status = ? WHERE id = ?',
                [newStatus, requestId]
            );

            // Deduct inventory for company-supply only when driver marks as received
            const [rmRows] = await connection.query(
                `SELECT material_id, source_type, 
                        COALESCE(quantity_supplied, quantity) AS delivered_qty
                 FROM request_material WHERE id = ?`,
                [requestId]
            );
            if (rmRows && rmRows.length > 0) {
                const rm = rmRows[0];
                const deliveredQty = parseFloat(rm.delivered_qty || 0);
                if (rm.source_type === 'company_supply' && rm.material_id && deliveredQty > 0) {
                    await connection.query(
                        `UPDATE materials 
                         SET quantity = GREATEST(0, COALESCE(quantity,0) - ?)
                         WHERE material_id = ?`,
                        [deliveredQty, rm.material_id]
                    );
                }
            }

            console.log(`✅ [Driver API] Updated release ${releaseId} - material_releases='received', request_material='${newStatus}'`);

            await connection.commit();
            return { success: true };
        } catch (error) {
            await connection.rollback();
            console.error('❌ [Driver API] Error updating material release status:', error);
            throw new Error('Failed to update material release status');
        } finally {
            connection.release();
        }
    }
};

module.exports = SCMModel;
