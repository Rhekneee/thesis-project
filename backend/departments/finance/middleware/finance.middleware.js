const authMiddleware = {
    verifySession: (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ message: "Unauthorized: Please log in" });
        }
        req.user = req.session.user;
        next();
    }
};

// Export to match the HR middleware structure
module.exports = authMiddleware;
