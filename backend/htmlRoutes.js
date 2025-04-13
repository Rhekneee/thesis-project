// htmlRoutes.js
const path = require('path');

const htmlRoutes = (app) => {
  // Serve HR Manager Dashboard
  app.get('/customer', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'customer.html'));
  });
  
  app.get('/hr/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'hr_manager', 'hr_dashboard.html'));
  });
  // Serve Employee Management page
  app.get('/hr_manager/employee_management', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'hr_manager', 'employee_management.html'));
});

  // Additional pages can be added here
};

module.exports = htmlRoutes;
