const { DataTypes } = require("sequelize");
const sequelize = require("../db/sequelize");

const Cart = sequelize.define(
  "Cart",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM("active", "ordered", "abandoned"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    tableName: "carts",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Cart;