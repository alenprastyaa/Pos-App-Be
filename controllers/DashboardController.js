const Produk = require("../models/Product");
const TransaksiPenjualan = require("../models/TransaksiPenjualan");
const Pelanggan = require("../models/Pelanggan");
const Toko = require("../models/Toko");
const { success, error } = require("../utils/response");
const { buildDailySalesReportPdf } = require("../utils/pdfReport");
const ExcelJS = require("exceljs");
const { Op, fn, col } = require("sequelize");

const JAKARTA_TIMEZONE = "Asia/Jakarta";
const DAY_MS = 24 * 60 * 60 * 1000;
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

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

const getJakartaDayRange = (date = new Date()) => {
    const { year, month, day } = getJakartaDateParts(date);
    const start = new Date(Date.UTC(year, month - 1, day) - JAKARTA_OFFSET_MS);
    const end = new Date(start.getTime() + DAY_MS);

    return { start, end };
};

const formatJakartaDateLabel = (date = new Date()) => new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TIMEZONE,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
}).format(date);

const formatJakartaDateTimeLabel = (date = new Date()) => new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TIMEZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
}).format(date);

const toNumber = (value) => Number(value || 0);

const formatDateRangeLabel = (start, end) => {
    const formatter = new Intl.DateTimeFormat("id-ID", {
        timeZone: JAKARTA_TIMEZONE,
        day: "2-digit",
        month: "long",
        year: "numeric"
    });

    const startLabel = formatter.format(start);
    const endLabel = formatter.format(end);
    return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
};

const parseJakartaDateInput = (value) => {
    if (!value) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const utc = Date.UTC(year, month - 1, day) - JAKARTA_OFFSET_MS;
    return new Date(utc);
};

const buildReportRange = (req) => {
    const startInput = parseJakartaDateInput(req.query.start_date);
    const endInput = parseJakartaDateInput(req.query.end_date);
    const todayRange = getJakartaDayRange();

    const start = startInput || todayRange.start;
    const endDay = endInput || (startInput || todayRange.start);

    if (start.getTime() > endDay.getTime()) {
        const error = new Error("Tanggal mulai tidak boleh lebih besar dari tanggal selesai.");
        error.statusCode = 400;
        throw error;
    }

    const end = new Date(endDay.getTime() + DAY_MS);

    return {
        start,
        end,
        startLabel: formatDateRangeLabel(start, start),
        endLabel: formatDateRangeLabel(endDay, endDay),
        rangeLabel: formatDateRangeLabel(start, endDay),
        generatedAtLabel: formatJakartaDateTimeLabel(),
        queryStart: req.query.start_date || null,
        queryEnd: req.query.end_date || null
    };
};

const getStoreScope = async (req) => {
    if (req.user.role_name === "superadmin") {
        return {
            tokoWhere: {},
            transaksiWhere: {}
        };
    }

    return {
        tokoWhere: { id: req.user.toko_id },
        transaksiWhere: { toko_id: req.user.toko_id }
    };
};

const getTokoFilter = (req) => {
    const filter = {};
    if (req.user.role_name !== "superadmin") {
        filter.toko_id = req.user.toko_id;
    }
    return filter;
};

const collectDailySalesReport = async (req) => {
    const range = buildReportRange(req);
    const scope = await getStoreScope(req);

    const [tokoList, aggregateRows] = await Promise.all([
        Toko.findAll({
            attributes: ["id", "nama_toko", "alamat"],
            where: scope.tokoWhere,
            order: [["nama_toko", "ASC"]]
        }),
        TransaksiPenjualan.findAll({
            where: {
                ...scope.transaksiWhere,
                createdAt: {
                    [Op.gte]: range.start,
                    [Op.lt]: range.end
                }
            },
            attributes: [
                "toko_id",
                [fn("COUNT", col("id")), "totalTransactions"],
                [fn("SUM", col("total_item")), "totalItem"],
                [fn("SUM", col("total_qty")), "totalQty"],
                [fn("SUM", col("total_harga")), "totalSales"],
                [fn("SUM", col("total_bayar")), "totalBayar"],
                [fn("SUM", col("sisa_hutang")), "totalSisaHutang"],
                [fn("SUM", col("total_kembalian")), "totalKembalian"]
            ],
            group: ["toko_id"],
            raw: true
        })
    ]);

    const aggregateMap = new Map(aggregateRows.map((row) => [row.toko_id, row]));

    const rows = tokoList.map((toko) => {
        const aggregate = aggregateMap.get(toko.id) || {};
        const totalTransactions = toNumber(aggregate.totalTransactions);
        const totalItem = toNumber(aggregate.totalItem);
        const totalQty = toNumber(aggregate.totalQty);
        const totalSales = toNumber(aggregate.totalSales);
        const totalBayar = toNumber(aggregate.totalBayar);
        const totalSisaHutang = toNumber(aggregate.totalSisaHutang);
        const totalKembalian = toNumber(aggregate.totalKembalian);

        return {
            tokoId: toko.id,
            namaToko: toko.nama_toko,
            alamatToko: toko.alamat,
            totalTransactions,
            totalItem,
            totalQty,
            totalSales,
            totalBayar,
            totalSisaHutang,
            totalKembalian
        };
    });

    const summary = rows.reduce((acc, row) => {
        acc.totalStores += 1;
        acc.totalTransactions += row.totalTransactions;
        acc.totalItem += row.totalItem;
        acc.totalQty += row.totalQty;
        acc.totalSales += row.totalSales;
        acc.totalBayar += row.totalBayar;
        acc.totalSisaHutang += row.totalSisaHutang;
        acc.totalKembalian += row.totalKembalian;
        if (row.totalTransactions > 0) {
            acc.totalActiveStores += 1;
        }
        if (acc.bestStoreName === "-" || row.totalSales > acc.bestStoreSales) {
            acc.bestStoreName = row.namaToko;
            acc.bestStoreSales = row.totalSales;
        }
        return acc;
    }, {
        totalStores: 0,
        totalActiveStores: 0,
        totalTransactions: 0,
        totalItem: 0,
        totalQty: 0,
        totalSales: 0,
        totalBayar: 0,
        totalSisaHutang: 0,
        totalKembalian: 0,
        bestStoreName: "-",
        bestStoreSales: 0
    });

    return {
        reportDateLabel: range.rangeLabel,
        reportDateRange: {
            start: range.startLabel,
            end: range.endLabel,
            queryStart: range.queryStart,
            queryEnd: range.queryEnd
        },
        generatedAtLabel: range.generatedAtLabel,
        rows,
        summary
    };
};

const escapeCsv = (value) => {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
};

const buildCsvReport = (report) => {
    const header = [
        "No",
        "Toko",
        "Alamat",
        "Transaksi",
        "Item",
        "Qty",
        "Omzet",
        "Bayar",
        "Sisa Hutang",
        "Kembalian"
    ];

    const lines = [
        `Laporan Penjualan Hari Ini,${escapeCsv(report.reportDateLabel)}`,
        `Dibuat Pada,${escapeCsv(report.generatedAtLabel)}`,
        "",
        header.join(","),
        ...report.rows.map((row, index) => [
            index + 1,
            escapeCsv(row.namaToko),
            escapeCsv(row.alamatToko),
            row.totalTransactions,
            row.totalItem,
            row.totalQty,
            row.totalSales,
            row.totalBayar,
            row.totalSisaHutang,
            row.totalKembalian
        ].map(escapeCsv).join(","))
    ];

    return `\ufeff${lines.join("\n")}`;
};

const getReportFileRangeSuffix = (report) => {
    const start = report?.reportDateRange?.queryStart;
    const end = report?.reportDateRange?.queryEnd;
    const toLocalFileDate = (value) => {
        if (!value) return null;
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
        if (!match) return String(value);
        return `${match[3]}-${match[2]}-${match[1]}`;
    };

    if (!start && !end) {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, "0");
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const year = now.getFullYear();
        return `${day}-${month}-${year}`;
    }

    if (start && end && start !== end) {
        return `${toLocalFileDate(start)}_sampai_${toLocalFileDate(end)}`;
    }

    return toLocalFileDate(start || end);
};

const setReportHeaders = (res, report, baseName, format) => {
    const safeName = `${baseName}_${getReportFileRangeSuffix(report)}`;
    res.setHeader("Cache-Control", "no-store");
    if (format === "pdf") {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${safeName}.pdf"`);
    } else if (format === "xlsx") {
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${safeName}.xlsx"`);
    } else if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${safeName}.csv"`);
    }
};

const writeWorkbook = async (report) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "POS System";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Laporan Harian", {
        views: [{ state: "frozen", ySplit: 5 }]
    });

    sheet.columns = [
        { key: "no", width: 6 },
        { key: "namaToko", width: 24 },
        { key: "alamatToko", width: 32 },
        { key: "totalTransactions", width: 12 },
        { key: "totalItem", width: 12 },
        { key: "totalQty", width: 12 },
        { key: "totalSales", width: 16 },
        { key: "totalBayar", width: 16 },
        { key: "totalSisaHutang", width: 16 },
        { key: "totalKembalian", width: 16 }
    ];

    sheet.insertRow(1, ["LAPORAN PENJUALAN HARI INI"]);
    sheet.insertRow(2, [report.reportDateLabel]);
    sheet.insertRow(3, [report.generatedAtLabel]);
    sheet.insertRow(4, []);
    sheet.mergeCells("A1:J1");
    sheet.mergeCells("A2:J2");
    sheet.mergeCells("A3:J3");

    [1, 2, 3].forEach((rowIndex) => {
        const row = sheet.getRow(rowIndex);
        row.font = rowIndex === 1 ? { bold: true, size: 16, color: { argb: "FF0F172A" } } : { italic: true, size: 10, color: { argb: "FF64748B" } };
        row.alignment = { vertical: "middle", horizontal: "left" };
    });

    const headerRow = sheet.getRow(5);
    headerRow.values = ["No", "Toko", "Alamat", "Transaksi", "Item", "Qty", "Omzet", "Bayar", "Sisa Hutang", "Kembalian"];
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F172A" }
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    report.rows.forEach((row, index) => {
        const excelRow = sheet.addRow({
            no: index + 1,
            namaToko: row.namaToko,
            alamatToko: row.alamatToko,
            totalTransactions: row.totalTransactions,
            totalItem: row.totalItem,
            totalQty: row.totalQty,
            totalSales: row.totalSales,
            totalBayar: row.totalBayar,
            totalSisaHutang: row.totalSisaHutang,
            totalKembalian: row.totalKembalian
        });
        excelRow.alignment = { vertical: "middle" };
        [7, 8, 9, 10].forEach((cellIndex) => {
            excelRow.getCell(cellIndex).numFmt = '#,##0';
        });
    });

    sheet.addRow([]);
    const summaryRow = sheet.addRow(["Ringkasan"]);
    summaryRow.font = { bold: true };
    sheet.addRow(["Total Toko", report.summary.totalStores]);
    sheet.addRow(["Toko Aktif", report.summary.totalActiveStores]);
    sheet.addRow(["Total Transaksi", report.summary.totalTransactions]);
    sheet.addRow(["Total Omzet", report.summary.totalSales]);

    sheet.columns.forEach((column) => {
        column.alignment = { vertical: "middle" };
    });

    return workbook.xlsx.writeBuffer();
};

const getDashboardSummary = async (req, res) => {
    try {
        const tokoFilter = getTokoFilter(req);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);

        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const yearStart = new Date(today.getFullYear(), 0, 1);

        const todayFilter = { ...tokoFilter, createdAt: { [Op.gte]: today } };
        const monthFilter = { ...tokoFilter, createdAt: { [Op.gte]: monthStart } };
        const yearFilter = { ...tokoFilter, createdAt: { [Op.gte]: yearStart } };
        const last7DaysFilter = { ...tokoFilter, createdAt: { [Op.gte]: sevenDaysAgo } };

        const totalStok = await Produk.sum("stok_produk", { where: tokoFilter }) || 0;
        const totalProduk = await Produk.count({ where: tokoFilter });
        const totalPenjualanHariIni = await TransaksiPenjualan.sum("total_harga", { where: todayFilter }) || 0;
        const totalTransaksiHariIni = await TransaksiPenjualan.count({ where: todayFilter });
        const totalPenjualanBulanIni = await TransaksiPenjualan.sum("total_harga", { where: monthFilter }) || 0;
        const totalPenjualanTahunIni = await TransaksiPenjualan.sum("total_harga", { where: yearFilter }) || 0;

        const totalPiutang = await Pelanggan.sum("hutang", { where: tokoFilter }) || 0;
        const totalPelanggan = await Pelanggan.count({ where: tokoFilter });
        const pelangganTerbaru = await Pelanggan.findAll({
            where: tokoFilter,
            limit: 5,
            order: [["createdAt", "DESC"]]
        });

        const transaksiTerakhir = await TransaksiPenjualan.findAll({
            where: tokoFilter,
            limit: 5,
            order: [["createdAt", "DESC"]],
            include: [{ model: Pelanggan, attributes: ["nama_pelanggan"] }]
        });

        const stokRendahFilter = { ...tokoFilter, stok_produk: { [Op.lt]: 10 } };
        const produkStokRendah = await Produk.findAll({
            where: stokRendahFilter,
            attributes: ["id", "nama_produk", "stok_produk"],
            limit: 5,
            order: [["stok_produk", "ASC"]]
        });

        const salesChartData = await TransaksiPenjualan.findAll({
            where: last7DaysFilter,
            attributes: [
                [fn("date_trunc", "day", col("createdAt")), "day"],
                [fn("sum", col("total_harga")), "totalSales"]
            ],
            group: ["day"],
            order: [["day", "ASC"]]
        });

        return success(res, "Data Dashboard berhasil diambil", {
            summary: {
                totalStok,
                totalProduk,
                totalPenjualanHariIni,
                totalTransaksiHariIni,
                totalPenjualanBulanIni,
                totalPenjualanTahunIni,
                totalPiutang,
                totalPelanggan
            },
            dataAktivitas: {
                transaksiTerakhir,
                produkStokRendah,
                pelangganTerbaru
            },
            salesChartData
        });
    } catch (err) {
        console.error(err);
        return error(res, "Gagal mengambil data dashboard", 500, err.message);
    }
};

const getDailySalesReport = async (req, res) => {
    try {
        const report = await collectDailySalesReport(req);
        return success(res, "Laporan penjualan harian berhasil diambil", report);
    } catch (err) {
        console.error(err);
        return error(res, err.message || "Gagal mengambil laporan penjualan harian", err.statusCode || 500, err.message);
    }
};

const downloadDailySalesReportPdf = async (req, res) => {
    try {
        const report = await collectDailySalesReport(req);
        const pdfBuffer = buildDailySalesReportPdf(report);
        setReportHeaders(res, report, "laporan-penjualan-harian", "pdf");
        return res.send(pdfBuffer);
    } catch (err) {
        console.error(err);
        return error(res, err.message || "Gagal membuat PDF laporan penjualan", err.statusCode || 500, err.message);
    }
};

const downloadDailySalesReportExcel = async (req, res) => {
    try {
        const report = await collectDailySalesReport(req);
        const buffer = await writeWorkbook(report);
        setReportHeaders(res, report, "laporan-penjualan-harian", "xlsx");
        return res.send(Buffer.from(buffer));
    } catch (err) {
        console.error(err);
        return error(res, err.message || "Gagal membuat Excel laporan penjualan", err.statusCode || 500, err.message);
    }
};

const downloadDailySalesReportCsv = async (req, res) => {
    try {
        const report = await collectDailySalesReport(req);
        setReportHeaders(res, report, "laporan-penjualan-harian", "csv");
        return res.send(buildCsvReport(report));
    } catch (err) {
        console.error(err);
        return error(res, err.message || "Gagal membuat CSV laporan penjualan", err.statusCode || 500, err.message);
    }
};

module.exports = {
    getDashboardSummary,
    collectDailySalesReport,
    getDailySalesReport,
    downloadDailySalesReportPdf,
    downloadDailySalesReportExcel,
    downloadDailySalesReportCsv
};
