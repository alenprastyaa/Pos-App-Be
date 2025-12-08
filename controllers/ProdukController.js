const Produk = require("../models/Product");
const User = require("../models/User");
const Toko = require("../models/Toko")
const { success, error } = require("../utils/response");
const { Op } = require('sequelize')
const ExcelJS = require("exceljs");
const axios = require('axios')

const createProduk = async (req, res) => {
    try {
        const { nama_produk, barcode, stok_produk, harga_beli, harga_jual_ritel, harga_jual_biasa, toko_id } = req.body;

        if (!nama_produk || !barcode) {
            return error(res, "nama_produk dan barcode wajib diisi", 400);
        }

        let finalTokoId = req.user.toko_id;

        if (req.user.role_name === "superadmin") {
            if (!toko_id) return error(res, "toko_id wajib diisi untuk superadmin", 400);
            finalTokoId = toko_id;
        }

        // 🔍 CEK BARCODE SUDAH ADA DI TOKO YANG SAMA
        const existingBarcode = await Produk.findOne({
            where: {
                barcode,
                toko_id: finalTokoId
            }
        });

        if (existingBarcode) {
            return error(res, "Barcode ini sudah digunakan di toko tersebut", 400);
        }

        const produk = await Produk.create({
            nama_produk,
            barcode,
            stok_produk,
            harga_beli,
            harga_jual_ritel,
            harga_jual_biasa,
            user_id: req.user.id,
            toko_id: finalTokoId
        });

        return success(res, "Produk berhasil dibuat", produk, 201);

    } catch (err) {
        console.error(err);
        return error(res, "Server error", 500, err.message);
    }
};


const getAllProduk = async (req, res) => {
    try {
        let {
            page = 1,
            limit = 10,
            search = "",
            toko_id,
            user_id
        } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        const offset = (page - 1) * limit;
        const where = {};
        if (search) {
            where[Op.or] = [
                { nama_produk: { [Op.iLike]: `%${search}%` } },
                { barcode: { [Op.iLike]: `%${search}%` } }
            ];
        }

        if (req.user.role_name === "admin") {
            // where.user_id = req.user.id;
            where.toko_id = req.user.toko_id;
        }

        if (req.user.role_name === "superadmin") {
            if (toko_id) where.toko_id = toko_id;
            if (user_id) where.user_id = user_id;
        }
        const { count, rows } = await Produk.findAndCountAll({
            where,
            limit,
            offset,
            include: [
                {
                    model: User,
                    attributes: ["id", "full_name", "email", "role_name", "toko_id"],
                    include: [{
                        model: Toko,
                    }]
                }
            ],
            order: [["createdAt", "DESC"]]
        });
        return success(res, "Data produk ditemukan", {
            total: count,
            current_page: page,
            per_page: limit,
            total_pages: Math.ceil(count / limit),
            data: rows
        });
    } catch (err) {
        console.error(err);
        return error(res, "Server error", 500, err.message);
    }
};

const getProdukById = async (req, res) => {
    try {
        const { id } = req.params;

        const produk = await Produk.findOne({
            where: { id },
            include: [{
                model: User,
                attributes: ["id", "full_name", "email"]
            }]
        });

        if (!produk) return error(res, "Produk tidak ditemukan", 404);
        if (produk.toko_id !== req.user.toko_id) {
            return error(res, "Tidak punya akses ke produk ini", 403);
        }

        return success(res, "Produk ditemukan", produk);

    } catch (err) {
        console.error(err);
        return error(res, "Server error", 500, err.message);
    }
};

const updateProduk = async (req, res) => {
    try {
        const { id } = req.params;
        const produk = await Produk.findOne({ where: { id } });
        if (!produk) return error(res, "Produk tidak ditemukan", 404);
        if (req.user.role_name === "admin") {
            if (produk.toko_id !== req.user.toko_id) {
                return error(res, "Tidak punya akses untuk mengedit produk ini", 403);
            }
        }
        await Produk.update(req.body, { where: { id } });
        const updated = await Produk.findOne({
            where: { id },
            include: [
                {
                    model: User,
                    attributes: ["id", "full_name", "email", "role_name"]
                }
            ]
        });
        return success(res, "Produk berhasil diperbarui", updated);
    } catch (err) {
        console.error(err);
        return error(res, "Server error", 500, err.message);
    }
};


const deleteProduk = async (req, res) => {
    try {
        const { id } = req.params;

        const produk = await Produk.findOne({ where: { id } });
        if (!produk) return error(res, "Produk tidak ditemukan", 404);

        if (produk.toko_id !== req.user.toko_id) {
            return error(res, "Tidak punya akses untuk menghapus produk ini", 403);
        }

        await Produk.destroy({ where: { id } });

        return success(res, "Produk berhasil dihapus");

    } catch (err) {
        console.error(err);
        return error(res, "Server error", 500, err.message);
    }
};
const downloadProdukExcel = async (req, res) => {
    try {
        const where = {};

        if (req.user.role_name === "admin") {
            where.toko_id = req.user.toko_id;
        }

        const produkList = await Produk.findAll({ where });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Produk");

        // Header sesuai upload
        worksheet.columns = [
            { header: "nama_produk", key: "nama_produk", width: 25 },
            { header: "barcode", key: "barcode", width: 20 },
            { header: "stok_produk", key: "stok_produk", width: 15 },
            { header: "harga_beli", key: "harga_beli", width: 15 },
            { header: "harga_jual_ritel", key: "harga_jual_ritel", width: 20 },
            { header: "harga_jual_biasa", key: "harga_jual_biasa", width: 20 },
        ];

        produkList.forEach((p) => {
            worksheet.addRow({
                nama_produk: p.nama_produk,
                barcode: p.barcode,
                stok_produk: p.stok_produk,
                harga_beli: p.harga_beli,
                harga_jual_ritel: p.harga_jual_ritel,
                harga_jual_biasa: p.harga_jual_biasa,
            });
        });

        const excelBuffer = await workbook.xlsx.writeBuffer();
        const fileBuffer = Buffer.from(excelBuffer);

        const blob = new Blob([fileBuffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const form = new FormData();
        form.append("file", blob, `produk_${Date.now()}.xlsx`);

        const uploadResponse = await axios.post(
            "https://invitations.my.id/api/upload-file",
            form,
            {
                headers: {
                    ...form.getHeaders?.(),
                    "Content-Type": "multipart/form-data",
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            }
        );

        return success(res, "Berhasil generate file", uploadResponse.data.data);

    } catch (err) {
        console.error(err);
        return error(res, "Gagal generate atau upload file", 500, err.message);
    }
};


const uploadExcelCreateProduk = async (req, res) => {
    try {

        if (!req.file) {
            return error(res, "File Excel wajib diupload", 400);
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);

        const worksheet = workbook.getWorksheet(1);

        const rowsToInsert = [];

        worksheet.eachRow((row, index) => {
            if (index === 1) return; // skip header

            const [
                nama_produk,
                barcode,
                stok_produk,
                harga_beli,
                harga_jual_ritel,
                harga_jual_biasa,
            ] = row.values.slice(1);

            if (!nama_produk || !barcode) return;

            rowsToInsert.push({
                nama_produk,
                barcode,
                stok_produk: stok_produk || 0,
                harga_beli: harga_beli || 0,
                harga_jual_ritel: harga_jual_ritel || 0,
                harga_jual_biasa: harga_jual_biasa || 0,
                user_id: req.user.id,
                toko_id: req.user.toko_id,
            });
        });

        if (rowsToInsert.length === 0) {
            return error(res, "Data Excel kosong atau tidak valid", 400);
        }

        await Produk.bulkCreate(rowsToInsert);

        return success(res, "Berhasil upload & create produk dari Excel", {
            created: rowsToInsert.length
        });

    } catch (err) {
        console.error(err);
        return error(res, "Gagal upload Excel", 500, err.message);
    }
};

module.exports = {
    createProduk,
    getAllProduk,
    getProdukById,
    updateProduk,
    deleteProduk,
    downloadProdukExcel,
    uploadExcelCreateProduk
};
