const nodemailer = require("nodemailer");

let transporter = null;

const getTransporter = () => {
    if (transporter) {
        return transporter;
    }

    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
        throw new Error("EMAIL_USER dan EMAIL_PASS harus diisi di environment");
    }

    transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user,
            pass
        }
    });

    return transporter;
};

const normalizeRecipients = (to) => {
    if (Array.isArray(to)) {
        return to
            .map((value) => String(value).trim())
            .filter(Boolean);
    }

    return String(to || "")
        .split(/[,\n;]/)
        .map((value) => value.trim())
        .filter(Boolean);
};

const sendEmail = async ({ to, subject, text, html, attachments = [] }) => {
    const recipients = normalizeRecipients(to);
    if (recipients.length === 0) {
        throw new Error("Recipient email tidak ditemukan");
    }

    const transporterInstance = getTransporter();
    return transporterInstance.sendMail({
        from: process.env.EMAIL_USER,
        to: recipients,
        subject,
        text,
        html,
        attachments
    });
};

module.exports = {
    sendEmail
};
