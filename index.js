const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");

const createDatabase = require("./db/createDatabase");
const sequelize = require("./db/sequelize");

const AppError = require("./utils/AppError");
const errorMiddleware = require("./middleware/errorMiddleware");

const path = require("path");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const profileRoutes = require("./routes/profileRoutes");
const cartRoutes = require("./routes/cartRoutes");

// const { protect } = require("./middleware/authMiddleware");
// const { adminOnly } = require("./middleware/adminMiddleware");


// Models and relationships loaded
require("./models");

const app = express();


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Test route
app.get("/", (req, res) => {
  res.send("Shopping Cart API running...");
});

// Example test error route
app.get("/test-error", (req, res, next) => {
  return next(new AppError("This is a test error", 400));
});

//test for token
// app.get("/api/test/protected", protect, (req, res) => {
//   res.status(200).json({
//     success: true,
//     message: "Protected route access successful",
//     user: req.user,
//   });
// });

//test for admin 
// app.get("/api/test/admin", protect, adminOnly, (req, res) => {
//   res.status(200).json({
//     success: true,
//     message: "Admin route access successful",
//     user: req.user,
//   });
// });

//in here add the routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/cart", cartRoutes);



// Wrong route handler
app.use((req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
});

// Global error handler 
app.use(errorMiddleware);


const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // 1.if  Database is not , create the database
    await createDatabase();

    // 2. Sequelize database connection 
    await sequelize.authenticate();
    console.log("Sequelize connected to MySQL successfully");

    // 3. Models  tables create/update 
    await sequelize.sync();
    console.log("All tables checked/created successfully");

    // 4. Express server start 
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup error:", error.message);
    process.exit(1);
  }
};

startServer();