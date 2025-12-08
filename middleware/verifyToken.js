const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Toko = require("../models/Toko");
const { error } = require("../utils/response");

const verifyToken = async (req, res, next) => {
    try {
        const header = req.headers.authorization;

        if (!header || !header.startsWith("Bearer ")) {
            return error(res, "Token tidak ditemukan", 401);
        }
        const token = header.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return error(res, "Token tidak valid", 401);
        }

        const user = await User.findOne({
            where: { id: decoded.id },
            attributes: { exclude: ["password"] },
            include: [{ model: Toko }],
        });

        if (!user) {
            return error(res, "User tidak ditemukan", 404);
        }

        req.user = user;
        next();
    } catch (err) {
        console.error("TOKEN ERROR:", err);
        return error(res, "Token tidak valid atau sudah kadaluarsa", 401);
    }
};

const authorizeRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return error(res, "Akses ditolak", 403);
        }

        if (!allowedRoles.includes(req.user.role_name)) {
            return error(res, "Role tidak diizinkan mengakses resource ini", 403);
        }

        next();
    };
};

// Export dengan const
module.exports = {
    verifyToken,
    authorizeRole
};
