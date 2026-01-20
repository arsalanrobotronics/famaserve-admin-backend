// includes
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const sanitize = require("mongo-sanitize");

// Models
const SystemUserModel = require("../../models/SystemUsers");
const RoleModel = require("../../models/Role");

// helper functions
const systemLogsHelper = require("../../helpers/system-logs");
const { sendResponse, checkKeysExist } = require("../../helpers/utils");

// module name
const moduleName = "System Users";

module.exports = {
  getById,
  getAll,
  systemUsersDropdown,
  create,
  update,
  remove,
};

/** Get record by Id **/
async function getById(request, response) {
  let params = request.params;

  try {
    // Validate userId parameter
    if (!params.userId) {
      return sendResponse(response, moduleName, 422, 0, "User ID is required");
    }

    // Validate ObjectId format
    if (!ObjectId.isValid(params.userId)) {
      return sendResponse(response, moduleName, 422, 0, "Invalid User ID format");
    }

    const model = SystemUserModel;

    let $aggregate = [
      {
        $lookup: {
          from: "roles",
          localField: "roleId",
          foreignField: "_id",
          as: "roleDetails",
        },
      },
      { $unwind: { path: "$roleDetails", preserveNullAndEmptyArrays: true } },
      { $match: { _id: new ObjectId(params.userId) } },
      {
        $project: {
          fullName: 1,
          username: 1,
          email: 1,
          phoneNumber: 1,
          status: 1,
          roleId: "$roleDetails._id",
          roleTitle: "$roleDetails.title",
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ];

    let data = await model.aggregate($aggregate).exec();

    // create system logs
    await systemLogsHelper.composeSystemLogs({
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "getById",
      data,
    });

    return sendResponse(response, moduleName, 200, 1, "User fetched", { user: data[0] });
  } catch (error) {
    console.log("--- operation_user_getById_error ---", error);
    return sendResponse(response, moduleName, 500, 0, "Something went wrong, please try again later.");
  }
}

/** Get all users **/
async function getAll(request, response) {
  let params = request.query;

  try {
    const model = await SystemUserModel;
    let page = params.startAt ? parseInt(params.startAt) : 1;
    let perPage = params.perPage ? parseInt(params.perPage) : 10;
    let sortBy = { createdAt: -1 };

    let $aggregate = [
      {
        $lookup: {
          from: "roles",
          localField: "roleId",
          foreignField: "_id",
          as: "roleDetails",
        },
      },
      { $unwind: { path: "$roleDetails", preserveNullAndEmptyArrays: true } },
    ];

    if (params.status) {
      $aggregate.push({ $match: { status: { $eq: params.status } } });
    }

    if (params.keyword) {
      let key = params.keyword;
      $aggregate.push({
        $match: {
          $or: [
            { fullName: RegExp(key, "i") },
            { email: RegExp(key, "i") },
            { username: RegExp(key, "i") },
          ],
        },
      });
    }

    if (params.date) {
      const filterDate = new Date(params.date);
      if (!isNaN(filterDate)) {
        const startOfDay = new Date(filterDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(filterDate);
        endOfDay.setHours(23, 59, 59, 999);

        $aggregate.push({
          $match: {
            createdAt: {
              $gte: startOfDay,
              $lte: endOfDay,
            },
          },
        });
      }
    }

    let data = await model
      .aggregate($aggregate)
      .project({
        fullName: 1,
        username: 1,
        email: 1,
        phoneNumber: 1,
        status: 1,
        roleTitle: "$roleDetails.title",
        createdAt: 1,
      })
      .sort(sortBy)
      .skip(perPage * (page - 1))
      .limit(perPage)
      .exec();

    let countAgg = [...$aggregate, { $count: "total" }];
    const count = await model.aggregate(countAgg).exec();
    const total = count.length ? count[0].total : 0;

    // create system logs
    await systemLogsHelper.composeSystemLogs({
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "getAll",
      data,
    });

    return sendResponse(response, moduleName, 200, 1, "Users fetched", {
      users: data,
      pagination: {
        total,
        perPage,
        current: page,
        first: 1,
        last: total ? Math.ceil(total / perPage) : 1,
        next: page < Math.ceil(total / perPage) ? page + 1 : "",
      },
    });
  } catch (error) {
    console.log("--- operation_user_getAll_error ---", error);
    return sendResponse(response, moduleName, 500, 0, "Something went wrong, please try again later.");
  }
}

/** Get system users dropdown **/
async function systemUsersDropdown(request, response) {
  let params = request.query;

  try {
    const model = await SystemUserModel;

    let $aggregate = [
      {
        $lookup: {
          from: "roles",
          localField: "roleId",
          foreignField: "_id",
          as: "roleDetails",
        },
      },
      { $unwind: { path: "$roleDetails", preserveNullAndEmptyArrays: true } },
    ];

    /** apply_status_filter - default to active for dropdown **/
    if (params.status) {
      $aggregate.push({ $match: { status: { $eq: params.status } } });
    } else {
      $aggregate.push({ $match: { status: { $eq: "active" } } });
    }

    /** apply_search_filter **/
    if (params.keyword) {
      let key = params.keyword;
      $aggregate.push({
        $match: {
          $or: [
            { fullName: RegExp(key, "i") },
            { email: RegExp(key, "i") },
            { username: RegExp(key, "i") },
          ],
        },
      });
    }

    let data = await model
      .aggregate($aggregate)
      .project({
        _id: 1,
        fullName: 1,
        email: 1,
        username: 1,
        roleTitle: "$roleDetails.title",
        roleId: "$roleDetails._id",
      })
      .sort({ fullName: 1 })
      .exec();

    $aggregate.push({ $count: "total" });
    const count = await model.aggregate($aggregate).exec();
    const total = count.length ? count[0].total : 0;

    // create system logs
    await systemLogsHelper.composeSystemLogs({
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "systemUsersDropdown",
      data,
    });

    return sendResponse(response, moduleName, 200, 1, "System users dropdown fetched", {
      users: data,
      total: total,
    });
  } catch (error) {
    console.log("--- operation_systemUsersDropdown_error ---", error);
    return sendResponse(response, moduleName, 500, 0, "Something went wrong, please try again later.");
  }
}

/** Create user **/
async function create(request, response) {
  let params = request.body;

  // check required keys
  let checkKeys = await checkKeysExist(params, [
    "fullName",
    "email",
    "phoneNumber",
    "roleId",
    "password",
  ]);
  if (checkKeys) {
    return sendResponse(response, moduleName, 422, 0, checkKeys);
  }

  try {
    // check duplicate email
    let check = await SystemUserModel.countDocuments({ email: params.email });
    if (check && check > 0) {
      return sendResponse(response, moduleName, 422, 0, "User already exists with this email");
    }

    // 🧠 Generate username from full name
    const baseUsername = params.fullName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .replace(/\.$/, "");

    // ensure username uniqueness
    let username = baseUsername;
    let count = 1;
    while (await SystemUserModel.exists({ username })) {
      username = `${baseUsername}.${count++}`;
    }

    const record = new SystemUserModel({
      fullName: params.fullName,
      username,
      email: params.email,
      phoneNumber: params.phoneNumber,
      roleId: params.roleId,
      status: params.status || "pending",
      createdAt: new Date(),
      password: "",
    });

    record.password = record.encryptPassword(params.password);
    const data = await record.save();

    // create system logs
    await systemLogsHelper.composeSystemLogs({
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "created",
      data,
    });

    return sendResponse(response, moduleName, 201, 1, "User has been created successfully", data);
  } catch (error) {
    console.log("--- operation_user_create_error ---", error);
    return sendResponse(response, moduleName, 500, 0, "Something went wrong, please try again later.");
  }
}

/** Update user **/
async function update(request, response) {
  let params = request.body;

  // check required keys
  let checkKeys = await checkKeysExist(params, [
    "_id",
    "fullName",
    "email",
    "phoneNumber",
    "roleId",
  ]);
  if (checkKeys) {
    return sendResponse(response, moduleName, 422, 0, checkKeys);
  }

  try {
    const record = await SystemUserModel.findById(params._id);
    if (!record) {
      return sendResponse(response, moduleName, 404, 0, "User not found");
    }

    // 🧠 Auto-update username if fullName changed
    if (record.fullName !== params.fullName) {
      const baseUsername = params.fullName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/\.$/, "");

      let username = baseUsername;
      let count = 1;
      while (await SystemUserModel.exists({ username, _id: { $ne: record._id } })) {
        username = `${baseUsername}.${count++}`;
      }

      record.username = username;
    }

    record.fullName = params.fullName;
    record.email = params.email;
    record.phoneNumber = params.phoneNumber;
    record.roleId = params.roleId;
    record.status = params.status || record.status;
    record.updatedAt = new Date();

    const data = await record.save();

    // create system logs
    await systemLogsHelper.composeSystemLogs({
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "updated",
      data,
    });

    return sendResponse(response, moduleName, 200, 1, "User has been updated successfully", data);
  } catch (error) {
    console.log("--- operation_user_update_error ---", error);
    return sendResponse(response, moduleName, 500, 0, "Something went wrong, please try again later.");
  }
}

/** Delete user **/
async function remove(request, response) {
  let params = request.params;

  try {
    // Validate userId parameter
    if (!params.userId) {
      return sendResponse(response, moduleName, 422, 0, "User ID is required");
    }

    // Validate ObjectId format
    if (!ObjectId.isValid(params.userId)) {
      return sendResponse(response, moduleName, 422, 0, "Invalid User ID format");
    }

    const deleted = await SystemUserModel.findByIdAndDelete(new ObjectId(params.userId));
    if (!deleted) {
      return sendResponse(response, moduleName, 404, 0, "User not found");
    }

    // create system logs
    await systemLogsHelper.composeSystemLogs({
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "deleted",
      data: deleted,
    });

    return sendResponse(response, moduleName, 200, 1, "User deleted successfully");
  } catch (error) {
    console.log("--- operation_user_remove_error ---", error);
    return sendResponse(response, moduleName, 500, 0, "Something went wrong, please try again later.");
  }
}
