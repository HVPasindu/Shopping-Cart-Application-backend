const AppError = require("../utils/AppError");

const adminOnly = (req, res, next) => {
    if (!req.user || req.user.role !== "admin") {
        throw new AppError("Only admin can access this route.", 403);
    }

    next();
};

const mainAdminOnly = (req, res, next) => {
    if (
        !req.user ||
        req.user.role !== "admin" ||
        req.user.name !== "Main Admin"
    ) {
        throw new AppError("Only Main Admin can perform this action.", 403);
    }

    next();
};

module.exports = {
    adminOnly,
    mainAdminOnly,
};