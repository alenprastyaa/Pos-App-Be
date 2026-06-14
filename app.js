const express = require('express')
const app = express()
const bodyParser = require("body-parser");
const cors = require('cors')
const { DataTypes } = require("sequelize");
app.use(bodyParser.json());
const db = require("./config/db")
const port = 3900
app.use(express.json());
app.use(cors())
require("./models/EmailReportSetting");
const AuthRoutes = require('./routes/authRoutes')
const tokoRoute = require("./routes/tokoRoute");
const produkRoutes = require("./routes/ProdukRoutes")
const transaksiRoutes = require("./routes/transaksiRoutes")
const pelanggan = require("./routes/pelanggan")
const dashboard = require("./routes/dashboard")
const orderRoutes = require("./routes/orderRoutes")
const realtimeRoutes = require("./routes/realtimeRoutes")
const { initializeEmailReportScheduler } = require("./services/emailReportScheduler");
const TransaksiPenjualan = require("./models/TransaksiPenjualan");

const ensureOrderTransactionColumn = async () => {
    const queryInterface = db.getQueryInterface();
    const tableName = TransaksiPenjualan.getTableName();
    let table;

    try {
        table = await queryInterface.describeTable(tableName);
    } catch (error) {
        return;
    }

    if (!table.order_id) {
        await queryInterface.addColumn(tableName, "order_id", {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: "orders",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
        });
    }
};


const StartApp = async () => {
    try {
        await db.authenticate();
        await ensureOrderTransactionColumn();
        await db.sync();
        await initializeEmailReportScheduler();
        app.use("/user", AuthRoutes)
        app.use("/toko", tokoRoute);
        app.use("/produk", produkRoutes)
        app.use("/transaksi", transaksiRoutes)
        app.use("/pelanggan", pelanggan)
        app.use("/dashboard", dashboard)
        app.use("/order", orderRoutes)
        app.use("/realtime", realtimeRoutes)
        app.listen(port, () => {
            console.log("Aplikasi Berjalan di port : ", port);
        });
    } catch (error) {
        console.log(error)
    }
}

StartApp()
