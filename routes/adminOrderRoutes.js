const express = require("express");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");

const {
  getAllOrdersForAdmin,
  getOrderByIdForAdmin,
  updateOrderStatusForAdmin,
} = require("../controllers/adminOrderController");

const router = express.Router();

router.get("/", protect, adminOnly, getAllOrdersForAdmin);
router.get("/:id", protect, adminOnly, getOrderByIdForAdmin);
router.put("/:id/status", protect, adminOnly, updateOrderStatusForAdmin);

module.exports = router;