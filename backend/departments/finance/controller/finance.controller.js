const Payroll = require('../model/finance.model');

class PayrollController {
    static async getPendingPayrolls(req, res) {
        try {
            const payrolls = await Payroll.getAllPendingPayrolls();
            
            // The data is already formatted in the model with the correct field names
            res.json({
                success: true,
                data: payrolls
            });
        } catch (error) {
            console.error('Error fetching pending payrolls:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch pending payrolls',
                error: error.message
            });
        }
    }

    static async updatePayrollStatus(req, res) {
        try {
            const { payrollId } = req.params;
            const { status, remarks } = req.body;

            // Validate payrollId
            if (!payrollId || payrollId === 'undefined') {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid payroll ID'
                });
            }

            if (!['approved', 'rejected'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status. Must be either "approved" or "rejected"'
                });
            }

            if (status === 'rejected' && !remarks) {
                return res.status(400).json({
                    success: false,
                    message: 'Remarks are required when rejecting payroll'
                });
            }

            const success = await Payroll.updatePayrollStatus(payrollId, status, remarks);
            
            if (!success) {
                return res.status(404).json({
                    success: false,
                    message: 'Payroll not found'
                });
            }

            res.json({
                success: true,
                message: `Payroll ${status} successfully`
            });
        } catch (error) {
            console.error('Error updating payroll status:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update payroll status',
                error: error.message
            });
        }
    }

    static async getPayrollDetails(req, res) {
        try {
            const { payrollId } = req.params;
            const payroll = await Payroll.getPayrollById(payrollId);

            if (!payroll) {
                return res.status(404).json({
                    success: false,
                    message: 'Payroll not found'
                });
            }

            // The data is already formatted in the model with the correct field names
            res.json({
                success: true,
                data: payroll
            });
        } catch (error) {
            console.error('Error fetching payroll details:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch payroll details',
                error: error.message
            });
        }
    }
}

module.exports = PayrollController;
