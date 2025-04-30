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
};

module.exports = htmlRoutes;
