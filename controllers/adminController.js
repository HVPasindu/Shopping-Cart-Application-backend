const bcrypt = require("bcryptjs");
const { QueryTypes } = require("sequelize");

const sequelize = require("../db/sequelize");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

// CREATE NEW ADMIN
const createAdmin = catchAsync(async (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    throw new AppError("Name, email and password are required", 400);
  }

  if (password.length < 6) {
    throw new AppError("Password must be at least 6 characters", 400);
  }

  const findUserQuery = `
    SELECT *
    FROM users
    WHERE email = ?
    LIMIT 1
  `;

  const users = await sequelize.query(findUserQuery, {
    replacements: [email],
    type: QueryTypes.SELECT,
  });

  const existingUser = users[0];

  if (existingUser) {
    throw new AppError("Email already exists", 400);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const insertAdminQuery = `
    INSERT INTO users
    (
      name,
      email,
      password,
      phone,
      role,
      is_email_verified,
      status,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `;

  await sequelize.query(insertAdminQuery, {
    replacements: [
      name,
      email,
      hashedPassword,
      phone || null,
      "admin",
      true,
      "active",
    ],
    type: QueryTypes.INSERT,
  });

  const findCreatedAdminQuery = `
    SELECT id, name, email, phone, role, is_email_verified, status, created_at
    FROM users
    WHERE email = ?
    LIMIT 1
  `;

  const createdAdmins = await sequelize.query(findCreatedAdminQuery, {
    replacements: [email],
    type: QueryTypes.SELECT,
  });

  const createdAdmin = createdAdmins[0];

  return res.status(201).json({
    success: true,
    message: "Admin created successfully",
    data: {
      admin: createdAdmin,
    },
  });
});

// GET ALL CUSTOMERS
const getAllUsers = catchAsync(async (req, res) => {
  const getUsersQuery = `
    SELECT 
      id,
      name,
      email,
      phone,
      role,
      is_email_verified,
      status,
      created_at,
      updated_at
    FROM users
    WHERE role = 'customer'
    ORDER BY created_at DESC
  `;

  const users = await sequelize.query(getUsersQuery, {
    type: QueryTypes.SELECT,
  });

  return res.status(200).json({
    success: true,
    message: "Users fetched successfully",
    data: {
      users,
    },
  });
});

// GET ALL ADMINS
const getAllAdmins = catchAsync(async (req, res) => {
  const getAdminsQuery = `
    SELECT 
      id,
      name,
      email,
      phone,
      role,
      is_email_verified,
      status,
      created_at,
      updated_at
    FROM users
    WHERE role = 'admin'
    ORDER BY created_at DESC
  `;

  const admins = await sequelize.query(getAdminsQuery, {
    type: QueryTypes.SELECT,
  });

  return res.status(200).json({
    success: true,
    message: "Admins fetched successfully",
    data: {
      admins,
    },
  });
});

// UPDATE CUSTOMER STATUS - ANY ADMIN
const updateCustomerStatus = catchAsync(async (req, res) => {
  const userId = req.params.id;
  const { status } = req.body;

  const allowedStatuses = ["active", "inactive", "blocked"];

  if (!status) {
    throw new AppError("Status is required", 400);
  }

  if (!allowedStatuses.includes(status)) {
    throw new AppError("Invalid status", 400);
  }

  const findUserQuery = `
    SELECT *
    FROM users
    WHERE id = ?
    LIMIT 1
  `;

  const users = await sequelize.query(findUserQuery, {
    replacements: [userId],
    type: QueryTypes.SELECT,
  });

  const user = users[0];

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.role !== "customer") {
    throw new AppError("This route can update customer status only", 400);
  }

  const updateStatusQuery = `
    UPDATE users
    SET status = ?, updated_at = NOW()
    WHERE id = ?
  `;

  await sequelize.query(updateStatusQuery, {
    replacements: [status, userId],
    type: QueryTypes.UPDATE,
  });

  return res.status(200).json({
    success: true,
    message: "Customer status updated successfully",
    data: {
      user_id: Number(userId),
      status,
    },
  });
});

// UPDATE ADMIN STATUS - MAIN ADMIN ONLY
const updateAdminStatus = catchAsync(async (req, res) => {
  const adminId = req.params.id;
  const { status } = req.body;

  const allowedStatuses = ["active", "inactive", "blocked"];

  if (!status) {
    throw new AppError("Status is required", 400);
  }

  if (!allowedStatuses.includes(status)) {
    throw new AppError("Invalid status", 400);
  }

  const findAdminQuery = `
    SELECT *
    FROM users
    WHERE id = ?
    LIMIT 1
  `;

  const admins = await sequelize.query(findAdminQuery, {
    replacements: [adminId],
    type: QueryTypes.SELECT,
  });

  const admin = admins[0];

  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  if (admin.role !== "admin") {
    throw new AppError("This route can update admin status only", 400);
  }

  if (admin.name === "Main Admin") {
    throw new AppError("Main Admin status cannot be changed", 400);
  }

  const updateStatusQuery = `
    UPDATE users
    SET status = ?, updated_at = NOW()
    WHERE id = ?
  `;

  await sequelize.query(updateStatusQuery, {
    replacements: [status, adminId],
    type: QueryTypes.UPDATE,
  });

  return res.status(200).json({
    success: true,
    message: "Admin status updated successfully",
    data: {
      admin_id: Number(adminId),
      status,
    },
  });
});

module.exports = {
  createAdmin,
  getAllUsers,
  getAllAdmins,
  updateCustomerStatus,
  updateAdminStatus,
};