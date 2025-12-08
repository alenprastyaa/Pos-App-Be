const Produk = require("../models/Product");
const TransaksiPenjualan = require("../models/TransaksiPenjualan");
const Pelanggan = require("../models/Pelanggan");
const sequelize = require("../config/db");
const { success, error } = require("../utils/response");
const { Op, fn, col } = require('sequelize');

const getTokoFilter = (req) => {
    let filter = {};
    if (req.user.role_name !== "superadmin") {
        filter.toko_id = req.user.toko_id;
    }
    return filter;
};

const getDashboardSummary = async (req, res) => {
    try {
        const tokoFilter = getTokoFilter(req);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);

        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const yearStart = new Date(today.getFullYear(), 0, 1);

        const todayFilter = { ...tokoFilter, createdAt: { [Op.gte]: today } };
        const monthFilter = { ...tokoFilter, createdAt: { [Op.gte]: monthStart } };
        const yearFilter = { ...tokoFilter, createdAt: { [Op.gte]: yearStart } };
        const last7DaysFilter = { ...tokoFilter, createdAt: { [Op.gte]: sevenDaysAgo } };

        const totalStok = await Produk.sum('stok_produk', { where: tokoFilter }) || 0;
        const totalProduk = await Produk.count({ where: tokoFilter });
        const totalPenjualanHariIni = await TransaksiPenjualan.sum('total_harga', { where: todayFilter }) || 0;
        const totalTransaksiHariIni = await TransaksiPenjualan.count({ where: todayFilter });
        const totalPenjualanBulanIni = await TransaksiPenjualan.sum('total_harga', { where: monthFilter }) || 0;
        const totalPenjualanTahunIni = await TransaksiPenjualan.sum('total_harga', { where: yearFilter }) || 0;

        const totalPiutang = await Pelanggan.sum('hutang', { where: tokoFilter }) || 0;
        const totalPelanggan = await Pelanggan.count({ where: tokoFilter });
        const pelangganTerbaru = await Pelanggan.findAll({
            where: tokoFilter,
            limit: 5,
            order: [['createdAt', 'DESC']]
        });

        const transaksiTerakhir = await TransaksiPenjualan.findAll({
            where: tokoFilter,
            limit: 5,
            order: [['createdAt', 'DESC']],
            include: [{ model: Pelanggan, attributes: ['nama_pelanggan'] }]
        });

        const stokRendahFilter = { ...tokoFilter, stok_produk: { [Op.lt]: 10 } };
        const produkStokRendah = await Produk.findAll({
            where: stokRendahFilter,
            attributes: ['id', 'nama_produk', 'stok_produk'],
            limit: 5,
            order: [['stok_produk', 'ASC']]
        });

        const salesChartData = await TransaksiPenjualan.findAll({
            where: last7DaysFilter,
            attributes: [
                [fn('date_trunc', 'day', col('createdAt')), 'day'],
                [fn('sum', col('total_harga')), 'totalSales']
            ],
            group: ['day'],
            order: [['day', 'ASC']]
        });

        return success(res, "Data Dashboard berhasil diambil", {
            summary: {
                totalStok,
                totalProduk,
                totalPenjualanHariIni,
                totalTransaksiHariIni,
                totalPenjualanBulanIni,
                totalPenjualanTahunIni,
                totalPiutang,
                totalPelanggan
            },
            dataAktivitas: {
                transaksiTerakhir,
                produkStokRendah,
                pelangganTerbaru
            },
            salesChartData
        });

    } catch (err) {
        console.error(err);
        return error(res, "Gagal mengambil data dashboard", 500, err.message);
    }
};

module.exports = { getDashboardSummary };