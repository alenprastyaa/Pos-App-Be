const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const Toko = require("./Toko");

const User = sequelize.define("users", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    toko_id: {
        type: DataTypes.UUID
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: "active"
    },
    full_name: DataTypes.STRING,
    email: DataTypes.STRING,
    password: DataTypes.STRING,
    role_name: {
        type: DataTypes.ENUM({
            values: ["superadmin", "admin"],
            name: "role_enum_custom"
        }),
        allowNull: false
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: "users",
    timestamps: false,
});


User.belongsTo(Toko, { foreignKey: "toko_id" });
Toko.hasMany(User, { foreignKey: "toko_id" });


module.exports = User;
