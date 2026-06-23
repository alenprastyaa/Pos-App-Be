const Produk = require("../models/Product");
const { success, error } = require("../utils/response");
const TransaksiDetail = require("../models/TransaksiDetail");
const TransaksiPenjualan = require("../models/TransaksiPenjualan");
const sequelize = require("../config/db");
const Pelanggan = require("../models/Pelanggan");
const { Op } = require("sequelize");

const getHargaGrosir = (produk) => {
  const prices = [produk.harga_jual_ritel, produk.harga_jual_biasa]
    .map(Number)
    .filter((price) => Number.isFinite(price) && price > 0);

  return prices.length > 0 ? Math.min(...prices) : 0;
};

const scanBarcode = async (req, res) => {
  try {
    const { barcode } = req.body;
    const produk = await Produk.findOne({
      where: { barcode, toko_id: req.user.toko_id },
    });
    if (!produk) return error(res, "Produk tidak ditemukan", 404);
    return success(res, "Produk ditemukan", produk);
  } catch (err) {
    return error(res, "Server error", 500, err.message);
  }
};

const createTransaksiReguler = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { items, pelanggan_id, pembayaran } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return error(res, "Items transaksi tidak boleh kosong", 400);
    }
    if (!pelanggan_id) return error(res, "pelanggan_id wajib diisi", 400);
    if (pembayaran === undefined || pembayaran < 0)
      return error(res, "pembayaran wajib diisi", 400);

    const pelanggan = await Pelanggan.findOne({ where: { id: pelanggan_id } });
    if (!pelanggan) return error(res, "Pelanggan tidak ditemukan", 404);

    let totalHarga = 0;
    let totalQty = 0;
    const transaksi = await TransaksiPenjualan.create(
      {
        user_id: req.user.id,
        toko_id: req.user.toko_id,
        pelanggan_id: pelanggan.id,
      },
      { transaction: t },
    );

    for (const item of items) {
      if (!item.barcode || !item.qty) {
        await t.rollback();
        return error(res, "Barcode dan qty wajib diisi untuk setiap item", 400);
      }

      const produk = await Produk.findOne({
        where: { barcode: item.barcode, toko_id: req.user.toko_id },
      });
      if (!produk) {
        await t.rollback();
        return error(
          res,
          `Produk dengan barcode ${item.barcode} tidak ditemukan`,
          404,
        );
      }

      const harga = produk.harga_jual_biasa;
      const subtotal = harga * item.qty;
      totalHarga += subtotal;
      totalQty += item.qty;

      await TransaksiDetail.create(
        {
          transaksi_id: transaksi.id,
          produk_id: produk.id,
          pelanggan_id: pelanggan.id,
          barcode: produk.barcode,
          harga,
          qty: item.qty,
          subtotal,
        },
        { transaction: t },
      );

      await produk.update(
        {
          stok_produk: produk.stok_produk - item.qty,
        },
        { transaction: t },
      );
    }

    const hutangLama = pelanggan.hutang || 0;
    let sisaBayar = pembayaran;
    let sisaHutangLama = hutangLama;

    if (sisaBayar > 0 && sisaHutangLama > 0) {
      const bayarHutangLama = Math.min(sisaBayar, sisaHutangLama);
      sisaBayar -= bayarHutangLama;
      sisaHutangLama -= bayarHutangLama;
    }

    let sisaHutangBaru = totalHarga - sisaBayar;
    let kembalian = 0;

    if (sisaHutangBaru < 0) {
      kembalian = Math.abs(sisaHutangBaru);
      sisaHutangBaru = 0;
    }

    const totalHutangAkhir = sisaHutangLama + sisaHutangBaru;

    await pelanggan.update({ hutang: totalHutangAkhir }, { transaction: t });
    await transaksi.update(
      {
        total_item: items.length,
        total_qty: totalQty,
        total_harga: totalHarga,
        total_bayar: pembayaran,
        sisa_hutang: sisaHutangBaru,
        total_kembalian: kembalian,
      },
      { transaction: t },
    );

    await t.commit();

    return success(res, "Transaksi berhasil dibuat", {
      transaksi,
      pelanggan: {
        id: pelanggan.id,
        nama_pelanggan: pelanggan.nama_pelanggan,
        hutang_sebelumnya: hutangLama,
        pembayaran_untuk_hutang_lama: Math.min(pembayaran, hutangLama),
        sisa_hutang_lama: sisaHutangLama,
        hutang_transaksi_saat_ini: sisaHutangBaru,
        total_hutang_sekarang: totalHutangAkhir,
        kembalian: kembalian,
        detail_perhitungan: {
          total_harga: totalHarga,
          pembayaran: pembayaran,
          sisaBayarSetelahLunasHutangLama: sisaBayar,
        },
      },
    });
  } catch (err) {
    await t.rollback();
    return error(res, "Gagal membuat transaksi", 500, err.message);
  }
};

const createTransaksi = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { items, pelanggan_id, pembayaran } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return error(res, "Items transaksi tidak boleh kosong", 400);
    }
    if (!pelanggan_id) return error(res, "pelanggan_id wajib diisi", 400);
    if (pembayaran === undefined || pembayaran < 0)
      return error(res, "pembayaran wajib diisi", 400);

    const pelanggan = await Pelanggan.findOne({ where: { id: pelanggan_id } });
    if (!pelanggan) return error(res, "Pelanggan tidak ditemukan", 404);

    let totalHarga = 0;
    let totalQty = 0;
    const transaksi = await TransaksiPenjualan.create(
      {
        user_id: req.user.id,
        toko_id: req.user.toko_id,
        pelanggan_id: pelanggan.id,
      },
      { transaction: t },
    );

    for (const item of items) {
      if (!item.barcode || !item.qty) {
        await t.rollback();
        return error(res, "Barcode dan qty wajib diisi untuk setiap item", 400);
      }

      const produk = await Produk.findOne({
        where: { barcode: item.barcode, toko_id: req.user.toko_id },
      });
      if (!produk) {
        await t.rollback();
        return error(
          res,
          `Produk dengan barcode ${item.barcode} tidak ditemukan`,
          404,
        );
      }

      const harga = getHargaGrosir(produk);
      if (harga <= 0) {
        await t.rollback();
        return error(
          res,
          `Harga grosir produk ${produk.nama_produk} belum valid`,
          400,
        );
      }
      const subtotal = harga * item.qty;
      totalHarga += subtotal;
      totalQty += item.qty;

      await TransaksiDetail.create(
        {
          transaksi_id: transaksi.id,
          produk_id: produk.id,
          pelanggan_id: pelanggan.id,
          barcode: produk.barcode,
          harga,
          qty: item.qty,
          subtotal,
        },
        { transaction: t },
      );

      await produk.update(
        {
          stok_produk: produk.stok_produk - item.qty,
        },
        { transaction: t },
      );
    }

    const hutangLama = Number(pelanggan.hutang) || 0;
    let sisaBayar = pembayaran;
    let sisaHutangLama = hutangLama;

    const pembayaranHutangLama = Math.min(sisaBayar, sisaHutangLama);
    sisaBayar -= pembayaranHutangLama;
    sisaHutangLama -= pembayaranHutangLama;

    let sisaHutangBaru = totalHarga - sisaBayar;
    let kembalian = 0;

    if (sisaHutangBaru < 0) {
      kembalian = Math.abs(sisaHutangBaru);
      sisaHutangBaru = 0;
    }

    const totalHutangAkhir = sisaHutangLama + sisaHutangBaru;

    await pelanggan.update({ hutang: totalHutangAkhir }, { transaction: t });
    await transaksi.update(
      {
        total_item: items.length,
        total_qty: totalQty,
        total_harga: totalHarga,
        total_bayar: pembayaran,
        sisa_hutang: sisaHutangBaru,
        total_kembalian: kembalian,
      },
      { transaction: t },
    );

    await t.commit();

    return success(res, "Transaksi berhasil dibuat", {
      transaksi,
      pelanggan: {
        id: pelanggan.id,
        nama_pelanggan: pelanggan.nama_pelanggan,
        hutang_sebelumnya: hutangLama,
        pembayaran_untuk_hutang_lama: pembayaranHutangLama,
        sisa_hutang_lama: sisaHutangLama,
        hutang_transaksi_saat_ini: sisaHutangBaru,
        total_hutang_sekarang: totalHutangAkhir,
        kembalian: kembalian,
        detail_perhitungan: {
          total_harga: totalHarga,
          pembayaran: pembayaran,
          sisaBayarSetelahLunasHutangLama: sisaBayar,
        },
      },
    });
  } catch (err) {
    await t.rollback();
    return error(res, "Gagal membuat transaksi", 500, err.message);
  }
};

const getAllTransaksi = async (req, res) => {
  try {
    let { page = 1, limit = 10, search = "" } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    const offset = (page - 1) * limit;

    // Kondisi toko
    let whereTransaksi = {};

    // 🟢 Jika bukan superadmin → filter transaksi berdasarkan toko user
    if (req.user.role_name !== "superadmin") {
      whereTransaksi.toko_id = req.user.toko_id;
    }
    // 🟡 Jika superadmin → tidak filter toko sama sekali (lihat semua toko)

    // Filter pelanggan
    const pelangganFilter = search
      ? { nama_pelanggan: { [Op.like]: `%${search}%` } }
      : {};

    // Hitung total data
    const totalData = await TransaksiPenjualan.count({
      where: whereTransaksi,
      include: [
        {
          model: Pelanggan,
          where: pelangganFilter,
          required: Object.keys(pelangganFilter).length > 0,
        },
      ],
    });

    // Ambil data transaksi
    const transaksi = await TransaksiPenjualan.findAll({
      where: whereTransaksi,
      include: [
        {
          model: Pelanggan,
          attributes: ["id", "nama_pelanggan"],
          where: pelangganFilter,
          required: Object.keys(pelangganFilter).length > 0,
        },
        {
          model: TransaksiDetail,
          include: [{ model: Produk }],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    const totalPage = Math.ceil(totalData / limit);

    return success(res, "Daftar transaksi ditemukan", {
      currentPage: page,
      limit,
      totalData,
      totalPage,
      transaksi,
    });
  } catch (err) {
    console.error(err);
    return error(res, "Server error", 500, err.message);
  }
};

const getTransaksiById = async (req, res) => {
  try {
    const trx = await TransaksiPenjualan.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: TransaksiDetail,
          include: [{ model: Produk }],
        },
      ],
    });

    if (!trx) return error(res, "Transaksi tidak ditemukan", 404);

    return success(res, "Detail transaksi ditemukan", trx);
  } catch (err) {
    return error(res, "Server error", 500, err.message);
  }
};

module.exports = {
  scanBarcode,
  createTransaksi,
  getAllTransaksi,
  getTransaksiById,
  createTransaksiReguler,
};
