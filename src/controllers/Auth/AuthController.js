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
