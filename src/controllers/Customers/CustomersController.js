// dependencies
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const bcrypt = require("bcryptjs");
const sanitize = require("mongo-sanitize");
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
  // create,
  // update,
  remove,
};

/** fetch_customer_by_identifier **/
async function getById(request, response) {
  let params = request.params;

  try {
    if (!ObjectId.isValid(params.customerId)) {
      return sendResponse(response, moduleName, 422, 0, "Invalid customer ID format");
    }

    const $aggregate = [
      {
        $match: {
          _id: new ObjectId(params.customerId),
        },
      },
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

    let data = await CustomerModel.aggregate($aggregate).exec();

    if (!data || data.length === 0) {
      return sendResponse(response, moduleName, 404, 0, "Customer not found");
    }

    // generate_audit_entry
    let systemLogsData = {
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "getById",
      data: data[0],
    };
    await systemLogsHelper.composeSystemLogs(systemLogsData);

    let respData = {
      customer: data[0],
    };
    return sendResponse(response, moduleName, 200, 1, "Customer fetched", respData);
  } catch (error) {
    console.log("--- customers_getById_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** fetch_all_customers **/
async function getAll(request, response) {
  let params = request.query;

  try {
    /** pagination_offset **/
    let page = params.startAt ? parseInt(params.startAt) : 1;

    /** records_limit **/
    let perPage = params.perPage ? parseInt(params.perPage) : 10;

    /** sort_configuration **/
    let sortBy = { createdAt: -1 };

    if (params.sortBy) {
      sortBy = {
        [params.sortBy]: params.sortOrder === "asc" ? 1 : -1,
      };
    }

    // Build match conditions for roleId filter
    let roleIdFilter = null;

    // If role is provided in query params (e.g., role=Provider or role=Customer), filter by it
    if (params.role) {
      const roleTitle = sanitize(params.role);
      
      // Find role by title (case-insensitive) - try exact match first, then case-insensitive
      let role = await RoleModel.findOne({ title: roleTitle });
      
      if (!role) {
        // Try case-insensitive match
        role = await RoleModel.findOne({ 
          title: { $regex: new RegExp(`^${roleTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
        });
      }
      
      if (!role) {
        return sendResponse(response, moduleName, 404, 0, `Role "${roleTitle}" not found`);
      }
      
      // Ensure roleIdFilter is a proper ObjectId (role._id should already be ObjectId from Mongoose)
      roleIdFilter = role._id instanceof ObjectId ? role._id : new ObjectId(role._id);
    }

    let $aggregate = [];

    // Add roleId filter FIRST if provided (before lookups) - this ensures only records with matching roleId are returned
    if (roleIdFilter) {
      $aggregate.push({
        $match: {
          roleId: roleIdFilter,
        },
      });
    }

    // Add lookups for role and createdBy details
    $aggregate.push({
      $lookup: {
        from: "roles",
        localField: "roleId",
        foreignField: "_id",
        as: "role",
      },
    });

    $aggregate.push({
      $unwind: {
        path: "$role",
        preserveNullAndEmptyArrays: true,
      },
    });

    $aggregate.push({
      $lookup: {
        from: "systemUsers",
        localField: "createdBy",
        foreignField: "_id",
        as: "createdByDetails",
      },
    });

    $aggregate.push({
      $unwind: {
        path: "$createdByDetails",
        preserveNullAndEmptyArrays: true,
      },
    });

    /** apply_status_filter **/
    if (params.status) {
      $aggregate.push({
        $match: {
          status: params.status,
        },
      });
    }

    /** apply_search_filter **/
    if (params.keyword) {
      let key = params.keyword;
      $aggregate.push({
        $match: {
          $or: [
            { fullName: RegExp(key, "i") },
            { phoneNumber: RegExp(key, "i") },
            { email: RegExp(key, "i") },
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

    // Clone aggregate for count
    const countAggregate = [...$aggregate, { $count: "total" }];

    // Add sorting, pagination
    $aggregate.push({ $sort: sortBy });
    $aggregate.push({ $skip: perPage * (page - 1) });
    $aggregate.push({ $limit: perPage });

    let data = await CustomerModel.aggregate($aggregate).exec();
    const count = await CustomerModel.aggregate(countAggregate).exec();
    const total = count.length ? count[0].total : 0;

    // generate_audit_entry
    let systemLogsData = {
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "getAll",
      data: { count: data.length },
    };
    await systemLogsHelper.composeSystemLogs(systemLogsData);

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
    return sendResponse(response, moduleName, 200, 1, "Customers fetched", respData);
  } catch (error) {
    console.log("--- customers_getAll_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** create_customer **/
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
    // Get Customer role
    const customerRole = await RoleModel.findOne({ title: "Customer" });
    if (!customerRole) {
      return sendResponse(response, moduleName, 404, 0, "Customer role not found");
    }

    // verify_entity_existence
    let check = await CustomerModel.countDocuments({
      email: params.email,
    });

    if (check && check > 0) {
      return sendResponse(
        response,
        moduleName,
        422,
        0,
        "Customer already exists with the given email"
      );
    }

    let hashPin = await bcrypt.hashSync(params.password, salt);

    var customer = new CustomerModel();
    customer.fullName = params.fullName;
    customer.email = params.email;
    customer.phoneNumber = params.phoneNumber;
    customer.status = "active";
    customer.createdBy = request?.user?._id || null;
    customer.password = hashPin;
    customer.isManuallyCreated = true;
    customer.roleId = customerRole._id;

    // Customer specific fields
    customer.gender = params.gender || "";
    customer.preferences = params.preferences || [];

    let data = await customer.save();

    if (data) {
      // generate_audit_entry
      let systemLogsData = {
        userId: request.user._id,
        userIp: request.ip,
        roleId: request.user.roleId,
        module: moduleName,
        action: "created",
        data: data,
      };
      await systemLogsHelper.composeSystemLogs(systemLogsData);

      return sendResponse(
        response,
        moduleName,
        200,
        1,
        "Customer has been created successfully"
      );
    }
  } catch (error) {
    console.log("--- customers_create_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** update_customer **/
async function update(request, response) {
  let params = request.body;

  // validate_input_parameters
  let checkKeys = await checkKeysExist(params, ["_id"]);
  if (checkKeys) {
    return sendResponse(response, moduleName, 422, 0, checkKeys);
  }

  try {
    // Get Customer role
    const customerRole = await RoleModel.findOne({ title: "Customer" });
    if (!customerRole) {
      return sendResponse(response, moduleName, 404, 0, "Customer role not found");
    }

    // Check if customer exists
    let existingCustomer = await CustomerModel.findOne({
      _id: new ObjectId(params._id),
      roleId: customerRole._id,
    });

    if (!existingCustomer) {
      return sendResponse(response, moduleName, 404, 0, "Customer not found");
    }

    // Check for duplicate email
    if (params.email) {
      let check = await CustomerModel.countDocuments({
        email: params.email,
        _id: { $ne: params._id },
      });

      if (check > 0) {
        return sendResponse(
          response,
          moduleName,
          422,
          0,
          "Another user already exists with the given email"
        );
      }
    }

    // construct_update_payload
    const updateObject = {
      ...(params.fullName && { fullName: params.fullName }),
      ...(params.phoneNumber && { phoneNumber: params.phoneNumber }),
      ...(params.email && { email: params.email }),
      ...(params.status && { status: params.status }),
      ...(params.gender !== undefined && { gender: params.gender }),
      ...(params.preferences && { preferences: params.preferences }),
      updatedAt: new Date(),
    };

    const updatedCustomer = await CustomerModel.findOneAndUpdate(
      { _id: new ObjectId(params._id), roleId: customerRole._id },
      updateObject,
      { new: true, runValidators: true }
    );

    if (updatedCustomer) {
      // generate_audit_entry
      let systemLogsData = {
        userId: request.user._id,
        userIp: request.ip,
        roleId: request.user.roleId,
        module: moduleName,
        action: "updated",
        data: updatedCustomer,
      };
      await systemLogsHelper.composeSystemLogs(systemLogsData);

      return sendResponse(
        response,
        moduleName,
        200,
        1,
        "Customer has been updated successfully"
      );
    }
  } catch (error) {
    console.log("--- customers_update_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** delete_customer **/
async function remove(request, response) {
  let params = request.body;

  // validate_input_parameters
  let checkKeys = await checkKeysExist(params, ["_id"]);
  if (checkKeys) {
    return sendResponse(response, moduleName, 422, 0, checkKeys);
  }

  try {
    // Get Customer role
    const customerRole = await RoleModel.findOne({ title: "Customer" });
    if (!customerRole) {
      return sendResponse(response, moduleName, 404, 0, "Customer role not found");
    }

    // verify_entity_existence
    let check = await CustomerModel.countDocuments({
      _id: new ObjectId(params._id),
      roleId: customerRole._id,
    });

    if (check > 0) {
      const deleteRecord = await CustomerModel.deleteOne({
        _id: new ObjectId(params._id),
        roleId: customerRole._id,
      });

      if (deleteRecord) {
        // generate_audit_entry
        let systemLogsData = {
          userId: request.user._id,
          userIp: request.ip,
          roleId: request.user.roleId,
          module: moduleName,
          action: "deleted",
          data: params._id,
        };
        await systemLogsHelper.composeSystemLogs(systemLogsData);

        return sendResponse(
          response,
          moduleName,
          200,
          1,
          "Customer has been deleted successfully"
        );
      }
    }

    return sendResponse(response, moduleName, 422, 0, "Customer does not exist");
  } catch (error) {
    console.log("--- customers_remove_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

