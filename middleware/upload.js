const multer = require("multer");
const path = require("path");
const fs = require("fs");

const createFolderIfNotExists = (folderPath) => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
};

// Upload folders
createFolderIfNotExists("uploads/categories");
createFolderIfNotExists("uploads/products");
createFolderIfNotExists("uploads/profiles");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "category_image") {
      cb(null, "uploads/categories");
    } else if (file.fieldname === "product_images") {
      cb(null, "uploads/products");
    } else if (file.fieldname === "profile_image") {
      cb(null, "uploads/profiles");
    } else {
      cb(new Error("Invalid image field name"), null);
    }
  },

  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const allowedImageTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const fileFilter = (req, file, cb) => {
  if (
    file.fieldname === "category_image" ||
    file.fieldname === "product_images" ||
    file.fieldname === "profile_image"
  ) {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error("Only JPG, JPEG, PNG and WEBP images are allowed"),
        false
      );
    }
  } else {
    cb(new Error("Invalid file field"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Category - one image
const uploadCategoryImage = upload.single("category_image");

// Product - multiple images
const uploadProductImages = upload.array("product_images", 10);

// User profile - one image
const uploadProfileImage = upload.single("profile_image");

module.exports = {
  uploadCategoryImage,
  uploadProductImages,
  uploadProfileImage,
};