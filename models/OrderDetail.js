const { DataTypes } = require("sequelize");
const Db = require("../config/db");
const Order = require("./Order");
const Produk = require("./Product");

const OrderDetail = Db.define("order_details", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    order_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    produk_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    barcode: {
        type: DataTypes.STRING,
        allowNull: false
    },
    nama_produk: {
        type: DataTypes.STRING,
        allowNull: false
    },
    harga: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    qty: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    subtotal: {
        type: DataTypes.BIGINT,
        allowNull: false
    }
});

Order.hasMany(OrderDetail, { foreignKey: "order_id" });
OrderDetail.belongsTo(Order, { foreignKey: "order_id" });
Produk.hasMany(OrderDetail, { foreignKey: "produk_id" });
OrderDetail.belongsTo(Produk, { foreignKey: "produk_id" });

module.exports = OrderDetail;
