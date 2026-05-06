const { QueryTypes } = require("sequelize");

const sequelize = require("../db/sequelize");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const deleteFile = require("../utils/deleteFile");
const {
  notifyActiveCartUsersForCategory,
} = require("../utils/notificationHelper");

// CREATE CATEGORY - ADMIN ONLY
const createCategory = catchAsync(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    if (req.file) {
      deleteFile(req.file.path);
    }

    throw new AppError("Category name is required", 400);
  }

  const imagePath = req.file ? req.file.path.replace(/\\/g, "/") : null;

  const findCategoryQuery = `
    SELECT *
    FROM categories
    WHERE name = ?
    LIMIT 1
  `;

  const categories = await sequelize.query(findCategoryQuery, {
    replacements: [name],
    type: QueryTypes.SELECT,
  });

  const existingCategory = categories[0];

  if (existingCategory) {
    if (imagePath) {
      deleteFile(imagePath);
    }

    throw new AppError("Category name already exists", 400);
  }

  const insertCategoryQuery = `
    INSERT INTO categories
    (
      name,
      description,
      image,
      status,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, NOW(), NOW())
  `;

  await sequelize.query(insertCategoryQuery, {
    replacements: [name, description || null, imagePath, "active"],
    type: QueryTypes.INSERT,
  });

  const findCreatedCategoryQuery = `
    SELECT *
    FROM categories
    WHERE name = ?
    LIMIT 1
  `;

  const createdCategories = await sequelize.query(findCreatedCategoryQuery, {
    replacements: [name],
    type: QueryTypes.SELECT,
  });

  const createdCategory = createdCategories[0];

  return res.status(201).json({
    success: true,
    message: "Category created successfully",
    data: {
      category: {
        ...createdCategory,
        image_url: createdCategory.image
          ? `${req.protocol}://${req.get("host")}/${createdCategory.image}`
          : null,
      },
    },
  });
});

// GET ALL CATEGORIES - PUBLIC / CUSTOMER
// Only active categories are visible to public/customers
const getAllCategories = catchAsync(async (req, res) => {
  const getCategoriesQuery = `
    SELECT
      id,
      name,
      description,
      image,
      status,
      created_at,
      updated_at
    FROM categories
    WHERE status = 'active'
    ORDER BY created_at DESC
  `;

  const categories = await sequelize.query(getCategoriesQuery, {
    type: QueryTypes.SELECT,
  });

  const categoriesWithImageUrl = categories.map((category) => ({
    ...category,
    image_url: category.image
      ? `${req.protocol}://${req.get("host")}/${category.image}`
      : null,
  }));

  return res.status(200).json({
    success: true,
    message: "Categories fetched successfully",
    data: {
      categories: categoriesWithImageUrl,
    },
  });
});

// GET SINGLE CATEGORY - PUBLIC / CUSTOMER
// Only active category can be viewed by public/customers
const getCategoryById = catchAsync(async (req, res) => {
  const categoryId = req.params.id;

  const getCategoryQuery = `
    SELECT
      id,
      name,
      description,
      image,
      status,
      created_at,
      updated_at
    FROM categories
    WHERE id = ?
      AND status = 'active'
    LIMIT 1
  `;

  const categories = await sequelize.query(getCategoryQuery, {
    replacements: [categoryId],
    type: QueryTypes.SELECT,
  });

  const category = categories[0];

  if (!category) {
    throw new AppError("Category not found or inactive", 404);
  }

  return res.status(200).json({
    success: true,
    message: "Category fetched successfully",
    data: {
      category: {
        ...category,
        image_url: category.image
          ? `${req.protocol}://${req.get("host")}/${category.image}`
          : null,
      },
    },
  });
});

// GET ALL CATEGORIES - ADMIN ONLY
// Admin can view active + inactive categories
const getAllCategoriesForAdmin = catchAsync(async (req, res) => {
  const { status } = req.query;

  let getCategoriesQuery = `
    SELECT
      id,
      name,
      description,
      image,
      status,
      created_at,
      updated_at
    FROM categories
  `;

  const replacements = [];

  if (status) {
    const allowedStatuses = ["active", "inactive"];

    if (!allowedStatuses.includes(status)) {
      throw new AppError("Invalid status", 400);
    }

    getCategoriesQuery += `
      WHERE status = ?
    `;

    replacements.push(status);
  }

  getCategoriesQuery += `
    ORDER BY created_at DESC
  `;

  const categories = await sequelize.query(getCategoriesQuery, {
    replacements,
    type: QueryTypes.SELECT,
  });

  const categoriesWithImageUrl = categories.map((category) => ({
    ...category,
    image_url: category.image
      ? `${req.protocol}://${req.get("host")}/${category.image}`
      : null,
  }));

  return res.status(200).json({
    success: true,
    message: "Admin categories fetched successfully",
    data: {
      categories: categoriesWithImageUrl,
    },
  });
});

// GET SINGLE CATEGORY - ADMIN ONLY
// Admin can view active + inactive category by id
const getCategoryByIdForAdmin = catchAsync(async (req, res) => {
  const categoryId = req.params.id;

  const getCategoryQuery = `
    SELECT
      id,
      name,
      description,
      image,
      status,
      created_at,
      updated_at
    FROM categories
    WHERE id = ?
    LIMIT 1
  `;

  const categories = await sequelize.query(getCategoryQuery, {
    replacements: [categoryId],
    type: QueryTypes.SELECT,
  });

  const category = categories[0];

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  return res.status(200).json({
    success: true,
    message: "Admin category fetched successfully",
    data: {
      category: {
        ...category,
        image_url: category.image
          ? `${req.protocol}://${req.get("host")}/${category.image}`
          : null,
      },
    },
  });
});


// UPDATE CATEGORY - ADMIN ONLY
const updateCategory = catchAsync(async (req, res) => {
  const categoryId = req.params.id;
  const { name, description } = req.body;

  const findCategoryQuery = `
    SELECT *
    FROM categories
    WHERE id = ?
    LIMIT 1
  `;

  const categories = await sequelize.query(findCategoryQuery, {
    replacements: [categoryId],
    type: QueryTypes.SELECT,
  });

  const category = categories[0];

  if (!category) {
    if (req.file) {
      deleteFile(req.file.path);
    }

    throw new AppError("Category not found", 404);
  }

  const updatedName = name || category.name;
  const updatedDescription =
    description !== undefined ? description : category.description;

  if (name) {
    const checkDuplicateQuery = `
      SELECT *
      FROM categories
      WHERE name = ?
        AND id != ?
      LIMIT 1
    `;

    const duplicateCategories = await sequelize.query(checkDuplicateQuery, {
      replacements: [updatedName, categoryId],
      type: QueryTypes.SELECT,
    });

    const duplicateCategory = duplicateCategories[0];

    if (duplicateCategory) {
      if (req.file) {
        deleteFile(req.file.path);
      }

      throw new AppError("Category name already exists", 400);
    }
  }

  let imagePath = category.image;

  if (req.file) {
    imagePath = req.file.path.replace(/\\/g, "/");

    if (category.image) {
      deleteFile(category.image);
    }
  }

  const updateCategoryQuery = `
    UPDATE categories
    SET
      name = ?,
      description = ?,
      image = ?,
      updated_at = NOW()
    WHERE id = ?
  `;

  await sequelize.query(updateCategoryQuery, {
    replacements: [
      updatedName,
      updatedDescription || null,
      imagePath,
      categoryId,
    ],
    type: QueryTypes.UPDATE,
  });

  const getUpdatedCategoryQuery = `
    SELECT *
    FROM categories
    WHERE id = ?
    LIMIT 1
  `;

  const updatedCategories = await sequelize.query(getUpdatedCategoryQuery, {
    replacements: [categoryId],
    type: QueryTypes.SELECT,
  });

  const updatedCategory = updatedCategories[0];

  return res.status(200).json({
    success: true,
    message: "Category updated successfully",
    data: {
      category: {
        ...updatedCategory,
        image_url: updatedCategory.image
          ? `${req.protocol}://${req.get("host")}/${updatedCategory.image}`
          : null,
      },
    },
  });
});


// UPDATE CATEGORY STATUS - ADMIN ONLY
const updateCategoryStatus = catchAsync(async (req, res) => {
  const categoryId = req.params.id;
  const { status } = req.body;

  const allowedStatuses = ["active", "inactive"];

  if (!status) {
    throw new AppError("Status is required", 400);
  }

  if (!allowedStatuses.includes(status)) {
    throw new AppError("Invalid status", 400);
  }

  const findCategoryQuery = `
    SELECT *
    FROM categories
    WHERE id = ?
    LIMIT 1
  `;

  const categories = await sequelize.query(findCategoryQuery, {
    replacements: [categoryId],
    type: QueryTypes.SELECT,
  });

  const category = categories[0];

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  if (status === "inactive" && category.status !== "inactive") {
    await notifyActiveCartUsersForCategory({
      categoryId,
      title: "Category Unavailable",
      message: `${category.name} category එක admin විසින් inactive කර ඇත. එම category එකේ cart items order කරන්න බැහැ.`,
    });
  }

  if (status === "active" && category.status !== "active") {
    await notifyActiveCartUsersForCategory({
      categoryId,
      title: "Category Available Again",
      message: `${category.name} category එක ආපහු active කර ඇත. ඔබගේ cart එක check කරන්න.`,
    });
  }

  const updateStatusQuery = `
    UPDATE categories
    SET
      status = ?,
      updated_at = NOW()
    WHERE id = ?
  `;

  await sequelize.query(updateStatusQuery, {
    replacements: [status, categoryId],
    type: QueryTypes.UPDATE,
  });

  return res.status(200).json({
    success: true,
    message: "Category status updated successfully",
    data: {
      category_id: Number(categoryId),
      status,
    },
  });
});

// DELETE CATEGORY PERMANENTLY - ADMIN ONLY
const deleteCategory = catchAsync(async (req, res) => {
  const categoryId = req.params.id;

  const findCategoryQuery = `
    SELECT *
    FROM categories
    WHERE id = ?
    LIMIT 1
  `;

  const categories = await sequelize.query(findCategoryQuery, {
    replacements: [categoryId],
    type: QueryTypes.SELECT,
  });

  const category = categories[0];

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  // Find affected active cart users before cascade delete happens
  const findAffectedCartUsersQuery = `
    SELECT DISTINCT
      carts.user_id,
      products.name AS product_name,
      categories.name AS category_name
    FROM cart_items
    INNER JOIN carts ON cart_items.cart_id = carts.id
    INNER JOIN products ON cart_items.product_id = products.id
    INNER JOIN categories ON products.category_id = categories.id
    WHERE categories.id = ?
      AND carts.status = 'active'
  `;

  const affectedUsers = await sequelize.query(findAffectedCartUsersQuery, {
    replacements: [categoryId],
    type: QueryTypes.SELECT,
  });

  for (const affectedUser of affectedUsers) {
    const insertNotificationQuery = `
      INSERT INTO notifications
      (
        user_id,
        title,
        message,
        type,
        is_read,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, NOW())
    `;

    await sequelize.query(insertNotificationQuery, {
      replacements: [
        affectedUser.user_id,
        "Cart Item Removed",
        `${affectedUser.product_name} product එක ${affectedUser.category_name} category එක delete කළ නිසා ඔබගේ cart එකෙන් ඉවත් කර ඇත.`,
        "cart",
        false,
      ],
      type: QueryTypes.INSERT,
    });
  }

  // Delete physical product image files before DB cascade delete
  const findProductImagesQuery = `
    SELECT product_images.image_url
    FROM product_images
    INNER JOIN products ON product_images.product_id = products.id
    WHERE products.category_id = ?
  `;

  const productImages = await sequelize.query(findProductImagesQuery, {
    replacements: [categoryId],
    type: QueryTypes.SELECT,
  });

  for (const productImage of productImages) {
    if (productImage.image_url) {
      deleteFile(productImage.image_url);
    }
  }

  // Delete physical category image file
  if (category.image) {
    deleteFile(category.image);
  }

  const deleteCategoryQuery = `
    DELETE FROM categories
    WHERE id = ?
  `;

  await sequelize.query(deleteCategoryQuery, {
    replacements: [categoryId],
    type: QueryTypes.DELETE,
  });

  return res.status(200).json({
    success: true,
    message: "Category deleted successfully",
  });
});

module.exports = {
  createCategory,
  getAllCategories,
  getCategoryById,
  getAllCategoriesForAdmin,
  getCategoryByIdForAdmin,
  updateCategory,
  updateCategoryStatus,
  deleteCategory,
};