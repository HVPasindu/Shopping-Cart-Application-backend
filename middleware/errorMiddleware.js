const errorMiddleware = (err, req, res, next) => {
  console.error("ERROR:", err);

  const statusCode = err.statusCode || 500;
  const status = err.status || "error";
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    success: false,
    status,
    message,
  });
};

module.exports = errorMiddleware;