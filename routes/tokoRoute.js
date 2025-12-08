const router = require("express").Router();
const {
    createToko,
    getAllToko,
    getTokoById,
    updateToko,
    deleteToko
} = require("../controllers/tokoController");
const { verifyToken } = require("../middleware/verifyToken");


router.post("/", verifyToken, createToko);
router.get("/", verifyToken, getAllToko);
router.get("/:id", verifyToken, getTokoById);
router.put("/:id", verifyToken, updateToko);
router.delete("/:id", verifyToken, deleteToko);

module.exports = router;
