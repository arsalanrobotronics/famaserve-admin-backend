// dependencies
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

// data_models
const ProviderServiceModel = require("../../models/ProviderService");

// utility_functions
const systemLogsHelper = require("../../helpers/system-logs");
const { sendResponse, checkKeysExist } = require("../../helpers/utils");

// module_identifier
const moduleName = "ProviderServices";

module.exports = {
  getAll,
  update,
};

/** fetch_all_provider_services **/
async function getAll(request, response) {
  let params = request.query;

  try {
    let page = params.startAt ? parseInt(params.startAt) : 1;
    let perPage = params.perPage ? parseInt(params.perPage) : 10;
    let sortBy = { createdAt: -1 };

    if (params.sortBy) {
      sortBy = {
        [params.sortBy]: params.sortOrder === "asc" ? 1 : -1,
      };
    }

    const matchStage = { isDeleted: { $ne: true } };
    if (params.status) matchStage.status = params.status;
    if (params.isApproved !== undefined && params.isApproved !== "") {
      matchStage.isApproved = params.isApproved === "true" || params.isApproved === true;
    }
    if (params.providerId && ObjectId.isValid(params.providerId)) {
      matchStage.providerId = new ObjectId(params.providerId);
    }

    let $aggregate = [
      { $match: matchStage },
      {
        $lookup: {
          from: "customers",
          localField: "providerId",
          foreignField: "_id",
          as: "provider",
        },
      },
      {
        $unwind: {
          path: "$provider",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          providerId: 1,
          categoryId: 1,
          categoryTitle: 1,
          categorySlug: 1,
          serviceId: 1,
          serviceTitle: 1,
          serviceSlug: 1,
          title: 1,
          description: 1,
          priceMin: 1,
          priceMax: 1,
          location: 1,
          status: 1,
          isApproved: 1,
          createdAt: 1,
          updatedAt: 1,
          "provider._id": 1,
          "provider.fullName": 1,
          "provider.email": 1,
          "provider.companyName": 1,
          "category._id": 1,
          "category.title": 1,
        },
      },
    ];

    if (params.keyword) {
      const key = params.keyword;
      $aggregate.push({
        $match: {
          $or: [
            { title: RegExp(key, "i") },
            { description: RegExp(key, "i") },
            { categoryTitle: RegExp(key, "i") },
            { serviceTitle: RegExp(key, "i") },
            { "provider.fullName": RegExp(key, "i") },
            { "provider.companyName": RegExp(key, "i") },
          ],
        },
      });
    }

    const countAggregate = [...$aggregate, { $count: "total" }];
    $aggregate.push({ $sort: sortBy });
    $aggregate.push({ $skip: perPage * (page - 1) });
    $aggregate.push({ $limit: perPage });

    let data = await ProviderServiceModel.aggregate($aggregate).exec();
    const count = await ProviderServiceModel.aggregate(countAggregate).exec();
    const total = count.length ? count[0].total : 0;

    let systemLogsData = {
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "getAll",
      data: { count: data.length },
    };
    await systemLogsHelper.composeSystemLogs(systemLogsData);

    return sendResponse(response, moduleName, 200, 1, "Provider services fetched", {
      providerServices: data,
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
    console.log("--- providerServices_getAll_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** update_provider_service_status **/
async function update(request, response) {
  let params = request.body;

  let checkKeys = await checkKeysExist(params, ["_id", "status"]);
  if (checkKeys) {
    return sendResponse(response, moduleName, 422, 0, checkKeys);
  }

  const validStatuses = ["accept", "reject", "inactive"];
  if (!validStatuses.includes(params.status)) {
    return sendResponse(
      response,
      moduleName,
      422,
      0,
      `Invalid status. Must be one of: ${validStatuses.join(", ")}`
    );
  }

  try {
    if (!ObjectId.isValid(params._id)) {
      return sendResponse(response, moduleName, 422, 0, "Invalid ID format");
    }

    let existing = await ProviderServiceModel.findOne({
      _id: new ObjectId(params._id),
      isDeleted: { $ne: true },
    });

    if (!existing) {
      return sendResponse(response, moduleName, 404, 0, "Provider service not found");
    }

    if (params.status === "accept") {
      existing.isApproved = true;
      existing.status = "active";
    } else if (params.status === "reject") {
      existing.isApproved = false;
    } else if (params.status === "inactive") {
      existing.status = "inactive";
    }

    let data = await existing.save();

    let systemLogsData = {
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "update",
      data: data,
    };
    await systemLogsHelper.composeSystemLogs(systemLogsData);

    return sendResponse(
      response,
      moduleName,
      200,
      1,
      "Provider service updated successfully",
      { providerService: data }
    );
  } catch (error) {
    console.log("--- providerServices_update_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}
