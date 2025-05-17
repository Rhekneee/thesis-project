const authMiddleware = {
  verifySession: (req, res, next) => {

      
      if (!req.session || !req.session.user) {
          return res.status(401).json({ message: "Unauthorized: Please log in" });
      }
      req.user = req.session.user;
      next();
  },

  verifyHRRole: (req, res, next) => {
 
      // Check if user has HR role
      if (!req.user || req.user.role_name !== 'office_administrator') {
          return res.status(403).json({ message: "Forbidden: HR access required" });
      }
      next();
  }
};

// ✅ Fix the export to match the import in routes
module.exports = authMiddleware;
