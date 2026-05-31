const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const EmailReportSetting = sequelize.define("email_report_settings", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    setting_key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        defaultValue: "daily_report_email"
    },
    recipient_email: {
        type: DataTypes.STRING,
        allowNull: true
    },
    send_time: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "22:00"
    },
    enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    last_sent_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    }
}, {
    tableName: "email_report_settings",
    timestamps: false,
});

module.exports = EmailReportSetting;
