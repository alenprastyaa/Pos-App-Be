const router = require("express").Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Toko = require("../models/Toko");
const Order = require("../models/Order");
const OrderDetail = require("../models/OrderDetail");
const Produk = require("../models/Product");
const { addClient, removeClient } = require("../utils/realtimeHub");

const buildOrderNotification = (order, prefix = "pending") => {
    const sourceName = order?.source_toko?.nama_toko || "Toko asal";
    const targetName = order?.target_toko?.nama_toko || "Toko tujuan";
    const source = sourceName && sourceName !== "Toko asal" ? sourceName : "Toko asal";
    const target = targetName && targetName !== "Toko tujuan" ? targetName : "Toko tujuan";

    const statusLabel = order?.status === "approved"
        ? "disetujui"
        : order?.status === "rejected"
            ? "ditolak"
            : "masuk";

    return {
        id: `${prefix}-${order.id}`,
        type: `order:${order.status === "pending" ? "new" : "updated"}`,
        title: order.status === "pending" ? "Order Masuk Baru" : `Order ${order.status === "approved" ? "Disetujui" : "Ditolak"}`,
        message: order.status === "pending"
            ? `${source} mengirim order ${order.order_code} ke ${target}`
            : `Order ${order.order_code} telah ${statusLabel}.`,
        link: order.status === "pending" ? "/order-masuk" : "/order",
        orderId: order.id,
        orderCode: order.order_code,
        status: order.status,
        createdAt: order.createdAt,
    };
};

const buildScopeWhere = (user) => {
    if (user.role_name === "superadmin") {
        return { status: "pending" };
    }

    return {
        status: "pending",
        target_toko_id: user.toko_id,
    };
};

const buildSnapshot = async (user) => {
    const where = buildScopeWhere(user);

    const pendingIncomingCount = await Order.count({ where });
    const orders = await Order.findAll({
        where,
        include: [
            { model: OrderDetail, include: [{ model: Produk }] },
            { model: Toko, as: "source_toko" },
            { model: Toko, as: "target_toko" },
        ],
        order: [["createdAt", "DESC"]],
        limit: 8,
    });

    return {
        incomingOrderCount: pendingIncomingCount,
        unreadCount: pendingIncomingCount,
        notifications: orders.map((order) => buildOrderNotification(order, "snapshot")),
    };
};

router.get("/stream", async (req, res) => {
    try {
        const token = req.query.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Token tidak ditemukan",
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({
            where: { id: decoded.id },
            attributes: { exclude: ["password"] },
            include: [{ model: Toko }],
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User tidak ditemukan",
            });
        }

        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": req.headers.origin || "*",
            "Access-Control-Allow-Credentials": "true",
        });

        if (typeof res.flushHeaders === "function") {
            res.flushHeaders();
        }

        res.write(`retry: 5000\n\n`);

        const client = {
            res,
            userId: user.id,
            tokoId: user.toko_id,
            roleName: user.role_name,
        };

        addClient(client);

        const snapshot = await buildSnapshot(user);
        res.write(`data: ${JSON.stringify({ type: "snapshot", ...snapshot })}\n\n`);

        const heartbeat = setInterval(() => {
            if (res.destroyed || res.writableEnded) {
                clearInterval(heartbeat);
                removeClient(res);
                return;
            }
            res.write(": ping\n\n");
        }, 25000);

        req.on("close", () => {
            clearInterval(heartbeat);
            removeClient(res);
            if (!res.writableEnded) {
                res.end();
            }
        });
    } catch (error) {
        console.error("SSE stream error:", error);
        if (!res.headersSent) {
            return res.status(401).json({
                success: false,
                message: "Token tidak valid atau sudah kadaluarsa",
            });
        }
        res.end();
    }
});

module.exports = router;
