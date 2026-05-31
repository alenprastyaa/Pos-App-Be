const express = require('express')
const app = express()
const bodyParser = require("body-parser");
const cors = require('cors')
app.use(bodyParser.json());
const db = require("./config/db")
const port = 3900
app.use(express.json());
app.use(cors())
const AuthRoutes = require('./routes/authRoutes')
const tokoRoute = require("./routes/tokoRoute");
const produkRoutes = require("./routes/ProdukRoutes")
const transaksiRoutes = require("./routes/transaksiRoutes")
const pelanggan = require("./routes/pelanggan")
const dashboard = require("./routes/dashboard")
const orderRoutes = require("./routes/orderRoutes")
const realtimeRoutes = require("./routes/realtimeRoutes")
// tes

const StartApp = async () => {
    try {
        await db.authenticate();
        await db.sync();
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
