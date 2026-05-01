const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");

const createDatabase = require("./db/createDatabase");
const sequelize = require("./db/sequelize");

// Models and relationships load කරනවා
require("./models");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Shopping Cart API running...");
});

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