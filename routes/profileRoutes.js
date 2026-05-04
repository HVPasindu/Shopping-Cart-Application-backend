const express = require("express");

const { protect } = require("../middleware/authMiddleware");
const { uploadProfileImage } = require("../middleware/upload");

const {
  getMyProfile,
  updateMyProfile,
} = require("../controllers/profileController");

const router = express.Router();

// Logged-in user profile
router.get("/", protect, getMyProfile);
router.put("/", protect, uploadProfileImage, updateMyProfile);

module.exports = router;