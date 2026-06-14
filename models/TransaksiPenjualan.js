const { DataTypes } = require("sequelize");
const Db = require("../config/db");
const Pelanggan = require("./Pelanggan");
const Toko = require("./Toko");
const Order = require("./Order");
const TransaksiPenjualan = Db.define("transaksi_penjualan", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    toko_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    pelanggan_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    order_id: {
        type: DataTypes.UUID,
        allowNull: true,
        unique: true
    },
    total_item: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    total_qty: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    total_harga: {
        type: DataTypes.BIGINT,
        defaultValue: 0
    },
    total_bayar: {
        type: DataTypes.BIGINT,
        defaultValue: 0
    },
    sisa_hutang: {
        type: DataTypes.BIGINT,
        defaultValue: 0
    },
    total_kembalian: {
        type: DataTypes.BIGINT,
        defaultValue: 0
    }
});
TransaksiPenjualan.belongsTo(Pelanggan, {
    foreignKey: "pelanggan_id",
});

TransaksiPenjualan.belongsTo(Toko, {
    foreignKey: "toko_id",
});

TransaksiPenjualan.belongsTo(Order, {
    foreignKey: "order_id",
});

Toko.hasMany(TransaksiPenjualan, {
    foreignKey: "toko_id",
});




module.exports = TransaksiPenjualan;
