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
}

module.exports = FinanceModel;
