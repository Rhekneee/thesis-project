const db = require("../../../db");
const axios = require('axios');

class FinanceModel {
    // Updated Finance Model to work with Payroll Periods
    // Get all payroll periods for Finance dashboard
    static async getAllPayrollPeriods() {
        try {
            const [periods] = await db.query(`
            SELECT 
                    pp.*,
                    COUNT(p.id) as employee_count,
                    SUM(p.net_salary) as total_payroll_amount,
                    SUM(p.total_hours) as total_hours,
                    SUM(p.overtime_hours) as total_overtime_hours
                FROM payroll_periods pp
                LEFT JOIN payroll p ON pp.id = p.payroll_period_id
                GROUP BY pp.id
                ORDER BY pp.created_at DESC
            `);
            return periods;
        } catch (error) {
            console.error('Error fetching payroll periods:', error);
            throw error;
        }
    }

    // Get pending payroll periods
    static async getPendingPayrollPeriods() {
        try {
            const [periods] = await db.query(`
                SELECT 
                    pp.*,
                    COUNT(p.id) as employee_count,
                    SUM(p.net_salary) as total_payroll_amount
                FROM payroll_periods pp
                LEFT JOIN payroll p ON pp.id = p.payroll_period_id
                WHERE pp.status = 'pending'
                GROUP BY pp.id
                ORDER BY pp.created_at DESC
            `);
            return periods;
        } catch (error) {
            console.error('Error fetching pending payroll periods:', error);
            throw error;
        }
    }

    // Get approved payroll periods
    static async getApprovedPayrollPeriods() {
        try {
            const [periods] = await db.query(`
                SELECT 
                    pp.*,
                    COUNT(p.id) as employee_count,
                    SUM(p.net_salary) as total_payroll_amount
                FROM payroll_periods pp
                LEFT JOIN payroll p ON pp.id = p.payroll_period_id
                WHERE pp.status = 'approved'
                GROUP BY pp.id
                ORDER BY pp.created_at DESC
            `);
            return periods;
        } catch (error) {
            console.error('Error fetching approved payroll periods:', error);
            throw error;
        }
    }

    // Get payroll period by ID
    static async getPayrollPeriodById(periodId) {
        try {
            const [periods] = await db.query(`
                SELECT * FROM payroll_periods WHERE id = ?
            `, [periodId]);
            return periods[0] || null;
        } catch (error) {
            console.error('Error fetching payroll period:', error);
            throw error;
        }
    }

    // Get all payroll entries for a specific period
    static async getPayrollEntriesByPeriod(periodId) {
        try {
            const [entries] = await db.query(`
                SELECT 
                    p.*,
                e.full_name,
                r.name as position,
                    e.profile_picture,
                    d.name as department_name
            FROM payroll p
            JOIN employees e ON p.employee_id = e.employee_id
            JOIN roles r ON e.role_id = r.id
                JOIN departments d ON r.department_id = d.id
                WHERE p.payroll_period_id = ?
                ORDER BY e.full_name
            `, [periodId]);
            return entries;
        } catch (error) {
            console.error('Error fetching payroll entries by period:', error);
            throw error;
        }
    }

    // Get payroll period summary
    static async getPayrollPeriodSummary(periodId) {
        try {
            const [summary] = await db.query(`
                SELECT 
                    pp.period_name,
                    pp.start_date,
                    pp.end_date,
                    pp.status,
                    COUNT(p.id) as total_employees,
                    SUM(p.net_salary) as total_payroll_amount,
                    AVG(p.net_salary) as average_salary,
                    SUM(p.total_hours) as total_hours,
                    SUM(p.overtime_hours) as total_overtime_hours,
                    SUM(p.total_deductions) as total_deductions,
                    SUM(p.absence_deduction) as total_absence_deductions
                FROM payroll_periods pp
                LEFT JOIN payroll p ON pp.id = p.payroll_period_id
                WHERE pp.id = ?
                GROUP BY pp.id
            `, [periodId]);
            
            return summary[0] || null;
        } catch (error) {
            console.error('Error fetching payroll period summary:', error);
            throw error;
        }
    }

    // Update payroll period status
    static async updatePayrollPeriodStatus(periodId, status) {
        try {
            const [result] = await db.query(`
                UPDATE payroll_periods 
                SET status = ?, updated_at = NOW()
                WHERE id = ?
            `, [status, periodId]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating payroll period status:', error);
            throw error;
        }
    }

    // Create payslips from payroll period
    static async createPayslipsFromPeriod(periodId, approvedBy) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Get all payroll entries for this period
            const [payrollEntries] = await connection.query(`
                SELECT * FROM payroll 
                WHERE payroll_period_id = ? AND status = 'approved'
            `, [periodId]);

            if (payrollEntries.length === 0) {
                throw new Error('No approved payroll entries found for this period');
            }

            // Get period details
            const [period] = await connection.query(`
                SELECT * FROM payroll_periods WHERE id = ?
            `, [periodId]);

            if (!period || period.length === 0) {
                throw new Error('Payroll period not found');
            }

            const periodData = period[0];
            const payslipIds = [];

            // Create payslip for each payroll entry
            for (const payrollEntry of payrollEntries) {
                // Generate payslip number
                const payslipNumber = `PS-${periodId}-${payrollEntry.employee_id}-${Date.now()}`;

                // Insert payslip
                const [payslipResult] = await connection.query(`
                    INSERT INTO payslip (
                        payslip_number, payslip_date, payslip_period, employee_id,
                        basic_salary, salary_before_tax, total_deductions, absence_deduction,
                        net_salary, start_date, end_date, days_present, days_absent,
                        total_hours, overtime_hours, payment_method, status, approved_by,
                        approved_date, payroll_period_id
                    ) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
                `, [
                    payslipNumber,
                    periodData.period_name,
                    payrollEntry.employee_id,
                    payrollEntry.fixed_salary,
                    payrollEntry.salary_before_tax,
                    payrollEntry.total_deductions,
                    payrollEntry.absence_deduction,
                    payrollEntry.net_salary,
                    payrollEntry.start_date,
                    payrollEntry.end_date,
                    payrollEntry.days_present,
                    payrollEntry.days_absent,
                    payrollEntry.total_hours,
                    payrollEntry.overtime_hours,
                    'bank_transfer',
                    'approved',
                    approvedBy,
                    periodId
                ]);

                payslipIds.push(payslipResult.insertId);

                // Update payroll entry status to processed
                await connection.query(`
                    UPDATE payroll 
                    SET status = 'processed' 
                    WHERE id = ?
                `, [payrollEntry.id]);
            }

            // Update period status to processed
            await connection.query(`
                UPDATE payroll_periods 
                SET status = 'processed', updated_at = NOW()
                WHERE id = ?
            `, [periodId]);

            await connection.commit();
            return {
                success: true,
                payslipIds: payslipIds,
                message: `Created ${payslipIds.length} payslips for period ${periodData.period_name}`
            };

        } catch (error) {
            await connection.rollback();
            console.error('Error creating payslips from period:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // Get all payslips (updated to work with periods)
    static async getAllPayslips() {
        try {
            const [payslips] = await db.query(`
            SELECT 
                p.id,
                    p.payslip_number,
                    p.payslip_date,
                    p.payslip_period,
                p.employee_id,
                    e.full_name,
                    r.name as position,
                    e.profile_picture,
                    p.basic_salary,
                    p.salary_before_tax,
                    p.total_deductions,
                    p.absence_deduction,
                    p.net_salary,
                p.start_date,
                p.end_date,
                p.days_present,
                p.days_absent,
                p.total_hours,
                p.overtime_hours,
                    p.payment_method,
                p.status,
                    p.approved_date,
                    u.username as approved_by_name,
                    pp.period_name as payroll_period_name
                FROM payslip p
            JOIN employees e ON p.employee_id = e.employee_id
                JOIN roles r ON e.role_id = r.id
                LEFT JOIN users u ON p.approved_by = u.id
                LEFT JOIN payroll_periods pp ON p.payroll_period_id = pp.id
                ORDER BY p.payslip_date DESC, p.payslip_number DESC
            `);
            return payslips;
        } catch (error) {
            console.error('Error fetching payslips:', error);
            throw error;
        }
    }

    // Get payslip by ID (updated to include period info)
    static async getPayslipById(payslipId) {
        try {
            const [payslips] = await db.query(`
                SELECT 
                    p.*,
                    e.full_name,
                    r.name as position,
                    e.profile_picture,
                    u.username as approved_by_name,
                    pp.period_name as payroll_period_name
                FROM payslip p
                JOIN employees e ON p.employee_id = e.employee_id
                JOIN roles r ON e.role_id = r.id
                LEFT JOIN users u ON p.approved_by = u.id
                LEFT JOIN payroll_periods pp ON p.payroll_period_id = pp.id
                WHERE p.id = ?
            `, [payslipId]);
            return payslips[0] || null;
        } catch (error) {
            console.error('Error fetching payslip:', error);
            throw error;
        }
    }

    // Update payslip status
    static async updatePayslipStatus(payslipId, status) {
        try {
            const [result] = await db.query(`
                UPDATE payslip 
                SET status = ?, updated_at = NOW()
                WHERE id = ?
            `, [status, payslipId]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating payslip status:', error);
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

    // =============================================
    // BANK ACCOUNT MANAGEMENT
    // These functions handle bank account operations
    // =============================================

    // Insert new bank account
    static async insertBankAccount(bankAccountData) {
        const SQL_COMMAND = `
            INSERT INTO bank_accounts (
                account_name, 
                bank_name, 
                account_number, 
                opening_balance, 
                currency, 
                status, 
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, NOW())
        `;

        try {
            const [result] = await db.query(SQL_COMMAND, [
                bankAccountData.account_name,
                bankAccountData.bank_name,
                bankAccountData.account_number,
                bankAccountData.opening_balance || 0,
                bankAccountData.currency || 'PHP',
                bankAccountData.status || 'active'
            ]);

            return {
                success: true,
                account_id: result.insertId,
                message: 'Bank account created successfully'
            };
        } catch (error) {
            console.error('Error in insertBankAccount:', error);
            
            // Handle duplicate account number error
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('Account number already exists. Please use a different account number.');
            }
            
            throw new Error('Failed to create bank account: ' + error.message);
        }
    }

    // Get all bank accounts
    static async getAllBankAccounts() {
        const SQL_COMMAND = `
            SELECT 
                account_id,
                account_name,
                bank_name,
                account_number,
                opening_balance,
                currency,
                status,
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at
            FROM bank_accounts 
            ORDER BY created_at DESC
        `;

        try {
            const [accounts] = await db.query(SQL_COMMAND);
            return accounts;
        } catch (error) {
            console.error('Error in getAllBankAccounts:', error);
            throw new Error('Failed to fetch bank accounts');
        }
    }

    // Get bank account by ID
    static async getBankAccountById(accountId) {
        const SQL_COMMAND = `
            SELECT 
                account_id,
                account_name,
                bank_name,
                account_number,
                opening_balance,
                currency,
                status,
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at
            FROM bank_accounts 
            WHERE account_id = ?
        `;

        try {
            const [accounts] = await db.query(SQL_COMMAND, [accountId]);
            return accounts[0] || null;
        } catch (error) {
            console.error('Error in getBankAccountById:', error);
            throw new Error('Failed to fetch bank account');
        }
    }

    // Update bank account
    static async updateBankAccount(accountId, bankAccountData) {
        const SQL_COMMAND = `
            UPDATE bank_accounts 
            SET 
                account_name = ?,
                bank_name = ?,
                account_number = ?,
                opening_balance = ?,
                currency = ?,
                status = ?
            WHERE account_id = ?
        `;

        try {
            const [result] = await db.query(SQL_COMMAND, [
                bankAccountData.account_name,
                bankAccountData.bank_name,
                bankAccountData.account_number,
                bankAccountData.opening_balance || 0,
                bankAccountData.currency || 'PHP',
                bankAccountData.status || 'active',
                accountId
            ]);

            if (result.affectedRows === 0) {
                throw new Error('Bank account not found');
            }

            return {
                success: true,
                message: 'Bank account updated successfully'
            };
        } catch (error) {
            console.error('Error in updateBankAccount:', error);
            
            // Handle duplicate account number error
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('Account number already exists. Please use a different account number.');
            }
            
            throw new Error('Failed to update bank account: ' + error.message);
        }
    }

    // Delete bank account
    static async deleteBankAccount(accountId) {
        const SQL_COMMAND = `
            DELETE FROM bank_accounts 
            WHERE account_id = ?
        `;

        try {
            const [result] = await db.query(SQL_COMMAND, [accountId]);
            
            if (result.affectedRows === 0) {
                throw new Error('Bank account not found');
            }

            return {
                success: true,
                message: 'Bank account deleted successfully'
            };
        } catch (error) {
            console.error('Error in deleteBankAccount:', error);
            throw new Error('Failed to delete bank account: ' + error.message);
        }
    }

    // Check if account number exists
    static async checkAccountNumberExists(accountNumber, excludeId = null) {
        let SQL_COMMAND = `
            SELECT COUNT(*) as count 
            FROM bank_accounts 
            WHERE account_number = ?
        `;
        
        const params = [accountNumber];
        
        if (excludeId) {
            SQL_COMMAND += ` AND account_id != ?`;
            params.push(excludeId);
        }

        try {
            const [result] = await db.query(SQL_COMMAND, params);
            return result[0].count > 0;
        } catch (error) {
            console.error('Error in checkAccountNumberExists:', error);
            throw new Error('Failed to check account number existence');
        }
    }

    // =============================================
    // CASH MONITORING (INFLOWS VIA PAYMONGO)
    // =============================================

    static async insertCashMonitoringInflow({
        inflow_source,
        amount,
        payment_method = 'paymongo',
        reference_number = null,
        description = null,
        recorded_by = 'system:paymongo',
        transaction_date = null
    }) {
        const SQL = `
            INSERT INTO cash_monitoring (
                flow_type, inflow_source, outflow_category, amount,
                payment_method, reference_number, description,
                recorded_by, transaction_date
            ) VALUES ('inflow', ?, NULL, ?, ?, ?, ?, ?, ?)
        `;

        const txDate = transaction_date || new Date();
        const params = [
            inflow_source || 'developer_payment',
            amount,
            payment_method,
            reference_number,
            description,
            recorded_by,
            // Ensure YYYY-MM-DD for DATE column
            typeof txDate === 'string' ? txDate : new Date(txDate).toISOString().slice(0, 10)
        ];

        try {
            const [result] = await db.query(SQL, params);
            return { success: true, id: result.insertId };
        } catch (error) {
            console.error('Error inserting cash inflow:', error);
            throw new Error('Failed to insert cash inflow');
        }
    }

    static async createPayMongoPaymentLink({ amount, description, reference_number, customer }) {
        const secretKey = process.env.PAYMONGO_SECRET_KEY;
        if (!secretKey) {
            throw new Error('PAYMONGO_SECRET_KEY not configured');
        }

        // PayMongo amounts are in cents/centavos (integer)
        const amountInCents = Math.round(parseFloat(amount) * 100);

        const payload = {
            data: {
                attributes: {
                    amount: amountInCents,
                    description: description || 'Payment',
                    remarks: reference_number || undefined,
                    currency: 'PHP',
                    // Optional customer details if provided
                    customer: customer && (customer.name || customer.email || customer.phone)
                        ? {
                            name: customer.name,
                            email: customer.email,
                            phone: customer.phone
                        }
                        : undefined
                }
            }
        };

        try {
            const auth = Buffer.from(`${secretKey}:`).toString('base64');
            const resp = await axios.post(
                'https://api.paymongo.com/v1/links',
                payload,
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 15000
                }
            );

            const link = resp?.data?.data;
            return {
                success: true,
                id: link?.id,
                amount: amount,
                description,
                reference_number,
                checkout_url: link?.attributes?.checkout_url || link?.attributes?.short_url
            };
        } catch (error) {
            console.error('Error creating PayMongo payment link:', error?.response?.data || error.message);
            throw new Error('Failed to create PayMongo payment link');
        }
    }
}

module.exports = FinanceModel;