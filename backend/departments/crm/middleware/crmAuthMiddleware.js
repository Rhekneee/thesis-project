const verifySession = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    // Check if user is a developer (role_id 25) or customer (role_id 26)
    if (req.session.user.role_name !== 'developer' && req.session.user.role_name !== 'customer') {
        return res.status(403).json({ error: "Forbidden: Developer or customer access required." });
    }

    next();
};

module.exports = verifySession;
