const ExcelJS = require("exceljs");

const BASE_COLUMNS = [
    { header: "nama_produk", key: "nama_produk", width: 25 },
    { header: "barcode", key: "barcode", width: 20 },
    { header: "stok_produk", key: "stok_produk", width: 15 },
    { header: "harga_beli", key: "harga_beli", width: 15 },
    { header: "harga_jual_ritel", key: "harga_jual_ritel", width: 20 },
    { header: "harga_jual_biasa", key: "harga_jual_biasa", width: 20 },
];

const sanitizeSheetName = (name) => {
    const safe = String(name || "Toko")
        .replace(/[\\/:*?\[\]]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return safe.slice(0, 31) || "Toko";
};

const getUniqueSheetName = (name, existingNames) => {
    const baseName = sanitizeSheetName(name);
    let candidate = baseName;
    let suffix = 1;
    while (existingNames.has(candidate)) {
        const suffixText = `_${suffix}`;
        candidate = `${baseName.slice(0, 31 - suffixText.length)}${suffixText}`;
        suffix += 1;
    }
    existingNames.add(candidate);
    return candidate;
};

const applyWorksheetStyling = (worksheet) => {
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.eachCell((cell) => {
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF0F172A" }
        };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
            row.alignment = { vertical: "middle" };
        }
    });
};

const createSheetWithProducts = (workbook, sheetName, produkRows) => {
    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.columns = BASE_COLUMNS;

    produkRows.forEach((produk) => {
        worksheet.addRow({
            nama_produk: produk.nama_produk,
            barcode: produk.barcode,
            stok_produk: produk.stok_produk,
            harga_beli: produk.harga_beli,
            harga_jual_ritel: produk.harga_jual_ritel,
            harga_jual_biasa: produk.harga_jual_biasa,
        });
    });

    if (produkRows.length === 0) {
        worksheet.addRow({
            nama_produk: "Belum ada produk",
            barcode: "",
            stok_produk: "",
            harga_beli: "",
            harga_jual_ritel: "",
            harga_jual_biasa: "",
        });
    }

    applyWorksheetStyling(worksheet);
    return worksheet;
};

const buildProdukWorkbookBuffer = async ({ products = [], stores = [], includeAllStores = false }) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "POS System";
    workbook.created = new Date();

    if (includeAllStores) {
        const groupedByStore = new Map();
        products.forEach((product) => {
            const storeName = product.toko?.nama_toko || "Toko";
            const storeId = product.toko_id || "unknown";
            if (!groupedByStore.has(storeId)) {
                groupedByStore.set(storeId, { name: storeName, rows: [] });
            }
            groupedByStore.get(storeId).rows.push(product);
        });

        groupedByStore.forEach((group) => {
            group.rows.sort((a, b) => a.nama_produk.localeCompare(b.nama_produk, "id"));
        });

        const usedSheetNames = new Set();
        stores.forEach((store) => {
            const group = groupedByStore.get(store.id) || { name: store.nama_toko, rows: [] };
            createSheetWithProducts(workbook, getUniqueSheetName(group.name, usedSheetNames), group.rows);
        });

        if (stores.length === 0) {
            createSheetWithProducts(workbook, getUniqueSheetName("Tidak Ada Data", new Set()), []);
        }
    } else {
        createSheetWithProducts(workbook, "Produk", products);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
};

module.exports = {
    buildProdukWorkbookBuffer
};
