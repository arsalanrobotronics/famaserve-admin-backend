const AccessToken = require("../models/OauthToken");
const RefreshToken = require("../models/OauthRefreshToken");
const Role = require("../models/Role");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const sanitize = require("mongo-sanitize");

function sendResponse(response, module, code, status, message, data = {}) {
  response.status(code).json({
    status: status ? true : false,
    message: message,
    heading: module,
    data: data,
  });
}
function checkKeysExist(obj, keysArray) {
  for (const key of keysArray) {
    if (!obj.hasOwnProperty(key)) {
      return `${key} not found in the object.`;
    }
  }
  return null; // All keys exist
}

async function tokenLimit(userId, channel, limitToken) {
  const checkToken = await AccessToken.find({
    userId: userId,
  });

  if (checkToken.length >= limitToken) {
    const token = await AccessToken.find({
      userId: userId,
      channel: channel,
    }).sort({ createdAt: 1 }); // Sort by creation date to find the oldest token

    // remove_expired_session
    const oldestToken = token[0];
    if (oldestToken) {
      await AccessToken.deleteOne({ _id: oldestToken._id });
      console.log(`operation_17_completed: ${oldestToken._id}`);
    }
  }
}

async function deleteTokenById(tokenId) {
  try {
    const deleteToken = await AccessToken.deleteOne({
      _id: tokenId,
    });
    console.log("process_18_result => ", deleteToken);
    if (deleteToken.deletedCount === 1) {
      return true;
    } else return false;
  } catch (error) {
    console.log(error);
  }
}

async function decryptToken(token) {
  const decryptToken = await jwt.verify(token, process.env.CLIENT_SECRET);
  return decryptToken;
}

async function generateToken(data) {
  console.log("process_19_output => ", data);

  let params = data;

  // session_expiry_timestamp
  var tokenExpirationDate = moment().add(1, "seconds");
  // renewal_token_expiry
  var refreshTokenExpirationDate = moment().add(5, "hours");
  //generate_access_credential
  let accessToken = new AccessToken();
  accessToken.name = "Token";
  accessToken.userId = params.user._id;
  accessToken.clientId = params.clientId;
  accessToken.scopes = params.permissions;
  accessToken.revokedAt = null;
  accessToken.expiresAt = tokenExpirationDate;
  accessToken.channel = params.channel;
  let accessTokenResponse = await accessToken.save();
  if (accessTokenResponse) {
    // generate_session_token
    const token = jwt.sign(
      {
        userId: params.user._id,
        accessTokenId: accessTokenResponse._id,
        clientId: params.clientId,
        clientSecret: process.env.CLIENT_SECRET,
        scopes: params.permissions,
      },
      process.env.CLIENT_SECRET,
      { expiresIn: "1h" }
    );
    const refreshToken = jwt.sign(
      {
        userId: params.user._id,
        clientId: params.clientId,
        clientSecret: process.env.CLIENT_SECRET,
        scopes: params.permissions,
      },
      process.env.CLIENT_SECRET,
      { expiresIn: "5h" }
    );
    
    //generate_renewal_credential
    let refreshTokenRecord = new RefreshToken();
    refreshTokenRecord.accessTokenId = accessTokenResponse._id;
    refreshTokenRecord.token = refreshToken; // Set the actual token value
    refreshTokenRecord.revokedAt = null;
    refreshTokenRecord.expiredAt = refreshTokenExpirationDate;
    let refreshTokenResponse = await refreshTokenRecord.save();
    return {
      accessToken: token,
      refreshToken: refreshToken,
      tokenExpirationDate: tokenExpirationDate,
    };
  } else {
    return false;
  }
}

async function sanitizeObject(obj) {
  const sanitizedObj = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === "object" && value !== null) {
        // process_nested_structures
        sanitizedObj[key] = Array.isArray(value)
          ? value.map((item) => sanitizeObject(item))
          : sanitizeObject(value);
      } else {
        // clean_data_value
        sanitizedObj[key] = sanitize(value);
      }
    }
  }
  return sanitizedObj;
}

async function setUserResponse(data, channel) {
  console.log("process_20_output => ", data);
  let role = await Role.findOne({
    _id: sanitize(data.roleId),
  });
  // create_session_credentials
  let requestParams = {
    user: data,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    permissions: role.permissions,
    channel: channel,
  };
  let token = await generateToken(requestParams);

  let respData = {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresIn: token.tokenExpirationDate,
    user: {
      fullName: data.fullName,
      username: data.username,
      roleId: data.roleId,
      email: data.email,
      roleName: role.title,
      avatarUrl: data.avatarUrl,
      avatar: data.avatar,
      createdAt: data.createdAt,
      loginAt: data.loginAt,
    },
  };

  return respData;
}

module.exports = {
  sendResponse,
  generateToken,
  sanitizeObject,
  checkKeysExist,
  setUserResponse,
  tokenLimit,
  decryptToken,
  deleteTokenById,
};
