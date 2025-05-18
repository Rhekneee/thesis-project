const logisticsAuth = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: "Unauthorized: Please log in." });
    }
    // Check if user has the 'logistics' role
    if (req.session.user.role_name !== 'logistics') {
        return res.status(403).json({ error: "Forbidden: Logistics access required." });
    }
    next();
};

module.exports = logisticsAuth;
