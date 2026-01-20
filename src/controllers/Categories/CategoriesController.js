// dependencies
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

// data_models
const CategoryModel = require("../../models/Category");

// utility_functions
const systemLogsHelper = require("../../helpers/system-logs");
const { sendResponse, checkKeysExist } = require("../../helpers/utils");

// module_identifier
const moduleName = "Categories";

module.exports = {
  getById,
  getAll,
  create,
  update,
  delete: deleteCategory,
};

/** fetch_category_by_identifier **/
async function getById(request, response) {
  let params = request.params;

  try {
    if (!ObjectId.isValid(params.categoryId)) {
      return sendResponse(response, moduleName, 422, 0, "Invalid category ID format");
    }

    const $aggregate = [
      {
        $match: {
          _id: new ObjectId(params.categoryId),
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
          title: 1,
          description: 1,
          icon: 1,
          slug: 1,
          type: 1,
          status: 1,
          sequence: 1,
          createdAt: 1,
          updatedAt: 1,
          "createdByDetails._id": 1,
          "createdByDetails.fullName": 1,
        },
      },
    ];

    let data = await CategoryModel.aggregate($aggregate).exec();

    if (!data || data.length === 0) {
      return sendResponse(response, moduleName, 404, 0, "Category not found");
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
      category: data[0],
    };
    return sendResponse(response, moduleName, 200, 1, "Category fetched", respData);
  } catch (error) {
    console.log("--- categories_getById_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** fetch_all_categories **/
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
          title: 1,
          description: 1,
          icon: 1,
          slug: 1,
          type: 1,
          status: 1,
          sequence: 1,
          createdAt: 1,
          updatedAt: 1,
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

    /** apply_search_filter **/
    if (params.keyword) {
      let key = params.keyword;
      $aggregate.unshift({
        $match: {
          $or: [
            { title: RegExp(key, "i") },
            { description: RegExp(key, "i") },
            { slug: RegExp(key, "i") },
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

    let data = await CategoryModel.aggregate($aggregate).exec();
    const count = await CategoryModel.aggregate(countAggregate).exec();
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
      categories: data,
      pagination: {
        total: total,
        perPage: perPage,
        current: page,
        first: 1,
        last: total ? Math.ceil(total / perPage) : 1,
        next: page < Math.ceil(total / perPage) ? page + 1 : "",
      },
    };
    return sendResponse(response, moduleName, 200, 1, "Categories fetched", respData);
  } catch (error) {
    console.log("--- categories_getAll_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** create_category **/
async function create(request, response) {
  let params = request.body;

  // validate_input_parameters
  let checkKeys = await checkKeysExist(params, ["title", "slug"]);
  if (checkKeys) {
    return sendResponse(response, moduleName, 422, 0, checkKeys);
  }

  try {
    // verify_slug_uniqueness
    let check = await CategoryModel.countDocuments({
      slug: params.slug.toLowerCase().trim(),
    });

    if (check > 0) {
      return sendResponse(
        response,
        moduleName,
        422,
        0,
        "Category already exists with the given slug"
      );
    }

    var category = new CategoryModel();
    category.title = params.title;
    category.slug = params.slug.toLowerCase().trim();
    category.description = params.description || null;
    category.icon = params.icon || null;
    category.type = params.type || "manual";
    category.status = params.status || "active";
    category.sequence = params.sequence || null;
    category.createdBy = request?.user?._id || null;

    let data = await category.save();

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
        "Category has been created successfully",
        { category: data }
      );
    }
  } catch (error) {
    console.log("--- categories_create_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** update_category **/
async function update(request, response) {
  let params = request.body;

  // validate_input_parameters
  let checkKeys = await checkKeysExist(params, ["_id"]);
  if (checkKeys) {
    return sendResponse(response, moduleName, 422, 0, checkKeys);
  }

  try {
    if (!ObjectId.isValid(params._id)) {
      return sendResponse(response, moduleName, 422, 0, "Invalid category ID format");
    }

    // Check if category exists
    let existingCategory = await CategoryModel.findOne({
      _id: new ObjectId(params._id),
    });

    if (!existingCategory) {
      return sendResponse(response, moduleName, 404, 0, "Category not found");
    }

    // Check for duplicate slug if slug is being updated
    if (params.slug) {
      let check = await CategoryModel.countDocuments({
        slug: params.slug.toLowerCase().trim(),
        _id: { $ne: params._id },
      });

      if (check > 0) {
        return sendResponse(
          response,
          moduleName,
          422,
          0,
          "Another category already exists with the given slug"
        );
      }
    }

    // construct_update_payload
    const updateObject = {
      ...(params.title && { title: params.title }),
      ...(params.slug && { slug: params.slug.toLowerCase().trim() }),
      ...(params.description !== undefined && { description: params.description }),
      ...(params.icon !== undefined && { icon: params.icon }),
      ...(params.type && { type: params.type }),
      ...(params.status && { status: params.status }),
      ...(params.sequence !== undefined && { sequence: params.sequence }),
      updatedAt: new Date(),
    };

    const updatedCategory = await CategoryModel.findOneAndUpdate(
      { _id: new ObjectId(params._id) },
      updateObject,
      { new: true, runValidators: true }
    );

    if (updatedCategory) {
      // generate_audit_entry
      let systemLogsData = {
        userId: request.user._id,
        userIp: request.ip,
        roleId: request.user.roleId,
        module: moduleName,
        action: "updated",
        data: updatedCategory,
      };
      await systemLogsHelper.composeSystemLogs(systemLogsData);

      return sendResponse(
        response,
        moduleName,
        200,
        1,
        "Category has been updated successfully",
        { category: updatedCategory }
      );
    }
  } catch (error) {
    console.log("--- categories_update_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** delete_category **/
async function deleteCategory(request, response) {
  let params = request.params;

  try {
    if (!ObjectId.isValid(params.categoryId)) {
      return sendResponse(response, moduleName, 422, 0, "Invalid category ID format");
    }

    // verify_entity_existence
    let check = await CategoryModel.countDocuments({
      _id: new ObjectId(params.categoryId),
    });

    if (check > 0) {
      const deleteRecord = await CategoryModel.deleteOne({
        _id: new ObjectId(params.categoryId),
      });

      if (deleteRecord) {
        // generate_audit_entry
        let systemLogsData = {
          userId: request.user._id,
          userIp: request.ip,
          roleId: request.user.roleId,
          module: moduleName,
          action: "deleted",
          data: params.categoryId,
        };
        await systemLogsHelper.composeSystemLogs(systemLogsData);

        return sendResponse(
          response,
          moduleName,
          200,
          1,
          "Category has been deleted successfully"
        );
      }
    }

    return sendResponse(response, moduleName, 422, 0, "Category does not exist");
  } catch (error) {
    console.log("--- categories_delete_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}


