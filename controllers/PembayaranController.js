const Pembayaran = require("../models/Pembayaran");
const TransaksiPenjualan = require("../models/TransaksiPenjualan");
const Pelanggan = require("../models/Pelanggan");
const { success, error } = require("../utils/response");
const sequelize = require("../config/db");
const { Op } = require("sequelize");

const createPembayaran = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { transaksi_id, uang_diterima, metode_pembayaran } = req.body;

        const transaksi = await TransaksiPenjualan.findOne({ where: { id: transaksi_id } });
        if (!transaksi) return error(res, "Transaksi tidak ditemukan", 404);

        let hutang = 0;
        if (uang_diterima < transaksi.total_harga) {
            hutang = transaksi.total_harga - uang_diterima;
        }

        // Simpan pembayaran
        const pembayaran = await Pembayaran.create({
            transaksi_id,
            pelanggan_id: transaksi.pelanggan_id,
            total_bayar: transaksi.total_harga,
            uang_diterima,
            hutang,
            metode_pembayaran: metode_pembayaran || "cash"
        }, { transaction: t });

        if (transaksi.pelanggan_id) {
            const pelanggan = await Pelanggan.findOne({ where: { id: transaksi.pelanggan_id } });
            if (pelanggan) {
                await pelanggan.update({
                    hutang: (pelanggan.hutang || 0) + hutang
                }, { transaction: t });
            }
        }

        await t.commit();
        return success(res, "Pembayaran berhasil dibuat", pembayaran);

    } catch (err) {
        await t.rollback();
        console.error(err);
        return error(res, "Gagal membuat pembayaran", 500, err.message);
    }
};



const getHistoryByPelanggan = async (req, res) => {
    try {
        const { pelanggan_id } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const { count, rows } = await Pembayaran.findAndCountAll({
            where: { pelanggan_id },
            include: [
                {
                    model: TransaksiPenjualan,
                    attributes: ["id", "total_harga", "total_item", "total_qty"]
                }
            ],
            order: [["createdAt", "DESC"]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        return success(res, "Data histori pembayaran ditemukan", {
            total: count,
            current_page: parseInt(page),
            per_page: parseInt(limit),
            total_pages: Math.ceil(count / limit),
            data: rows
        });

    } catch (err) {
        console.error(err);
        return error(res, "Server error", 500, err.message);
    }
};

module.exports = { createPembayaran, getHistoryByPelanggan };
