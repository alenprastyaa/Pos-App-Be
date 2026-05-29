const router = require("express").Router();
const {
    createProduk,
    getAllProduk,
    getProdukById,
    getProdukByToko,
    updateProduk,
    deleteProduk,
    downloadProdukExcel,
    uploadExcelCreateProduk
} = require("../controllers/ProdukController");
const upload = require("../middleware/uploadExcel");

const { verifyToken, authorizeRole } = require("../middleware/verifyToken");


router.post("/", verifyToken, createProduk);
router.get("/", verifyToken, getAllProduk);
router.get("/toko/:tokoId", verifyToken, getProdukByToko);
router.get("/download/excel", verifyToken, downloadProdukExcel);
router.post("/excel/upload-excel", verifyToken, upload.single("file"), uploadExcelCreateProduk);
router.get("/:id", verifyToken, getProdukById);
router.put("/:id", verifyToken, updateProduk);
router.delete("/:id", verifyToken, deleteProduk);



module.exports = router;
