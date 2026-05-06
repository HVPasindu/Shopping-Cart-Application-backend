const { QueryTypes } = require("sequelize");

const sequelize = require("../db/sequelize");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const {
  notifyActiveCartUsersForProduct,
  notifyActiveCartUsersForCategory,
} = require("../utils/notificationHelper");


const CART_ABANDON_AFTER_DAYS = 7;

// MARK OLD ACTIVE CARTS AS ABANDONED
const abandonOldActiveCartsByUserId = async (userId, transaction = null) => {
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
    transaction,
  });
};

// GET ACTIVE CART BY USER ID
const getActiveCartByUserId = async (userId, transaction = null) => {
  await abandonOldActiveCartsByUserId(userId, transaction);

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
    transaction,
  });

  return carts[0];
};

// CALCULATE CART TOTAL
const calculateCartTotal = async (cartId, transaction = null) => {
  const calculateTotalQuery = `
    SELECT COALESCE(SUM(subtotal), 0) AS total
    FROM cart_items
    WHERE cart_id = ?
  `;

  const result = await sequelize.query(calculateTotalQuery, {
    replacements: [cartId],
    type: QueryTypes.SELECT,
    transaction,
  });

  return Number(result[0].total);
};

// GENERATE ORDER NUMBER
const generateOrderNumber = () => {
  const timestamp = Date.now();
  const randomNumber = Math.floor(1000 + Math.random() * 9000);

  return `ORD-${timestamp}-${randomNumber}`;
};

// GET ORDER SUMMARY BEFORE CONFIRM
const getOrderSummary = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const cart = await getActiveCartByUserId(userId);

  if (!cart) {
    throw new AppError("Your cart is empty or previous cart was abandoned", 400);
  }

  const getCartItemsQuery = `
    SELECT
      cart_items.id AS cart_item_id,
      cart_items.cart_id,
      cart_items.product_id,
      products.name AS product_name,
      products.description AS product_description,
      products.price AS current_price,
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

  if (items.length === 0) {
    throw new AppError("Your cart is empty", 400);
  }

  for (const item of items) {
    if (item.product_status !== "active") {
      item.can_order = false;
      item.issue = "Product is not available";
    } else if (item.category_status !== "active") {
      item.can_order = false;
      item.issue = "Product category is not available";
    } else if (Number(item.stock_quantity) < Number(item.quantity)) {
      item.can_order = false;
      item.issue = "Requested quantity is not available in stock";
    } else {
      item.can_order = true;
      item.issue = null;
    }

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
  const canPlaceOrder = items.every((item) => item.can_order === true);

  return res.status(200).json({
    success: true,
    message: "Order summary fetched successfully",
    data: {
      cart,
      items,
      total_amount: totalAmount,
      can_place_order: canPlaceOrder,
    },
  });
});

// CONFIRM ORDER
const confirmOrder = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const transaction = await sequelize.transaction();

  try {
    const cart = await getActiveCartByUserId(userId, transaction);

    if (!cart) {
      throw new AppError("Your cart is empty or previous cart was abandoned", 400);
    }

    const getCartItemsQuery = `
      SELECT
        cart_items.id AS cart_item_id,
        cart_items.cart_id,
        cart_items.product_id,
        products.category_id,
        products.name AS product_name,
        products.price AS current_price,
        products.stock_quantity,
        products.status AS product_status,
        categories.status AS category_status,
        cart_items.quantity,
        cart_items.unit_price,
        cart_items.subtotal
      FROM cart_items
      INNER JOIN products ON cart_items.product_id = products.id
      INNER JOIN categories ON products.category_id = categories.id
      WHERE cart_items.cart_id = ?
    `;

    const cartItems = await sequelize.query(getCartItemsQuery, {
      replacements: [cart.id],
      type: QueryTypes.SELECT,
      transaction,
    });

    if (cartItems.length === 0) {
      throw new AppError("Your cart is empty", 400);
    }

    for (const item of cartItems) {
      if (item.product_status !== "active") {
        throw new AppError(`${item.product_name} is not available`, 400);
      }

      if (item.category_status !== "active") {
        throw new AppError(`${item.product_name} category is not available`, 400);
      }

      if (Number(item.stock_quantity) < Number(item.quantity)) {
        throw new AppError(
          `${item.product_name} requested quantity is not available in stock`,
          400
        );
      }
    }

    // const totalAmount = cartItems.reduce((total, item) => {
    //   return total + Number(item.subtotal);
    // }, 0);

    const totalAmount = await calculateCartTotal(cart.id, transaction);
    const orderNumber = generateOrderNumber();

    const insertOrderQuery = `
      INSERT INTO orders
      (
        user_id,
        cart_id,
        order_number,
        total_amount,
        order_status,
        payment_status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const insertOrderResult = await sequelize.query(insertOrderQuery, {
      replacements: [
        userId,
        cart.id,
        orderNumber,
        totalAmount,
        "confirmed",
        "pending",
      ],
      type: QueryTypes.INSERT,
      transaction,
    });

    const orderId = insertOrderResult[0];

    for (const item of cartItems) {
      const insertOrderItemQuery = `
        INSERT INTO order_items
        (
          order_id,
          product_id,
          product_name,
          quantity,
          unit_price,
          subtotal,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `;

      await sequelize.query(insertOrderItemQuery, {
        replacements: [
          orderId,
          item.product_id,
          item.product_name,
          item.quantity,
          item.unit_price,
          item.subtotal,
        ],
        type: QueryTypes.INSERT,
        transaction,
      });

      const newStockQuantity =
        Number(item.stock_quantity) - Number(item.quantity);

      const updateProductStockQuery = `
        UPDATE products
        SET
          stock_quantity = ?,
          status = CASE
            WHEN ? = 0 THEN 'inactive'
            ELSE status
          END,
          updated_at = NOW()
        WHERE id = ?
      `;

      await sequelize.query(updateProductStockQuery, {
        replacements: [newStockQuantity, newStockQuantity, item.product_id],
        type: QueryTypes.UPDATE,
        transaction,
      });

      if (newStockQuantity === 0) {
        await notifyActiveCartUsersForProduct({
          productId: item.product_id,
          title: "Product Out of Stock",
          message: `${item.product_name} product එක දැන් out of stock නිසා available නැහැ. එය ඔබගේ cart එකේ තවම තියෙන නමුත් order කරන්න බැහැ.`,
          excludeCartId: cart.id,
          excludeUserId: userId,
          transaction,
        });
      }

      const countActiveProductsQuery = `
        SELECT COUNT(*) AS active_product_count
        FROM products
        WHERE category_id = ?
          AND status = 'active'
      `;

      const activeProductCountResult = await sequelize.query(
        countActiveProductsQuery,
        {
          replacements: [item.category_id],
          type: QueryTypes.SELECT,
          transaction,
        }
      );

      const activeProductCount = Number(
        activeProductCountResult[0].active_product_count
      );

      // if (activeProductCount === 0) {
      //   const updateCategoryStatusQuery = `
      //     UPDATE categories
      //     SET
      //       status = 'inactive',
      //       updated_at = NOW()
      //     WHERE id = ?
      //   `;

      //   await sequelize.query(updateCategoryStatusQuery, {
      //     replacements: [item.category_id],
      //     type: QueryTypes.UPDATE,
      //     transaction,
      //   });
      // }

      if (activeProductCount === 0) {
        const updateCategoryStatusQuery = `
    UPDATE categories
    SET
      status = 'inactive',
      updated_at = NOW()
    WHERE id = ?
  `;

        await sequelize.query(updateCategoryStatusQuery, {
          replacements: [item.category_id],
          type: QueryTypes.UPDATE,
          transaction,
        });

        await notifyActiveCartUsersForCategory({
          categoryId: item.category_id,
          title: "Category Unavailable",
          message: `Cart එකේ ඇති category එකක් දැන් available නැහැ. එම category එකේ cart items order කරන්න බැහැ.`,
          excludeCartId: cart.id,
          excludeUserId: userId,
          transaction,
        });
      }
    }

    const updateCartStatusQuery = `
      UPDATE carts
      SET
        status = 'ordered',
        updated_at = NOW()
      WHERE id = ?
    `;

    await sequelize.query(updateCartStatusQuery, {
      replacements: [cart.id],
      type: QueryTypes.UPDATE,
      transaction,
    });

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: {
        order: {
          id: orderId,
          order_number: orderNumber,
          total_amount: totalAmount,
          order_status: "confirmed",
          payment_status: "pending",
        },
      },
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

// GET MY ORDERS
const getMyOrders = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const getOrdersQuery = `
    SELECT
      id,
      user_id,
      cart_id,
      order_number,
      total_amount,
      order_status,
      payment_status,
      created_at,
      updated_at
    FROM orders
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;

  const orders = await sequelize.query(getOrdersQuery, {
    replacements: [userId],
    type: QueryTypes.SELECT,
  });

  return res.status(200).json({
    success: true,
    message: "Orders fetched successfully",
    data: {
      orders,
    },
  });
});

// GET SINGLE ORDER BY ID
const getOrderById = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const orderId = req.params.id;

  const getOrderQuery = `
    SELECT
      id,
      user_id,
      cart_id,
      order_number,
      total_amount,
      order_status,
      payment_status,
      created_at,
      updated_at
    FROM orders
    WHERE id = ?
      AND user_id = ?
    LIMIT 1
  `;

  const orders = await sequelize.query(getOrderQuery, {
    replacements: [orderId, userId],
    type: QueryTypes.SELECT,
  });

  const order = orders[0];

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  const getOrderItemsQuery = `
    SELECT
      id,
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      subtotal,
      created_at
    FROM order_items
    WHERE order_id = ?
    ORDER BY id ASC
  `;

  const items = await sequelize.query(getOrderItemsQuery, {
    replacements: [orderId],
    type: QueryTypes.SELECT,
  });

  return res.status(200).json({
    success: true,
    message: "Order fetched successfully",
    data: {
      order: {
        ...order,
        items,
      },
    },
  });
});

// CUSTOMER CANCEL OWN ORDER
const cancelMyOrder = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const orderId = req.params.id;

  const transaction = await sequelize.transaction();

  try {
    const getOrderQuery = `
      SELECT *
      FROM orders
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
    `;

    const orders = await sequelize.query(getOrderQuery, {
      replacements: [orderId, userId],
      type: QueryTypes.SELECT,
      transaction,
    });

    const order = orders[0];

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    if (order.order_status === "cancelled") {
      throw new AppError("Order is already cancelled", 400);
    }

    if (order.order_status === "completed") {
      throw new AppError("Completed order cannot be cancelled", 400);
    }

    if (order.order_status !== "confirmed") {
      throw new AppError("Only confirmed orders can be cancelled", 400);
    }

    const getOrderItemsQuery = `
      SELECT
        id,
        order_id,
        product_id,
        product_name,
        quantity
      FROM order_items
      WHERE order_id = ?
    `;

    const orderItems = await sequelize.query(getOrderItemsQuery, {
      replacements: [orderId],
      type: QueryTypes.SELECT,
      transaction,
    });

    for (const item of orderItems) {
      if (!item.product_id) {
        continue;
      }

      const findProductQuery = `
        SELECT *
        FROM products
        WHERE id = ?
        LIMIT 1
      `;

      const products = await sequelize.query(findProductQuery, {
        replacements: [item.product_id],
        type: QueryTypes.SELECT,
        transaction,
      });

      const product = products[0];

      if (!product) {
        continue;
      }

      const restoredStock =
        Number(product.stock_quantity) + Number(item.quantity);

      const restoreProductStockQuery = `
        UPDATE products
        SET
          stock_quantity = ?,
          status = 'active',
          updated_at = NOW()
        WHERE id = ?
      `;

      await sequelize.query(restoreProductStockQuery, {
        replacements: [restoredStock, item.product_id],
        type: QueryTypes.UPDATE,
        transaction,
      });

      await notifyActiveCartUsersForProduct({
        productId: item.product_id,
        title: "Product Available Again",
        message: `${item.product_name} product එක ආපහු stock එකට එකතු වී available වෙලා තියෙනවා. ඔබගේ cart එක check කරන්න.`,
        excludeUserId: userId,
        transaction,
      });

      const activateCategoryQuery = `
        UPDATE categories
        SET
          status = 'active',
          updated_at = NOW()
        WHERE id = ?
      `;

      await sequelize.query(activateCategoryQuery, {
        replacements: [product.category_id],
        type: QueryTypes.UPDATE,
        transaction,
      });

      await notifyActiveCartUsersForCategory({
  categoryId: product.category_id,
  title: "Category Available Again",
  message: `Cart එකේ ඇති category එකක් ආපහු available වෙලා තියෙනවා. ඔබගේ cart එක check කරන්න.`,
  excludeUserId: userId,
  transaction,
});
    }

    const updateOrderStatusQuery = `
      UPDATE orders
      SET
        order_status = 'cancelled',
        updated_at = NOW()
      WHERE id = ?
    `;

    await sequelize.query(updateOrderStatusQuery, {
      replacements: [orderId],
      type: QueryTypes.UPDATE,
      transaction,
    });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: {
        order_id: Number(orderId),
        order_status: "cancelled",
      },
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

module.exports = {
  getOrderSummary,
  confirmOrder,
  getMyOrders,
  getOrderById,
  cancelMyOrder,
};