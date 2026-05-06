const User = require("./User");
const EmailVerification = require("./EmailVerification");
const UserProfile = require("./UserProfile");
const Category = require("./Category");
const Product = require("./Product");
const ProductImage = require("./ProductImage");
const Cart = require("./Cart");
const CartItem = require("./CartItem");
const Order = require("./Order");
const OrderItem = require("./OrderItem");
const Payment = require("./Payment");
const UserAuthProvider = require("./UserAuthProvider");
const Notification = require("./Notification");

// User 1 ---- 1 UserProfile
User.hasOne(UserProfile, {
  foreignKey: "user_id",
  as: "profile",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

UserProfile.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

// User 1 ---- many EmailVerifications
User.hasMany(EmailVerification, {
  foreignKey: "user_id",
  as: "email_verifications",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

EmailVerification.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

// User 1 ---- many Auth Providers
User.hasMany(UserAuthProvider, {
  foreignKey: "user_id",
  as: "auth_providers",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

UserAuthProvider.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

// User 1 ---- many Notifications
User.hasMany(Notification, {
  foreignKey: "user_id",
  as: "notifications",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Notification.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

// Category 1 ---- many Products
// Category.hasMany(Product, {
//   foreignKey: "category_id",
//   as: "products",
//   onDelete: "RESTRICT",
//   onUpdate: "CASCADE",
// });

// Product.belongsTo(Category, {
//   foreignKey: "category_id",
//   as: "category",
// });

// Category 1 ---- many Products
Category.hasMany(Product, {
  foreignKey: "category_id",
  as: "products",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Product.belongsTo(Category, {
  foreignKey: "category_id",
  as: "category",
});


// Product 1 ---- many ProductImages
Product.hasMany(ProductImage, {
  foreignKey: "product_id",
  as: "images",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

ProductImage.belongsTo(Product, {
  foreignKey: "product_id",
  as: "product",
});

// User 1 ---- many Carts
User.hasMany(Cart, {
  foreignKey: "user_id",
  as: "carts",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Cart.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

// Cart 1 ---- many CartItems
Cart.hasMany(CartItem, {
  foreignKey: "cart_id",
  as: "items",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

CartItem.belongsTo(Cart, {
  foreignKey: "cart_id",
  as: "cart",
});

// Product 1 ---- many CartItems
// Product.hasMany(CartItem, {
//   foreignKey: "product_id",
//   as: "cart_items",
//   onDelete: "RESTRICT",
//   onUpdate: "CASCADE",
// });

// CartItem.belongsTo(Product, {
//   foreignKey: "product_id",
//   as: "product",
// });

// Product 1 ---- many CartItems
Product.hasMany(CartItem, {
  foreignKey: "product_id",
  as: "cart_items",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

CartItem.belongsTo(Product, {
  foreignKey: "product_id",
  as: "product",
});

// User 1 ---- many Orders
User.hasMany(Order, {
  foreignKey: "user_id",
  as: "orders",
  onDelete: "RESTRICT",
  onUpdate: "CASCADE",
});

Order.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

// Cart 1 ---- 1 Order
Cart.hasOne(Order, {
  foreignKey: "cart_id",
  as: "order",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

Order.belongsTo(Cart, {
  foreignKey: "cart_id",
  as: "cart",
});

// Order 1 ---- many OrderItems
Order.hasMany(OrderItem, {
  foreignKey: "order_id",
  as: "items",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

OrderItem.belongsTo(Order, {
  foreignKey: "order_id",
  as: "order",
});

// Product 1 ---- many OrderItems
// Product.hasMany(OrderItem, {
//   foreignKey: "product_id",
//   as: "order_items",
//   onDelete: "RESTRICT",
//   onUpdate: "CASCADE",
// });

// OrderItem.belongsTo(Product, {
//   foreignKey: "product_id",
//   as: "product",
// });

// Product 1 ---- many OrderItems
Product.hasMany(OrderItem, {
  foreignKey: "product_id",
  as: "order_items",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

OrderItem.belongsTo(Product, {
  foreignKey: "product_id",
  as: "product",
});

// Order 1 ---- 1 Payment
Order.hasOne(Payment, {
  foreignKey: "order_id",
  as: "payment",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Payment.belongsTo(Order, {
  foreignKey: "order_id",
  as: "order",
});

module.exports = {
  User,
  EmailVerification,
  UserProfile,
  Category,
  Product,
  ProductImage,
  Cart,
  CartItem,
  Order,
  OrderItem,
  Payment,
  UserAuthProvider,
  Notification,
};