// dependencies
const moment = require("moment");
const bcrypt = require("bcryptjs");
const sanitize = require("mongo-sanitize");
const salt = parseInt(process.env.SALT);

// data_models
const UserModel = require("../../models/SystemUsers");
const Role = require("../../models/Role");

// utility_functions
const systemLogsHelper = require("../../helpers/system-logs");
const {
  sendResponse,
  checkKeysExist,
  setUserResponse,
  tokenLimit,
  decryptToken,
  deleteTokenById,
} = require("../../helpers/utils");

// module_identifier
const moduleName = "Authentication";

module.exports = {
  login,
  updatePassword,
  logout,
  checkAuth,
  getProfile,
  updateProfile,
  changePassword,
};

/** validate_credentials_and_create_session **/
async function login(request, response) {
  let params = request.body;

  // validate_input_parameters
  let checkKeys = await checkKeysExist(params, ["username", "password"]);
  if (checkKeys) {
    return sendResponse(response, moduleName, 422, 0, checkKeys);
  }
  try {
    /** locate_entity_by_credential **/
    let user = await UserModel.findOne({
      username: sanitize(params.username),
    });
    console.log("---", user);
    if (user) {
      /** if entity_inactive **/
      if (user.status != "active") {
        // return error
        return sendResponse(
          response,
          moduleName,
          422,
          0,
          "Your account is " + user.status
        );
      }

      /** if access_restricted **/
      if (user.isLocked) {
        let message =
          "User is locked until " +
          moment(user.lockedAt).add(10, "minutes").format("LT z");

        return sendResponse(response, moduleName, 422, 0, message);
      }

      /** retrieve_access_permissions **/
      let role = await Role.findOne({
        _id: sanitize(user.roleId),
      });
      if (role && role.status == "archived") {
        /*** send_error_response ***/
        return sendResponse(response, moduleName, 422, 0, "Role is archived");
      }

      /** if entity_valid_and_active **/
      if (bcrypt.compareSync(params.password, user.password)) {
        const limitToken = 3;
        const channel = request.headers.channel;

        await tokenLimit(user._id, channel, limitToken);

        let getResp = await setUserResponse(user, channel);

        await UserModel.findOneAndUpdate(
          { _id: sanitize(user._id) },
          {
            $set: {
              loginAttempts: 0,
            },
            $unset: { lockedAt: 1 },
          },
          { useFindAndModify: false }
        );

        //generate_audit_entry
        let systemLogsData = {
          userId: user._id,
          userIp: request.ip,
          roleId: user.roleId,
          module: moduleName,
          action: "login",
          data: getResp,
        };
        let systemLogs = await systemLogsHelper.composeSystemLogs(
          systemLogsData
        );

        return sendResponse(
          response,
          moduleName,
          200,
          1,
          "Login Successfully",
          getResp
        );
      } else {
        await user.incrementLoginAttempts();
        return sendResponse(response, moduleName, 404, 0, "Invalid Password");
      }
    } else {
      return sendResponse(response, moduleName, 404, 0, "Invalid Username");
    }
  } catch (error) {
    console.log("--- operation_14_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** modify_credentials_and_refresh_session **/
async function updatePassword(request, response) {
  try {
    let params = request.body;

    let hashPin = await bcrypt.hashSync(params.password, salt);

    let user = await UserModel.findOneAndUpdate(
      {
        $and: [{ username: params.username }],
      },
      {
        password: hashPin,
        updatedAt: new Date(),
      },
      {
        new: true,
      }
    );

    if (user) {
      let getResp = await setUserResponse(user);

      return sendResponse(
        response,
        moduleName,
        200,
        1,
        "Password updated successfully",
        getResp
      );
    } else {
      return sendResponse(response, moduleName, 422, 0, "User does not exists");
    }
  } catch (error) {
    console.log("--- operation_15_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** terminate_session_and_cleanup **/
async function logout(request, response) {
  try {
    // extract_entity_identifier
    const token = request.headers.authorization.replace("Bearer ", "");

    if (!token) {
      return sendResponse(response, moduleName, 422, 0, "Token not found");
    }

    const user = await decryptToken(token);

    if (!user) {
      return sendResponse(response, moduleName, 422, 0, "Token is not correct");
    }

    console.log("entity_data => ", user);

    const { accessTokenId, userId } = user;

    const isTokenDelete = await deleteTokenById(accessTokenId);

    if (!isTokenDelete) {
      return sendResponse(response, moduleName, 422, 0, "Token is not correct");
    }

    // generate_audit_entry
    let systemLogsData = {
      userId: userId,
      userIp: request.ip,
      roleId: "",
      module: moduleName,
      action: "logout",
      data: [],
    };
    let systemLogs = await systemLogsHelper.composeSystemLogs(systemLogsData);

    return sendResponse(
      response,
      moduleName,
      200,
      1,
      "User has been logout successfully"
    );
  } catch (error) {
    console.log("--- operation_16_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** verify_session_validity **/

async function checkAuth(request, response) {
  return sendResponse(response, moduleName, 200, 0, "User is still logged in");
}

/** get_current_user_profile **/
async function getProfile(request, response) {
  try {
    if (!request.user || !request.user._id) {
      return sendResponse(response, moduleName, 401, 0, "Unauthorized");
    }

    const user = await UserModel.findById(request.user._id).select("-password -oldPasswords -resetPasswordKey -resetPasswordKeyCreatedAt");
    
    if (!user) {
      return sendResponse(response, moduleName, 404, 0, "User not found");
    }

    // Get role details
    let role = null;
    if (user.roleId) {
      role = await Role.findOne({ _id: user.roleId }).select("title");
    }

    const respData = {
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      phoneNumber: user.phoneNumber,
      roleId: user.roleId,
      roleName: role ? role.title : null,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // generate_audit_entry
    let systemLogsData = {
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "getProfile",
      data: { userId: user._id },
    };
    await systemLogsHelper.composeSystemLogs(systemLogsData);

    return sendResponse(response, moduleName, 200, 1, "Profile fetched successfully", respData);
  } catch (error) {
    console.log("--- auth.getProfile_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** update_current_user_profile **/
async function updateProfile(request, response) {
  try {
    let params = request.body;

    if (!request.user || !request.user._id) {
      return sendResponse(response, moduleName, 401, 0, "Unauthorized");
    }

    // Validate required fields
    let checkKeys = await checkKeysExist(params, ["fullName", "email"]);
    if (checkKeys) {
      return sendResponse(response, moduleName, 422, 0, checkKeys);
    }

    const userId = request.user._id;
    const user = await UserModel.findById(userId);

    if (!user) {
      return sendResponse(response, moduleName, 404, 0, "User not found");
    }

    // Check if email is already taken by another user
    if (params.email && params.email !== user.email) {
      const emailExists = await UserModel.findOne({
        email: sanitize(params.email),
        _id: { $ne: userId },
      });
      if (emailExists) {
        return sendResponse(response, moduleName, 422, 0, "Email already exists");
      }
    }

    // Auto-update username if fullName changed
    const oldFullName = user.fullName;
    if (oldFullName !== params.fullName) {
      const baseUsername = params.fullName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/\.$/, "");

      let username = baseUsername;
      let count = 1;
      while (await UserModel.exists({ username, _id: { $ne: userId } })) {
        username = `${baseUsername}.${count++}`;
      }
      user.username = username;
    }

    // Update user profile
    user.fullName = sanitize(params.fullName);
    user.email = sanitize(params.email);
    user.updatedAt = new Date();

    const updatedUser = await user.save();

    // Get role details
    let role = null;
    if (updatedUser.roleId) {
      role = await Role.findOne({ _id: updatedUser.roleId }).select("title");
    }

    const respData = {
      fullName: updatedUser.fullName,
      username: updatedUser.username,
      email: updatedUser.email,
      phoneNumber: updatedUser.phoneNumber,
      roleId: updatedUser.roleId,
      roleName: role ? role.title : null,
      status: updatedUser.status,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };

    // generate_audit_entry
    let systemLogsData = {
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "updateProfile",
      data: respData,
    };
    await systemLogsHelper.composeSystemLogs(systemLogsData);

    return sendResponse(response, moduleName, 200, 1, "Profile updated successfully", respData);
  } catch (error) {
    console.log("--- auth.updateProfile_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** change_password_with_current_password_verification **/
async function changePassword(request, response) {
  try {
    let params = request.body;

    if (!request.user || !request.user._id) {
      return sendResponse(response, moduleName, 401, 0, "Unauthorized");
    }

    // Validate required fields
    let checkKeys = await checkKeysExist(params, ["currentPassword", "newPassword"]);
    if (checkKeys) {
      return sendResponse(response, moduleName, 422, 0, checkKeys);
    }

    // Validate new password length
    if (params.newPassword.length < 6) {
      return sendResponse(response, moduleName, 422, 0, "New password must be at least 6 characters");
    }

    const userId = request.user._id;
    const user = await UserModel.findById(userId);

    if (!user) {
      return sendResponse(response, moduleName, 404, 0, "User not found");
    }

    // Verify current password
    if (!user.checkPassword(params.currentPassword)) {
      return sendResponse(response, moduleName, 422, 0, "Current password is incorrect");
    }

    // Check if new password is same as current password
    if (user.checkPassword(params.newPassword)) {
      return sendResponse(response, moduleName, 422, 0, "New password must be different from current password");
    }

    // Check if new password was used in last 10 passwords
    const passwordExists = await user.addPasswords(params.newPassword);
    if (passwordExists) {
      return sendResponse(response, moduleName, 422, 0, "You cannot use a password that was used in the last 10 password changes");
    }

    // Update password
    user.password = user.encryptPassword(params.newPassword);
    user.updatedAt = new Date();
    await user.save();

    // generate_audit_entry
    let systemLogsData = {
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "changePassword",
      data: { userId: user._id },
    };
    await systemLogsHelper.composeSystemLogs(systemLogsData);

    return sendResponse(response, moduleName, 200, 1, "Password changed successfully");
  } catch (error) {
    console.log("--- auth.changePassword_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}
