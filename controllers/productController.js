const { QueryTypes } = require("sequelize");

const sequelize = require("../db/sequelize");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const deleteFile = require("../utils/deleteFile");
const {
  notifyActiveCartUsersForProduct,
} = require("../utils/notificationHelper");

// CREATE PRODUCT - ADMIN ONLY
const createProduct = catchAsync(async (req, res) => {
  const { category_id, name, description, price, stock_quantity } = req.body;

  if (!category_id || !name || !price) {
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        deleteFile(file.path);
      }
    }

    throw new AppError("Category, name and price are required", 400);
  }

  if (Number(price) <= 0) {
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        deleteFile(file.path);
      }
    }

    throw new AppError("Price must be greater than 0", 400);
  }

  if (stock_quantity !== undefined && Number(stock_quantity) < 0) {
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        deleteFile(file.path);
      }
    }

    throw new AppError("Stock quantity cannot be negative", 400);
  }

  const findCategoryQuery = `
    SELECT *
    FROM categories
    WHERE id = ?
    LIMIT 1
  `;

  const categories = await sequelize.query(findCategoryQuery, {
    replacements: [category_id],
    type: QueryTypes.SELECT,
  });

  const category = categories[0];

  if (!category) {
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        deleteFile(file.path);
      }
    }

    throw new AppError("Category not found", 404);
  }

  if (category.status !== "active") {
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        deleteFile(file.path);
      }
    }

    throw new AppError("Cannot add product to inactive category", 400);
  }

  const checkDuplicateQuery = `
    SELECT *
    FROM products
    WHERE name = ?
      AND category_id = ?
    LIMIT 1
  `;

  const duplicateProducts = await sequelize.query(checkDuplicateQuery, {
    replacements: [name, category_id],
    type: QueryTypes.SELECT,
  });

  const duplicateProduct = duplicateProducts[0];

  if (duplicateProduct) {
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        deleteFile(file.path);
      }
    }

    throw new AppError("Product name already exists in this category", 400);
  }

  const insertProductQuery = `
    INSERT INTO products
    (
      category_id,
      name,
      description,
      price,
      stock_quantity,
      status,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
  `;

  await sequelize.query(insertProductQuery, {
    replacements: [
      category_id,
      name,
      description || null,
      price,
      stock_quantity !== undefined ? stock_quantity : 0,
      "active",
    ],
    type: QueryTypes.INSERT,
  });

  const findCreatedProductQuery = `
    SELECT *
    FROM products
    WHERE name = ?
      AND category_id = ?
    LIMIT 1
  `;

  const createdProducts = await sequelize.query(findCreatedProductQuery, {
    replacements: [name, category_id],
    type: QueryTypes.SELECT,
  });

  const createdProduct = createdProducts[0];

  if (req.files && req.files.length > 0) {
    for (let i = 0; i < req.files.length; i++) {
      const imagePath = req.files[i].path.replace(/\\/g, "/");
      const isMain = i === 0;

      const insertProductImageQuery = `
        INSERT INTO product_images
        (
          product_id,
          image_url,
          is_main,
          created_at
        )
        VALUES (?, ?, ?, NOW())
      `;

      await sequelize.query(insertProductImageQuery, {
        replacements: [createdProduct.id, imagePath, isMain],
        type: QueryTypes.INSERT,
      });
    }
  }

  const getProductImagesQuery = `
    SELECT *
    FROM product_images
    WHERE product_id = ?
    ORDER BY is_main DESC, id ASC
  `;

  const images = await sequelize.query(getProductImagesQuery, {
    replacements: [createdProduct.id],
    type: QueryTypes.SELECT,
  });

  const imagesWithUrls = images.map((image) => ({
    ...image,
    image_url_full: image.image_url
      ? `${req.protocol}://${req.get("host")}/${image.image_url}`
      : null,
  }));

  return res.status(201).json({
    success: true,
    message: "Product created successfully",
    data: {
      product: {
        ...createdProduct,
        images: imagesWithUrls,
      },
    },
  });
});

// GET ALL PRODUCTS - PUBLIC / CUSTOMER
// Only active products under active categories
const getAllProducts = catchAsync(async (req, res) => {
  const getProductsQuery = `
    SELECT
      products.id,
      products.category_id,
      categories.name AS category_name,
      products.name,
      products.description,
      products.price,
      products.stock_quantity,
      products.status,
      products.created_at,
      products.updated_at
    FROM products
    INNER JOIN categories ON products.category_id = categories.id
    WHERE products.status = 'active'
      AND categories.status = 'active'
    ORDER BY products.created_at DESC
  `;

  const products = await sequelize.query(getProductsQuery, {
    type: QueryTypes.SELECT,
  });

  for (const product of products) {
    const getImagesQuery = `
      SELECT *
      FROM product_images
      WHERE product_id = ?
      ORDER BY is_main DESC, id ASC
    `;

    const images = await sequelize.query(getImagesQuery, {
      replacements: [product.id],
      type: QueryTypes.SELECT,
    });

    product.images = images.map((image) => ({
      ...image,
      image_url_full: image.image_url
        ? `${req.protocol}://${req.get("host")}/${image.image_url}`
        : null,
    }));
  }

  return res.status(200).json({
    success: true,
    message: "Products fetched successfully",
    data: {
      products,
    },
  });
});

// GET SINGLE PRODUCT - PUBLIC / CUSTOMER
// Only active product under active category
const getProductById = catchAsync(async (req, res) => {
  const productId = req.params.id;

  const getProductQuery = `
    SELECT
      products.id,
      products.category_id,
      categories.name AS category_name,
      products.name,
      products.description,
      products.price,
      products.stock_quantity,
      products.status,
      products.created_at,
      products.updated_at
    FROM products
    INNER JOIN categories ON products.category_id = categories.id
    WHERE products.id = ?
      AND products.status = 'active'
      AND categories.status = 'active'
    LIMIT 1
  `;

  const products = await sequelize.query(getProductQuery, {
    replacements: [productId],
    type: QueryTypes.SELECT,
  });

  const product = products[0];

  if (!product) {
    throw new AppError("Product not found or inactive", 404);
  }

  const getImagesQuery = `
    SELECT *
    FROM product_images
    WHERE product_id = ?
    ORDER BY is_main DESC, id ASC
  `;

  const images = await sequelize.query(getImagesQuery, {
    replacements: [productId],
    type: QueryTypes.SELECT,
  });

  const imagesWithUrls = images.map((image) => ({
    ...image,
    image_url_full: image.image_url
      ? `${req.protocol}://${req.get("host")}/${image.image_url}`
      : null,
  }));

  return res.status(200).json({
    success: true,
    message: "Product fetched successfully",
    data: {
      product: {
        ...product,
        images: imagesWithUrls,
      },
    },
  });
});

// GET PRODUCTS BY CATEGORY - PUBLIC / CUSTOMER
const getProductsByCategory = catchAsync(async (req, res) => {
  const categoryId = req.params.categoryId;

  const findCategoryQuery = `
    SELECT *
    FROM categories
    WHERE id = ?
      AND status = 'active'
    LIMIT 1
  `;

  const categories = await sequelize.query(findCategoryQuery, {
    replacements: [categoryId],
    type: QueryTypes.SELECT,
  });

  const category = categories[0];

  if (!category) {
    throw new AppError("Category not found or inactive", 404);
  }

  const getProductsQuery = `
    SELECT
      products.id,
      products.category_id,
      categories.name AS category_name,
      products.name,
      products.description,
      products.price,
      products.stock_quantity,
      products.status,
      products.created_at,
      products.updated_at
    FROM products
    INNER JOIN categories ON products.category_id = categories.id
    WHERE products.category_id = ?
      AND products.status = 'active'
      AND categories.status = 'active'
    ORDER BY products.created_at DESC
  `;

  const products = await sequelize.query(getProductsQuery, {
    replacements: [categoryId],
    type: QueryTypes.SELECT,
  });

  for (const product of products) {
    const getImagesQuery = `
      SELECT *
      FROM product_images
      WHERE product_id = ?
      ORDER BY is_main DESC, id ASC
    `;

    const images = await sequelize.query(getImagesQuery, {
      replacements: [product.id],
      type: QueryTypes.SELECT,
    });

    product.images = images.map((image) => ({
      ...image,
      image_url_full: image.image_url
        ? `${req.protocol}://${req.get("host")}/${image.image_url}`
        : null,
    }));
  }

  return res.status(200).json({
    success: true,
    message: "Products fetched successfully by category",
    data: {
      category,
      products,
    },
  });
});

// GET ALL PRODUCTS - ADMIN ONLY
// Admin can view active + inactive products
const getAllProductsForAdmin = catchAsync(async (req, res) => {
  const { status, category_id } = req.query;

  let getProductsQuery = `
    SELECT
      products.id,
      products.category_id,
      categories.name AS category_name,
      products.name,
      products.description,
      products.price,
      products.stock_quantity,
      products.status,
      products.created_at,
      products.updated_at
    FROM products
    INNER JOIN categories ON products.category_id = categories.id
  `;

  const conditions = [];
  const replacements = [];

  if (status) {
    const allowedStatuses = ["active", "inactive"];

    if (!allowedStatuses.includes(status)) {
      throw new AppError("Invalid status", 400);
    }

    conditions.push("products.status = ?");
    replacements.push(status);
  }

  if (category_id) {
    conditions.push("products.category_id = ?");
    replacements.push(category_id);
  }

  if (conditions.length > 0) {
    getProductsQuery += `
      WHERE ${conditions.join(" AND ")}
    `;
  }

  getProductsQuery += `
    ORDER BY products.created_at DESC
  `;

  const products = await sequelize.query(getProductsQuery, {
    replacements,
    type: QueryTypes.SELECT,
  });

  for (const product of products) {
    const getImagesQuery = `
      SELECT *
      FROM product_images
      WHERE product_id = ?
      ORDER BY is_main DESC, id ASC
    `;

    const images = await sequelize.query(getImagesQuery, {
      replacements: [product.id],
      type: QueryTypes.SELECT,
    });

    product.images = images.map((image) => ({
      ...image,
      image_url_full: image.image_url
        ? `${req.protocol}://${req.get("host")}/${image.image_url}`
        : null,
    }));
  }

  return res.status(200).json({
    success: true,
    message: "Admin products fetched successfully",
    data: {
      products,
    },
  });
});

// GET SINGLE PRODUCT - ADMIN ONLY
// Admin can view active + inactive product
const getProductByIdForAdmin = catchAsync(async (req, res) => {
  const productId = req.params.id;

  const getProductQuery = `
    SELECT
      products.id,
      products.category_id,
      categories.name AS category_name,
      products.name,
      products.description,
      products.price,
      products.stock_quantity,
      products.status,
      products.created_at,
      products.updated_at
    FROM products
    INNER JOIN categories ON products.category_id = categories.id
    WHERE products.id = ?
    LIMIT 1
  `;

  const products = await sequelize.query(getProductQuery, {
    replacements: [productId],
    type: QueryTypes.SELECT,
  });

  const product = products[0];

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const getImagesQuery = `
    SELECT *
    FROM product_images
    WHERE product_id = ?
    ORDER BY is_main DESC, id ASC
  `;

  const images = await sequelize.query(getImagesQuery, {
    replacements: [productId],
    type: QueryTypes.SELECT,
  });

  const imagesWithUrls = images.map((image) => ({
    ...image,
    image_url_full: image.image_url
      ? `${req.protocol}://${req.get("host")}/${image.image_url}`
      : null,
  }));

  return res.status(200).json({
    success: true,
    message: "Admin product fetched successfully",
    data: {
      product: {
        ...product,
        images: imagesWithUrls,
      },
    },
  });
});

// UPDATE PRODUCT - ADMIN ONLY
const updateProduct = catchAsync(async (req, res) => {
  const productId = req.params.id;
  const { category_id, name, description, price, stock_quantity } = req.body;

  const findProductQuery = `
    SELECT *
    FROM products
    WHERE id = ?
    LIMIT 1
  `;

  const products = await sequelize.query(findProductQuery, {
    replacements: [productId],
    type: QueryTypes.SELECT,
  });

  const product = products[0];

  if (!product) {
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        deleteFile(file.path);
      }
    }

    throw new AppError("Product not found", 404);
  }

  const updatedCategoryId =
    category_id !== undefined ? category_id : product.category_id;

  const updatedName = name || product.name;

  const updatedDescription =
    description !== undefined ? description : product.description;

  const updatedPrice = price !== undefined ? price : product.price;

  const updatedStockQuantity =
    stock_quantity !== undefined ? stock_quantity : product.stock_quantity;

  if (Number(updatedPrice) <= 0) {
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        deleteFile(file.path);
      }
    }

    throw new AppError("Price must be greater than 0", 400);
  }

  if (Number(updatedStockQuantity) < 0) {
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        deleteFile(file.path);
      }
    }

    throw new AppError("Stock quantity cannot be negative", 400);
  }

  const findCategoryQuery = `
    SELECT *
    FROM categories
    WHERE id = ?
    LIMIT 1
  `;

  const categories = await sequelize.query(findCategoryQuery, {
    replacements: [updatedCategoryId],
    type: QueryTypes.SELECT,
  });

  const category = categories[0];

  if (!category) {
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        deleteFile(file.path);
      }
    }

    throw new AppError("Category not found", 404);
  }

  const checkDuplicateQuery = `
    SELECT *
    FROM products
    WHERE name = ?
      AND category_id = ?
      AND id != ?
    LIMIT 1
  `;

  const duplicateProducts = await sequelize.query(checkDuplicateQuery, {
    replacements: [updatedName, updatedCategoryId, productId],
    type: QueryTypes.SELECT,
  });

  const duplicateProduct = duplicateProducts[0];

  if (duplicateProduct) {
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        deleteFile(file.path);
      }
    }

    throw new AppError("Product name already exists in this category", 400);
  }

  const updateProductQuery = `
    UPDATE products
    SET
      category_id = ?,
      name = ?,
      description = ?,
      price = ?,
      stock_quantity = ?,
      updated_at = NOW()
    WHERE id = ?
  `;

  await sequelize.query(updateProductQuery, {
    replacements: [
      updatedCategoryId,
      updatedName,
      updatedDescription || null,
      updatedPrice,
      updatedStockQuantity,
      productId,
    ],
    type: QueryTypes.UPDATE,
  });

  if (req.files && req.files.length > 0) {
    // 1. Old product images ටික DB එකෙන් ගන්නවා
    const findOldImagesQuery = `
    SELECT *
    FROM product_images
    WHERE product_id = ?
  `;

    const oldImages = await sequelize.query(findOldImagesQuery, {
      replacements: [productId],
      type: QueryTypes.SELECT,
    });

    // 2. Old image files uploads folder එකෙන් delete කරනවා
    for (const oldImage of oldImages) {
      if (oldImage.image_url) {
        deleteFile(oldImage.image_url);
      }
    }

    // 3. Old image records DB එකෙන් delete කරනවා
    const deleteOldImagesQuery = `
    DELETE FROM product_images
    WHERE product_id = ?
  `;

    await sequelize.query(deleteOldImagesQuery, {
      replacements: [productId],
      type: QueryTypes.DELETE,
    });

    // 4. New images insert කරනවා
    for (let i = 0; i < req.files.length; i++) {
      const imagePath = req.files[i].path.replace(/\\/g, "/");

      // New images වල පළවෙනි එක main image කරනවා
      const isMain = i === 0;

      const insertProductImageQuery = `
      INSERT INTO product_images
      (
        product_id,
        image_url,
        is_main,
        created_at
      )
      VALUES (?, ?, ?, NOW())
    `;

      await sequelize.query(insertProductImageQuery, {
        replacements: [productId, imagePath, isMain],
        type: QueryTypes.INSERT,
      });
    }
  }

  const getUpdatedProductQuery = `
    SELECT
      products.id,
      products.category_id,
      categories.name AS category_name,
      products.name,
      products.description,
      products.price,
      products.stock_quantity,
      products.status,
      products.created_at,
      products.updated_at
    FROM products
    INNER JOIN categories ON products.category_id = categories.id
    WHERE products.id = ?
    LIMIT 1
  `;

  const updatedProducts = await sequelize.query(getUpdatedProductQuery, {
    replacements: [productId],
    type: QueryTypes.SELECT,
  });

  const updatedProduct = updatedProducts[0];

  const getImagesQuery = `
    SELECT *
    FROM product_images
    WHERE product_id = ?
    ORDER BY is_main DESC, id ASC
  `;

  const images = await sequelize.query(getImagesQuery, {
    replacements: [productId],
    type: QueryTypes.SELECT,
  });

  const imagesWithUrls = images.map((image) => ({
    ...image,
    image_url_full: image.image_url
      ? `${req.protocol}://${req.get("host")}/${image.image_url}`
      : null,
  }));

  return res.status(200).json({
    success: true,
    message: "Product updated successfully",
    data: {
      product: {
        ...updatedProduct,
        images: imagesWithUrls,
      },
    },
  });
});

// UPDATE PRODUCT STATUS - ADMIN ONLY
const updateProductStatus = catchAsync(async (req, res) => {
  const productId = req.params.id;
  const { status } = req.body;

  const allowedStatuses = ["active", "inactive"];

  if (!status) {
    throw new AppError("Status is required", 400);
  }

  if (!allowedStatuses.includes(status)) {
    throw new AppError("Invalid status", 400);
  }

  const findProductQuery = `
    SELECT *
    FROM products
    WHERE id = ?
    LIMIT 1
  `;

  const products = await sequelize.query(findProductQuery, {
    replacements: [productId],
    type: QueryTypes.SELECT,
  });

  const product = products[0];

  if (!product) {
    throw new AppError("Product not found", 404);
  }


  if (status === "inactive" && product.status !== "inactive") {
    await notifyActiveCartUsersForProduct({
      productId,
      title: "Product Unavailable",
      message: `${product.name} product එක admin විසින් inactive කර ඇත. එය ඔබගේ cart එකේ තවම තියෙන නමුත් order කරන්න බැහැ.`,
    });
  }

  if (status === "active" && product.status !== "active") {
    await notifyActiveCartUsersForProduct({
      productId,
      title: "Product Available Again",
      message: `${product.name} product එක ආපහු active කර ඇත. ඔබගේ cart එක check කරන්න.`,
    });
  }

  const updateStatusQuery = `
    UPDATE products
    SET
      status = ?,
      updated_at = NOW()
    WHERE id = ?
  `;

  await sequelize.query(updateStatusQuery, {
    replacements: [status, productId],
    type: QueryTypes.UPDATE,
  });

  return res.status(200).json({
    success: true,
    message: "Product status updated successfully",
    data: {
      product_id: Number(productId),
      status,
    },
  });
});

// DELETE PRODUCT PERMANENTLY - ADMIN ONLY
const deleteProduct = catchAsync(async (req, res) => {
  const productId = req.params.id;

  const findProductQuery = `
    SELECT *
    FROM products
    WHERE id = ?
    LIMIT 1
  `;

  const products = await sequelize.query(findProductQuery, {
    replacements: [productId],
    type: QueryTypes.SELECT,
  });

  const product = products[0];

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const findAffectedCartUsersQuery = `
    SELECT DISTINCT
      carts.user_id,
      products.name AS product_name
    FROM cart_items
    INNER JOIN carts ON cart_items.cart_id = carts.id
    INNER JOIN products ON cart_items.product_id = products.id
    WHERE products.id = ?
      AND carts.status = 'active'
  `;

  const affectedUsers = await sequelize.query(findAffectedCartUsersQuery, {
    replacements: [productId],
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
        `${affectedUser.product_name} product එක delete කළ නිසා ඔබගේ cart එකෙන් ඉවත් කර ඇත.`,
        "cart",
        false,
      ],
      type: QueryTypes.INSERT,
    });
  }

  const findProductImagesQuery = `
    SELECT image_url
    FROM product_images
    WHERE product_id = ?
  `;

  const productImages = await sequelize.query(findProductImagesQuery, {
    replacements: [productId],
    type: QueryTypes.SELECT,
  });

  for (const productImage of productImages) {
    if (productImage.image_url) {
      deleteFile(productImage.image_url);
    }
  }

  const deleteProductQuery = `
    DELETE FROM products
    WHERE id = ?
  `;

  await sequelize.query(deleteProductQuery, {
    replacements: [productId],
    type: QueryTypes.DELETE,
  });

  return res.status(200).json({
    success: true,
    message: "Product deleted successfully",
  });
});

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  getProductsByCategory,
  getAllProductsForAdmin,
  getProductByIdForAdmin,
  updateProduct,
  updateProductStatus,
  deleteProduct,
};