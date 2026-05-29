const { Op } = require("sequelize");
const sequelize = require("../config/db");
const { success, error } = require("../utils/response");
const Order = require("../models/Order");
const OrderDetail = require("../models/OrderDetail");
const Produk = require("../models/Product");
const Toko = require("../models/Toko");
const {
    broadcastToToko,
    broadcastToRole,
    broadcastToUser,
} = require("../utils/realtimeHub");

const buildOrderCode = () => {
    const suffix = Date.now().toString(36).toUpperCase();
    return `ORD-${suffix}`;
};

const getOrderDetails = (order) => {
    return order?.order_details || order?.OrderDetails || order?.orderDetails || [];
};

const getPendingIncomingCountForToko = async (tokoId) => {
    return Order.count({
        where: {
            status: "pending",
            target_toko_id: tokoId,
        },
    });
};

const getPendingIncomingCountForSuperadmin = async () => {
    return Order.count({
        where: {
            status: "pending",
        },
    });
};

const buildDateRange = (dateString) => {
    if (!dateString) {
        return null;
    }

    const start = new Date(`${dateString}T00:00:00+07:00`);
    const end = new Date(`${dateString}T23:59:59.999+07:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return null;
    }

    return { start, end };
};

const buildNotification = (order, type, actorName = "") => {
    const sourceName = order?.source_toko?.nama_toko || "Toko asal";
    const targetName = order?.target_toko?.nama_toko || "Toko tujuan";
    const titleMap = {
        create: "Order Masuk Baru",
        approved: "Order Disetujui",
        rejected: "Order Ditolak",
    };

    const messageMap = {
        create: `${sourceName} mengirim order ${order.order_code} ke ${targetName}`,
        approved: `Order ${order.order_code} telah disetujui${actorName ? ` oleh ${actorName}` : ""}.`,
        rejected: `Order ${order.order_code} telah ditolak${actorName ? ` oleh ${actorName}` : ""}.`,
    };

    return {
        id: `${type}-${order.id}-${Date.now()}`,
        type: `order:${type}`,
        title: titleMap[type] || "Notifikasi Order",
        message: messageMap[type] || `Update order ${order.order_code}`,
        link: type === "create" ? "/order-masuk" : "/order",
        orderId: order.id,
        orderCode: order.order_code,
        status: order.status,
        createdAt: new Date().toISOString(),
    };
};

const createOrder = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { target_toko_id, items, note } = req.body;

        if (!req.user?.toko_id) {
            await t.rollback();
            return error(res, "User harus terhubung ke toko untuk membuat order", 400);
        }

        if (!target_toko_id) {
            await t.rollback();
            return error(res, "target_toko_id wajib diisi", 400);
        }

        if (target_toko_id === req.user.toko_id) {
            await t.rollback();
            return error(res, "Toko tujuan tidak boleh sama dengan toko asal", 400);
        }

        if (!Array.isArray(items) || items.length === 0) {
            await t.rollback();
            return error(res, "Items order tidak boleh kosong", 400);
        }

        const sourceToko = await Toko.findByPk(req.user.toko_id);
        const targetToko = await Toko.findByPk(target_toko_id);

        if (!sourceToko) {
            await t.rollback();
            return error(res, "Toko asal tidak ditemukan", 404);
        }

        if (!targetToko) {
            await t.rollback();
            return error(res, "Toko tujuan tidak ditemukan", 404);
        }

        let totalItem = 0;
        let totalQty = 0;
        let totalHarga = 0;

        const order = await Order.create(
            {
                order_code: buildOrderCode(),
                user_id: req.user.id,
                source_toko_id: req.user.toko_id,
                target_toko_id,
                status: "pending",
                note: note || null,
            },
            { transaction: t }
        );

        for (const item of items) {
            const qty = parseInt(item.qty, 10);
            if (!item.produk_id || !qty || qty < 1) {
                await t.rollback();
                return error(res, "Setiap item harus memiliki produk_id dan qty minimal 1", 400);
            }

            const produk = await Produk.findOne({
                where: {
                    id: item.produk_id,
                    toko_id: target_toko_id,
                },
            });

            if (!produk) {
                await t.rollback();
                return error(res, "Produk tidak ditemukan di toko tujuan", 404);
            }

            const harga = item.harga ? Number(item.harga) : Number(produk.harga_jual_biasa ?? produk.harga_jual_ritel ?? 0);
            const subtotal = harga * qty;

            totalItem += 1;
            totalQty += qty;
            totalHarga += subtotal;

            await OrderDetail.create(
                {
                    order_id: order.id,
                    produk_id: produk.id,
                    barcode: produk.barcode,
                    nama_produk: produk.nama_produk,
                    harga,
                    qty,
                    subtotal,
                },
                { transaction: t }
            );
        }

        await order.update(
            {
                total_item: totalItem,
                total_qty: totalQty,
                total_harga: totalHarga,
            },
            { transaction: t }
        );

        await t.commit();

        const created = await Order.findOne({
            where: { id: order.id },
            include: [
                { model: OrderDetail, include: [{ model: Produk }] },
                { model: Toko, as: "source_toko" },
                { model: Toko, as: "target_toko" },
            ],
        });

        const targetPendingCount = await getPendingIncomingCountForToko(target_toko_id);
        const superadminPendingCount = await getPendingIncomingCountForSuperadmin();
        const notification = buildNotification(created, "create", req.user.full_name || "");

        broadcastToToko(target_toko_id, {
            type: "notification",
            notification,
            incomingOrderCount: targetPendingCount,
        });

        broadcastToRole("superadmin", {
            type: "notification",
            notification,
            incomingOrderCount: superadminPendingCount,
        });

        broadcastToUser(req.user.id, {
            type: "notification",
            notification: {
                ...notification,
                title: "Order Berhasil Dikirim",
                message: `Order ${created.order_code} telah dikirim ke ${created.target_toko?.nama_toko || "toko tujuan"}.`,
                link: "/order",
            },
        });

        return success(res, "Order berhasil dibuat", created, 201);
    } catch (err) {
        await t.rollback();
        console.error(err);
        return error(res, "Gagal membuat order", 500, err.message);
    }
};

const getOrders = async (req, res) => {
    try {
        const {
            direction = "all",
            status,
            search = "",
            date = "",
            page,
            limit,
        } = req.query;

        const hasToko = Boolean(req.user?.toko_id);
        const usePagination = page !== undefined || limit !== undefined;
        const currentPage = Math.max(parseInt(page, 10) || 1, 1);
        const pageSize = Math.max(parseInt(limit, 10) || 10, 1);
        const offset = (currentPage - 1) * pageSize;
        const searchKeyword = search.toString().trim();
        const filters = [];

        if (req.user.role_name !== "superadmin") {
            if (direction === "incoming" && hasToko) {
                filters.push({ target_toko_id: req.user.toko_id });
            } else if (direction === "outgoing" && hasToko) {
                filters.push({ source_toko_id: req.user.toko_id });
            } else if (hasToko) {
                filters.push({
                    [Op.or]: [
                        { source_toko_id: req.user.toko_id },
                        { target_toko_id: req.user.toko_id },
                    ],
                });
            }
        } else if (direction === "incoming" && hasToko) {
            filters.push({ target_toko_id: req.user.toko_id });
        } else if (direction === "outgoing" && hasToko) {
            filters.push({ source_toko_id: req.user.toko_id });
        }

        if (status) {
            filters.push({ status });
        }

        const dateRange = buildDateRange(date);
        if (dateRange) {
            filters.push({
                createdAt: {
                    [Op.between]: [dateRange.start, dateRange.end],
                },
            });
        }

        if (searchKeyword) {
            const keyword = `%${searchKeyword}%`;
            filters.push({
                [Op.or]: [
                    { order_code: { [Op.like]: keyword } },
                    { note: { [Op.like]: keyword } },
                    sequelize.where(sequelize.col("source_toko.nama_toko"), {
                        [Op.like]: keyword,
                    }),
                    sequelize.where(sequelize.col("target_toko.nama_toko"), {
                        [Op.like]: keyword,
                    }),
                ],
            });
        }

        const where = filters.length === 0
            ? {}
            : filters.length === 1
                ? filters[0]
                : { [Op.and]: filters };

        const include = [
            { model: OrderDetail, include: [{ model: Produk }] },
            { model: Toko, as: "source_toko" },
            { model: Toko, as: "target_toko" },
        ];

        const findOptions = {
            where,
            include,
            order: [["createdAt", "DESC"]],
        };

        if (usePagination) {
            findOptions.limit = pageSize;
            findOptions.offset = offset;
        }

        const orders = await Order.findAll(findOptions);

        if (!usePagination) {
            return success(res, "Data order ditemukan", orders);
        }

        const totalData = await Order.count({
            where,
            include: [
                { model: Toko, as: "source_toko" },
                { model: Toko, as: "target_toko" },
            ],
            distinct: true,
            col: "id",
        });

        const totalPage = Math.max(Math.ceil(totalData / pageSize), 1);

        return success(res, "Data order ditemukan", {
            orders,
            currentPage,
            limit: pageSize,
            totalData,
            totalPage,
            hasNextPage: currentPage < totalPage,
            hasPrevPage: currentPage > 1,
        });
    } catch (err) {
        console.error(err);
        return error(res, "Gagal mengambil data order", 500, err.message);
    }
};

const approveOrder = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const submittedItems = Array.isArray(req.body?.items) ? req.body.items : [];
        const order = await Order.findOne({
            where: { id },
            include: [{ model: OrderDetail }],
        });

        if (!order) {
            await t.rollback();
            return error(res, "Order tidak ditemukan", 404);
        }

        if (req.user.role_name !== "superadmin" && req.user.toko_id !== order.target_toko_id) {
            await t.rollback();
            return error(res, "Hanya toko tujuan yang dapat menyetujui order ini", 403);
        }

        if (order.status !== "pending") {
            await t.rollback();
            return error(res, "Order sudah diproses", 400);
        }

        const sourceTokoId = order.source_toko_id;
        const targetTokoId = order.target_toko_id;
        const sourceToko = await Toko.findByPk(sourceTokoId);
        const targetToko = await Toko.findByPk(targetTokoId);

        if (!sourceToko || !targetToko) {
            await t.rollback();
            return error(res, "Data toko tidak ditemukan", 404);
        }

        const originalDetails = getOrderDetails(order);
        const itemsToProcess =
            submittedItems.length > 0
                ? submittedItems
                : originalDetails;

        if (!itemsToProcess.length) {
            await t.rollback();
            return error(res, "Order tidak memiliki item yang bisa diproses", 400);
        }

        const finalDetails = [];

        for (const item of itemsToProcess) {
            const qty = parseInt(item.qty, 10);
            if (!qty || qty < 1) {
                await t.rollback();
                return error(res, "Qty item tidak valid", 400);
            }

            const harga = Number(item.harga ?? 0);
            let produk = null;

            if (item.produk_id) {
                produk = await Produk.findOne({
                    where: {
                        id: item.produk_id,
                        toko_id: targetTokoId,
                    },
                });
            }

            if (!produk && item.barcode) {
                produk = await Produk.findOne({
                    where: {
                        barcode: item.barcode,
                        toko_id: targetTokoId,
                    },
                });
            }

            if (!produk) {
                await t.rollback();
                return error(res, `Produk ${item.nama_produk || item.barcode || ""} tidak ditemukan di toko tujuan`, 404);
            }

            const finalHarga = harga > 0 ? harga : Number(produk.harga_jual_biasa ?? produk.harga_jual_ritel ?? 0);
            const subtotal = finalHarga * qty;

            finalDetails.push({
                produk_id: produk.id,
                barcode: produk.barcode,
                nama_produk: produk.nama_produk,
                harga: finalHarga,
                qty,
                subtotal,
            });
        }

        if (finalDetails.length === 0) {
            await t.rollback();
            return error(res, "Order tidak boleh kosong", 400);
        }

        await OrderDetail.destroy({
            where: { order_id: order.id },
            transaction: t,
        });

        for (const detail of finalDetails) {
            await OrderDetail.create(
                {
                    order_id: order.id,
                    produk_id: detail.produk_id,
                    barcode: detail.barcode,
                    nama_produk: detail.nama_produk,
                    harga: detail.harga,
                    qty: detail.qty,
                    subtotal: detail.subtotal,
                },
                { transaction: t }
            );
        }

        let totalItem = 0;
        let totalQty = 0;
        let totalHarga = 0;

        for (const detail of finalDetails) {
            const targetProduk = await Produk.findOne({
                where: {
                    id: detail.produk_id,
                    toko_id: targetTokoId,
                },
            });

            if (!targetProduk) {
                await t.rollback();
                return error(res, `Produk ${detail.nama_produk} tidak ditemukan di toko tujuan`, 404);
            }

            if (Number(targetProduk.stok_produk) < Number(detail.qty)) {
                await t.rollback();
                return error(res, `Stok ${detail.nama_produk} di toko tujuan tidak cukup`, 400);
            }

            await targetProduk.update(
                {
                    stok_produk: Number(targetProduk.stok_produk) - Number(detail.qty),
                },
                { transaction: t }
            );

            const sourceProduk = await Produk.findOne({
                where: {
                    barcode: detail.barcode,
                    toko_id: sourceTokoId,
                },
            });

            if (sourceProduk) {
                await sourceProduk.update(
                    {
                        stok_produk: Number(sourceProduk.stok_produk) + Number(detail.qty),
                    },
                    { transaction: t }
                );
            } else {
                await Produk.create(
                    {
                        nama_produk: detail.nama_produk,
                        barcode: detail.barcode,
                        stok_produk: detail.qty,
                        harga_beli: detail.harga,
                        harga_jual_ritel: detail.harga,
                        harga_jual_biasa: detail.harga,
                        user_id: req.user.id,
                        toko_id: sourceTokoId,
                    },
                    { transaction: t }
                );
            }

            totalItem += 1;
            totalQty += Number(detail.qty);
            totalHarga += Number(detail.subtotal);
        }

        await order.update(
            {
                total_item: totalItem,
                total_qty: totalQty,
                total_harga: totalHarga,
                status: "approved",
                approved_by: req.user.id,
                approved_at: new Date(),
            },
            { transaction: t }
        );

        await t.commit();

        const updated = await Order.findOne({
            where: { id },
            include: [
                { model: OrderDetail, include: [{ model: Produk }] },
                { model: Toko, as: "source_toko" },
                { model: Toko, as: "target_toko" },
            ],
        });

        const targetPendingCount = await getPendingIncomingCountForToko(targetTokoId);
        const superadminPendingCount = await getPendingIncomingCountForSuperadmin();
        const actionType = updated.status === "approved" ? "approved" : "rejected";
        const notification = buildNotification(updated, actionType, req.user.full_name || "");

        broadcastToToko(targetTokoId, {
            type: "notification",
            notification,
            incomingOrderCount: targetPendingCount,
        });

        broadcastToRole("superadmin", {
            type: "notification",
            notification,
            incomingOrderCount: superadminPendingCount,
        });

        broadcastToToko(sourceTokoId, {
            type: "notification",
            notification: {
                ...notification,
                title: actionType === "approved" ? "Order Diterima" : "Order Ditolak",
                message:
                    actionType === "approved"
                        ? `Order ${updated.order_code} yang kamu kirim sudah disetujui.`
                        : `Order ${updated.order_code} yang kamu kirim sudah ditolak.`,
                link: "/order",
            },
        });

        return success(res, "Order berhasil disetujui", updated);
    } catch (err) {
        await t.rollback();
        console.error(err);
        return error(res, "Gagal menyetujui order", 500, err.message);
    }
};

const rejectOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findByPk(id);

        if (!order) {
            return error(res, "Order tidak ditemukan", 404);
        }

        if (req.user.role_name !== "superadmin" && req.user.toko_id !== order.target_toko_id) {
            return error(res, "Hanya toko tujuan yang dapat menolak order ini", 403);
        }

        if (order.status !== "pending") {
            return error(res, "Order sudah diproses", 400);
        }

        await order.update({
            status: "rejected",
            approved_by: req.user.id,
            approved_at: new Date(),
        });

        const updated = await Order.findOne({
            where: { id },
            include: [
                { model: OrderDetail, include: [{ model: Produk }] },
                { model: Toko, as: "source_toko" },
                { model: Toko, as: "target_toko" },
            ],
        });
        const targetPendingCount = await getPendingIncomingCountForToko(order.target_toko_id);
        const superadminPendingCount = await getPendingIncomingCountForSuperadmin();
        const notification = buildNotification(updated, "rejected", req.user.full_name || "");

        broadcastToToko(order.target_toko_id, {
            type: "notification",
            notification,
            incomingOrderCount: targetPendingCount,
        });

        broadcastToRole("superadmin", {
            type: "notification",
            notification,
            incomingOrderCount: superadminPendingCount,
        });

        broadcastToToko(order.source_toko_id, {
            type: "notification",
            notification: {
                ...notification,
                title: "Order Ditolak",
                message: `Order ${updated.order_code} yang kamu kirim sudah ditolak.`,
                link: "/order",
            },
        });

        return success(res, "Order berhasil ditolak", updated);
    } catch (err) {
        console.error(err);
        return error(res, "Gagal menolak order", 500, err.message);
    }
};

module.exports = {
    createOrder,
    getOrders,
    approveOrder,
    rejectOrder,
};
