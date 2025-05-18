const db = require("../../../db");

class FinanceModel {
    // Get all payrolls
    static async getAllPayrolls() {
        const SQL_COMMAND = `
            SELECT 
                p.id,
                p.employee_id,
                p.start_date,
                p.end_date,
                p.days_present,
                p.days_absent,
                p.total_hours,
                p.overtime_hours,
                p.fixed_salary,
                p.salary_before_tax,
                p.total_deductions,
                p.absence_deduction,
                p.net_salary,
                p.payroll_date,
                p.payroll_period,
                p.status,
                p.remarks,
                e.full_name,
                r.name as position,
                e.profile_picture
            FROM payroll p
            JOIN employees e ON p.employee_id = e.employee_id
            JOIN roles r ON e.role_id = r.id
            ORDER BY p.payroll_date DESC;
        `;

        try {
            console.log('Executing SQL query for all payrolls...');
            const [payrolls] = await db.query(SQL_COMMAND);
            console.log('Number of payroll records found:', payrolls.length);
            if (payrolls.length > 0) {
                console.log('Sample payroll record:', payrolls[0]);
            } else {
                console.log('No payroll records found in the database');
            }
            return payrolls;
        } catch (error) {
            console.error('Database error in getAllPayrolls:', error);
            throw error;
        }
    }

    // Get pending payrolls
    static async getPendingPayrolls() {
        const SQL_COMMAND = `
            SELECT 
                p.id,
                p.employee_id,
                p.start_date,
                p.end_date,
                p.days_present,
                p.days_absent,
                p.total_hours,
                p.overtime_hours,
                p.fixed_salary,
                p.salary_before_tax,
                p.total_deductions,
                p.absence_deduction,
                p.net_salary,
                p.payroll_date,
                p.payroll_period,
                p.status,
                p.remarks,
                e.full_name,
                r.role_name as position,
                e.profile_picture
            FROM payroll p
            JOIN employees e ON p.employee_id = e.employee_id
            JOIN roles r ON e.role_id = r.role_id
            WHERE p.status = 'pending'
            ORDER BY p.payroll_date DESC;
        `;

        try {
            console.log('Executing SQL query for pending payrolls...');
            const [payrolls] = await db.query(SQL_COMMAND);
            console.log('Number of pending payroll records found:', payrolls.length);
            if (payrolls.length > 0) {
                console.log('Sample pending payroll record:', payrolls[0]);
            } else {
                console.log('No pending payroll records found in the database');
            }
            return payrolls;
        } catch (error) {
            console.error('Database error in getPendingPayrolls:', error);
            throw error;
        }
    }

    // =============================================
    // PURCHASE REQUESTS - Connected to Supply Department
    // These functions handle purchase request data from the supply department
    // =============================================

    // Get all purchase requests from supply department
    static async getAllPurchaseRequests() {
        const SQL_COMMAND = `
            SELECT 
                pr.request_id,
                pr.material_type,
                pr.quantity,
                pr.unit,
                pr.justification,
                pr.status,
                pr.requested_by,
                pr.department,
                DATE_FORMAT(pr.request_date, '%Y-%m-%d %H:%i:%s') as request_date,
                DATE_FORMAT(pr.approved_date, '%Y-%m-%d %H:%i:%s') as approved_date,
                e.full_name as requester_name,
                d.name as department_name,
                pr.remarks
            FROM purchase_requests pr
            LEFT JOIN users u ON pr.requested_by = u.username
            LEFT JOIN employees e ON e.employee_id = u.id
            LEFT JOIN departments d ON pr.department = d.id
            WHERE pr.status != 'Deleted'
            ORDER BY 
                CASE 
                    WHEN pr.status = 'Pending' THEN 1
                    WHEN pr.status = 'Approved' THEN 2
                    WHEN pr.status = 'In Transit' THEN 3
                    WHEN pr.status = 'Delivered' THEN 4
                    WHEN pr.status = 'Rejected' THEN 5
                    ELSE 6
                END,
                pr.request_date DESC;
        `;

        try {
            console.log('Executing SQL query for purchase requests...');
            console.log('SQL Command:', SQL_COMMAND);
            const [requests] = await db.query(SQL_COMMAND);
            console.log('Number of purchase requests found:', requests.length);
            if (requests.length > 0) {
                console.log('Sample purchase request:', requests[0]);
            } else {
                console.log('No purchase requests found in the database');
            }
            return requests;
        } catch (error) {
            console.error('Detailed error in getAllPurchaseRequests:', {
                message: error.message,
                code: error.code,
                sqlMessage: error.sqlMessage,
                sqlState: error.sqlState,
                sql: error.sql
            });
            throw new Error(`Failed to fetch purchase requests: ${error.message}`);
        }
    }

    // Update purchase request status (for finance approval/rejection)
    static async updatePurchaseRequestStatus(requestId, status, remarks = null) {
        const SQL_COMMAND = `
            UPDATE purchase_requests 
            SET 
                status = ?,
                remarks = ?,
                approved_date = CASE 
                    WHEN ? IN ('Approved', 'Rejected') THEN NOW()
                    ELSE approved_date
                END
            WHERE request_id = ?
        `;

        try {
            const [result] = await db.query(SQL_COMMAND, [status, remarks, status, requestId]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error in updatePurchaseRequestStatus:', error);
            throw new Error('Failed to update purchase request status');
        }
    }

    // Update purchase request status to approved (for finance approval)
    static async approvePurchaseRequest(requestId) {
        const SQL_COMMAND = `
            UPDATE purchase_requests 
            SET 
                status = 'Approved',
                approved_date = NOW(),
                updated_at = NOW()
            WHERE request_id = ? AND status = 'Pending'
        `;

        try {
            const [result] = await db.query(SQL_COMMAND, [requestId]);
            
            if (result.affectedRows === 0) {
                throw new Error('Purchase request not found or already processed');
            }

            return {
                success: true,
                message: 'Purchase request approved successfully by finance'
            };
        } catch (error) {
            console.error('Error in approvePurchaseRequest:', error);
            throw new Error('Failed to approve purchase request: ' + error.message);
        }
    }

    // Get approved purchase requests (for finance view)
    static async getApprovedPurchaseRequests() {
        const SQL_COMMAND = `
            SELECT 
                pr.request_id,
                pr.material_type,
                pr.quantity,
                pr.unit,
                pr.justification,
                pr.status,
                pr.requested_by,
                pr.department,
                DATE_FORMAT(pr.request_date, '%Y-%m-%d %H:%i:%s') as request_date,
                DATE_FORMAT(pr.approved_date, '%Y-%m-%d %H:%i:%s') as approved_date,
                e.full_name as requester_name,
                d.name as department_name,
                pr.remarks
            FROM purchase_requests pr
            LEFT JOIN users u ON pr.requested_by = u.username
            LEFT JOIN employees e ON e.employee_id = u.id
            LEFT JOIN departments d ON pr.department = d.id
            WHERE pr.status = 'Approved'
            ORDER BY pr.approved_date DESC;
        `;

        try {
            const [requests] = await db.query(SQL_COMMAND);
            return requests;
        } catch (error) {
            console.error('Error in getApprovedPurchaseRequests:', error);
            throw new Error('Failed to fetch approved purchase requests: ' + error.message);
        }
    }

    // Get purchase orders with supplier estimations
    static async getPurchaseOrdersWithEstimations() {
        const SQL_COMMAND = `
            SELECT 
                po.po_id,
                po.material_type,
                po.quantity,
                po.unit,
                po.estimation_cost,
                po.status,
                po.created_at,
                po.updated_at,
                s.supplier_name,
                s.supplier_id,
                pr.request_id,
                pr.justification,
                pr.requested_by,
                d.name as department_name,
                DATE_FORMAT(po.created_at, '%Y-%m-%d %H:%i:%s') as created_date,
                DATE_FORMAT(po.updated_at, '%Y-%m-%d %H:%i:%s') as updated_date
            FROM purchase_order po
            JOIN supplier_account s ON po.supplier_id = s.supplier_id
            JOIN purchase_requests pr ON po.pr_id = pr.request_id
            LEFT JOIN departments d ON pr.department = d.id
            WHERE po.status = 'Pending Estimation'
            ORDER BY po.created_at DESC;
        `;

        try {
            console.log('Executing SQL query for purchase orders with estimations...');
            const [orders] = await db.query(SQL_COMMAND);
            console.log('Number of purchase orders found:', orders.length);
            return orders;
        } catch (error) {
            console.error('Error in getPurchaseOrdersWithEstimations:', error);
            throw new Error('Failed to fetch purchase orders with estimations');
        }
    }

    // Update purchase order status (approve/reject estimation)
    static async updatePurchaseOrderEstimation(poId, status, remarks = null, payment_type = null) {
        const SQL_COMMAND = `
            UPDATE purchase_order 
            SET 
                status = ?,
                remarks = ?,
                payment_type = ?,
                updated_at = NOW()
            WHERE po_id = ? AND status = 'Pending Estimation'
        `;

        try {
            const [result] = await db.query(SQL_COMMAND, [status, remarks, payment_type, poId]);
            
            if (result.affectedRows === 0) {
                throw new Error('Purchase order not found or already processed');
            }

            return {
                success: true,
                message: `Purchase order ${status.toLowerCase()} successfully${payment_type ? ` with ${payment_type} payment` : ''}`
            };
        } catch (error) {
            console.error('Error in updatePurchaseOrderEstimation:', error);
            throw new Error(`Failed to ${status.toLowerCase()} purchase order: ${error.message}`);
        }
    }

    // Get purchase orders pending payment
    static async getPurchaseOrdersPendingPayment() {
        const SQL_COMMAND = `
            SELECT 
                po.po_id,
                po.material_type,
                po.quantity,
                po.unit,
                po.estimation_cost,
                po.status,
                po.payment_type,
                po.created_at,
                po.updated_at,
                s.supplier_name,
                s.supplier_id,
                DATE_FORMAT(po.created_at, '%Y-%m-%d %H:%i:%s') as created_date,
                DATE_FORMAT(po.updated_at, '%Y-%m-%d %H:%i:%s') as updated_date
            FROM purchase_order po
            JOIN supplier_account s ON po.supplier_id = s.supplier_id
            WHERE po.status = 'Pending Payment'
            ORDER BY po.updated_at DESC;
        `;

        try {
            console.log('Executing SQL query for purchase orders pending payment...');
            const [orders] = await db.query(SQL_COMMAND);
            console.log('Number of pending payment orders found:', orders.length);
            return orders;
        } catch (error) {
            console.error('Error in getPurchaseOrdersPendingPayment:', error);
            throw new Error('Failed to fetch purchase orders pending payment');
        }
    }

    // Update purchase order payment status
    static async updatePurchaseOrderPayment(poId, status, reference_number = null) {
        const SQL_COMMAND = `
            UPDATE purchase_order 
            SET 
                status = ?,
                payment_reference = ?,
                payment_date = CASE 
                    WHEN ? = 'Paid' THEN NOW()
                    ELSE payment_date
                END,
                updated_at = NOW()
            WHERE po_id = ? AND status = 'Pending Payment'
        `;

        try {
            const [result] = await db.query(SQL_COMMAND, [status, reference_number, status, poId]);
            
            if (result.affectedRows === 0) {
                throw new Error('Purchase order not found or not in pending payment status');
            }

            return {
                success: true,
                message: `Payment status updated to ${status.toLowerCase()} successfully`
            };
        } catch (error) {
            console.error('Error in updatePurchaseOrderPayment:', error);
            throw new Error(`Failed to update payment status: ${error.message}`);
        }
    }

    // Get purchase order by ID
    static async getPurchaseOrderById(poId) {
        const SQL_COMMAND = `
            SELECT 
                po.po_id,
                po.material_type,
                po.quantity,
                po.unit,
                po.estimation_cost,
                po.status,
                po.payment_type,
                po.receipt_number,
                po.receipt_date,
                po.receipt_file,
                po.created_at,
                po.updated_at,
                s.supplier_name,
                s.supplier_id,
                DATE_FORMAT(po.created_at, '%Y-%m-%d %H:%i:%s') as created_date,
                DATE_FORMAT(po.updated_at, '%Y-%m-%d %H:%i:%s') as updated_date
            FROM purchase_order po
            JOIN supplier_account s ON po.supplier_id = s.supplier_id
            WHERE po.po_id = ?
        `;

        try {
            const [orders] = await db.query(SQL_COMMAND, [poId]);
            return orders[0] || null;
        } catch (error) {
            console.error('Error in getPurchaseOrderById:', error);
            throw new Error('Failed to fetch purchase order');
        }
    }

    // Process payment for delivered order
    static async processPurchaseOrderPayment(poId, payment_type, reference_number = null) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Update order status to Paid and store payment details
            const SQL_COMMAND = `
                UPDATE purchase_order 
                SET 
                    status = 'Paid',
                    payment_reference = ?,
                    payment_date = NOW(),
                    updated_at = NOW()
                WHERE po_id = ? AND status = 'Delivered with Receipt'
            `;

            const [result] = await connection.query(SQL_COMMAND, [reference_number, poId]);
            
            if (result.affectedRows === 0) {
                await connection.rollback();
                return { 
                    success: false, 
                    message: 'Order not found or not in correct status for payment' 
                };
            }

            // Get updated order details
            const [updatedOrder] = await connection.query(`
                SELECT 
                    po.po_id,
                    po.material_type,
                    po.quantity,
                    po.unit,
                    po.estimation_cost,
                    po.status,
                    po.payment_type,
                    po.payment_reference,
                    po.payment_date,
                    po.receipt_number,
                    po.receipt_date,
                    po.receipt_file,
                    s.supplier_name,
                    DATE_FORMAT(po.payment_date, '%Y-%m-%d %H:%i:%s') as payment_date_formatted
                FROM purchase_order po
                JOIN supplier_account s ON po.supplier_id = s.supplier_id
                WHERE po.po_id = ?
            `, [poId]);

            await connection.commit();

            return {
                success: true,
                message: 'Payment processed successfully',
                data: updatedOrder[0] ? {
                    ...updatedOrder[0],
                    quantity: parseFloat(updatedOrder[0].quantity),
                    estimation_cost: parseFloat(updatedOrder[0].estimation_cost || 0)
                } : null
            };
        } catch (error) {
            await connection.rollback();
            console.error('Error in processPurchaseOrderPayment:', error);
            throw new Error('Failed to process payment');
        } finally {
            connection.release();
        }
    }
}

module.exports = FinanceModel;
