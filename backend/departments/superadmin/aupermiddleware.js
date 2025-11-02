const superadminMiddleware = {
    verifySession: (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ message: "Unauthorized: Please log in" });
        }
        req.user = req.session.user;
        next();
    },

    verifySuperadminRole: (req, res, next) => {
        // Check if user has superadmin role
        if (!req.user || req.user.role_name !== 'superadmin') {
            return res.status(403).json({ message: "Forbidden: Superadmin access required" });
        }
        next();
    }
};

module.exports = superadminMiddleware;
