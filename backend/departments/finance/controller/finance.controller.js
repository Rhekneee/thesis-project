const FinanceModel = require('../model/finance.model');
const crypto = require('crypto');

// Updated Finance Controller to work with Payroll Periods
// Get all payroll periods for Finance dashboard
exports.getAllPayrollPeriods = async (req, res) => {
    try {
        if (!req.session?.user) {
            return res.status(401).json({ error: 'Unauthorized: No session found' });
        }

        const periods = await FinanceModel.getAllPayrollPeriods();
        res.json({
            success: true,
            periods: periods
        });
    } catch (error) {
        console.error('Error in getAllPayrollPeriods:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to fetch payroll periods' 
        });
    }
};

// Get pending payroll periods
exports.getPendingPayrollPeriods = async (req, res) => {
    try {
        if (!req.session?.user) {
            return res.status(401).json({ error: 'Unauthorized: No session found' });
        }

        const periods = await FinanceModel.getPendingPayrollPeriods();
        res.json({
            success: true,
            periods: periods
        });
    } catch (error) {
        console.error('Error in getPendingPayrollPeriods:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to fetch pending payroll periods' 
        });
    }
};

// Get approved payroll periods
exports.getApprovedPayrollPeriods = async (req, res) => {
    try {
        if (!req.session?.user) {
            return res.status(401).json({ error: 'Unauthorized: No session found' });
        }

        const periods = await FinanceModel.getApprovedPayrollPeriods();
        res.json({
            success: true,
            periods: periods
        });
    } catch (error) {
        console.error('Error in getApprovedPayrollPeriods:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to fetch approved payroll periods' 
        });
    }
};

// Get payroll period by ID
exports.getPayrollPeriodById = async (req, res) => {
    try {
        if (!req.session?.user) {
            return res.status(401).json({ error: 'Unauthorized: No session found' });
        }

        const { periodId } = req.params;
        const period = await FinanceModel.getPayrollPeriodById(periodId);
        
        if (!period) {
            return res.status(404).json({ 
                success: false, 
                error: 'Payroll period not found' 
            });
        }

        res.json({
            success: true,
            period: period
        });
    } catch (error) {
        console.error('Error in getPayrollPeriodById:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to fetch payroll period' 
        });
    }
};

// Get payroll entries for a specific period
exports.getPayrollEntriesByPeriod = async (req, res) => {
    try {
        if (!req.session?.user) {
            return res.status(401).json({ error: 'Unauthorized: No session found' });
        }

        const { periodId } = req.params;
        const entries = await FinanceModel.getPayrollEntriesByPeriod(periodId);
        
        res.json({
            success: true,
            entries: entries
        });
    } catch (error) {
        console.error('Error in getPayrollEntriesByPeriod:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to fetch payroll entries' 
        });
    }
};

// Get payroll period summary
exports.getPayrollPeriodSummary = async (req, res) => {
    try {
        if (!req.session?.user) {
            return res.status(401).json({ error: 'Unauthorized: No session found' });
        }

        const { periodId } = req.params;
        const summary = await FinanceModel.getPayrollPeriodSummary(periodId);
        
        if (!summary) {
            return res.status(404).json({ 
                success: false, 
                error: 'Payroll period not found' 
            });
        }

        res.json({
            success: true,
            summary: summary
        });
    } catch (error) {
        console.error('Error in getPayrollPeriodSummary:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to fetch payroll period summary' 
        });
    }
};

// Update payroll period status
exports.updatePayrollPeriodStatus = async (req, res) => {
    try {
        if (!req.session?.user) {
            return res.status(401).json({ error: 'Unauthorized: No session found' });
        }

        const { periodId } = req.params;
        const { status } = req.body;

        if (!['pending', 'approved', 'rejected', 'processed'].includes(status)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid status. Must be pending, approved, rejected, or processed.' 
            });
        }

        const success = await FinanceModel.updatePayrollPeriodStatus(periodId, status);
        
        if (!success) {
            return res.status(404).json({ 
                success: false, 
                error: 'Payroll period not found' 
            });
        }

        res.json({
            success: true,
            message: `Payroll period status updated to ${status}`
        });
    } catch (error) {
        console.error('Error in updatePayrollPeriodStatus:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to update payroll period status' 
        });
    }
};

// Create payslips from payroll period
exports.createPayslipsFromPeriod = async (req, res) => {
    try {
        if (!req.session?.user) {
            return res.status(401).json({ error: 'Unauthorized: No session found' });
        }

        const { periodId } = req.params;
        const approvedBy = req.session.user.id;

        const result = await FinanceModel.createPayslipsFromPeriod(periodId, approvedBy);
        
        res.json({
            success: true,
            message: result.message,
            payslipIds: result.payslipIds
        });
    } catch (error) {
        console.error('Error in createPayslipsFromPeriod:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to create payslips from period' 
        });
    }
};

// =============================================
// PURCHASE REQUESTS - Connected to Supply Department
// These endpoints handle purchase request operations from the supply department
// =============================================

// Get all purchase requests
exports.getAllPurchaseRequests = async (req, res) => {
    try {
        console.log('Fetching purchase requests...');
        // Get data from model
        const requests = await FinanceModel.getAllPurchaseRequests();
    

        // Format the data for frontend
        const formattedRequests = requests.map(request => ({
            request_id: request.request_id,
            material_type: request.material_type,
            quantity: parseFloat(request.quantity),
            unit: request.unit,
            justification: request.justification,
            status: request.status || 'Pending',
            requested_by: request.requester_name || request.requested_by,
            department: request.department_name || request.department,
            request_date: request.request_date,
            approved_date: request.approved_date,
            remarks: request.remarks
        }));

    

        return res.status(200).json({
            success: true,
            requests: formattedRequests
        });

    } catch (error) {
        console.error('Error in getAllPurchaseRequests controller:', {
            message: error.message,
            stack: error.stack
        });
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error while fetching purchase requests"
        });
    }
};

// Update purchase request status (approve/reject)
exports.updatePurchaseRequestStatus = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { status, remarks } = req.body;

        // Validate status
        const validStatuses = ['Approved', 'Rejected', 'In Transit', 'Delivered'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status provided"
            });
        }

        // Validate remarks for rejection
        if (status === 'Rejected' && (!remarks || remarks.trim() === '')) {
            return res.status(400).json({
                success: false,
                message: "Remarks are required when rejecting a request"
            });
        }

        // Update the request status
        const success = await FinanceModel.updatePurchaseRequestStatus(
            requestId,
            status,
            remarks
        );

        if (!success) {
            return res.status(404).json({
                success: false,
                message: "Purchase request not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: `Purchase request ${status.toLowerCase()} successfully`
        });

    } catch (error) {
        console.error("Error updating purchase request status:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while updating purchase request status"
        });
    }
};

// Approve purchase request (finance approval)
exports.approvePurchaseRequest = async (req, res) => {
    try {
        const { requestId } = req.params;

        if (!requestId) {
            return res.status(400).json({
                success: false,
                message: "Request ID is required"
            });
        }

        // Call model to approve the request
        const result = await FinanceModel.approvePurchaseRequest(requestId);

        return res.status(200).json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error("Error in approvePurchaseRequest controller:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error while approving purchase request"
        });
    }
};

// Get approved purchase requests (for finance view)
exports.getApprovedPurchaseRequests = async (req, res) => {
    try {
        const requests = await FinanceModel.getApprovedPurchaseRequests();

        return res.status(200).json({
            success: true,
            requests: requests
        });

    } catch (error) {
        console.error("Error in getApprovedPurchaseRequests controller:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error while fetching approved purchase requests"
        });
    }
};

// Get purchase orders with supplier estimations
exports.getPurchaseOrdersWithEstimations = async (req, res) => {
    try {
        // Check if user is authorized (Finance)
        if (!req.session?.user?.role_id === 25) { // Assuming 25 is finance role
            return res.status(403).json({ 
                success: false, 
                message: 'Unauthorized: Finance access required' 
            });
        }

        const orders = await FinanceModel.getPurchaseOrdersWithEstimations();

        // Format the data for frontend
        const formattedOrders = orders.map(order => ({
            po_id: order.po_id,
            material_type: order.material_type,
            quantity: parseFloat(order.quantity),
            unit: order.unit,
            estimation_cost: parseFloat(order.estimation_cost),
            status: order.status,
            supplier_name: order.supplier_name,
            supplier_id: order.supplier_id,
            request_id: order.request_id,
            justification: order.justification,
            requested_by: order.requested_by,
            department: order.department_name,
            created_date: order.created_date,
            updated_date: order.updated_date
        }));

        return res.status(200).json({
            success: true,
            orders: formattedOrders
        });

    } catch (error) {
        console.error('Error in getPurchaseOrdersWithEstimations controller:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal server error while fetching purchase orders'
        });
    }
};

// Update purchase order estimation status (approve/reject)
exports.updatePurchaseOrderEstimation = async (req, res) => {
    const { poId } = req.params;
    const { status, remarks, payment_type } = req.body;

    try {
        // Validate status
        if (!['Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be either "Approved" or "Rejected"'
            });
        }

        // Validate remarks for rejection
        if (status === 'Rejected' && (!remarks || remarks.trim() === '')) {
            return res.status(400).json({
                success: false,
                message: 'Remarks are required when rejecting an estimation'
            });
        }

        // Update the purchase order status (without payment processing)
        const result = await FinanceModel.updatePurchaseOrderEstimation(
            poId,
            status,
            remarks,
            payment_type // Store payment type for later use
        );

        if (result.success) {
            res.json({
                success: true,
                message: `Purchase order ${status.toLowerCase()} successfully. ${status === 'Approved' ? 'Waiting for delivery and receipt.' : ''}`,
                data: result.data
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message
            });
        }
    } catch (error) {
        console.error('Error updating purchase order estimation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update purchase order estimation',
            error: error.message
        });
    }
};

// Process payment for delivered order
exports.processPurchaseOrderPayment = async (req, res) => {
    const { poId } = req.params;
    const { payment_type, reference_number } = req.body;

    try {
        // Check if user is authorized (Finance)
        if (!req.session?.user?.role_id === 25) {
            return res.status(403).json({ 
                success: false, 
                message: 'Unauthorized: Finance access required' 
            });
        }

        // Get order details first to verify status
        const order = await FinanceModel.getPurchaseOrderById(poId);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Purchase order not found'
            });
        }

        if (order.status !== 'Delivered with Receipt') {
            return res.status(400).json({
                success: false,
                message: 'Payment can only be processed for delivered orders with receipt'
            });
        }

        // Validate payment type
        if (!payment_type || !['Online Payment', 'COD'].includes(payment_type)) {
            return res.status(400).json({
                success: false,
                message: 'Valid payment type (Online Payment or COD) is required'
            });
        }

        // Validate reference number for online payments
        if (payment_type === 'Online Payment' && (!reference_number || reference_number.trim() === '')) {
            return res.status(400).json({
                success: false,
                message: 'Reference number is required for online payments'
            });
        }

        // Process the payment
        const result = await FinanceModel.processPurchaseOrderPayment(
            poId,
            payment_type,
            reference_number
        );

        if (result.success) {
            res.json({
                success: true,
                message: 'Payment processed successfully',
                data: result.data
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message
            });
        }
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process payment',
            error: error.message
        });
    }
};

// Get purchase orders pending payment
exports.getPurchaseOrdersPendingPayment = async (req, res) => {
    try {
        // Check if user is authorized (Finance)
        if (!req.session?.user?.role_id === 25) {
            return res.status(403).json({ 
                success: false, 
                message: 'Unauthorized: Finance access required' 
            });
        }

        const orders = await FinanceModel.getPurchaseOrdersPendingPayment();

        // Format the data for frontend
        const formattedOrders = orders.map(order => ({
            po_id: order.po_id,
            material_type: order.material_type,
            quantity: parseFloat(order.quantity),
            unit: order.unit,
            estimation_cost: parseFloat(order.estimation_cost),
            status: order.status,
            supplier_name: order.supplier_name,
            supplier_id: order.supplier_id,
            payment_type: order.payment_type,
            created_date: order.created_date,
            updated_date: order.updated_date
        }));

        return res.status(200).json({
            success: true,
            orders: formattedOrders
        });

    } catch (error) {
        console.error('Error in getPurchaseOrdersPendingPayment controller:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal server error while fetching pending payments'
        });
    }
};

// Update purchase order payment status
exports.updatePurchaseOrderPayment = async (req, res) => {
    const { poId } = req.params;
    const { status, reference_number } = req.body;

    try {
        // Check if user is authorized (Finance)
        if (!req.session?.user?.role_id === 25) {
            return res.status(403).json({ 
                success: false, 
                message: 'Unauthorized: Finance access required' 
            });
        }

        // Validate status
        if (!['Paid', 'Payment Failed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be either "Paid" or "Payment Failed"'
            });
        }

        // Validate reference number for successful payments
        if (status === 'Paid' && (!reference_number || reference_number.trim() === '')) {
            return res.status(400).json({
                success: false,
                message: 'Reference number is required when marking payment as successful'
            });
        }

        // Update the purchase order payment status
        const result = await FinanceModel.updatePurchaseOrderPayment(
            poId,
            status,
            reference_number
        );

        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                data: result.data
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message
            });
        }
    } catch (error) {
        console.error('Error updating purchase order payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update purchase order payment',
            error: error.message
        });
    }
};

// =============================================
// PAYSLIP MANAGEMENT
// These endpoints handle payslip operations
// =============================================

// Create payslip from approved payroll
exports.createPayslipFromPayroll = async (req, res) => {
    try {
        const { payrollId } = req.params;
        const approvedBy = req.session?.user?.id;

        if (!approvedBy) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated"
            });
        }

        if (!payrollId) {
            return res.status(400).json({
                success: false,
                message: "Payroll ID is required"
            });
        }

        // Create payslip from payroll
        const result = await FinanceModel.createPayslipFromPayroll(payrollId, approvedBy);

        return res.status(200).json({
            success: true,
            message: result.message,
            data: {
                payslip_id: result.payslip_id,
                payroll_id: result.payroll_id
            }
        });

    } catch (error) {
        console.error("Error creating payslip:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error while creating payslip"
        });
    }
};

// Get all payslips
exports.getAllPayslips = async (req, res) => {
    try {
        const payslips = await FinanceModel.getAllPayslips();

        // Format the data for frontend
        const formattedPayslips = payslips.map(payslip => ({
            id: payslip.id,
            payslip_number: payslip.payslip_number,
            payslip_date: payslip.payslip_date,
            payslip_period: payslip.payslip_period,
            employee_id: payslip.employee_id,
            name: payslip.full_name,
            position: payslip.position,
            profile_picture: payslip.profile_picture || '',
            basic_salary: parseFloat(payslip.basic_salary),
            salary_before_tax: parseFloat(payslip.salary_before_tax),
            total_deductions: parseFloat(payslip.total_deductions),
            absence_deduction: parseFloat(payslip.absence_deduction),
            net_salary: parseFloat(payslip.net_salary),
            start_date: payslip.start_date,
            end_date: payslip.end_date,
            days_present: payslip.days_present,
            days_absent: payslip.days_absent,
            total_hours: parseFloat(payslip.total_hours),
            overtime_hours: parseFloat(payslip.overtime_hours),
            payment_method: payslip.payment_method,
            status: payslip.status,
            approved_date: payslip.approved_date,
            approved_by_name: payslip.approved_by_name
        }));

        return res.status(200).json({
            success: true,
            data: formattedPayslips
        });

    } catch (error) {
        console.error("Error fetching payslips:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching payslips"
        });
    }
};

// Get payslip by ID with details
exports.getPayslipById = async (req, res) => {
    try {
        const { payslipId } = req.params;

        if (!payslipId) {
            return res.status(400).json({
                success: false,
                message: "Payslip ID is required"
            });
        }

        // Get payslip details
        const payslip = await FinanceModel.getPayslipById(payslipId);
        
        if (!payslip) {
            return res.status(404).json({
                success: false,
                message: "Payslip not found"
            });
        }

        // Format the data (no deductions/allowances tables exist)
        const formattedPayslip = {
            id: payslip.id,
            payslip_number: payslip.payslip_number,
            payslip_date: payslip.payslip_date,
            payslip_period: payslip.payslip_period,
            employee_id: payslip.employee_id,
            name: payslip.full_name,
            position: payslip.position,
            profile_picture: payslip.profile_picture || '',
            basic_salary: parseFloat(payslip.basic_salary),
            salary_before_tax: parseFloat(payslip.salary_before_tax),
            total_deductions: parseFloat(payslip.total_deductions),
            absence_deduction: parseFloat(payslip.absence_deduction),
            net_salary: parseFloat(payslip.net_salary),
            start_date: payslip.start_date,
            end_date: payslip.end_date,
            days_present: payslip.days_present,
            days_absent: payslip.days_absent,
            total_hours: parseFloat(payslip.total_hours),
            overtime_hours: parseFloat(payslip.overtime_hours),
            payment_method: payslip.payment_method,
            status: payslip.status,
            approved_date: payslip.approved_date,
            approved_by_name: payslip.approved_by_name,
            deductions: [], // No deductions table
            allowances: []  // No allowances table
        };

        return res.status(200).json({
            success: true,
            data: formattedPayslip
        });

    } catch (error) {
        console.error("Error fetching payslip details:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching payslip details"
        });
    }
};

// Update payslip status
exports.updatePayslipStatus = async (req, res) => {
    try {
        const { payslipId } = req.params;
        const { status } = req.body;

        if (!payslipId) {
            return res.status(400).json({
                success: false,
                message: "Payslip ID is required"
            });
        }

        if (!status) {
            return res.status(400).json({
                success: false,
                message: "Status is required"
            });
        }

        // Validate status
        const validStatuses = ['Generated', 'Sent', 'Viewed', 'Downloaded', 'Archived'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status provided"
            });
        }

        // Update payslip status
        const success = await FinanceModel.updatePayslipStatus(payslipId, status);

        if (!success) {
            return res.status(404).json({
                success: false,
                message: "Payslip not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: `Payslip status updated to ${status} successfully`
        });

    } catch (error) {
        console.error("Error updating payslip status:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while updating payslip status"
        });
    }
};

// =============================================
// CASH MONITORING (PAYMONGO INTEGRATION)
// =============================================

// Create a PayMongo payment link for a billing
exports.createPaymentLink = async (req, res) => {
    try {
        const { amount, description, reference_number, customer } = req.body;

        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'Valid amount is required' });
        }

        const result = await FinanceModel.createPayMongoPaymentLink({
            amount,
            description,
            reference_number,
            customer
        });

        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Failed to create payment link' });
    }
};

// PayMongo webhook to record successful payments into cash_monitoring
// IMPORTANT: This must be mounted on a raw-body route to verify signature
exports.paymongoWebhook = async (req, res) => {
    try {
        const signature = req.headers['paymongo-signature'];
        const secret = process.env.PAYMONGO_WEBHOOK_SECRET;

        // If secret is set, attempt verification (tolerate absence in dev)
        if (secret && signature) {
            const rawBody = req.rawBody;
            const computed = crypto
                .createHmac('sha256', secret)
                .update(rawBody)
                .digest('hex');

            if (computed !== signature) {
                return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
            }
        }

        const event = req.body;
        const type = event?.data?.attributes?.type || event?.type;

        // We care about payment.paid or link.paid events
        if (type && (type.includes('payment.paid') || type.includes('link.paid'))) {
            const attrs = event?.data?.attributes || {};
            const dataObj = event?.data || {};
            const linkAttrs = attrs?.data?.attributes || attrs; // handle nested structures

            const amountCents = linkAttrs?.amount || attrs?.amount;
            const amount = amountCents ? (Number(amountCents) / 100) : undefined;
            const reference = linkAttrs?.remarks || linkAttrs?.reference_number || dataObj?.id;
            const description = linkAttrs?.description || 'PayMongo payment';

            if (amount) {
                await FinanceModel.insertCashMonitoringInflow({
                    inflow_source: 'developer_payment',
                    amount,
                    payment_method: 'paymongo',
                    reference_number: reference,
                    description,
                    recorded_by: 'system:paymongo',
                    transaction_date: new Date()
                });
            }
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Webhook processing error:', error);
        return res.status(500).json({ success: false, message: 'Webhook processing failed' });
    }
};

// Manual insert inflow (fallback/admin tool)
exports.insertCashInflow = async (req, res) => {
    try {
        const { amount, inflow_source, payment_method, reference_number, description, transaction_date } = req.body;
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'Valid amount is required' });
        }

        const result = await FinanceModel.insertCashMonitoringInflow({
            inflow_source: inflow_source || 'developer_payment',
            amount: parseFloat(amount),
            payment_method: payment_method || 'bank_transfer',
            reference_number: reference_number || null,
            description: description || null,
            recorded_by: req.session?.user?.username || 'finance_user',
            transaction_date: transaction_date || new Date()
        });

        return res.status(201).json({ success: true, id: result.id });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Failed to insert inflow' });
    }
};
// BANK ACCOUNT MANAGEMENT
// These endpoints handle bank account operations
// =============================================

// Create new bank account
exports.createBankAccount = async (req, res) => {
    try {
        const {
            account_name,
            bank_name,
            account_number,
            opening_balance,
            currency,
            status
        } = req.body;

        // Validate required fields
        if (!account_name || !bank_name || !account_number) {
            return res.status(400).json({
                success: false,
                message: "Account name, bank name, and account number are required"
            });
        }

        // Validate account number format (basic validation)
        if (account_number.length < 5) {
            return res.status(400).json({
                success: false,
                message: "Account number must be at least 5 characters long"
            });
        }

        // Validate currency
        const validCurrencies = ['PHP', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'SGD', 'HKD'];
        if (currency && !validCurrencies.includes(currency)) {
            return res.status(400).json({
                success: false,
                message: "Invalid currency provided"
            });
        }

        // Validate status
        const validStatuses = ['active', 'inactive'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status provided"
            });
        }

        // Validate opening balance
        if (opening_balance && (isNaN(opening_balance) || parseFloat(opening_balance) < 0)) {
            return res.status(400).json({
                success: false,
                message: "Opening balance must be a valid positive number"
            });
        }

        // Check if account number already exists
        const accountExists = await FinanceModel.checkAccountNumberExists(account_number);
        if (accountExists) {
            return res.status(400).json({
                success: false,
                message: "Account number already exists. Please use a different account number."
            });
        }

        // Prepare bank account data
        const bankAccountData = {
            account_name: account_name.trim(),
            bank_name: bank_name.trim(),
            account_number: account_number.trim(),
            opening_balance: parseFloat(opening_balance) || 0,
            currency: currency || 'PHP',
            status: status || 'active'
        };

        // Create bank account
        const result = await FinanceModel.insertBankAccount(bankAccountData);

        return res.status(201).json({
            success: true,
            message: result.message,
            data: {
                account_id: result.account_id,
                ...bankAccountData
            }
        });

    } catch (error) {
        console.error("Error creating bank account:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error while creating bank account"
        });
    }
};

// Get all bank accounts
exports.getAllBankAccounts = async (req, res) => {
    try {
        const accounts = await FinanceModel.getAllBankAccounts();

        // Format the data for frontend
        const formattedAccounts = accounts.map(account => ({
            account_id: account.account_id,
            account_name: account.account_name,
            bank_name: account.bank_name,
            account_number: account.account_number,
            opening_balance: parseFloat(account.opening_balance),
            currency: account.currency,
            status: account.status,
            created_at: account.created_at
        }));

        return res.status(200).json({
            success: true,
            data: formattedAccounts
        });

    } catch (error) {
        console.error("Error fetching bank accounts:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error while fetching bank accounts"
        });
    }
};

// Get bank account by ID
exports.getBankAccountById = async (req, res) => {
    try {
        const { accountId } = req.params;

        if (!accountId) {
            return res.status(400).json({
                success: false,
                message: "Account ID is required"
            });
        }

        const account = await FinanceModel.getBankAccountById(accountId);
        
        if (!account) {
            return res.status(404).json({
                success: false,
                message: "Bank account not found"
            });
        }

        // Format the data for frontend
        const formattedAccount = {
            account_id: account.account_id,
            account_name: account.account_name,
            bank_name: account.bank_name,
            account_number: account.account_number,
            opening_balance: parseFloat(account.opening_balance),
            currency: account.currency,
            status: account.status,
            created_at: account.created_at
        };

        return res.status(200).json({
            success: true,
            data: formattedAccount
        });

    } catch (error) {
        console.error("Error fetching bank account:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error while fetching bank account"
        });
    }
};

// Update bank account
exports.updateBankAccount = async (req, res) => {
    try {
        const { accountId } = req.params;
        const {
            account_name,
            bank_name,
            account_number,
            opening_balance,
            currency,
            status
        } = req.body;

        if (!accountId) {
            return res.status(400).json({
                success: false,
                message: "Account ID is required"
            });
        }

        // Validate required fields
        if (!account_name || !bank_name || !account_number) {
            return res.status(400).json({
                success: false,
                message: "Account name, bank name, and account number are required"
            });
        }

        // Validate account number format
        if (account_number.length < 5) {
            return res.status(400).json({
                success: false,
                message: "Account number must be at least 5 characters long"
            });
        }

        // Validate currency
        const validCurrencies = ['PHP', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'SGD', 'HKD'];
        if (currency && !validCurrencies.includes(currency)) {
            return res.status(400).json({
                success: false,
                message: "Invalid currency provided"
            });
        }

        // Validate status
        const validStatuses = ['active', 'inactive'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status provided"
            });
        }

        // Validate opening balance
        if (opening_balance && (isNaN(opening_balance) || parseFloat(opening_balance) < 0)) {
            return res.status(400).json({
                success: false,
                message: "Opening balance must be a valid positive number"
            });
        }

        // Check if account number already exists (excluding current account)
        const accountExists = await FinanceModel.checkAccountNumberExists(account_number, accountId);
        if (accountExists) {
            return res.status(400).json({
                success: false,
                message: "Account number already exists. Please use a different account number."
            });
        }

        // Prepare bank account data
        const bankAccountData = {
            account_name: account_name.trim(),
            bank_name: bank_name.trim(),
            account_number: account_number.trim(),
            opening_balance: parseFloat(opening_balance) || 0,
            currency: currency || 'PHP',
            status: status || 'active'
        };

        // Update bank account
        const result = await FinanceModel.updateBankAccount(accountId, bankAccountData);

        return res.status(200).json({
            success: true,
            message: result.message,
            data: {
                account_id: parseInt(accountId),
                ...bankAccountData
            }
        });

    } catch (error) {
        console.error("Error updating bank account:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error while updating bank account"
        });
    }
};

// Delete bank account
exports.deleteBankAccount = async (req, res) => {
    try {
        const { accountId } = req.params;

        if (!accountId) {
            return res.status(400).json({
                success: false,
                message: "Account ID is required"
            });
        }

        // Delete bank account
        const result = await FinanceModel.deleteBankAccount(accountId);

        return res.status(200).json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error("Error deleting bank account:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error while deleting bank account"
        });
    }
};
