const { DataTypes } = require("sequelize");
const Db = require("../config/db");
const Produk = require("./Product");
const TransaksiPenjualan = require("./TransaksiPenjualan");
const Pelanggan = require("./Pelanggan");
const TransaksiDetail = Db.define("transaksi_detail", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    transaksi_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    produk_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    pelanggan_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    barcode: {
        type: DataTypes.STRING,
        allowNull: false
    },
    harga: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    qty: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    subtotal: {
        type: DataTypes.BIGINT,
        allowNull: false
    }
});


TransaksiPenjualan.hasMany(TransaksiDetail, { foreignKey: "transaksi_id" });
TransaksiDetail.belongsTo(TransaksiPenjualan, { foreignKey: "transaksi_id" });

Produk.hasMany(TransaksiDetail, { foreignKey: "produk_id" });
TransaksiDetail.belongsTo(Produk, { foreignKey: "produk_id" });

Pelanggan.hasMany(TransaksiDetail, { foreignKey: "pelanggan_id" })
TransaksiDetail.belongsTo(Pelanggan, { foreignKey: "pelanggan_id" })

module.exports = TransaksiDetail;
