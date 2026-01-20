// includes
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const sanitize = require("mongo-sanitize");

// Models
const PermissionsModel = require("../../models/Permissions");

// helper functions
const systemLogsHelper = require("../../helpers/system-logs");
const { sendResponse, checkKeysExist } = require("../../helpers/utils");

// module name
const moduleName = "Permissions";

module.exports = {
  getById,
  getAll,
  create,
  update,
  remove
};
/** Get record by Id **/
async function getById(request, response) {
  let params = request.params;

  try {
    /** set model to fetch **/
    const model = await PermissionsModel;

    $aggregate = [
      {
        $lookup: {
          from: "systemUsers",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdByDetails",
        },
      },
      {
        $unwind: {
          path: "$createdByDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    $aggregate.push({
      $match: {
        _id: new ObjectId(params.permissionId),
      },
    });

    let data = await model.aggregate([$aggregate]).exec();

    //create system logs
    let systemLogsData = {
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "getById",
      data: data,
    };
    let systemLogs = await systemLogsHelper.composeSystemLogs(systemLogsData);

    let respData = {
      permission: data[0],
    };
    return sendResponse(response, moduleName, 200, 1, "Permission fetched", respData);
  } catch (error) {
    console.log("--- operation_44_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** Get all Permissions **/
async function getAll(request, response) {
  let params = request.query;

  try {
    /** set model to fetch all **/
    const model = await PermissionsModel;

    /** page number for pagination **/
    let page = params.startAt ? parseInt(params.startAt) : 1;

    /**  per page **/
    let perPage = params.perPage ? parseInt(params.perPage) : 10;

    /**  how to sort the list  **/
    let sortBy = { createdAt: -1 };

    $aggregate = [
      {
        $lookup: {
          from: "systemUsers",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdByDetails",
        },
      },
      {
        $unwind: {
          path: "$createdByDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    /** filter via status  **/
    if (params.status) {
      $aggregate.push({
        $match: {
          status: {
            $eq: params.status,
          },
        },
      });
    }

    /** filter via title or slug  **/
    if (params.keyword) {
      let key = params.keyword;

      $aggregate.push({
        $match: {
          $or: [
            {
              "title": RegExp(key, "i"),
            },
            {
              "slug": RegExp(key, "i"),
            },
          ],
        },
      });
    }

    /** apply_date_filter **/
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
      .aggregate([$aggregate])
      .sort(sortBy)
      .skip(perPage * (page - 1))
      .limit(perPage)
      .exec();

    $aggregate.push({
      $count: "total",
    });
    const count = await model.aggregate($aggregate).exec();

    const total = count.length ? count[0].total : 0;

    //create system logs
    let systemLogsData = {
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "getAll",
      data: data,
    };
    let systemLogs = await systemLogsHelper.composeSystemLogs(systemLogsData);

    let respData = {
      permissions: data,
      pagination: {
        total: total,
        perPage: perPage,
        current: page,
        first: 1,
        last: total ? Math.ceil(total / perPage) : 1,
        next: page < Math.ceil(total / perPage) ? page + 1 : "",
      },
    };
    return sendResponse(response, moduleName, 200, 1, "Permissions fetched", respData);
  } catch (error) {
    console.log("--- operation_45_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** create Permission **/
async function create(request, response) {
  let params = request.body;

  // check if the required keys are missing or not
  let checkKeys = await checkKeysExist(params, ["title", "slug"]);
  if (checkKeys) {
    return sendResponse(response, moduleName, 422, 0, checkKeys);
  }
  try {
    // check if record is already exists
    let check = await PermissionsModel.countDocuments({
      $or: [
        { "title": params.title },
        { "slug": params.slug },
      ],
    });
    if (check && check > 0) {
      return sendResponse(
        response,
        moduleName,
        422,
        0,
        "Permission already exists with the given title or slug"
      );
    }

    var record = new PermissionsModel();
    record.title = params.title;
    record.slug = params.slug;
    record.status = params.status || "active";
    record.createdBy = request.user._id;
    // create a new record
    let data = await record.save();
    // if created successfully

    if (data) {
      //create system logs
      let systemLogsData = {
        userId: request.user._id,
        userIp: request.ip,
        roleId: request.user.roleId,
        module: moduleName,
        action: "created",
        data: data,
      };
      let systemLogs = await systemLogsHelper.composeSystemLogs(systemLogsData);

      return sendResponse(
        response,
        moduleName,
        201,
        1,
        "Permission has been created successfully",
        record
      );
    }
  } catch (error) {
    console.log("--- operation_46_error ---", error);

    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** update Permission **/
async function update(request, response) {
  let params = request.body;

  // check if the required keys are missing or not
  let checkKeys = await checkKeysExist(params, ["title", "slug"]);
  if (checkKeys) {
    return sendResponse(response, moduleName, 422, 0, checkKeys);
  }
  try {
    // check if permission already exists
    let check = await PermissionsModel.countDocuments({
      $and: [
        {
          $or: [
            { "title": params.title },
            { "slug": params.slug },
          ],
        },
        {
          _id: { $ne: params._id },
        },
      ],
    });
    if (check && check > 0) {
      return sendResponse(
        response,
        moduleName,
        422,
        0,
        "Permission already exists with the given title or slug"
      );
    }

    var record = await PermissionsModel.findOne({
      _id: new ObjectId(params._id),
    });
    if (record) {
      record.title = params.title;
      record.slug = params.slug;
      record.status = params.status || record.status;
      record.updatedAt = new Date();

      // update a record
      let data = await record.save();
      // if updated successfully

      if (data) {
        //create system logs
        let systemLogsData = {
          userId: request.user._id,
          userIp: request.ip,
          roleId: request.user.roleId,
          module: moduleName,
          action: "updated",
          data: data,
        };
        let systemLogs = await systemLogsHelper.composeSystemLogs(
          systemLogsData
        );

        return sendResponse(
          response,
          moduleName,
          200,
          1,
          "Permission has been updated successfully"
        );
      }
    }
    return sendResponse(response, moduleName, 422, 0, "Permission not found");
  } catch (error) {
    console.log("--- operation_46_error ---", error);

    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** Delete permission **/
async function remove(request, response) {
  let params = request.params;

  try {
    // Delete permission
    const deleted = await PermissionsModel.findByIdAndDelete(
      new ObjectId(params.permissionId)
    );
    if (!deleted) {
      return sendResponse(response, moduleName, 422, 0, "Permission not found");
    }

    // Log system action
    let systemLogsData = {
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "deleted",
      data: deleted,
    };
    await systemLogsHelper.composeSystemLogs(systemLogsData);

    return sendResponse(response, moduleName, 200, 1, "Permission deleted successfully");
  } catch (error) {
    console.log("--- operation_47_error ---", error);
    return sendResponse(response, moduleName, 500, 0, "Something went wrong, please try again later.");
  }
}


