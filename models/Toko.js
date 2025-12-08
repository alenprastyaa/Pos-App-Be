const { DataTypes } = require("sequelize")
const Db = require("../config/db")


const Toko = Db.define("toko", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    nama_toko: {
        type: DataTypes.STRING,
        allowNull: false
    },
    alamat: {
        type: DataTypes.STRING,
        allowNull: false
    }
})

module.exports = Toko