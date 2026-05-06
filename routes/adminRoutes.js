const express = require("express");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly, mainAdminOnly } = require("../middleware/adminMiddleware");

const {
  createAdmin,
  getAllUsers,
  getAllAdmins,
  updateCustomerStatus,
  updateAdminStatus,
} = require("../controllers/adminController");

const router = express.Router();

// Any admin can add another admin
router.post("/admins", protect, adminOnly, createAdmin);

// Any admin can view users/admins
router.get("/users", protect, adminOnly, getAllUsers);
router.get("/admins", protect, adminOnly, getAllAdmins);

// Any admin can change customer status
router.put("/users/:id/status", protect, adminOnly, updateCustomerStatus);

// Only Main Admin can change admin status
router.put("/admins/:id/status", protect, mainAdminOnly, updateAdminStatus);

module.exports = router;