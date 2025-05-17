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
