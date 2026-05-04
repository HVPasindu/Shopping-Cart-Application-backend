const express = require("express");

const { protect } = require("../middleware/authMiddleware");

const {
  addToCart,
  getMyCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
} = require("../controllers/cartController");

const router = express.Router();

// Customer cart routes
router.post("/add", protect, addToCart);
router.get("/", protect, getMyCart);
router.put("/items/:itemId", protect, updateCartItemQuantity);
router.delete("/items/:itemId", protect, removeCartItem);
router.delete("/clear", protect, clearCart);

module.exports = router;