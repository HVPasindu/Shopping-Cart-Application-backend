const express = require("express");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");
const { uploadCategoryImage } = require("../middleware/upload");

const {
  createCategory,
  getAllCategories,
  getCategoryById,
  getAllCategoriesForAdmin,
  getCategoryByIdForAdmin,
  updateCategory,
  updateCategoryStatus,
  deleteCategory,
} = require("../controllers/categoryController");

const router = express.Router();

// Admin view routes 
router.get("/admin/all", protect, adminOnly, getAllCategoriesForAdmin);
router.get("/admin/:id", protect, adminOnly, getCategoryByIdForAdmin);

// Public routes - active categories only
router.get("/", getAllCategories);
router.get("/:id", getCategoryById);

// Admin only modify routes
router.post("/", protect, adminOnly, uploadCategoryImage, createCategory);
router.put("/:id", protect, adminOnly, uploadCategoryImage, updateCategory);
router.put("/:id/status", protect, adminOnly, updateCategoryStatus);
router.delete("/:id", protect, adminOnly, deleteCategory);

module.exports = router;