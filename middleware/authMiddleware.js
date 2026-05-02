const jwt = require("jsonwebtoken");
const sequelize = require("../db/sequelize");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

const protect = catchAsync(async (req, res, next) => {
  let token;

  // Authorization header එකෙන් token එක ගන්නවා
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    throw new AppError("You are not logged in. Please login first.", 401);
  }

  // Token verify කරනවා
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const findUserQuery = `
    SELECT id, name, email, phone, role, is_email_verified, status
    FROM users
    WHERE id = ?
    LIMIT 1
  `;

  const [users] = await sequelize.query(findUserQuery, {
    replacements: [decoded.id],
  });

  const user = users[0];

  if (!user) {
    throw new AppError("User belonging to this token no longer exists.", 401);
  }

  if (!user.is_email_verified) {
    throw new AppError("Please verify your email first.", 401);
  }

  if (user.status !== "active") {
    throw new AppError("Your account is not active.", 403);
  }

  // ඊළඟ controller එකට user data pass කරනවා
  req.user = user;

  next();
});

module.exports = {
  protect,
};