const { DataTypes } = require('sequelize')
const Db = require("../config/db")
const User = require('./User')
const Toko = require('./Toko')

const Produk = Db.define("produk", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    nama_produk: {
        type: DataTypes.STRING,
        allowNull: false
    },
    barcode: {
        type: DataTypes.STRING,
        allowNull: false
    },
    stok_produk: {
        type: DataTypes.INTEGER
    },
    harga_beli: {
        type: DataTypes.BIGINT
    },
    harga_jual_ritel: {
        type: DataTypes.BIGINT
    },
    harga_jual_biasa: {
        type: DataTypes.BIGINT
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    toko_id: {
        type: DataTypes.UUID,
        allowNull: false,
    }

})

User.hasMany(Produk, { foreignKey: "user_id" })
Produk.belongsTo(User, { foreignKey: "user_id" })


Toko.hasMany(Produk, { foreignKey: "toko_id" })
Produk.belongsTo(Toko, { foreignKey: "toko_id" })
module.exports = Produk