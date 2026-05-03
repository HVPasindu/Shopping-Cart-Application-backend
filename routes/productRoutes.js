const express = require("express");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");
const { uploadProductImages } = require("../middleware/upload");

const {
  createProduct,
  getAllProducts,
  getProductById,
  getProductsByCategory,
  getAllProductsForAdmin,
  getProductByIdForAdmin,
  updateProduct,
  updateProductStatus,
  deleteProduct,
} = require("../controllers/productController");

const router = express.Router();

// Admin view routes - /:id route එකට කලින් තියන්න
router.get("/admin/all", protect, adminOnly, getAllProductsForAdmin);
router.get("/admin/:id", protect, adminOnly, getProductByIdForAdmin);

// Public routes - active products only
router.get("/", getAllProducts);
router.get("/category/:categoryId", getProductsByCategory);
router.get("/:id", getProductById);

// Admin only modify routes
router.post(
  "/",
  protect,
  adminOnly,
  uploadProductImages,
  createProduct
);

router.put(
  "/:id",
  protect,
  adminOnly,
  uploadProductImages,
  updateProduct
);

router.put(
  "/:id/status",
  protect,
  adminOnly,
  updateProductStatus
);

router.delete(
  "/:id",
  protect,
  adminOnly,
  deleteProduct
);

module.exports = router;