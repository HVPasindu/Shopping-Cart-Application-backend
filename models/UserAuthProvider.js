const { DataTypes } = require("sequelize");
const sequelize = require("../db/sequelize");

const UserAuthProvider = sequelize.define(
  "UserAuthProvider",
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

    provider: {
      type: DataTypes.ENUM("google", "facebook", "passkey"),
      allowNull: false,
    },

    provider_user_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    tableName: "user_auth_providers",
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["provider", "provider_user_id"],
      },
      {
        unique: true,
        fields: ["user_id", "provider"],
      },
    ],
  }
);

module.exports = UserAuthProvider;