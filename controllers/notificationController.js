const { QueryTypes } = require("sequelize");

const sequelize = require("../db/sequelize");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

// GET MY NOTIFICATIONS
const getMyNotifications = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { is_read, type } = req.query;

  let getNotificationsQuery = `
    SELECT
      id,
      user_id,
      title,
      message,
      type,
      is_read,
      created_at
    FROM notifications
    WHERE user_id = ?
  `;

  const replacements = [userId];

  if (is_read !== undefined) {
    if (is_read !== "true" && is_read !== "false") {
      throw new AppError("is_read must be true or false", 400);
    }

    getNotificationsQuery += `
      AND is_read = ?
    `;

    replacements.push(is_read === "true");
  }

  if (type) {
    const allowedTypes = ["cart", "order", "system"];

    if (!allowedTypes.includes(type)) {
      throw new AppError("Invalid notification type", 400);
    }

    getNotificationsQuery += `
      AND type = ?
    `;

    replacements.push(type);
  }

  getNotificationsQuery += `
    ORDER BY created_at DESC
  `;

  const notifications = await sequelize.query(getNotificationsQuery, {
    replacements,
    type: QueryTypes.SELECT,
  });

  const unreadCountQuery = `
    SELECT COUNT(*) AS unread_count
    FROM notifications
    WHERE user_id = ?
      AND is_read = false
  `;

  const unreadCountResult = await sequelize.query(unreadCountQuery, {
    replacements: [userId],
    type: QueryTypes.SELECT,
  });

  const unreadCount = Number(unreadCountResult[0].unread_count);

  return res.status(200).json({
    success: true,
    message: "Notifications fetched successfully",
    data: {
      unread_count: unreadCount,
      notifications,
    },
  });
});

// MARK ONE NOTIFICATION AS READ
const markNotificationAsRead = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const notificationId = req.params.id;

  const findNotificationQuery = `
    SELECT *
    FROM notifications
    WHERE id = ?
      AND user_id = ?
    LIMIT 1
  `;

  const notifications = await sequelize.query(findNotificationQuery, {
    replacements: [notificationId, userId],
    type: QueryTypes.SELECT,
  });

  const notification = notifications[0];

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  const updateNotificationQuery = `
    UPDATE notifications
    SET is_read = true
    WHERE id = ?
      AND user_id = ?
  `;

  await sequelize.query(updateNotificationQuery, {
    replacements: [notificationId, userId],
    type: QueryTypes.UPDATE,
  });

  return res.status(200).json({
    success: true,
    message: "Notification marked as read successfully",
    data: {
      notification_id: Number(notificationId),
      is_read: true,
    },
  });
});

// MARK ALL NOTIFICATIONS AS READ
const markAllNotificationsAsRead = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const updateNotificationsQuery = `
    UPDATE notifications
    SET is_read = true
    WHERE user_id = ?
      AND is_read = false
  `;

  await sequelize.query(updateNotificationsQuery, {
    replacements: [userId],
    type: QueryTypes.UPDATE,
  });

  return res.status(200).json({
    success: true,
    message: "All notifications marked as read successfully",
  });
});

module.exports = {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};