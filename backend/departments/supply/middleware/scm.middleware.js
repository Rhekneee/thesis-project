const logisticsAuth = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: "Unauthorized: Please log in." });
    }
    // Check if user has the 'logistics' or 'Supply chain staff' role
    const roleName = req.session.user.role_name || '';
    const roleLower = roleName.toLowerCase();
    const allowedRoles = ['logistics', 'supply chain staff', 'supply_chain_staff', 'supply chain', 'supply_chain'];
    
    if (!allowedRoles.includes(roleLower)) {
        return res.status(403).json({ error: "Forbidden: Logistics or Supply chain staff access required." });
    }
    next();
};

module.exports = logisticsAuth;
