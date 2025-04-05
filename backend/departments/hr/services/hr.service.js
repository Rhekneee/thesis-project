const HRModel = require('../model/hr.model.js');

const HRService = {
  getEmployees: async () => {
    return await HRModel.getAllEmployees();
  },

  addEmployee: async (employeeData) => {
    return await HRModel.addEmployee(employeeData);
  }
};

module.exports = HRService;
