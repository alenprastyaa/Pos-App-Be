const Toko = require("../models/Toko");
const User = require("../models/User")
const { success, error } = require("../utils/response");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken")


const getMyData = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findOne({
            where: { id: userId },
            attributes: { exclude: ["password"] },
            include: [
                {
                    model: Toko,
                    as: "toko",
                }
            ]
        });

        if (!user) {
            return error(res, "User tidak ditemukan", 404);
        }

        return success(res, "Data user berhasil diambil", user);
    } catch (err) {
        console.error(err);
        return error(res, "Server error", 500, err.message);
    }
};

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, email, password, role_name, status, toko_id } = req.body;

        const user = await User.findOne({ where: { id } });
        if (!user) return error(res, "User tidak ditemukan", 404);

        if (email && email !== user.email) {
            const exists = await User.findOne({ where: { email } });
            if (exists) return error(res, "Email sudah digunakan", 409);
        }
        const allowedRoles = ["admin", "superadmin"];
        if (role_name && !allowedRoles.includes(role_name)) {
            return error(res, "Role hanya boleh 'admin' atau 'superadmin'", 400);
        }
        let toko = null;
        if (toko_id) {
            toko = await Toko.findOne({ where: { id: toko_id } });
            if (!toko) return error(res, "Toko dengan ID tersebut tidak ditemukan", 404);
        }

        let hashedPassword = user.password;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        await user.update({
            full_name: full_name || user.full_name,
            email: email || user.email,
            password: hashedPassword,
            role_name: role_name || user.role_name,
            status: status !== undefined ? status : user.status,
            toko_id: toko ? toko.id : user.toko_id
        });

        const { password: _p, ...safeUser } = user.toJSON();
        return success(res, "User berhasil diperbarui", safeUser);
    } catch (err) {
        console.error(err);
        return error(res, "Server error", 500, err.message);
    }
};
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findOne({ where: { id } });
        if (!user) return error(res, "User tidak ditemukan", 404);

        await user.destroy();
        return success(res, "User berhasil dihapus");
    } catch (err) {
        console.error(err);
        return error(res, "Server error", 500, err.message);
    }
};

const register = async (req, res) => {
    try {
        const { full_name, password, email, role_name, status, toko_id } = req.body;
        if (!full_name || !password || !email || !role_name) {
            return error(res, "full_name, password, email dan role_name wajib diisi", 400);
        }
        const allowedRoles = ["admin", "superadmin"];
        if (!allowedRoles.includes(role_name)) {
            return error(res, "Role hanya boleh 'admin' atau 'superadmin'", 400);
        }
        const exists = await User.findOne({ where: { email } });
        if (exists) return error(res, "Email sudah digunakan", 409);

        // Cek apakah toko valid (jika diisi)
        let toko = null;
        if (toko_id) {
            toko = await Toko.findOne({ where: { id: toko_id } });
            if (!toko) {
                return error(res, "Toko dengan ID tersebut tidak ditemukan", 404);
            }
        }
        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({
            full_name,
            email,
            password: hashed,
            role_name,
            status,
            toko_id: toko ? toko.id : null
        });
        const { password: _p, ...safeUser } = user.toJSON();
        return success(res, "User registered successfully", safeUser, 201);
    } catch (err) {
        console.error(err);
        return error(res, "Server error", 500, err.message);
    }
};
const GetUser = async (req, res) => {
    try {
        const user = await User.findAll({
            attributes: {
                exclude: "password"
            }
        })
        return success(res, "Data User ditemukan", user)
    } catch (error) {
        console.error(error);
        return error(res, "Server error", 500, err.message);
    }
}


const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return error(res, "Email dan password wajib diisi", 400);
        }
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return error(res, "Email atau password salah", 401);
        }
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return error(res, "Email atau password salah", 401);
        }
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role_name },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );
        const { password: _p, ...safeUser } = user.toJSON();
        return success(res, "Login berhasil", { user: safeUser, token });
    } catch (err) {
        console.error(err);
        return error(res, "Server error", 500, err.message);
    }
};

module.exports = { login, register, GetUser, updateUser, deleteUser, getMyData }