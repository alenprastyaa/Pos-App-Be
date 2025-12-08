const Pelanggan = require("../models/Pelanggan");
const { success, error } = require("../utils/response");

// CREATE
const createPelanggan = async (req, res) => {
    try {
        const { nama_pelanggan, alamat } = req.body;
        if (!nama_pelanggan) return error(res, "Nama pelanggan wajib diisi", 400);

        const pelanggan = await Pelanggan.create({
            nama_pelanggan,
            alamat,
            user_id: req.user.id,
            toko_id: req.user.toko_id
        });
        return success(res, "Pelanggan berhasil dibuat", pelanggan, 201);

    } catch (err) {
        console.error(err);
        return error(res, "Gagal membuat pelanggan", 500, err.message);
    }
};

// READ ALL
const getAllPelanggan = async (req, res) => {
    try {
        const where = {};
        if (req.user.role_name === "admin") {
            where.user_id = req.user.id;
            where.toko_id = req.user.toko_id;
        }

        const pelanggan = await Pelanggan.findAll({ where });
        return success(res, "Data pelanggan ditemukan", pelanggan);
    } catch (err) {
        console.error(err);
        return error(res, "Gagal mengambil data pelanggan", 500, err.message);
    }
};

// READ ONE
const getPelangganById = async (req, res) => {
    try {
        const { id } = req.params;
        const pelanggan = await Pelanggan.findByPk(id);
        if (!pelanggan) return error(res, "Pelanggan tidak ditemukan", 404);

        // Jika admin, pastikan hanya pelanggan dari toko mereka
        if (req.user.role_name === "admin" && pelanggan.toko_id !== req.user.toko_id) {
            return error(res, "Tidak punya akses melihat pelanggan ini", 403);
        }

        return success(res, "Data pelanggan ditemukan", pelanggan);
    } catch (err) {
        console.error(err);
        return error(res, "Gagal mengambil data pelanggan", 500, err.message);
    }
};

// UPDATE
const updatePelanggan = async (req, res) => {
    try {
        const { id } = req.params;
        const { nama_pelanggan, alamat } = req.body;

        const pelanggan = await Pelanggan.findByPk(id);
        if (!pelanggan) return error(res, "Pelanggan tidak ditemukan", 404);

        if (req.user.role_name === "admin" && pelanggan.toko_id !== req.user.toko_id) {
            return error(res, "Tidak punya akses mengedit pelanggan ini", 403);
        }

        await pelanggan.update({ nama_pelanggan, alamat });
        return success(res, "Pelanggan berhasil diperbarui", pelanggan);
    } catch (err) {
        console.error(err);
        return error(res, "Gagal memperbarui pelanggan", 500, err.message);
    }
};

// DELETE
const deletePelanggan = async (req, res) => {
    try {
        const { id } = req.params;
        const pelanggan = await Pelanggan.findByPk(id);
        if (!pelanggan) return error(res, "Pelanggan tidak ditemukan", 404);

        if (req.user.role_name === "admin" && pelanggan.toko_id !== req.user.toko_id) {
            return error(res, "Tidak punya akses menghapus pelanggan ini", 403);
        }

        await pelanggan.destroy();
        return success(res, "Pelanggan berhasil dihapus", null);
    } catch (err) {
        console.error(err);
        return error(res, "Gagal menghapus pelanggan", 500, err.message);
    }
};

module.exports = {
    createPelanggan,
    getAllPelanggan,
    getPelangganById,
    updatePelanggan,
    deletePelanggan
};
