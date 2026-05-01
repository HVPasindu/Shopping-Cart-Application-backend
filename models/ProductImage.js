const { DataTypes } = require("sequelize");
const sequelize = require("../db/sequelize");

const ProductImage = sequelize.define(
  "ProductImage",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    image_url: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    is_main: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "product_images",
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

module.exports = ProductImage;