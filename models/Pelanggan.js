const { DataTypes } = require("sequelize");
const Db = require("../config/db");
const User = require("./User");
const Toko = require("./Toko");
const TransaksiPenjualan = require("./TransaksiPenjualan");

const Pelanggan = Db.define("pelanggan", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    nama_pelanggan: {
        type: DataTypes.STRING,
        allowNull: false
    },
    alamat: {
        type: DataTypes.STRING
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    toko_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    hutang: {
        type: DataTypes.BIGINT,
        defaultValue: 0
    }
});



User.hasMany(Pelanggan, { foreignKey: "user_id" });
Pelanggan.belongsTo(User, { foreignKey: "user_id" });

Toko.hasMany(Pelanggan, { foreignKey: "toko_id" });
Pelanggan.belongsTo(Toko, { foreignKey: "toko_id" });

module.exports = Pelanggan;
