const mysql = require("mysql2/promise");

const createDatabase = async () => {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    console.log("MySQL server connected successfully");

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``
    );

    console.log(`Database checked/created: ${process.env.DB_NAME}`);
  } catch (error) {
    console.error("Database creation/check error:", error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log("Temporary MySQL connection closed");
    }
  }
};

module.exports = createDatabase;