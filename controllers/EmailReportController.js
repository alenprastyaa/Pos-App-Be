const { success, error } = require("../utils/response");
const { refreshEmailReportScheduler, getOrCreateSetting } = require("../services/emailReportScheduler");

const parseBoolean = (value) => {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "yes", "on"].includes(normalized)) return true;
        if (["false", "0", "no", "off"].includes(normalized)) return false;
    }
    return Boolean(value);
};

const normalizeRecipientList = (value) => {
    if (Array.isArray(value)) {
        return value;
    }

    return String(value || "")
        .split(/[,\n;]/)
        .map((item) => item.trim())
        .filter(Boolean);
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const getEmailReportSetting = async (req, res) => {
    try {
        const setting = await getOrCreateSetting();
        return success(res, "Setting email laporan berhasil diambil", setting);
    } catch (err) {
        console.error(err);
        return error(res, "Gagal mengambil setting email laporan", 500, err.message);
    }
};

const updateEmailReportSetting = async (req, res) => {
    try {
        const { send_time, enabled, recipient_email } = req.body;

        const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (send_time !== undefined && !timePattern.test(String(send_time))) {
            return error(res, "Format send_time harus HH:mm", 400);
        }

        const recipients = recipient_email !== undefined ? normalizeRecipientList(recipient_email) : null;
        if (recipients && recipients.some((email) => !isValidEmail(email))) {
            return error(res, "Salah satu format email tujuan tidak valid", 400);
        }

        const setting = await getOrCreateSetting();
        await setting.update({
            send_time: send_time !== undefined ? send_time : setting.send_time,
            enabled: enabled !== undefined ? parseBoolean(enabled) : setting.enabled,
            recipient_email: recipient_email !== undefined ? recipients.join(", ") || null : setting.recipient_email,
            updated_at: new Date()
        });

        await refreshEmailReportScheduler();

        return success(res, "Setting email laporan berhasil diperbarui", setting);
    } catch (err) {
        console.error(err);
        return error(res, "Gagal memperbarui setting email laporan", 500, err.message);
    }
};

module.exports = {
    getEmailReportSetting,
    updateEmailReportSetting
};
