const router = require("express").Router();
const { verifyToken } = require("../middleware/verifyToken");
const {
    createOrder,
    getOrders,
    approveOrder,
    rejectOrder,
    reviseApprovedOrder,
} = require("../controllers/OrderController");

router.post("/", verifyToken, createOrder);
router.get("/", verifyToken, getOrders);
router.post("/:id/approve", verifyToken, approveOrder);
router.post("/:id/revise", verifyToken, reviseApprovedOrder);
router.post("/:id/reject", verifyToken, rejectOrder);

module.exports = router;
