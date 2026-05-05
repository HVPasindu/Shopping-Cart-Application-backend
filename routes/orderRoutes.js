const express = require("express");

const { protect } = require("../middleware/authMiddleware");

const {
  getOrderSummary,
  confirmOrder,
  getMyOrders,
  getOrderById,
  cancelMyOrder,
} = require("../controllers/orderController");

const router = express.Router();

// Customer order routes
router.get("/summary", protect, getOrderSummary);
router.post("/confirm", protect, confirmOrder);
router.get("/my-orders", protect, getMyOrders);

// Customer can cancel only own confirmed order
router.put("/:id/cancel", protect, cancelMyOrder);

// Single order details
router.get("/:id", protect, getOrderById);

module.exports = router;