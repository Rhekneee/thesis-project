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

    // Add a new purchase request
    addPurchaseRequest: async (requestData) => {
        const query = `
            INSERT INTO purchase_requests (
                request_date, requested_by, department, quantity, unit, justification, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            requestData.request_date,
            requestData.requested_by,
            requestData.department,
            requestData.quantity,
            requestData.unit,
            requestData.justification,
            requestData.status || 'Pending'
        ];
        const [result] = await db.query(query, values);
        return result.insertId;
    }
};

module.exports = SCMModel;
