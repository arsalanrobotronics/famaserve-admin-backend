// dependencies
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

// data_models
const ServiceModel = require("../../models/Service");
const CategoryModel = require("../../models/Category");

// utility_functions
const systemLogsHelper = require("../../helpers/system-logs");
const { sendResponse, checkKeysExist } = require("../../helpers/utils");

// module_identifier
const moduleName = "Services";

module.exports = {
  getById,
  getAll,
  create,
  update,
  delete: deleteService,
};

/** fetch_service_by_identifier **/
async function getById(request, response) {
  let params = request.params;

  try {
    if (!ObjectId.isValid(params.serviceId)) {
      return sendResponse(response, moduleName, 422, 0, "Invalid service ID format");
    }

    const $aggregate = [
      {
        $match: {
          _id: new ObjectId(params.serviceId),
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
        $lookup: {
          from: "customers",
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
        $project: {
          _id: 1,
          categoryId: 1,
          title: 1,
          description: 1,
          slug: 1,
          type: 1,
          status: 1,
          sequence: 1,
          createdAt: 1,
          updatedAt: 1,
          "category._id": 1,
          "category.title": 1,
          "category.slug": 1,
          "createdByDetails._id": 1,
          "createdByDetails.fullName": 1,
        },
      },
    ];

    let data = await ServiceModel.aggregate($aggregate).exec();

    if (!data || data.length === 0) {
      return sendResponse(response, moduleName, 404, 0, "Service not found");
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
      service: data[0],
    };
    return sendResponse(response, moduleName, 200, 1, "Service fetched", respData);
  } catch (error) {
    console.log("--- services_getById_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** fetch_all_services **/
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

    let $aggregate = [
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
        $lookup: {
          from: "customers",
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
        $project: {
          _id: 1,
          categoryId: 1,
          title: 1,
          description: 1,
          slug: 1,
          type: 1,
          status: 1,
          sequence: 1,
          createdAt: 1,
          updatedAt: 1,
          "category._id": 1,
          "category.title": 1,
          "category.slug": 1,
          "createdByDetails._id": 1,
          "createdByDetails.fullName": 1,
        },
      },
    ];

    /** apply_status_filter **/
    if (params.status) {
      $aggregate.unshift({
        $match: {
          status: params.status,
        },
      });
    }

    /** apply_type_filter **/
    if (params.type) {
      $aggregate.unshift({
        $match: {
          type: params.type,
        },
      });
    }

    /** apply_category_filter **/
    if (params.categoryId && ObjectId.isValid(params.categoryId)) {
      $aggregate.unshift({
        $match: {
          categoryId: new ObjectId(params.categoryId),
        },
      });
    }

    /** apply_search_filter **/
    if (params.keyword) {
      let key = params.keyword;
      $aggregate.push({
        $match: {
          $or: [
            { title: RegExp(key, "i") },
            { description: RegExp(key, "i") },
            { slug: RegExp(key, "i") },
            { "category.title": RegExp(key, "i") },
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

        $aggregate.unshift({
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

    let data = await ServiceModel.aggregate($aggregate).exec();
    const count = await ServiceModel.aggregate(countAggregate).exec();
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
      services: data,
      pagination: {
        total: total,
        perPage: perPage,
        current: page,
        first: 1,
        last: total ? Math.ceil(total / perPage) : 1,
        next: page < Math.ceil(total / perPage) ? page + 1 : "",
      },
    };
    return sendResponse(response, moduleName, 200, 1, "Services fetched", respData);
  } catch (error) {
    console.log("--- services_getAll_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** create_service **/
async function create(request, response) {
  let params = request.body;

  // validate_input_parameters
  let checkKeys = await checkKeysExist(params, ["categoryId", "title", "slug"]);
  if (checkKeys) {
    return sendResponse(response, moduleName, 422, 0, checkKeys);
  }

  try {
    // validate_categoryId
    if (!ObjectId.isValid(params.categoryId)) {
      return sendResponse(response, moduleName, 422, 0, "Invalid category ID format");
    }

    // verify_category_exists
    let categoryExists = await CategoryModel.countDocuments({
      _id: new ObjectId(params.categoryId),
    });

    if (!categoryExists) {
      return sendResponse(response, moduleName, 422, 0, "Category does not exist");
    }

    // verify_slug_uniqueness_within_category
    let check = await ServiceModel.countDocuments({
      categoryId: new ObjectId(params.categoryId),
      slug: params.slug.toLowerCase().trim(),
    });

    if (check > 0) {
      return sendResponse(
        response,
        moduleName,
        422,
        0,
        "Service already exists with the given slug in this category"
      );
    }

    var service = new ServiceModel();
    service.categoryId = new ObjectId(params.categoryId);
    service.title = params.title;
    service.slug = params.slug.toLowerCase().trim();
    service.description = params.description || null;
    service.type = params.type || "manual";
    service.status = params.status || "active";
    service.sequence = params.sequence || null;
    service.createdBy = request?.user?._id || null;

    let data = await service.save();

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
        "Service has been created successfully",
        { service: data }
      );
    }
  } catch (error) {
    console.log("--- services_create_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** update_service **/
async function update(request, response) {
  let params = request.body;

  // validate_input_parameters
  let checkKeys = await checkKeysExist(params, ["_id"]);
  if (checkKeys) {
    return sendResponse(response, moduleName, 422, 0, checkKeys);
  }

  try {
    if (!ObjectId.isValid(params._id)) {
      return sendResponse(response, moduleName, 422, 0, "Invalid service ID format");
    }

    // Check if service exists
    let existingService = await ServiceModel.findOne({
      _id: new ObjectId(params._id),
    });

    if (!existingService) {
      return sendResponse(response, moduleName, 404, 0, "Service not found");
    }

    // If categoryId is being updated, verify it exists
    if (params.categoryId) {
      if (!ObjectId.isValid(params.categoryId)) {
        return sendResponse(response, moduleName, 422, 0, "Invalid category ID format");
      }

      let categoryExists = await CategoryModel.countDocuments({
        _id: new ObjectId(params.categoryId),
      });

      if (!categoryExists) {
        return sendResponse(response, moduleName, 422, 0, "Category does not exist");
      }
    }

    // Check for duplicate slug within category if slug or categoryId is being updated
    if (params.slug || params.categoryId) {
      const checkCategoryId = params.categoryId 
        ? new ObjectId(params.categoryId) 
        : existingService.categoryId;
      const checkSlug = params.slug 
        ? params.slug.toLowerCase().trim() 
        : existingService.slug;

      let check = await ServiceModel.countDocuments({
        categoryId: checkCategoryId,
        slug: checkSlug,
        _id: { $ne: params._id },
      });

      if (check > 0) {
        return sendResponse(
          response,
          moduleName,
          422,
          0,
          "Another service already exists with the given slug in this category"
        );
      }
    }

    // construct_update_payload
    const updateObject = {
      ...(params.categoryId && { categoryId: new ObjectId(params.categoryId) }),
      ...(params.title && { title: params.title }),
      ...(params.slug && { slug: params.slug.toLowerCase().trim() }),
      ...(params.description !== undefined && { description: params.description }),
      ...(params.type && { type: params.type }),
      ...(params.status && { status: params.status }),
      ...(params.sequence !== undefined && { sequence: params.sequence }),
      updatedAt: new Date(),
    };

    const updatedService = await ServiceModel.findOneAndUpdate(
      { _id: new ObjectId(params._id) },
      updateObject,
      { new: true, runValidators: true }
    );

    if (updatedService) {
      // generate_audit_entry
      let systemLogsData = {
        userId: request.user._id,
        userIp: request.ip,
        roleId: request.user.roleId,
        module: moduleName,
        action: "updated",
        data: updatedService,
      };
      await systemLogsHelper.composeSystemLogs(systemLogsData);

      return sendResponse(
        response,
        moduleName,
        200,
        1,
        "Service has been updated successfully",
        { service: updatedService }
      );
    }
  } catch (error) {
    console.log("--- services_update_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** delete_service **/
async function deleteService(request, response) {
  let params = request.params;

  try {
    if (!ObjectId.isValid(params.serviceId)) {
      return sendResponse(response, moduleName, 422, 0, "Invalid service ID format");
    }

    // verify_entity_existence
    let check = await ServiceModel.countDocuments({
      _id: new ObjectId(params.serviceId),
    });

    if (check > 0) {
      const deleteRecord = await ServiceModel.deleteOne({
        _id: new ObjectId(params.serviceId),
      });

      if (deleteRecord) {
        // generate_audit_entry
        let systemLogsData = {
          userId: request.user._id,
          userIp: request.ip,
          roleId: request.user.roleId,
          module: moduleName,
          action: "deleted",
          data: params.serviceId,
        };
        await systemLogsHelper.composeSystemLogs(systemLogsData);

        return sendResponse(
          response,
          moduleName,
          200,
          1,
          "Service has been deleted successfully"
        );
      }
    }

    return sendResponse(response, moduleName, 422, 0, "Service does not exist");
  } catch (error) {
    console.log("--- services_delete_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}


