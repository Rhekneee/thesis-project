// htmlRoutes.js
const path = require('path');

const htmlRoutes = (app) => {
// ====================
  // HR Manager Routes
  // ====================
  app.get('/customer', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'customer.html'));
  });
  
  app.get('/hr/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'hr_manager', 'hr_dashboard.html'));
  });

  app.get('/hr_manager/employee_management', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'hr_manager', 'employee_management.html'));
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
};

module.exports = htmlRoutes;
