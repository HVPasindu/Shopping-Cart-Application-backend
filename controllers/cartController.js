const { QueryTypes } = require("sequelize");

const sequelize = require("../db/sequelize");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

const CART_ABANDON_AFTER_DAYS = 7;

// MARK OLD ACTIVE CARTS AS ABANDONED
const abandonOldActiveCartsByUserId = async (userId) => {
  const abandonOldCartsQuery = `
    UPDATE carts
    SET
      status = 'abandoned',
      updated_at = NOW()
    WHERE user_id = ?
      AND status = 'active'
      AND updated_at < DATE_SUB(NOW(), INTERVAL ${CART_ABANDON_AFTER_DAYS} DAY)
  `;

  await sequelize.query(abandonOldCartsQuery, {
    replacements: [userId],
    type: QueryTypes.UPDATE,
  });
};

// GET ACTIVE CART BY USER ID
const getActiveCartByUserId = async (userId) => {
  // First check old active cart and mark abandoned if expired
  await abandonOldActiveCartsByUserId(userId);

  const findCartQuery = `
    SELECT *
    FROM carts
    WHERE user_id = ?
      AND status = 'active'
    LIMIT 1
  `;

  const carts = await sequelize.query(findCartQuery, {
    replacements: [userId],
    type: QueryTypes.SELECT,
  });

  return carts[0];
};

// CALCULATE CART TOTAL FROM CART ITEMS
const calculateCartTotal = async (cartId) => {
  const calculateTotalQuery = `
    SELECT COALESCE(SUM(subtotal), 0) AS total
    FROM cart_items
    WHERE cart_id = ?
  `;

  const result = await sequelize.query(calculateTotalQuery, {
    replacements: [cartId],
    type: QueryTypes.SELECT,
  });

  return Number(result[0].total);
};

// ADD TO CART
const addToCart = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { product_id, quantity } = req.body;

  if (!product_id || !quantity) {
    throw new AppError("Product ID and quantity are required", 400);
  }

  if (Number(quantity) <= 0) {
    throw new AppError("Quantity must be greater than 0", 400);
  }

  const findProductQuery = `
    SELECT
      products.id,
      products.name,
      products.price,
      products.stock_quantity,
      products.status AS product_status,
      categories.status AS category_status
    FROM products
    INNER JOIN categories ON products.category_id = categories.id
    WHERE products.id = ?
    LIMIT 1
  `;

  const products = await sequelize.query(findProductQuery, {
    replacements: [product_id],
    type: QueryTypes.SELECT,
  });

  const product = products[0];

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  if (product.product_status !== "active") {
    throw new AppError("Product is not available", 400);
  }

  if (product.category_status !== "active") {
    throw new AppError("Product category is not available", 400);
  }

  if (Number(product.stock_quantity) < Number(quantity)) {
    throw new AppError("Requested quantity is not available in stock", 400);
  }

  let cart = await getActiveCartByUserId(userId);

  // If no active cart exists, create new active cart
  // Old active cart can become abandoned inside getActiveCartByUserId()
  if (!cart) {
    const createCartQuery = `
      INSERT INTO carts
      (
        user_id,
        status,
        created_at,
        updated_at
      )
      VALUES (?, ?, NOW(), NOW())
    `;

    await sequelize.query(createCartQuery, {
      replacements: [userId, "active"],
      type: QueryTypes.INSERT,
    });

    cart = await getActiveCartByUserId(userId);
  }

  const findCartItemQuery = `
    SELECT *
    FROM cart_items
    WHERE cart_id = ?
      AND product_id = ?
    LIMIT 1
  `;

  const cartItems = await sequelize.query(findCartItemQuery, {
    replacements: [cart.id, product_id],
    type: QueryTypes.SELECT,
  });

  const existingCartItem = cartItems[0];

  if (existingCartItem) {
    const newQuantity =
      Number(existingCartItem.quantity) + Number(quantity);

    if (Number(product.stock_quantity) < newQuantity) {
      throw new AppError("Requested quantity exceeds available stock", 400);
    }

    const newSubtotal = newQuantity * Number(product.price);

    const updateCartItemQuery = `
      UPDATE cart_items
      SET
        quantity = ?,
        unit_price = ?,
        subtotal = ?,
        updated_at = NOW()
      WHERE id = ?
    `;

    await sequelize.query(updateCartItemQuery, {
      replacements: [
        newQuantity,
        product.price,
        newSubtotal,
        existingCartItem.id,
      ],
      type: QueryTypes.UPDATE,
    });
  } else {
    const subtotal = Number(quantity) * Number(product.price);

    const insertCartItemQuery = `
      INSERT INTO cart_items
      (
        cart_id,
        product_id,
        quantity,
        unit_price,
        subtotal,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `;

    await sequelize.query(insertCartItemQuery, {
      replacements: [
        cart.id,
        product_id,
        quantity,
        product.price,
        subtotal,
      ],
      type: QueryTypes.INSERT,
    });
  }

  const updateCartDateQuery = `
    UPDATE carts
    SET updated_at = NOW()
    WHERE id = ?
  `;

  await sequelize.query(updateCartDateQuery, {
    replacements: [cart.id],
    type: QueryTypes.UPDATE,
  });

  const totalAmount = await calculateCartTotal(cart.id);

  return res.status(200).json({
    success: true,
    message: "Product added to cart successfully",
    data: {
      cart_id: cart.id,
      total_amount: totalAmount,
    },
  });
});

// GET MY CART
const getMyCart = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const cart = await getActiveCartByUserId(userId);

  if (!cart) {
    return res.status(200).json({
      success: true,
      message: "Cart is empty or previous cart was abandoned",
      data: {
        cart: null,
        items: [],
        total_amount: 0,
      },
    });
  }

  const getCartItemsQuery = `
    SELECT
      cart_items.id AS cart_item_id,
      cart_items.cart_id,
      cart_items.product_id,
      products.name AS product_name,
      products.description AS product_description,
      products.stock_quantity,
      products.status AS product_status,
      categories.status AS category_status,
      cart_items.quantity,
      cart_items.unit_price,
      cart_items.subtotal,
      cart_items.created_at,
      cart_items.updated_at
    FROM cart_items
    INNER JOIN products ON cart_items.product_id = products.id
    INNER JOIN categories ON products.category_id = categories.id
    WHERE cart_items.cart_id = ?
    ORDER BY cart_items.created_at DESC
  `;

  const items = await sequelize.query(getCartItemsQuery, {
    replacements: [cart.id],
    type: QueryTypes.SELECT,
  });

  for (const item of items) {
    const getImagesQuery = `
      SELECT *
      FROM product_images
      WHERE product_id = ?
      ORDER BY is_main DESC, id ASC
      LIMIT 1
    `;

    const images = await sequelize.query(getImagesQuery, {
      replacements: [item.product_id],
      type: QueryTypes.SELECT,
    });

    const image = images[0];

    item.main_image = image
      ? {
          ...image,
          image_url_full: image.image_url
            ? `${req.protocol}://${req.get("host")}/${image.image_url}`
            : null,
        }
      : null;
  }

  const totalAmount = await calculateCartTotal(cart.id);

  return res.status(200).json({
    success: true,
    message: "Cart fetched successfully",
    data: {
      cart,
      items,
      total_amount: totalAmount,
    },
  });
});

// UPDATE CART ITEM QUANTITY
const updateCartItemQuantity = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const itemId = req.params.itemId;
  const { quantity } = req.body;

  if (!quantity) {
    throw new AppError("Quantity is required", 400);
  }

  if (Number(quantity) <= 0) {
    throw new AppError("Quantity must be greater than 0", 400);
  }

  // Mark user's old active cart as abandoned if expired
  await abandonOldActiveCartsByUserId(userId);

  const findCartItemQuery = `
    SELECT
      cart_items.*,
      carts.user_id,
      carts.status AS cart_status,
      products.price,
      products.stock_quantity,
      products.status AS product_status,
      categories.status AS category_status
    FROM cart_items
    INNER JOIN carts ON cart_items.cart_id = carts.id
    INNER JOIN products ON cart_items.product_id = products.id
    INNER JOIN categories ON products.category_id = categories.id
    WHERE cart_items.id = ?
    LIMIT 1
  `;

  const cartItems = await sequelize.query(findCartItemQuery, {
    replacements: [itemId],
    type: QueryTypes.SELECT,
  });

  const cartItem = cartItems[0];

  if (!cartItem) {
    throw new AppError("Cart item not found", 404);
  }

  if (Number(cartItem.user_id) !== Number(userId)) {
    throw new AppError("You cannot update this cart item", 403);
  }

  if (cartItem.cart_status === "abandoned") {
    throw new AppError(
      "This cart has been abandoned. Please add products again.",
      400
    );
  }

  if (cartItem.cart_status !== "active") {
    throw new AppError("This cart is not active", 400);
  }

  if (cartItem.product_status !== "active") {
    throw new AppError("Product is not available", 400);
  }

  if (cartItem.category_status !== "active") {
    throw new AppError("Product category is not available", 400);
  }

  if (Number(cartItem.stock_quantity) < Number(quantity)) {
    throw new AppError("Requested quantity exceeds available stock", 400);
  }

  const subtotal = Number(quantity) * Number(cartItem.price);

  const updateCartItemQuery = `
    UPDATE cart_items
    SET
      quantity = ?,
      unit_price = ?,
      subtotal = ?,
      updated_at = NOW()
    WHERE id = ?
  `;

  await sequelize.query(updateCartItemQuery, {
    replacements: [quantity, cartItem.price, subtotal, itemId],
    type: QueryTypes.UPDATE,
  });

  const updateCartDateQuery = `
    UPDATE carts
    SET updated_at = NOW()
    WHERE id = ?
  `;

  await sequelize.query(updateCartDateQuery, {
    replacements: [cartItem.cart_id],
    type: QueryTypes.UPDATE,
  });

  const totalAmount = await calculateCartTotal(cartItem.cart_id);

  return res.status(200).json({
    success: true,
    message: "Cart item quantity updated successfully",
    data: {
      cart_id: cartItem.cart_id,
      cart_item_id: Number(itemId),
      quantity: Number(quantity),
      subtotal,
      total_amount: totalAmount,
    },
  });
});

// REMOVE CART ITEM
const removeCartItem = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const itemId = req.params.itemId;

  // Mark user's old active cart as abandoned if expired
  await abandonOldActiveCartsByUserId(userId);

  const findCartItemQuery = `
    SELECT
      cart_items.*,
      carts.user_id,
      carts.status AS cart_status
    FROM cart_items
    INNER JOIN carts ON cart_items.cart_id = carts.id
    WHERE cart_items.id = ?
    LIMIT 1
  `;

  const cartItems = await sequelize.query(findCartItemQuery, {
    replacements: [itemId],
    type: QueryTypes.SELECT,
  });

  const cartItem = cartItems[0];

  if (!cartItem) {
    throw new AppError("Cart item not found", 404);
  }

  if (Number(cartItem.user_id) !== Number(userId)) {
    throw new AppError("You cannot remove this cart item", 403);
  }

  if (cartItem.cart_status === "abandoned") {
    throw new AppError(
      "This cart has been abandoned. Please add products again.",
      400
    );
  }

  if (cartItem.cart_status !== "active") {
    throw new AppError("This cart is not active", 400);
  }

  const deleteCartItemQuery = `
    DELETE FROM cart_items
    WHERE id = ?
  `;

  await sequelize.query(deleteCartItemQuery, {
    replacements: [itemId],
    type: QueryTypes.DELETE,
  });

  const updateCartDateQuery = `
    UPDATE carts
    SET updated_at = NOW()
    WHERE id = ?
  `;

  await sequelize.query(updateCartDateQuery, {
    replacements: [cartItem.cart_id],
    type: QueryTypes.UPDATE,
  });

  const totalAmount = await calculateCartTotal(cartItem.cart_id);

  return res.status(200).json({
    success: true,
    message: "Cart item removed successfully",
    data: {
      cart_id: cartItem.cart_id,
      total_amount: totalAmount,
    },
  });
});

// CLEAR CART
const clearCart = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const cart = await getActiveCartByUserId(userId);

  if (!cart) {
    return res.status(200).json({
      success: true,
      message: "Your cart is already empty or previous cart was abandoned",
      data: {
        cart: null,
        items: [],
        total_amount: 0,
      },
    });
  }

  const checkCartItemsQuery = `
    SELECT COUNT(*) AS item_count
    FROM cart_items
    WHERE cart_id = ?
  `;

  const itemCountResult = await sequelize.query(checkCartItemsQuery, {
    replacements: [cart.id],
    type: QueryTypes.SELECT,
  });

  const itemCount = Number(itemCountResult[0].item_count);

  if (itemCount === 0) {
    return res.status(200).json({
      success: true,
      message: "Your cart is already empty",
      data: {
        cart_id: cart.id,
        total_amount: 0,
      },
    });
  }

  const deleteCartItemsQuery = `
    DELETE FROM cart_items
    WHERE cart_id = ?
  `;

  await sequelize.query(deleteCartItemsQuery, {
    replacements: [cart.id],
    type: QueryTypes.DELETE,
  });

  const updateCartDateQuery = `
    UPDATE carts
    SET updated_at = NOW()
    WHERE id = ?
  `;

  await sequelize.query(updateCartDateQuery, {
    replacements: [cart.id],
    type: QueryTypes.UPDATE,
  });

  return res.status(200).json({
    success: true,
    message: "Cart cleared successfully",
    data: {
      cart_id: cart.id,
      total_amount: 0,
    },
  });
});

module.exports = {
  addToCart,
  getMyCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
};