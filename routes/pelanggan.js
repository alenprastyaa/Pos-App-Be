const router = require("express").Router();
const { verifyToken, authorizeRole } = require("../middleware/verifyToken");
const pelangganController = require("../controllers/pelangganController");

router.use(verifyToken);

router.post("/", authorizeRole("admin", "superadmin"), pelangganController.createPelanggan);
router.get("/", pelangganController.getAllPelanggan);
router.get("/:id", pelangganController.getPelangganById);
router.put("/:id", authorizeRole("admin", "superadmin"), pelangganController.updatePelanggan);
router.delete("/:id", authorizeRole("admin", "superadmin"), pelangganController.deletePelanggan);

module.exports = router;
