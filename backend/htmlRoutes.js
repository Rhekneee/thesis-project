// htmlRoutes.js
const path = require('path');

const htmlRoutes = (app) => {
// ====================
  // HR Manager Routes
  // ====================
  app.get('/customer', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'customer.html'));
  });
  
  app.get('/hr_manager/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'hr_manager', 'hr_dashboard.html'));
  });

  app.get('/hr_manager/employee_management', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'hr_manager', 'employee_management.html'));
});

app.get('/hr_manager/employee_attendance', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'hr_manager', 'employee_attendance.html'));
});

// Leave Requests Route
app.get('/hr_manager/leave_request', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'hr_manager', 'leave_request.html'));
});

// Payroll Management Route
app.get('/hr_manager/payroll', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'hr_manager', 'payroll_management.html'));
});

// Reports Route
app.get('/hr_manager/reports', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'hr_manager', 'report.html'));
});

// Attendance Route
app.get('/hr_manager/attendance', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'hr_manager', 'attendance.html'));
});

// Recruitment Route
app.get('/hr_manager/recruitment', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'hr_manager', 'recruitment.html'));
});

// Route for the Employee Attendance page
app.get('/hr_employee/attendance', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'hr_employee', 'Individual_attendance.html'));
});

app.get('/hr_manager/employee_list', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'hr_manager', 'employee_list.html'));
});


// ====================
  // CRM Website Routes
  // ====================
  app.get('/crm/index', (req, res) => {
    res.sendFile(path.join(__dirname,  '..', 'views', 'crm website', 'index.html')); // Adjusted path
  });

  app.get('/crm/application', (req, res) => {
    res.sendFile(path.join(__dirname,  '..', 'views', 'crm website', 'application.html')); // Adjusted path
  });

  app.get('/crm/contact', (req, res) => {
    res.sendFile(path.join(__dirname,  '..', 'views', 'crm website', 'contact.html')); // Adjusted path
  });

  app.get('/crm/developer', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'crm website', 'developers.html')); // Adjusted path
  });

  app.get('/crm/faqs', (req, res) => {
    res.sendFile(path.join(__dirname,  '..', 'views', 'crm website', 'faqs.html')); // Adjusted path
  });

  app.get('/crm/properties', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'crm website', 'properties.html')); // Adjusted path
  });
  app.get('/crm/vtour', (req, res) => {    
    res.sendFile(path.join(__dirname, '..', 'views', 'crm website', 'vtour.html')); // Adjusted path
  });

// ====================
  // CRM admin Routes
  // ====================

  app.get('/crm/add_properties', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'crm admin', 'add_properties.html')); // Adjusted path
  });

  app.get('/crm/agents', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'crm admin', 'agents.html')); // Adjusted path
  });

  app.get('/crm/clients', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'crm admin', 'clients.html')); // Adjusted path
  });

  app.get('/crm/crm_admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'crm admin', 'crm_admin.html')); // Adjusted path
  });

  app.get('/crm/edit_properties', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'crm admin', 'edit_properties.html')); // Adjusted path
  });
  
  app.get('/crm/inquiries', (req, res) => {    
    res.sendFile(path.join(__dirname, '..', 'views', 'crm admin', 'inquiries.html')); // Adjusted path
  });

  app.get('/crm/property_list', (req, res) => {    
    res.sendFile(path.join(__dirname, '..', 'views', 'crm admin', 'property_list.html')); // Adjusted path
  });

  app.get('/crm/transactions', (req, res) => {    
    res.sendFile(path.join(__dirname, '..', 'views', 'crm admin', 'transactions.html')); // Adjusted path
  });

  app.get('/crm/crm_work_adjustment', (req, res) => {    
    res.sendFile(path.join(__dirname, '..', 'views', 'crm admin', 'crm_halfday_request.html')); // Adjusted path
  }); 

  app.get('/crm/crm_daily_attendance', (req, res) => {    
    res.sendFile(path.join(__dirname, '..', 'views', 'crm admin', 'crm_daily_attendance.html')); // Adjusted path
  });

  app.get('/crm/crm_leave_request', (req, res) => {    
    res.sendFile(path.join(__dirname, '..', 'views', 'crm admin', 'crm_leave_request.html')); // Adjusted path
  });

  app.get('/crm/job_posting', (req, res) => {    
    res.sendFile(path.join(__dirname, '..', 'views', 'crm admin', 'job_posting.html')); // Adjusted path
  });
  

  // ====================
  // SCM admin Routes
  // ====================

  app.get('/scm/contract', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'scm admin', 'contract.html')); // Adjusted path
  });

  app.get('/scm/inventory', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'scm admin', 'inventory.html')); // Adjusted path
  });

  app.get('/scm/order', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'scm admin', 'order.html')); // Adjusted path
  });

  app.get('/scm/scm_dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'scm admin', 'scm_dashboard.html')); // Adjusted path
  });

  app.get('/scm/outside', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'scm admin', 'outside.html')); // Adjusted path
  });

  app.get('/scm/requestmaterial', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'scm admin', 'requestmaterial.html')); // Adjusted path
  });
  
  app.get('/scm/supplier', (req, res) => {    
    res.sendFile(path.join(__dirname, '..', 'views', 'scm admin', 'supplier.html')); // Adjusted path
  });

  app.get('/scm/transfer', (req, res) => {    
    res.sendFile(path.join(__dirname, '..', 'views', 'scm admin', 'transfer.html')); // Adjusted path
  });

  // ====================
  // CRM Website Routes
  // ====================
  app.get('/crm/index', (req, res) => {
    res.sendFile(path.join(__dirname,  '..', 'views', 'crm website', 'index.html')); // Adjusted path
  });

  app.get('/crm/application', (req, res) => {
    res.sendFile(path.join(__dirname,  '..', 'views', 'crm website', 'application.html')); // Adjusted path
  });

  app.get('/crm/contact', (req, res) => {
    res.sendFile(path.join(__dirname,  '..', 'views', 'crm website', 'contact.html')); // Adjusted path
  });

  app.get('/crm/developer', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'crm website', 'developers.html')); // Adjusted path
  });

  app.get('/crm/faqs', (req, res) => {
    res.sendFile(path.join(__dirname,  '..', 'views', 'crm website', 'faqs.html')); // Adjusted path
  });

  app.get('/crm/properties', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'crm website', 'properties.html')); // Adjusted path
  });
  app.get('/crm/vtour', (req, res) => {    
    res.sendFile(path.join(__dirname, '..', 'views', 'crm website', 'vtour.html')); // Adjusted path
  });

// ====================
  // HR admin Routes
  // ====================  

  app.get('/hr/hr_admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'hr admin', 'hr_admin.html')); // Adjusted path
  });

  app.get('/hr/hr_applicants', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'hr admin', 'hr_applicants.html')); // Adjusted path
  });

  app.get('/hr/hr_daily_attendance', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'hr admin', 'hr_daily_attendance.html')); // Adjusted path
  });

  app.get('/hr/hr_employee_attendance', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'hr admin', 'hr_employee_attendance.html')); // Adjusted path
  });

  app.get('/hr/hr_employee_halfday_request', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'hr admin', 'hr_employee_halfday_request.html')); // Adjusted path
  });

  app.get('/hr/hr_employee_leave_request', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'hr admin', 'hr_employee_leave_request.html')); // Adjusted path
  });

  app.get('/hr/hr_employee_list', (req, res) => {    
    res.sendFile(path.join(__dirname, '..', 'views', 'hr admin', 'hr_employee_list.html')); // Adjusted path
  });

  
  app.get('/hr/hr_interview', (req, res) => {    
    res.sendFile(path.join(__dirname, '..', 'views', 'hr admin', 'hr_interview.html')); // Adjusted path
  });

  app.get('/hr/hr_leave_request', (req, res) => {    
    res.sendFile(path.join(__dirname, '..', 'views', 'hr admin', 'hr_leave_request.html')); // Adjusted path
  });

  app.get('/hr/hr_history_attendance', (req, res) => {  
    res.sendFile(path.join(__dirname, '..', 'views', 'hr admin', 'hr_history_attendance.html')); // Adjusted path
  });
  app.get('/hr/hr_payroll', (req, res) => {  
    res.sendFile(path.join(__dirname, '..', 'views', 'hr admin', 'hr_payroll.html')); // Adjusted path
  });
  app.get('/hr/hr_salary_deduction', (req, res) => {  
    res.sendFile(path.join(__dirname, '..', 'views', 'hr admin', 'hr_salary_deduction.html')); // Adjusted path
  });

  app.get('/hr/hr_profile', (req, res) => {  
    res.sendFile(path.join(__dirname, '..', 'views', 'hr admin', 'hr_profile.html')); // Adjusted path
  });

  app.get('/hr/security_questions', (req, res) => {  
    res.sendFile(path.join(__dirname, '..', 'views', 'hr admin', 'security_questions.html')); // Adjusted path
  });

  app.get('/hr/change-password', (req, res) => {  
    res.sendFile(path.join(__dirname, '..', 'views', 'hr admin', 'change_password.html')); // Adjusted path
  });

  app.get('/hr/hr_work_adjustment', (req, res) => {  
    res.sendFile(path.join(__dirname, '..', 'views', 'hr admin', 'hr_work_adjustment.html')); // Adjusted path
  });

  app.get('/hr/hr_work_adjustment_request', (req, res) => {  
    res.sendFile(path.join(__dirname, '..', 'views', 'hr admin', 'hr_work_adjustment_request.html')); // Adjusted path
  });

// ====================
  // finance admin Routes
  // ====================  

  app.get('/fin/manager_finance', (req, res) => {  
    res.sendFile(path.join(__dirname, '..', 'views', 'finance admin', 'manager_finance.html')); // Adjusted path
  });




// ====================
  //   admin Routes
  // ====================  


  app.get('/hr/hr_salary_deduction', (req, res) => {  
    res.sendFile(path.join(__dirname, '..', 'views', 'hr admin', 'hr_salary_deduction.html')); // Adjusted path
  });



// ====================
  //   agents Routes
  // ====================  


  app.get('/agents/agent_dashboard', (req, res) => {  
    res.sendFile(path.join(__dirname, '..', 'views', 'agents', 'agent_dashboard.html')); // Adjusted path
  });

 app.get('/agents/agent_client', (req, res) => {  
    res.sendFile(path.join(__dirname, '..', 'views', 'agents', 'agent_client.html')); // Adjusted path
  });

  app.get('/agents/agent_assigned_task', (req, res) => {  
    res.sendFile(path.join(__dirname, '..', 'views', 'agents', 'agent_assigned_task.html')); // Adjusted path
  });

  app.get('/agents/agent_tripping', (req, res) => {  
    res.sendFile(path.join(__dirname, '..', 'views', 'agents', 'agent_tripping.html')); // Adjusted path
  });

  app.get('/agents/agent_transactions', (req, res) => {  
    res.sendFile(path.join(__dirname, '..', 'views', 'agents', 'agent_transactions.html')); // Adjusted path
  });

};

module.exports = htmlRoutes;
