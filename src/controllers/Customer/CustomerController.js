// dependencies
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const bcrypt = require("bcryptjs");
const salt = parseInt(process.env.SALT);

// data_models
const CustomerModel = require("../../models/Customers");
const RoleModel = require("../../models/Role");

// utility_functions
const systemLogsHelper = require("../../helpers/system-logs");
const { sendResponse, checkKeysExist } = require("../../helpers/utils");

// module_identifier
const moduleName = "Customers";

module.exports = {
  getById,
  getAll,
  create,
  update,
  remove,
};

/** fetch_entity_by_identifier **/
async function getById(request, response) {
  let params = request.params;

  try {
    /** initialize_query_model **/
    const model = await CustomerModel;

    if (!ObjectId.isValid(params.customerId)) {
      return sendResponse(response, moduleName, 422, 0, "Invalid customer ID format");
    }

    $aggregate = [
      {
        $lookup: {
          from: "roles",
          localField: "roleId",
          foreignField: "_id",
          as: "role",
        },
      },
      {
        $unwind: {
          path: "$role",
          preserveNullAndEmptyArrays: true,
        },
      },
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
      {
        $match: {
          _id: new ObjectId(params.customerId),
        },
      },
    ];

    let data = await model.aggregate([$aggregate]).exec();

    if (!data || data.length === 0) {
      return sendResponse(response, moduleName, 404, 0, "Customer not found");
    }

    //generate_audit_entry
    let systemLogsData = {
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "getById",
      data: data[0],
    };
    let systemLogs = await systemLogsHelper.composeSystemLogs(systemLogsData);

    let respData = {
      customer: data[0],
    };
    return sendResponse(response, moduleName, 200, 1, "Customer fetched", respData);
  } catch (error) {
    console.log("--- operation_getById_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** fetch_all_entities **/
async function getAll(request, response) {
  let params = request.query;

  try {
    /** initialize_query_model **/
    const model = await CustomerModel;

    /** pagination_offset **/
    let page = params.startAt ? parseInt(params.startAt) : 1;

    /** records_limit **/
    let perPage = params.perPage ? parseInt(params.perPage) : 10;

    /** sort_configuration **/
    let sortBy = { createdAt: -1 };

    if (params.sortBy) {
      sortBy = {
        [params.sortBy]: params.sortOrder,
      };
    }

    $aggregate = [
      {
        $lookup: {
          from: "roles",
          localField: "roleId",
          foreignField: "_id",
          as: "role",
        },
      },
      {
        $unwind: {
          path: "$role",
          preserveNullAndEmptyArrays: true,
        },
      },
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

    /** apply_status_filter **/
    if (params.status) {
      $aggregate.push({
        $match: {
          status: {
            $eq: params.status,
          },
        },
      });
    }
    /** apply_type_filter **/
    if (params.type) {
      let getRole = await RoleModel.findOne({ title: params.type });
      if (getRole) {
        $aggregate.push({
          $match: {
            roleId: {
              $eq: new ObjectId(getRole._id),
            },
          },
        });
      }
    }

    /** apply_search_filter **/
    if (params.keyword) {
      let key = params.keyword;

      $aggregate.push({
        $match: {
          $or: [
            {
              fullName: RegExp(key, "i"),
            },
            {
              phoneNumber: RegExp(key, "i"),
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

    //generate_audit_entry
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
      customers: data,
      pagination: {
        total: total,
        perPage: perPage,
        current: page,
        first: 1,
        last: total ? Math.ceil(total / perPage) : 1,
        next: page < Math.ceil(total / perPage) ? page + 1 : "",
      },
    };
    return sendResponse(
      response,
      moduleName,
      200,
      1,
      "Customers fetched",
      respData
    );
  } catch (error) {
    console.log("--- operation_01_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** initialize_entity_with_credentials **/
async function create(request, response) {
  let params = request.body;

  // validate_input_parameters
  let checkKeys = await checkKeysExist(params, [
    "phoneNumber",
    "fullName",
    "email",
    "password",
  ]);
  if (checkKeys) {
    return sendResponse(response, moduleName, 422, 0, checkKeys);
  }
  try {
    // verify_entity_existence
    let check = await CustomerModel.countDocuments({
      $or: [
        { phoneNumber: params.phoneNumber }],
    });

    if (check && check > 0) {
      return sendResponse(
        response,
        moduleName,
        422,
        0,
        "Customer already exists with the given CNIC, email or Phone Number"
      );
    }

    let hashPin = await bcrypt.hashSync(params.password, salt);

    var user = new CustomerModel();
    user.fullName = params.fullName;
    user.email = params.email;
    user.phoneNumber = params.phoneNumber;
    user.cnic = params.cnic;
    user.status = "active";
    user.createdBy =
      request && request.user && request.user._id ? request.user._id : null;
    user.password = hashPin;
    user.isManuallyCreated = params.isManuallyCreated;
    user.roleId = params.roleId;

    // initialize_new_entity
    let data = await user.save();
    // if operation_successful

    if (data) {
      //generate_audit_entry
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
        "Customer has been created successfully"
      );
    }
  } catch (error) {
    console.log("--- operation_02_error ---", error);

    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** modify_entity **/
async function update(request, response) {
  let params = request.body;

  // validate_input_parameters
  let checkKeys = await checkKeysExist(params, [
    "phoneNumber",
    "fullName",
    "email",
    "_id",
  ]);
  if (checkKeys) {
    return sendResponse(response, moduleName, 422, 0, checkKeys);
  }
  try {
    // verify_entity_existence
    let check = await CustomerModel.countDocuments({
      $and: [
        {
          $or: [
            { phoneNumber: params.phoneNumber }],
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
        "Customer already exists with the given CNIC, email or Phone Number"
      );
    }

    // construct_update_payload
    const updateObject = {
      fullName: params.fullName,
      phoneNumber: params.phoneNumber,
      email: params.email,
      roleId: params.roleId,
      status: params.status,

      // credential: bcrypt.hashSync(params.password, salt),
    };

    //      execute_update_operation
    const updatedUser = await CustomerModel.findOneAndUpdate(
      { _id: new ObjectId(params._id) },
      updateObject, // Fields to update
      { new: true, runValidators: true }
    );
    // if operation_successful

    if (updatedUser) {
      //generate_audit_entry
      let systemLogsData = {
        userId: request.user._id,
        userIp: request.ip,
        roleId: request.user.roleId,
        module: moduleName,
        action: "updated",
        data: updatedUser,
      };
      let systemLogs = await systemLogsHelper.composeSystemLogs(systemLogsData);

      return sendResponse(
        response,
        moduleName,
        200,
        1,
        "Customer has been updated successfully"
      );
    }
  } catch (error) {
    console.log("--- operation_03_error ---", error);

    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** delete_entity **/
async function remove(request, response) {
  let params = request.body;

  // validate_input_parameters
  let checkKeys = await checkKeysExist(params, ["_id"]);
  if (checkKeys) {
    return sendResponse(response, moduleName, 422, 0, checkKeys);
  }
  try {
    // verify_entity_existence
    let check = await CustomerModel.countDocuments({
      _id: new ObjectId(params._id),
    });
    if (check && check > 0) {
      const deleteRecord = await CustomerModel.deleteOne({
        _id: new ObjectId(params._id),
      });
      // if operation_successful

      if (deleteRecord) {
        //generate_audit_entry
        let systemLogsData = {
          userId: request.user._id,
          userIp: request.ip,
          roleId: request.user.roleId,
          module: moduleName,
          action: "deleted",
          data: params.cnic,
        };
        let systemLogs = await systemLogsHelper.composeSystemLogs(
          systemLogsData
        );

        return sendResponse(
          response,
          moduleName,
          200,
          1,
          "Customer has been deleted successfully"
        );
      }
    }
    return sendResponse(
      response,
      moduleName,
      422,
      0,
      "Customer does not exist"
    );
  } catch (error) {
    console.log("--- operation_03_error ---", error);

    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}
