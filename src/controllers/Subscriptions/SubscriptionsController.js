// includes
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const sanitize = require("mongo-sanitize");

// Models
const SubscriptionsModel = require("../../models/Subscriptions");

// helper functions
const systemLogsHelper = require("../../helpers/system-logs");
const { sendResponse, checkKeysExist } = require("../../helpers/utils");

// module name
const moduleName = "Subscriptions";

module.exports = {
  getById,
  getAll,
  create,
  update,
};
/** Get record by Id **/
async function getById(request, response) {
  let params = request.params;

  try {
    /** set model to fetch **/
    const model = await SubscriptionsModel;

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
        _id: new ObjectId(params.subscriptionId),
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
      subscriptions: data[0],
    };
    return sendResponse(response, moduleName, 200, 1, "Subscriptions fetched", respData);
  } catch (error) {
    console.log("--- operation_48_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** Get all Subscriptions **/
async function getAll(request, response) {
  let params = request.query;

  try {
    /** set model to fetch all **/
    const model = await SubscriptionsModel;

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

    /** filter via title  **/
    if (params.keyword) {
      let key = params.keyword;

      $aggregate.push({
        $match: {
          $or: [
            {
              "title": RegExp(key, "i"),
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
      subscriptions: data,
      pagination: {
        total: total,
        perPage: perPage,
        current: page,
        first: 1,
        last: total ? Math.ceil(total / perPage) : 1,
        next: page < Math.ceil(total / perPage) ? page + 1 : "",
      },
    };
    return sendResponse(response, moduleName, 200, 1, "Subscriptions fetched", respData);
  } catch (error) {
    console.log("--- operation_49_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** create Subscription **/
async function create(request, response) {
  let params = request.body;

  // check if the required keys are missing or not
  let checkKeys = await checkKeysExist(params, ["title", "amount","description"]);
  if (checkKeys) {
    return sendResponse(response, moduleName, 422, 0, checkKeys);
  }
  try {
    // check if record is already exists
    let check = await SubscriptionsModel.countDocuments({
      $or: [
        { "title": params.title },
      ],
    });
    if (check && check > 0) {
      return sendResponse(
        response,
        moduleName,
        422,
        0,
        "Subscription already exists with the given title"
      );
    }

    var record = new SubscriptionsModel();
    record.title = params.title;
    record.amount = params.amount;
    record.description = params.description;
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
        200,
        1,
        "Subscription has been created successfully"
      );
    }
  } catch (error) {
    console.log("--- operation_50_error ---", error);

    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** update Subscription **/
async function update(request, response) {
  let params = request.body;

  // check if the required keys are missing or not
  let checkKeys = await checkKeysExist(params, ["title", "amount","description"]);
  if (checkKeys) {
    return sendResponse(response, moduleName, 422, 0, checkKeys);
  }
  try {
    // check if FMR is already exists
    let check = await SubscriptionsModel.countDocuments({
      $and: [
        {
          $or: [
            { "title": params.title },
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
        "Subscription already exists with the given title"
      );
    }

    var record = await SubscriptionsModel.findOne({
      _id: new ObjectId(params._id),
    });
    if (record) {
      record.title = params.title;
      record.amount = params.amount;
      record.description = params.description;
      record.createdBy = request.user._id;

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
          "Subscription has been updated successfully"
        );
      }
    }
    return sendResponse(response, moduleName, 422, 0, "Subscription not found");
  } catch (error) {
    console.log("--- operation_50_error ---", error);

    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}
