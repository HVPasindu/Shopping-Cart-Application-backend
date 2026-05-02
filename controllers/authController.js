const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { QueryTypes } = require("sequelize");

const sequelize = require("../db/sequelize");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const generateOtp = require("../utils/generateOtp");
const { sendOtpEmail } = require("../services/emailService");

// JWT token create function
const createToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );
};

// Email --> user find , helper function 
const findUserByEmail = async (email) => {
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

  return users[0];
};

// OTP create + save + send
const createAndSendOtp = async (user) => {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const disableOldOtpQuery = `
    UPDATE email_verifications
    SET is_used = true
    WHERE user_id = ?
      AND is_used = false
  `;

  await sequelize.query(disableOldOtpQuery, {
    replacements: [user.id],
    type: QueryTypes.UPDATE,
  });

  const insertOtpQuery = `
    INSERT INTO email_verifications
    (
      user_id,
      email,
      otp_code,
      expires_at,
      is_used,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, NOW())
  `;

  await sequelize.query(insertOtpQuery, {
    replacements: [user.id, user.email, otp, expiresAt, false],
    type: QueryTypes.INSERT,
  });

  await sendOtpEmail(user.email, otp);

  return otp;
};

// REGISTER
const register = catchAsync(async (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    throw new AppError("Name, email and password are required", 400);
  }

  if (password.length < 6) {
    throw new AppError("Password must be at least 6 characters", 400);
  }

  const existingUser = await findUserByEmail(email);

  if (existingUser && Boolean(existingUser.is_email_verified)) {
    throw new AppError("Email already exists. Please login.", 400);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  let user;

  if (existingUser && !Boolean(existingUser.is_email_verified)) {
    const updateUserQuery = `
      UPDATE users
      SET
        name = ?,
        password = ?,
        phone = ?,
        role = ?,
        is_email_verified = ?,
        status = ?,
        updated_at = NOW()
      WHERE email = ?
    `;

    await sequelize.query(updateUserQuery, {
      replacements: [
        name,
        hashedPassword,
        phone || existingUser.phone || null,
        "customer",
        false,
        "active",
        email,
      ],
      type: QueryTypes.UPDATE,
    });

    const findUpdatedUserQuery = `
      SELECT *
      FROM users
      WHERE email = ?
      LIMIT 1
    `;

    const updatedUsers = await sequelize.query(findUpdatedUserQuery, {
      replacements: [email],
      type: QueryTypes.SELECT,
    });

    user = updatedUsers[0];
  }

  if (!existingUser) {
    const insertUserQuery = `
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

    await sequelize.query(insertUserQuery, {
      replacements: [
        name,
        email,
        hashedPassword,
        phone || null,
        "customer",
        false,
        "active",
      ],
      type: QueryTypes.INSERT,
    });

    const findNewUserQuery = `
      SELECT *
      FROM users
      WHERE email = ?
      LIMIT 1
    `;

    const newUsers = await sequelize.query(findNewUserQuery, {
      replacements: [email],
      type: QueryTypes.SELECT,
    });

    user = newUsers[0];
  }

  await createAndSendOtp(user);

  return res.status(201).json({
    success: true,
    message: "Registration successful. OTP sent to your email.",
    data: {
      email: user.email,
      is_email_verified: Boolean(user.is_email_verified),
    },
  });
});

// VERIFY OTP
const verifyOtp = catchAsync(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new AppError("Email and OTP are required", 400);
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

  const user = users[0];

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (Boolean(user.is_email_verified)) {
    return res.status(200).json({
      success: true,
      message: "Email already verified. You can login now.",
    });
  }

  const findOtpQuery = `
    SELECT *
    FROM email_verifications
    WHERE user_id = ?
      AND email = ?
      AND otp_code = ?
      AND is_used = false
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const otpRecords = await sequelize.query(findOtpQuery, {
    replacements: [user.id, email, otp],
    type: QueryTypes.SELECT,
  });

  const otpRecord = otpRecords[0];

  if (!otpRecord) {
    throw new AppError("Invalid OTP", 400);
  }

  if (new Date() > new Date(otpRecord.expires_at)) {
    throw new AppError("OTP expired. Please request a new OTP.", 400);
  }

  const verifyUserEmailQuery = `
    UPDATE users
    SET
      is_email_verified = true,
      updated_at = NOW()
    WHERE id = ?
  `;

  await sequelize.query(verifyUserEmailQuery, {
    replacements: [user.id],
    type: QueryTypes.UPDATE,
  });

  const markOtpAsUsedQuery = `
    UPDATE email_verifications
    SET is_used = true
    WHERE id = ?
  `;

  await sequelize.query(markOtpAsUsedQuery, {
    replacements: [otpRecord.id],
    type: QueryTypes.UPDATE,
  });

  return res.status(200).json({
    success: true,
    message: "Email verified successfully. You can login now.",
  });
});

// RESEND OTP
const resendOtp = catchAsync(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError("Email is required", 400);
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

  const user = users[0];

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (Boolean(user.is_email_verified)) {
    throw new AppError("Email already verified. Please login.", 400);
  }

  await createAndSendOtp(user);

  return res.status(200).json({
    success: true,
    message: "New OTP sent to your email.",
  });
});

// LOGIN
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
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

  const user = users[0];

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.password);

  if (!isPasswordCorrect) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!Boolean(user.is_email_verified)) {
    //await createAndSendOtp(user);

    throw new AppError(
      "Please verify your email first. A new OTP has been sent.",
      401
    );
  }

  if (user.status !== "active") {
    throw new AppError("Your account is not active", 403);
  }

  const token = createToken(user);

  return res.status(200).json({
    success: true,
    message: "Login successful",
    token,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    },
  });
});

module.exports = {
  register,
  verifyOtp,
  resendOtp,
  login,
};