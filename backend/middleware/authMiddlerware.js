const authMiddleware = {
    // Session check to verify if the user is authenticated
    verifySession: (req, res, next) => {
      if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized! Please log in first." });
      }
      req.user = req.session.user;  // Add user data to the request object
      next(); // User is authenticated, continue to the next function
    },
  
    // 🔐 Office Admin Role Checker (Role ID = 6)
    authorizeOfficeAdmin: (req, res, next) => {
      // Ensure the user has the correct role ID for office administrators
      if (!req.user || req.user.role_id !== 6) {
        return res.status(403).json({ message: "Access denied: Office Admins only." });
      }
      next(); // User is authorized as office admin, continue to the next function
    }
  };
  
  // ✅ Export both functions
  module.exports = authMiddleware;
      