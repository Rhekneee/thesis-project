const db = require("../../../db");

class Payroll {
    static async getAllPendingPayrolls() {
        try {
            const query = `
                SELECT 
                    p.id,
                    p.employee_id,
                    p.start_date as startDate,
                    p.end_date as endDate,
                    p.days_present as daysPresent,
                    p.days_absent as daysAbsent,
                    p.total_hours as totalHours,
                    p.overtime_hours as overtimeHours,
                    p.fixed_salary as fixedSalary,
                    p.salary_before_tax as salaryBeforeTax,
                    p.total_deductions as totalDeductions,
                    p.absence_deduction as absenceDeduction,
                    p.net_salary as netPay,
                    p.payroll_date as payrollDate,
                    p.payroll_period as payrollPeriod,
                    p.status,
                    p.remarks,
                    e.full_name as name,
                    r.name as position,
                    e.profile_picture as profilePic
                FROM payroll p
                JOIN employees e ON p.employee_id = e.employee_id
                JOIN roles r ON e.role_id = r.id
                WHERE p.status = 'pending'
                ORDER BY p.payroll_date DESC
            `;
            const [rows] = await db.query(query);
            return rows;
        } catch (error) {
            throw error;
        }
    }

    static async updatePayrollStatus(payrollId, status, remarks = null) {
        try {
            const query = `
                UPDATE payroll 
                SET status = ?, 
                    remarks = ?,
                    payroll_date = CURRENT_DATE
                WHERE id = ?
            `;
            const [result] = await db.query(query, [status, remarks, payrollId]);
            return result.affectedRows > 0;
        } catch (error) {
            throw error;
        }
    }

    static async getPayrollById(payrollId) {
        try {
            const query = `
                SELECT 
                    p.id,
                    p.employee_id,
                    p.start_date as startDate,
                    p.end_date as endDate,
                    p.days_present as daysPresent,
                    p.days_absent as daysAbsent,
                    p.total_hours as totalHours,
                    p.overtime_hours as overtimeHours,
                    p.fixed_salary as fixedSalary,
                    p.salary_before_tax as salaryBeforeTax,
                    p.total_deductions as totalDeductions,
                    p.absence_deduction as absenceDeduction,
                    p.net_salary as netPay,
                    p.payroll_date as payrollDate,
                    p.payroll_period as payrollPeriod,
                    p.status,
                    p.remarks,
                    e.full_name as name,
                    r.name as position,
                    e.profile_picture as profilePic
                FROM payroll p
                JOIN employees e ON p.employee_id = e.employee_id
                JOIN roles r ON e.role_id = r.id
                WHERE p.id = ?
            `;
            const [rows] = await db.query(query, [payrollId]);
            return rows[0];
        } catch (error) {
            throw error;
        }
    }
}

module.exports = Payroll;
