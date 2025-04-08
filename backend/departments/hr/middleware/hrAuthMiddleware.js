const authMiddleware = {
  verifySession: (req, res, next) => {
      if (!req.session || !req.session.user) {
          return res.status(401).json({ message: "Unauthorized: Please log in" });
      }
      req.user = req.session.user;
      next();
  }
};

// ✅ Fix the export to match the import in routes
module.exports = authMiddleware;
