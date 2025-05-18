const FinanceModel = require('../model/finance.model');

// Get all payrolls
exports.getAllPayrolls = async (req, res) => {
    try {
        // Get data from model
        const payrolls = await FinanceModel.getAllPayrolls();

        // Format the data for frontend
        const formattedPayrolls = payrolls.map(payroll => ({
            id: payroll.id,
            employee_id: payroll.employee_id,
            name: payroll.full_name,
            position: payroll.position,
            profile_picture: payroll.profile_picture || '', // Use empty string if no profile picture
            start_date: payroll.start_date,
            end_date: payroll.end_date,
            days_present: payroll.days_present,
            days_absent: payroll.days_absent,
            total_hours: parseFloat(payroll.total_hours),
            overtime_hours: parseFloat(payroll.overtime_hours),
            fixed_salary: parseFloat(payroll.fixed_salary),
            salary_before_tax: parseFloat(payroll.salary_before_tax),
            total_deductions: parseFloat(payroll.total_deductions),
            absence_deduction: parseFloat(payroll.absence_deduction),
            net_salary: parseFloat(payroll.net_salary),
            payroll_date: payroll.payroll_date,
            payroll_period: payroll.payroll_period,
            status: payroll.status,
            remarks: payroll.remarks
        }));

        return res.status(200).json({
            success: true,
            data: formattedPayrolls
        });

    } catch (error) {
        console.error("Error fetching payrolls:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching payrolls"
        });
    }
};

// Get all pending payrolls
exports.getPendingPayrolls = async (req, res) => {
    try {
        // Get data from model
        const payrolls = await FinanceModel.getPendingPayrolls();

        // Format the data for frontend
        const formattedPayrolls = payrolls.map(payroll => ({
            id: payroll.id,
            employee_id: payroll.employee_id,
            name: payroll.full_name,
            position: payroll.position,
            profile_picture: payroll.profile_picture || '', // Use empty string if no profile picture
            start_date: payroll.start_date,
            end_date: payroll.end_date,
            days_present: payroll.days_present,
            days_absent: payroll.days_absent,
            total_hours: parseFloat(payroll.total_hours),
            overtime_hours: parseFloat(payroll.overtime_hours),
            fixed_salary: parseFloat(payroll.fixed_salary),
            salary_before_tax: parseFloat(payroll.salary_before_tax),
            total_deductions: parseFloat(payroll.total_deductions),
            absence_deduction: parseFloat(payroll.absence_deduction),
            net_salary: parseFloat(payroll.net_salary),
            payroll_date: payroll.payroll_date,
            payroll_period: payroll.payroll_period,
            status: payroll.status,
            remarks: payroll.remarks
        }));

        return res.status(200).json({
            success: true,
            data: formattedPayrolls
        });

    } catch (error) {
        console.error("Error fetching pending payrolls:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching pending payrolls"
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
