const { QueryTypes } = require("sequelize");

const sequelize = require("../db/sequelize");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

const {
  createNotification,
  notifyActiveCartUsersForProduct,
  notifyActiveCartUsersForCategory,
} = require("../utils/notificationHelper");

// GET ALL ORDERS - ADMIN ONLY
const getAllOrdersForAdmin = catchAsync(async (req, res) => {
  const { status, payment_status } = req.query;

  let getOrdersQuery = `
    SELECT
      orders.id,
      orders.user_id,
      users.name AS customer_name,
      users.email AS customer_email,
      users.phone AS customer_phone,
      orders.cart_id,
      orders.order_number,
      orders.total_amount,
      orders.order_status,
      orders.payment_status,
      orders.created_at,
      orders.updated_at
    FROM orders
    INNER JOIN users ON orders.user_id = users.id
  `;

  const conditions = [];
  const replacements = [];

  if (status) {
    const allowedStatuses = ["pending", "confirmed", "cancelled", "completed"];

    if (!allowedStatuses.includes(status)) {
      throw new AppError("Invalid order status", 400);
    }

    conditions.push("orders.order_status = ?");
    replacements.push(status);
  }

  if (payment_status) {
    const allowedPaymentStatuses = ["pending", "paid", "failed"];

    if (!allowedPaymentStatuses.includes(payment_status)) {
      throw new AppError("Invalid payment status", 400);
    }

    conditions.push("orders.payment_status = ?");
    replacements.push(payment_status);
  }

  if (conditions.length > 0) {
    getOrdersQuery += `
      WHERE ${conditions.join(" AND ")}
    `;
  }

  getOrdersQuery += `
    ORDER BY orders.created_at DESC
  `;

  const orders = await sequelize.query(getOrdersQuery, {
    replacements,
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

// GET SINGLE ORDER - ADMIN ONLY
const getOrderByIdForAdmin = catchAsync(async (req, res) => {
  const orderId = req.params.id;

  const getOrderQuery = `
    SELECT
      orders.id,
      orders.user_id,
      users.name AS customer_name,
      users.email AS customer_email,
      users.phone AS customer_phone,
      orders.cart_id,
      orders.order_number,
      orders.total_amount,
      orders.order_status,
      orders.payment_status,
      orders.created_at,
      orders.updated_at
    FROM orders
    INNER JOIN users ON orders.user_id = users.id
    WHERE orders.id = ?
    LIMIT 1
  `;

  const orders = await sequelize.query(getOrderQuery, {
    replacements: [orderId],
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

// UPDATE ORDER STATUS - ADMIN ONLY
const updateOrderStatusForAdmin = catchAsync(async (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;

  const allowedStatuses = ["cancelled", "completed"];

  if (!status) {
    throw new AppError("Status is required", 400);
  }

  if (!allowedStatuses.includes(status)) {
    throw new AppError("Admin can only set status to cancelled or completed", 400);
  }

  const transaction = await sequelize.transaction();

  try {
    const getOrderQuery = `
      SELECT *
      FROM orders
      WHERE id = ?
      LIMIT 1
    `;

    const orders = await sequelize.query(getOrderQuery, {
      replacements: [orderId],
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
      throw new AppError("Order is already completed", 400);
    }

    if (order.order_status !== "confirmed") {
      throw new AppError("Only confirmed orders can be updated", 400);
    }

    if (status === "completed") {
      const updateOrderQuery = `
        UPDATE orders
        SET
          order_status = 'completed',
          updated_at = NOW()
        WHERE id = ?
      `;

      await sequelize.query(updateOrderQuery, {
        replacements: [orderId],
        type: QueryTypes.UPDATE,
        transaction,
      });

      await createNotification({
        userId: order.user_id,
        title: "Order Completed",
        message: `Your order ${order.order_number} has been completed.`,
        type: "order",
        transaction,
      });

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: "Order marked as completed successfully",
        data: {
          order_id: Number(orderId),
          order_status: "completed",
        },
      });
    }

    if (status === "cancelled") {
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
          excludeUserId: order.user_id,
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
          excludeUserId: order.user_id,
          transaction,
        });
      }

      const updateOrderQuery = `
        UPDATE orders
        SET
          order_status = 'cancelled',
          updated_at = NOW()
        WHERE id = ?
      `;

      await sequelize.query(updateOrderQuery, {
        replacements: [orderId],
        type: QueryTypes.UPDATE,
        transaction,
      });

      await createNotification({
        userId: order.user_id,
        title: "Order Cancelled",
        message: `Your order ${order.order_number} has been cancelled by admin.`,
        type: "order",
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
    }
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

module.exports = {
  getAllOrdersForAdmin,
  getOrderByIdForAdmin,
  updateOrderStatusForAdmin,
};