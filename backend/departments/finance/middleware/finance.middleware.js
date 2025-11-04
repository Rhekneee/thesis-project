// Middleware to check if user is authenticated and is a finance admin or accountant
const isFinanceAdmin = (req, res, next) => {
    // Check if user is logged in
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized: Please login first"
        });
    }

    // Check if user is a finance admin or accountant
    const roleName = req.session.user.role_name;
    if (roleName !== 'finance_accounting' && roleName !== 'accountant') {
        return res.status(403).json({
            success: false,
            message: "Forbidden: Access denied. Finance admin or accountant privileges required."
        });
    }

    next();
};

module.exports = {
    isFinanceAdmin
};
