const crmAuthMiddleware = {
    verifySession: (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: "Unauthorized: Please log in." });
        }
        next();
    }
};

module.exports = crmAuthMiddleware;
