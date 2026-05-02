const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");

const createDatabase = require("./db/createDatabase");
const sequelize = require("./db/sequelize");

const AppError = require("./utils/AppError");
const errorMiddleware = require("./middleware/errorMiddleware");

const authRoutes = require("./routes/authRoutes");


// Models and relationships loaded
require("./models");

const app = express();


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test route
app.get("/", (req, res) => {
  res.send("Shopping Cart API running...");
});

// Example test error route
app.get("/test-error", (req, res, next) => {
  return next(new AppError("This is a test error", 400));
});

//in here add the routes
app.use("/api/auth", authRoutes);



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
    await sequelize.sync({ alter: true });
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