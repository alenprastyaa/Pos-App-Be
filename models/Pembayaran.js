const { DataTypes } = require("sequelize");
const Db = require("../config/db");
const TransaksiPenjualan = require("./TransaksiPenjualan");
const Pelanggan = require("./Pelanggan");

const Pembayaran = Db.define("pembayaran", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    transaksi_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    pelanggan_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    total_bayar: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    uang_diterima: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    hutang: {
        type: DataTypes.BIGINT,
        defaultValue: 0
    },
    metode_pembayaran: {
        type: DataTypes.STRING,
        defaultValue: "cash"
    }
});

TransaksiPenjualan.hasOne(Pembayaran, { foreignKey: "transaksi_id" });
Pembayaran.belongsTo(TransaksiPenjualan, { foreignKey: "transaksi_id" });

Pelanggan.hasMany(Pembayaran, { foreignKey: "pelanggan_id" });
Pembayaran.belongsTo(Pelanggan, { foreignKey: "pelanggan_id" });

module.exports = Pembayaran;
