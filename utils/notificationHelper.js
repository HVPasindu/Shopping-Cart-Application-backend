const { QueryTypes } = require("sequelize");

const sequelize = require("../db/sequelize");

// CREATE SINGLE NOTIFICATION
const createNotification = async ({
  userId,
  title,
  message,
  type = "system",
  transaction = null,
}) => {
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
    replacements: [userId, title, message, type, false],
    type: QueryTypes.INSERT,
    transaction,
  });
};

// NOTIFY USERS WHO HAVE THIS PRODUCT IN ACTIVE CARTS
const notifyActiveCartUsersForProduct = async ({
  productId,
  title = "Cart Product Update",
  message,
  excludeCartId = null,
  excludeUserId = null,
  transaction = null,
}) => {
  let findAffectedUsersQuery = `
    SELECT DISTINCT
      carts.user_id,
      products.name AS product_name
    FROM cart_items
    INNER JOIN carts ON cart_items.cart_id = carts.id
    INNER JOIN products ON cart_items.product_id = products.id
    WHERE cart_items.product_id = ?
      AND carts.status = 'active'
  `;

  const replacements = [productId];

  if (excludeCartId) {
    findAffectedUsersQuery += `
      AND carts.id != ?
    `;
    replacements.push(excludeCartId);
  }

  if (excludeUserId) {
    findAffectedUsersQuery += `
      AND carts.user_id != ?
    `;
    replacements.push(excludeUserId);
  }

  const affectedUsers = await sequelize.query(findAffectedUsersQuery, {
    replacements,
    type: QueryTypes.SELECT,
    transaction,
  });

  for (const affectedUser of affectedUsers) {
    await createNotification({
      userId: affectedUser.user_id,
      title,
      message:
        message ||
        `${affectedUser.product_name} product එකේ update එකක් තියෙනවා. කරුණාකර cart එක check කරන්න.`,
      type: "cart",
      transaction,
    });
  }
};

// NOTIFY USERS WHO HAVE PRODUCTS OF THIS CATEGORY IN ACTIVE CARTS
const notifyActiveCartUsersForCategory = async ({
  categoryId,
  title = "Cart Category Update",
  message,
  excludeCartId = null,
  excludeUserId = null,
  transaction = null,
}) => {
  let findAffectedUsersQuery = `
    SELECT DISTINCT
      carts.user_id,
      categories.name AS category_name
    FROM cart_items
    INNER JOIN carts ON cart_items.cart_id = carts.id
    INNER JOIN products ON cart_items.product_id = products.id
    INNER JOIN categories ON products.category_id = categories.id
    WHERE categories.id = ?
      AND carts.status = 'active'
  `;

  const replacements = [categoryId];

  if (excludeCartId) {
    findAffectedUsersQuery += `
      AND carts.id != ?
    `;
    replacements.push(excludeCartId);
  }

  if (excludeUserId) {
    findAffectedUsersQuery += `
      AND carts.user_id != ?
    `;
    replacements.push(excludeUserId);
  }

  const affectedUsers = await sequelize.query(findAffectedUsersQuery, {
    replacements,
    type: QueryTypes.SELECT,
    transaction,
  });

  for (const affectedUser of affectedUsers) {
    await createNotification({
      userId: affectedUser.user_id,
      title,
      message:
        message ||
        `${affectedUser.category_name} category එකේ update එකක් තියෙනවා. කරුණාකර cart එක check කරන්න.`,
      type: "cart",
      transaction,
    });
  }
};

module.exports = {
  createNotification,
  notifyActiveCartUsersForProduct,
  notifyActiveCartUsersForCategory,
};