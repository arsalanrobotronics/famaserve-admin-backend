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
const moduleName = "Providers";

module.exports = {
  getById,
  getAll,
  // create,
  // update,
  remove,
};

/** fetch_provider_by_identifier **/
async function getById(request, response) {
  let params = request.params;

  try {
    // Get Provider role
    const providerRole = await RoleModel.findOne({ title: "Provider" });
    if (!providerRole) {
      return sendResponse(response, moduleName, 404, 0, "Provider role not found");
    }

    if (!ObjectId.isValid(params.providerId)) {
      return sendResponse(response, moduleName, 422, 0, "Invalid provider ID format");
    }

    const $aggregate = [
      {
        $match: {
          _id: new ObjectId(params.providerId),
          roleId: providerRole._id,
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
      return sendResponse(response, moduleName, 404, 0, "Provider not found");
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
      provider: data[0],
    };
    return sendResponse(response, moduleName, 200, 1, "Provider fetched", respData);
  } catch (error) {
    console.log("--- providers_getById_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** fetch_all_providers **/
async function getAll(request, response) {
  let params = request.query;

  try {
    // Get Provider role
    const providerRole = await RoleModel.findOne({ title: "Provider" });
    if (!providerRole) {
      return sendResponse(response, moduleName, 404, 0, "Provider role not found");
    }

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

    let $aggregate = [
      {
        $match: {
          roleId: providerRole._id,
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
            { companyName: RegExp(key, "i") },
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
      providers: data,
      pagination: {
        total: total,
        perPage: perPage,
        current: page,
        first: 1,
        last: total ? Math.ceil(total / perPage) : 1,
        next: page < Math.ceil(total / perPage) ? page + 1 : "",
      },
    };
    return sendResponse(response, moduleName, 200, 1, "Providers fetched", respData);
  } catch (error) {
    console.log("--- providers_getAll_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** create_provider **/
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
    // Get Provider role
    const providerRole = await RoleModel.findOne({ title: "Provider" });
    if (!providerRole) {
      return sendResponse(response, moduleName, 404, 0, "Provider role not found");
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
        "Provider already exists with the given email"
      );
    }

    let hashPin = await bcrypt.hashSync(params.password, salt);

    var provider = new CustomerModel();
    provider.fullName = params.fullName;
    provider.email = params.email;
    provider.phoneNumber = params.phoneNumber;
    provider.companyName = params.companyName || null;
    provider.status = "active";
    provider.createdBy = request?.user?._id || null;
    provider.password = hashPin;
    provider.isManuallyCreated = true;
    provider.roleId = providerRole._id;

    // Provider specific fields
    provider.serviceHistory = params.serviceHistory || null;
    provider.servicesOffered = params.servicesOffered || [];
    provider.serviceCategoryId = params.serviceCategoryId || null;
    provider.experienceLevel = params.experienceLevel || "";
    provider.abn = params.abn || null;

    let data = await provider.save();

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
        "Provider has been created successfully"
      );
    }
  } catch (error) {
    console.log("--- providers_create_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** update_provider **/
async function update(request, response) {
  let params = request.body;

  // validate_input_parameters
  let checkKeys = await checkKeysExist(params, ["_id"]);
  if (checkKeys) {
    return sendResponse(response, moduleName, 422, 0, checkKeys);
  }

  try {
    // Get Provider role
    const providerRole = await RoleModel.findOne({ title: "Provider" });
    if (!providerRole) {
      return sendResponse(response, moduleName, 404, 0, "Provider role not found");
    }

    // Check if provider exists
    let existingProvider = await CustomerModel.findOne({
      _id: new ObjectId(params._id),
      roleId: providerRole._id,
    });

    if (!existingProvider) {
      return sendResponse(response, moduleName, 404, 0, "Provider not found");
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
      ...(params.companyName !== undefined && { companyName: params.companyName }),
      ...(params.status && { status: params.status }),
      ...(params.serviceHistory !== undefined && { serviceHistory: params.serviceHistory }),
      ...(params.servicesOffered && { servicesOffered: params.servicesOffered }),
      ...(params.serviceCategoryId !== undefined && { serviceCategoryId: params.serviceCategoryId }),
      ...(params.experienceLevel !== undefined && { experienceLevel: params.experienceLevel }),
      ...(params.abn !== undefined && { abn: params.abn }),
      updatedAt: new Date(),
    };

    const updatedProvider = await CustomerModel.findOneAndUpdate(
      { _id: new ObjectId(params._id), roleId: providerRole._id },
      updateObject,
      { new: true, runValidators: true }
    );

    if (updatedProvider) {
      // generate_audit_entry
      let systemLogsData = {
        userId: request.user._id,
        userIp: request.ip,
        roleId: request.user.roleId,
        module: moduleName,
        action: "updated",
        data: updatedProvider,
      };
      await systemLogsHelper.composeSystemLogs(systemLogsData);

      return sendResponse(
        response,
        moduleName,
        200,
        1,
        "Provider has been updated successfully"
      );
    }
  } catch (error) {
    console.log("--- providers_update_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** delete_provider **/
async function remove(request, response) {
  let params = request.body;

  // validate_input_parameters
  let checkKeys = await checkKeysExist(params, ["_id"]);
  if (checkKeys) {
    return sendResponse(response, moduleName, 422, 0, checkKeys);
  }

  try {
    // Get Provider role
    const providerRole = await RoleModel.findOne({ title: "Provider" });
    if (!providerRole) {
      return sendResponse(response, moduleName, 404, 0, "Provider role not found");
    }

    // verify_entity_existence
    let check = await CustomerModel.countDocuments({
      _id: new ObjectId(params._id),
      roleId: providerRole._id,
    });

    if (check > 0) {
      const deleteRecord = await CustomerModel.deleteOne({
        _id: new ObjectId(params._id),
        roleId: providerRole._id,
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
          "Provider has been deleted successfully"
        );
      }
    }

    return sendResponse(response, moduleName, 422, 0, "Provider does not exist");
  } catch (error) {
    console.log("--- providers_remove_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

