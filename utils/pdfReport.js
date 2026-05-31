const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 32;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

const COLORS = {
    navy: [15, 23, 42],
    navyMid: [30, 41, 59],
    navyLight: [51, 65, 85],
    blue: [37, 99, 235],
    blueLight: [96, 165, 250],
    sky: [14, 165, 233],
    emerald: [16, 185, 129],
    amber: [245, 158, 11],
    violet: [124, 58, 237],
    gray: [100, 116, 139],
    grayLight: [148, 163, 184],
    slate: [71, 85, 105],
    border: [226, 232, 240],
    surface: [248, 250, 252],
    surfaceAlt: [241, 245, 249],
    white: [255, 255, 255],
    greenBg: [220, 252, 231],
    greenText: [21, 128, 61],
    grayBg: [241, 245, 249],
    slateText: [100, 116, 139]
};

const escapePdfText = (text) => String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");

const rgb = ([r, g, b]) => `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`;

const formatCurrency = (value) => {
    const numeric = Number(value || 0);
    return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(numeric)}`;
};

const formatNumber = (value) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(value || 0));

const truncateText = (text, maxLength) => {
    const value = String(text ?? "");
    if (value.length <= maxLength) return value;
    return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const createPage = () => ({ ops: [] });

const drawRect = (page, x, yTop, width, height, options = {}) => {
    const { fill = null, stroke = null, strokeWidth = 1 } = options;
    const y = PAGE_HEIGHT - yTop - height;
    const commands = [];
    if (fill) commands.push(`${rgb(fill)} rg`);
    if (stroke) {
        commands.push(`${rgb(stroke)} RG`);
        commands.push(`${strokeWidth} w`);
    }
    if (fill && stroke) {
        commands.push(`${x} ${y} ${width} ${height} re B`);
    } else if (fill) {
        commands.push(`${x} ${y} ${width} ${height} re f`);
    } else if (stroke) {
        commands.push(`${x} ${y} ${width} ${height} re S`);
    }
    page.ops.push(commands.join("\n"));
};

const drawLine = (page, x1, y1, x2, y2, options = {}) => {
    const { color = COLORS.border, width = 1 } = options;
    page.ops.push([
        `${rgb(color)} RG`,
        `${width} w`,
        `${x1} ${PAGE_HEIGHT - y1} m`,
        `${x2} ${PAGE_HEIGHT - y2} l`,
        "S"
    ].join("\n"));
};

const drawText = (page, text, x, yTop, options = {}) => {
    const { size = 12, font = "F1", color = COLORS.navy, align = "left" } = options;
    const value = String(text ?? "");
    const approximateWidth = size * 0.52 * value.length;
    let targetX = x;
    if (align === "center") targetX = x - (approximateWidth / 2);
    else if (align === "right") targetX = x - approximateWidth;
    const y = PAGE_HEIGHT - yTop - size;
    page.ops.push([
        `${rgb(color)} rg`,
        "BT",
        `/${font} ${size} Tf`,
        `1 0 0 1 ${targetX.toFixed(2)} ${y.toFixed(2)} Tm`,
        `(${escapePdfText(value)}) Tj`,
        "ET"
    ].join("\n"));
};

const drawKpiCard = (page, x, y, width, height, title, value, subtitle, accent, valueSize = 17) => {
    drawRect(page, x, y, width, height, {
        fill: COLORS.white,
        stroke: COLORS.border,
        strokeWidth: 0.8
    });
    drawRect(page, x, y, width, 26, { fill: accent });
    drawText(page, title, x + 12, y + 8, { size: 8, font: "F2", color: COLORS.white });
    drawText(page, value, x + 12, y + 34, { size: valueSize, font: "F2", color: COLORS.navy });
    drawText(page, subtitle, x + 12, y + 56, { size: 8, color: COLORS.gray });
};

const drawTableHeader = (page, y) => {
    drawRect(page, MARGIN, y, CONTENT_WIDTH, 22, { fill: COLORS.surfaceAlt });
    drawRect(page, MARGIN, y, 4, 22, { fill: COLORS.blue });
    drawText(page, "TOKO", MARGIN + 12, y + 7, { size: 8, font: "F2", color: COLORS.slate });
    drawText(page, "TRX", PAGE_WIDTH - MARGIN - 112, y + 7, { size: 8, font: "F2", color: COLORS.slate, align: "right" });
    drawText(page, "OMZET", PAGE_WIDTH - MARGIN - 10, y + 7, { size: 8, font: "F2", color: COLORS.slate, align: "right" });
};

const createFonts = () => [
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
];

const buildPageStream = (page) => page.ops.filter(Boolean).join("\n");

const buildPdfBuffer = (pages) => {
    const objects = [];
    const offsets = [0];

    const addObject = (content) => {
        const id = objects.length + 1;
        objects.push(content);
        return id;
    };

    const fontRegularId = addObject(createFonts()[0]);
    const fontBoldId = addObject(createFonts()[1]);

    const contentIds = [];
    pages.forEach((page) => {
        const stream = buildPageStream(page);
        const contentId = addObject(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
        contentIds.push(contentId);
    });

    const pagesTreeId = objects.length + 1;
    const pageIds = pages.map((_, index) => pagesTreeId + 1 + index);
    addObject(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);

    pages.forEach((page, index) => {
        const contentId = contentIds[index];
        addObject([
            "<< /Type /Page",
            `/Parent ${pagesTreeId} 0 R`,
            `/MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]`,
            `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >>`,
            `/Contents ${contentId} 0 R >>`
        ].join(" "));
    });

    const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesTreeId} 0 R >>`);

    let pdf = "%PDF-1.4\n";
    objects.forEach((object, index) => {
        const id = index + 1;
        offsets[id] = Buffer.byteLength(pdf);
        pdf += `${id} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    for (let i = 1; i <= objects.length; i += 1) {
        pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, "utf8");
};

// ─── First page header ──────────────────────────────────────────────────────

const renderFirstPageHeader = (page, report) => {
    // Hero banner
    drawRect(page, MARGIN, 20, CONTENT_WIDTH, 110, { fill: COLORS.navy });
    drawRect(page, PAGE_WIDTH - MARGIN - 162, 20, 162, 110, { fill: COLORS.navyMid });
    drawRect(page, MARGIN, 130, CONTENT_WIDTH, 5, { fill: COLORS.blue });

    drawText(page, "LAPORAN PENJUALAN", MARGIN + 18, 38, { size: 18, font: "F2", color: COLORS.white });
    drawText(page, "HARI INI", MARGIN + 18, 59, { size: 18, font: "F2", color: COLORS.blueLight });
    drawText(page, "Ringkasan transaksi harian seluruh toko", MARGIN + 18, 90, {
        size: 9, color: [203, 213, 225]
    });

    // Date card (inside right panel)
    drawRect(page, PAGE_WIDTH - MARGIN - 148, 32, 132, 82, { fill: COLORS.navyLight });
    drawText(page, "DIBUAT OTOMATIS", PAGE_WIDTH - MARGIN - 82, 42, {
        size: 7, font: "F2", color: COLORS.blueLight, align: "center"
    });
    drawLine(page, PAGE_WIDTH - MARGIN - 144, 54, PAGE_WIDTH - MARGIN - 20, 54, {
        color: COLORS.navyMid, width: 0.6
    });
    drawText(page, report.reportDateLabel, PAGE_WIDTH - MARGIN - 22, 62, {
        size: 10, font: "F2", color: COLORS.white, align: "right"
    });
    drawText(page, report.generatedAtLabel, PAGE_WIDTH - MARGIN - 22, 78, {
        size: 8, color: COLORS.grayLight, align: "right"
    });

    // KPI cards — 2×2 grid
    const kpiGap = 10;
    const kpiW = Math.floor((CONTENT_WIDTH - kpiGap) / 2);
    const kpiH = 72;
    const kpiStartY = 148;

    const kpiCards = [
        {
            title: "TOTAL PENJUALAN",
            value: formatCurrency(report.summary.totalSales),
            sub: `${formatNumber(report.summary.totalTransactions)} transaksi`,
            accent: COLORS.blue,
            valueSize: 15
        },
        {
            title: "TOTAL TRANSAKSI",
            value: formatNumber(report.summary.totalTransactions),
            sub: `${formatNumber(report.summary.totalActiveStores)} toko aktif`,
            accent: COLORS.emerald
        },
        {
            title: "TOKO AKTIF",
            value: `${formatNumber(report.summary.totalActiveStores)} / ${formatNumber(report.summary.totalStores)}`,
            sub: "toko beroperasi hari ini",
            accent: COLORS.amber
        },
        {
            title: "TOKO TERBAIK",
            value: truncateText(report.summary.bestStoreName || "-", 22),
            sub: formatCurrency(report.summary.bestStoreSales),
            accent: COLORS.violet,
            valueSize: 12
        }
    ];

    kpiCards.forEach((card, i) => {
        const x = MARGIN + (i % 2) * (kpiW + kpiGap);
        const y = kpiStartY + Math.floor(i / 2) * (kpiH + kpiGap);
        drawKpiCard(page, x, y, kpiW, kpiH, card.title, card.value, card.sub, card.accent, card.valueSize);
    });

    // Section label with accent mark
    // kpiStartY + 2 rows + 1 internal gap + spacing = 148 + 144 + 10 + 16 = 318
    const sectionY = kpiStartY + (2 * kpiH) + kpiGap + 16;
    drawRect(page, MARGIN, sectionY + 2, 4, 10, { fill: COLORS.blue });
    drawText(page, "RINCIAN PER TOKO", MARGIN + 10, sectionY, { size: 11, font: "F2", color: COLORS.navy });
    drawText(page, "Data lengkap setiap gerai", MARGIN + 10, sectionY + 16, { size: 8, color: COLORS.gray });

    // Table column header bar — tableY = sectionY + 32 = 350
    drawTableHeader(page, sectionY + 32);
};

// ─── Continuation page header ────────────────────────────────────────────────

const renderContinuationHeader = (page, report, pageIndex) => {
    drawRect(page, MARGIN, 18, CONTENT_WIDTH, 4, { fill: COLORS.blue });

    drawText(page, "LAPORAN PENJUALAN HARI INI", MARGIN, 32, { size: 13, font: "F2", color: COLORS.navy });
    drawText(page, `Lanjutan — Halaman ${pageIndex + 1}`, PAGE_WIDTH - MARGIN, 32, {
        size: 8, color: COLORS.gray, align: "right"
    });
    drawText(page, report.reportDateLabel, PAGE_WIDTH - MARGIN, 46, {
        size: 8, font: "F2", color: COLORS.slate, align: "right"
    });

    drawTableHeader(page, 60);
};

// ─── Store card ───────────────────────────────────────────────────────────────

const renderStoreCard = (page, row, rowIndex, yTop) => {
    const CARD_H = 118;
    const isActive = row.totalTransactions > 0;
    const accentColor = isActive ? COLORS.emerald : COLORS.blue;

    // Card shell
    drawRect(page, MARGIN, yTop, CONTENT_WIDTH, CARD_H, {
        fill: COLORS.white,
        stroke: COLORS.border,
        strokeWidth: 0.8
    });
    drawRect(page, MARGIN, yTop, 6, CARD_H, { fill: accentColor });

    // Store number badge
    const badgeX = MARGIN + 12;
    const badgeY = yTop + 14;
    drawRect(page, badgeX, badgeY, 24, 24, { fill: COLORS.navyMid });
    drawText(page, String(rowIndex + 1).padStart(2, "0"), badgeX + 12, badgeY + 7, {
        size: 8, font: "F2", color: COLORS.white, align: "center"
    });

    // Status badge
    const statusText = isActive ? "AKTIF" : "TUTUP";
    const statusBg = isActive ? COLORS.greenBg : COLORS.grayBg;
    const statusColor = isActive ? COLORS.greenText : COLORS.slateText;
    const statusW = 42;
    const statusX = MARGIN + CONTENT_WIDTH - statusW - 10;
    drawRect(page, statusX, yTop + 14, statusW, 16, { fill: statusBg });
    drawText(page, statusText, statusX + (statusW / 2), yTop + 19, {
        size: 7, font: "F2", color: statusColor, align: "center"
    });

    // Store info
    drawText(page, truncateText(row.namaToko, 30), MARGIN + 44, yTop + 16, {
        size: 14, font: "F2", color: COLORS.navy
    });
    drawText(page, truncateText(row.alamatToko || "-", 52), MARGIN + 44, yTop + 33, {
        size: 9, color: COLORS.gray
    });
    drawText(page, `${formatNumber(row.totalTransactions)} transaksi tercatat`, MARGIN + 44, yTop + 47, {
        size: 8, color: COLORS.grayLight
    });

    // Separator before metrics
    drawLine(page, MARGIN + 8, yTop + 63, MARGIN + CONTENT_WIDTH - 8, yTop + 63, {
        color: COLORS.border, width: 0.5
    });

    // Metrics panel
    const metricsY = yTop + 66;
    const metricsH = CARD_H - 66;
    drawRect(page, MARGIN, metricsY, CONTENT_WIDTH, metricsH, { fill: COLORS.surface });

    const halfW = CONTENT_WIDTH / 2;

    drawText(page, "TRANSAKSI", MARGIN + 14, metricsY + 8, { size: 7, font: "F2", color: COLORS.sky });
    drawText(page, formatNumber(row.totalTransactions), MARGIN + 14, metricsY + 22, {
        size: 16, font: "F2", color: COLORS.navy
    });

    const divX = MARGIN + halfW;
    drawLine(page, divX, metricsY + 4, divX, metricsY + metricsH - 4, {
        color: COLORS.border, width: 0.8
    });

    drawText(page, "OMZET", divX + 14, metricsY + 8, { size: 7, font: "F2", color: COLORS.blue });
    drawText(page, formatCurrency(row.totalSales), divX + 14, metricsY + 22, {
        size: 13, font: "F2", color: COLORS.navy
    });

    return CARD_H;
};

// ─── Build PDF ────────────────────────────────────────────────────────────────

const buildDailySalesReportPdf = (report) => {
    const CARD_H = 118;
    const CARD_GAP = 8;
    const FOOTER_SAFE = 800;

    // First page store cards start at y=378 (table header ends at 372, +6 gap)
    const FIRST_PAGE_START_Y = 378;
    // Continuation page store cards start at y=86 (table header ends at 82, +4 gap)
    const CONT_PAGE_START_Y = 86;

    const pages = [];
    let page = createPage();
    let currentY = FIRST_PAGE_START_Y;
    let pageIndex = 0;

    renderFirstPageHeader(page, report);

    report.rows.forEach((row, index) => {
        if (currentY + CARD_H > FOOTER_SAFE) {
            pages.push(page);
            page = createPage();
            pageIndex += 1;
            renderContinuationHeader(page, report, pageIndex);
            currentY = CONT_PAGE_START_Y;
        }

        renderStoreCard(page, row, index, currentY);
        currentY += CARD_H + CARD_GAP;
    });

    pages.push(page);

    // Footer on every page
    pages.forEach((pageItem, index) => {
        drawLine(pageItem, MARGIN, 808, PAGE_WIDTH - MARGIN, 808, { color: COLORS.border, width: 0.8 });
        drawRect(pageItem, MARGIN, 810, CONTENT_WIDTH, 18, { fill: COLORS.surfaceAlt });
        drawText(pageItem, "Dihasilkan otomatis oleh sistem POS", MARGIN + 8, 816, { size: 7, color: COLORS.gray });
        drawText(pageItem, `Halaman ${index + 1} dari ${pages.length}`, PAGE_WIDTH - MARGIN - 8, 816, {
            size: 7, font: "F2", color: COLORS.slate, align: "right"
        });
    });

    return buildPdfBuffer(pages);
};

module.exports = {
    buildDailySalesReportPdf,
    formatCurrency,
    formatNumber
};
