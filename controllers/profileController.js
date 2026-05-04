const { QueryTypes } = require("sequelize");

const sequelize = require("../db/sequelize");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const deleteFile = require("../utils/deleteFile");

// GET MY PROFILE
const getMyProfile = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const getProfileQuery = `
    SELECT
      users.id AS user_id,
      users.name,
      users.email,
      users.phone,
      users.role,
      users.status,

      user_profiles.id AS profile_id,
      user_profiles.address,
      user_profiles.city,
      user_profiles.postal_code,
      user_profiles.profile_image,
      user_profiles.created_at AS profile_created_at,
      user_profiles.updated_at AS profile_updated_at
    FROM users
    LEFT JOIN user_profiles ON users.id = user_profiles.user_id
    WHERE users.id = ?
    LIMIT 1
  `;

  const profiles = await sequelize.query(getProfileQuery, {
    replacements: [userId],
    type: QueryTypes.SELECT,
  });

  const profile = profiles[0];

  if (!profile) {
    throw new AppError("User not found", 404);
  }

  return res.status(200).json({
    success: true,
    message: "Profile fetched successfully",
    data: {
      profile: {
        ...profile,
        profile_image_url: profile.profile_image
          ? `${req.protocol}://${req.get("host")}/${profile.profile_image}`
          : null,
      },
    },
  });
});

// UPDATE / CREATE MY PROFILE
const updateMyProfile = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { name, phone, address, city, postal_code } = req.body;

  // 1. Current user details 
  const findUserQuery = `
    SELECT *
    FROM users
    WHERE id = ?
    LIMIT 1
  `;

  const users = await sequelize.query(findUserQuery, {
    replacements: [userId],
    type: QueryTypes.SELECT,
  });

  const user = users[0];

  if (!user) {
    if (req.file) {
      deleteFile(req.file.path);
    }

    throw new AppError("User not found", 404);
  }

  const updatedName = name !== undefined ? name : user.name;
  const updatedPhone = phone !== undefined ? phone : user.phone;

  // 2. users table  name/phone update 
  const updateUserQuery = `
    UPDATE users
    SET
      name = ?,
      phone = ?,
      updated_at = NOW()
    WHERE id = ?
  `;

  await sequelize.query(updateUserQuery, {
    replacements: [
      updatedName,
      updatedPhone || null,
      userId,
    ],
    type: QueryTypes.UPDATE,
  });

  // 3. user_profiles table  profile 
  const findProfileQuery = `
    SELECT *
    FROM user_profiles
    WHERE user_id = ?
    LIMIT 1
  `;

  const profiles = await sequelize.query(findProfileQuery, {
    replacements: [userId],
    type: QueryTypes.SELECT,
  });

  const existingProfile = profiles[0];

  let profileImagePath = existingProfile ? existingProfile.profile_image : null;

  // 4. New image 
  if (req.file) {
    profileImagePath = req.file.path.replace(/\\/g, "/");

    if (existingProfile && existingProfile.profile_image) {
      deleteFile(existingProfile.profile_image);
    }
  }

  if (existingProfile) {
    const updatedAddress =
      address !== undefined ? address : existingProfile.address;

    const updatedCity = city !== undefined ? city : existingProfile.city;

    const updatedPostalCode =
      postal_code !== undefined ? postal_code : existingProfile.postal_code;

    const updateProfileQuery = `
      UPDATE user_profiles
      SET
        address = ?,
        city = ?,
        postal_code = ?,
        profile_image = ?,
        updated_at = NOW()
      WHERE user_id = ?
    `;

    await sequelize.query(updateProfileQuery, {
      replacements: [
        updatedAddress || null,
        updatedCity || null,
        updatedPostalCode || null,
        profileImagePath,
        userId,
      ],
      type: QueryTypes.UPDATE,
    });
  } else {
    const insertProfileQuery = `
      INSERT INTO user_profiles
      (
        user_id,
        address,
        city,
        postal_code,
        profile_image,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `;

    await sequelize.query(insertProfileQuery, {
      replacements: [
        userId,
        address || null,
        city || null,
        postal_code || null,
        profileImagePath,
      ],
      type: QueryTypes.INSERT,
    });
  }

  // 5. Updated profile data එක users + user_profiles join 
  const getUpdatedProfileQuery = `
    SELECT
      users.id AS user_id,
      users.name,
      users.email,
      users.phone,
      users.role,
      users.status,

      user_profiles.id AS profile_id,
      user_profiles.address,
      user_profiles.city,
      user_profiles.postal_code,
      user_profiles.profile_image,
      user_profiles.created_at AS profile_created_at,
      user_profiles.updated_at AS profile_updated_at
    FROM users
    LEFT JOIN user_profiles ON users.id = user_profiles.user_id
    WHERE users.id = ?
    LIMIT 1
  `;

  const updatedProfiles = await sequelize.query(getUpdatedProfileQuery, {
    replacements: [userId],
    type: QueryTypes.SELECT,
  });

  const updatedProfile = updatedProfiles[0];

  return res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: {
      profile: {
        ...updatedProfile,
        profile_image_url: updatedProfile.profile_image
          ? `${req.protocol}://${req.get("host")}/${updatedProfile.profile_image}`
          : null,
      },
    },
  });
});

module.exports = {
  getMyProfile,
  updateMyProfile,
};