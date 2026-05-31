const EmailReportSetting = require("../models/EmailReportSetting");
const Produk = require("../models/Product");
const Toko = require("../models/Toko");
const { collectDailySalesReport } = require("../controllers/DashboardController");
const { buildDailySalesReportPdf } = require("../utils/pdfReport");
const { buildProdukWorkbookBuffer } = require("../utils/productExcelReport");
const { sendEmail } = require("../utils/mailer");

const SCHEDULE_KEY = "daily_report_email";
const JAKARTA_TIMEZONE = "Asia/Jakarta";
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

let activeTimer = null;
let sendingInProgress = false;

const getJakartaDateParts = (date = new Date()) => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: JAKARTA_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });

    const parts = formatter.formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return {
        year: Number(values.year),
        month: Number(values.month),
        day: Number(values.day)
    };
};

const formatJakartaDateStamp = (date = new Date()) => {
    const { year, month, day } = getJakartaDateParts(date);
    return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`;
};

const parseSendTime = (sendTime) => {
    const match = /^(\d{2}):(\d{2})$/.exec(String(sendTime || ""));
    if (!match) {
        return { hour: 22, minute: 0 };
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) {
        return { hour: 22, minute: 0 };
    }

    return { hour, minute };
};

const getNextRunDate = (sendTime, fromDate = new Date()) => {
    const { year, month, day } = getJakartaDateParts(fromDate);
    const { hour, minute } = parseSendTime(sendTime);

    const todayRun = new Date(Date.UTC(year, month - 1, day, hour, minute) - JAKARTA_OFFSET_MS);
    if (todayRun.getTime() > fromDate.getTime()) {
        return todayRun;
    }

    return new Date(Date.UTC(year, month - 1, day + 1, hour, minute) - JAKARTA_OFFSET_MS);
};

const getOrCreateSetting = async () => {
    const [setting] = await EmailReportSetting.findOrCreate({
        where: { setting_key: SCHEDULE_KEY },
        defaults: {
            setting_key: SCHEDULE_KEY,
            recipient_email: process.env.EMAIL_USER || null,
            send_time: "22:00",
            enabled: true
        }
    });

    if (!setting.recipient_email && process.env.EMAIL_USER) {
        await setting.update({ recipient_email: process.env.EMAIL_USER });
    }

    return setting;
};

const loadProductWorkbookBuffer = async () => {
    const [products, stores] = await Promise.all([
        Produk.findAll({
            include: [{
                model: Toko,
                attributes: ["id", "nama_toko"]
            }],
            order: [
                ["toko_id", "ASC"],
                ["nama_produk", "ASC"]
            ]
        }),
        Toko.findAll({
            attributes: ["id", "nama_toko"],
            order: [["nama_toko", "ASC"]]
        })
    ]);

    return buildProdukWorkbookBuffer({
        products,
        stores,
        includeAllStores: true
    });
};

const parseRecipients = (value) => String(value || "")
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);

const runDailyEmailJob = async () => {
    if (sendingInProgress) {
        console.log("[email-report] Job sebelumnya masih berjalan, dilewati.");
        return;
    }

    sendingInProgress = true;

    try {
        const setting = await getOrCreateSetting();
        if (!setting.enabled) {
            console.log("[email-report] Scheduler nonaktif.");
            return;
        }

        const recipients = parseRecipients(setting.recipient_email);
        const fallbackRecipients = recipients.length > 0 ? recipients : parseRecipients(process.env.EMAIL_USER);

        if (fallbackRecipients.length === 0) {
            throw new Error("Recipient email tidak ditemukan");
        }

        const report = await collectDailySalesReport({
            user: { role_name: "superadmin" },
            query: {}
        });

        const [pdfBuffer, produkWorkbookBuffer] = await Promise.all([
            Promise.resolve(buildDailySalesReportPdf(report)),
            loadProductWorkbookBuffer()
        ]);

        const fileDate = formatJakartaDateStamp(new Date());
        await sendEmail({
            to: fallbackRecipients,
            subject: `Laporan Otomatis POS - ${report.reportDateLabel}`,
            text: [
                `Halo,`,
                ``,
                `Berikut laporan otomatis POS untuk ${report.reportDateLabel}.`,
                `Terlampir PDF laporan penjualan harian dan Excel produk semua toko.`,
                ``,
                `Ringkasan:`,
                `- Total penjualan: Rp ${report.summary.totalSales.toLocaleString("id-ID")}`,
                `- Total transaksi: ${report.summary.totalTransactions}`,
                `- Toko aktif: ${report.summary.totalActiveStores}`,
                ``,
                `Email ini dikirim otomatis oleh sistem POS.`
            ].join("\n"),
            attachments: [
                {
                    filename: `laporan-penjualan-harian_${fileDate}.pdf`,
                    content: pdfBuffer,
                    contentType: "application/pdf"
                },
                {
                    filename: `produk_semua_toko_${fileDate}.xlsx`,
                    content: produkWorkbookBuffer,
                    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                }
            ]
        });

        await setting.update({ last_sent_at: new Date() });
        console.log(`[email-report] Email berhasil dikirim ke ${fallbackRecipients.join(", ")}`);
    } catch (err) {
        console.error("[email-report] Gagal mengirim email laporan:", err);
    } finally {
        sendingInProgress = false;
    }
};

const scheduleNextRun = async () => {
    const setting = await getOrCreateSetting();

    if (activeTimer) {
        clearTimeout(activeTimer);
        activeTimer = null;
    }

    if (!setting.enabled) {
        console.log("[email-report] Scheduler dinonaktifkan oleh setting.");
        return;
    }

    const nextRun = getNextRunDate(setting.send_time);
    const delay = Math.max(nextRun.getTime() - Date.now(), 1000);

    activeTimer = setTimeout(async () => {
        activeTimer = null;
        await runDailyEmailJob();
        await scheduleNextRun();
    }, delay);

    console.log(`[email-report] Jadwal berikutnya: ${nextRun.toISOString()} (${setting.send_time} WIB)`);
};

const initializeEmailReportScheduler = async () => {
    await scheduleNextRun();
};

const refreshEmailReportScheduler = async () => {
    await scheduleNextRun();
};

module.exports = {
    initializeEmailReportScheduler,
    refreshEmailReportScheduler,
    runDailyEmailJob,
    getOrCreateSetting
};
