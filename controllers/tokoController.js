const Toko = require("../models/Toko");
const { success, error } = require("../utils/response");

const createToko = async (req, res) => {
    try {
        const { nama_toko, alamat } = req.body;
        if (!nama_toko || !alamat) {
            return error(res, "nama_toko dan alamat wajib diisi", 400);
        }
        const toko = await Toko.create({ nama_toko, alamat });
        return success(res, "Toko berhasil dibuat", toko, 201);

    } catch (err) {
        console.error(err);
        return error(res, "Server error", 500, err.message);
    }
};
const getAllToko = async (req, res) => {
    try {
        const toko = await Toko.findAll();
        return success(res, "Daftar toko", toko);

    } catch (err) {
        console.error(err);
        return error(res, "Server error", 500, err.message);
    }
};
const getTokoById = async (req, res) => {
    try {
        const { id } = req.params;
        const toko = await Toko.findByPk(id);
        if (!toko) return error(res, "Toko tidak ditemukan", 404);
        return success(res, "Detail toko", toko);

    } catch (err) {
        console.error(err);
        return error(res, "Server error", 500, err.message);
    }
};

const updateToko = async (req, res) => {
    try {
        const { id } = req.params;
        const { nama_toko, alamat } = req.body;

        const toko = await Toko.findByPk(id);
        if (!toko) return error(res, "Toko tidak ditemukan", 404);

        toko.nama_toko = nama_toko ?? toko.nama_toko;
        toko.alamat = alamat ?? toko.alamat;

        await toko.save();

        return success(res, "Toko berhasil diperbarui", toko);

    } catch (err) {
        console.error(err);
        return error(res, "Server error", 500, err.message);
    }
};
const deleteToko = async (req, res) => {
    try {
        const { id } = req.params;

        const toko = await Toko.findByPk(id);
        if (!toko) return error(res, "Toko tidak ditemukan", 404);

        await toko.destroy();
        return success(res, "Toko berhasil dihapus", null);

    } catch (err) {
        console.error(err);
        return error(res, "Server error", 500, err.message);
    }
};

module.exports = {
    createToko,
    getAllToko,
    getTokoById,
    updateToko,
    deleteToko
};
