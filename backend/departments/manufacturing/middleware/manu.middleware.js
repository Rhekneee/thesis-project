const crmAuthMiddleware = (req, res, next) => {
    // Check if user is logged in
    if (!req.session || !req.session.user_id) {
        return res.status(401).json({ error: 'Unauthorized - Please log in' });
    }

    // Check if user is a developer (role_id 25)
    if (req.session.role_id !== 25) {
        return res.status(403).json({ error: 'Forbidden - Developer access required' });
    }

    // Set developer_id in session if not already set
    if (!req.session.developer_id) {
        req.session.developer_id = req.session.user_id;
    }

    next();
};

module.exports = {
    crmAuthMiddleware
};
