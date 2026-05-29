const { DataTypes } = require("sequelize");
const Db = require("../config/db");
const User = require("./User");
const Toko = require("./Toko");

const Order = Db.define("orders", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    order_code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    source_toko_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    target_toko_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM("pending", "approved", "rejected", "completed"),
        allowNull: false,
        defaultValue: "pending"
    },
    note: {
        type: DataTypes.TEXT,
        allowNull: true
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
    approved_by: {
        type: DataTypes.UUID,
        allowNull: true
    },
    approved_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
});

Order.belongsTo(User, { foreignKey: "user_id" });
Order.belongsTo(Toko, { foreignKey: "source_toko_id", as: "source_toko" });
Order.belongsTo(Toko, { foreignKey: "target_toko_id", as: "target_toko" });
Order.belongsTo(User, { foreignKey: "approved_by", as: "approver" });

module.exports = Order;
