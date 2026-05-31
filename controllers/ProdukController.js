const Produk = require("../models/Product");
const User = require("../models/User");
const Toko = require("../models/Toko")
const { success, error } = require("../utils/response");
const { Op } = require('sequelize')
const { buildProdukWorkbookBuffer } = require("../utils/productExcelReport");

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
        if (req.user.role_name !== "superadmin") {
            return error(res, "Hanya super admin yang dapat mengunduh file Excel produk", 403);
        }

        let where = {};
        let filenamePrefix = "produk";
        const isSuperAdmin = req.user.role_name === "superadmin";

        if (!isSuperAdmin) {
            where.toko_id = req.user.toko_id;
        }

        const [produkList, tokoList] = await Promise.all([
            Produk.findAll({
                where,
                include: [{
                    model: Toko,
                    attributes: ["id", "nama_toko"]
                }],
                order: [
                    ["nama_produk", "ASC"]
                ]
            }),
            isSuperAdmin
                ? Toko.findAll({
                    attributes: ["id", "nama_toko"],
                    order: [["nama_toko", "ASC"]]
                })
                : []
        ]);

        if (isSuperAdmin) {
            filenamePrefix = "produk_semua_toko";
        }

        const excelBuffer = await buildProdukWorkbookBuffer({
            products: produkList,
            stores: tokoList,
            includeAllStores: isSuperAdmin
        });

        const suffix = new Date().toISOString().slice(0, 10);
        const fileName = `${filenamePrefix}_${suffix}.xlsx`;

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${fileName}"`
        );

        return res.status(200).send(Buffer.from(excelBuffer));

    } catch (err) {
        console.error(err);
        return error(res, "Gagal generate atau upload file", 500, err.message);
    }
};

const getProdukByToko = async (req, res) => {
    try {
        const { tokoId } = req.params;

        if (!tokoId) {
            return error(res, "tokoId wajib diisi", 400);
        }

        const produk = await Produk.findAll({
            where: { toko_id: tokoId },
            include: [
                {
                    model: User,
                    attributes: ["id", "full_name", "email", "role_name", "toko_id"],
                    include: [{ model: Toko }],
                },
            ],
            order: [["createdAt", "DESC"]],
        });

        return success(res, "Data produk toko ditemukan", produk);
    } catch (err) {
        console.error(err);
        return error(res, "Server error", 500, err.message);
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
    getProdukByToko,
    updateProduk,
    deleteProduk,
    downloadProdukExcel,
    uploadExcelCreateProduk
};
