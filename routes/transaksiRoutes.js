const router = require("express").Router();
const { verifyToken } = require("../middleware/verifyToken");
const { scanBarcode, createTransaksi, getAllTransaksi, getTransaksiById, createTransaksiReguler } = require("../controllers/Transaksi");

router.post("/scan", verifyToken, scanBarcode);
router.post("/create/ritel", verifyToken, createTransaksi);
router.post("/create/reguler", verifyToken, createTransaksiReguler);
router.get("/", verifyToken, getAllTransaksi);
router.get("/:id", verifyToken, getTransaksiById);

module.exports = router;
