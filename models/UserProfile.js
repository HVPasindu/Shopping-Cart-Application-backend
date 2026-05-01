const { DataTypes } = require("sequelize");
const sequelize = require("../db/sequelize");

const UserProfile = sequelize.define(
  "UserProfile",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },

    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    postal_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    profile_image: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "user_profiles",
    timestamps: true,
    underscored: true,
  }
);

module.exports = UserProfile;