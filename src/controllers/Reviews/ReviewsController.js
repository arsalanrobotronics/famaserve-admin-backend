// dependencies
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

// data_models
const ReviewModel = require("../../models/Review");

// utility_functions
const systemLogsHelper = require("../../helpers/system-logs");
const { sendResponse, checkKeysExist } = require("../../helpers/utils");

// module_identifier
const moduleName = "Reviews";

module.exports = {
  getById,
  getAll,
  delete: deleteReview,
};

/** fetch_review_by_identifier **/
async function getById(request, response) {
  let params = request.params;

  try {
    if (!ObjectId.isValid(params.reviewId)) {
      return sendResponse(response, moduleName, 422, 0, "Invalid review ID format");
    }

    const $aggregate = [
      {
        $match: {
          _id: new ObjectId(params.reviewId),
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      {
        $unwind: {
          path: "$customer",
          preserveNullAndEmptyArrays: true,
        },
      },
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
          from: "bookings",
          localField: "bookingId",
          foreignField: "_id",
          as: "booking",
        },
      },
      {
        $unwind: {
          path: "$booking",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "providerservices",
          localField: "serviceId",
          foreignField: "_id",
          as: "service",
        },
      },
      {
        $unwind: {
          path: "$service",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          rating: 1,
          comment: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          "customer._id": 1,
          "customer.fullName": 1,
          "customer.email": 1,
          "customer.avatar": 1,
          "provider._id": 1,
          "provider.fullName": 1,
          "provider.email": 1,
          "provider.companyName": 1,
          "booking._id": 1,
          "booking.status": 1,
          "booking.scheduleDate": 1,
          "service._id": 1,
          "service.title": 1,
        },
      },
    ];

    let data = await ReviewModel.aggregate($aggregate).exec();

    if (!data || data.length === 0) {
      return sendResponse(response, moduleName, 404, 0, "Review not found");
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
      review: data[0],
    };
    return sendResponse(response, moduleName, 200, 1, "Review fetched", respData);
  } catch (error) {
    console.log("--- reviews_getById_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** fetch_all_reviews **/
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
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      {
        $unwind: {
          path: "$customer",
          preserveNullAndEmptyArrays: true,
        },
      },
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
          from: "providerservices",
          localField: "serviceId",
          foreignField: "_id",
          as: "service",
        },
      },
      {
        $unwind: {
          path: "$service",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          rating: 1,
          comment: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          "customer._id": 1,
          "customer.fullName": 1,
          "customer.email": 1,
          "provider._id": 1,
          "provider.fullName": 1,
          "provider.companyName": 1,
          "service._id": 1,
          "service.title": 1,
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

    /** apply_rating_filter **/
    if (params.rating) {
      $aggregate.unshift({
        $match: {
          rating: parseInt(params.rating),
        },
      });
    }

    /** apply_customer_filter **/
    if (params.customerId && ObjectId.isValid(params.customerId)) {
      $aggregate.unshift({
        $match: {
          customerId: new ObjectId(params.customerId),
        },
      });
    }

    /** apply_provider_filter **/
    if (params.providerId && ObjectId.isValid(params.providerId)) {
      $aggregate.unshift({
        $match: {
          providerId: new ObjectId(params.providerId),
        },
      });
    }

    /** apply_search_filter **/
    if (params.keyword) {
      let key = params.keyword;
      $aggregate.push({
        $match: {
          $or: [
            { "customer.fullName": RegExp(key, "i") },
            { "provider.fullName": RegExp(key, "i") },
            { "provider.companyName": RegExp(key, "i") },
            { comment: RegExp(key, "i") },
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

    let data = await ReviewModel.aggregate($aggregate).exec();
    const count = await ReviewModel.aggregate(countAggregate).exec();
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
      reviews: data,
      pagination: {
        total: total,
        perPage: perPage,
        current: page,
        first: 1,
        last: total ? Math.ceil(total / perPage) : 1,
        next: page < Math.ceil(total / perPage) ? page + 1 : "",
      },
    };
    return sendResponse(response, moduleName, 200, 1, "Reviews fetched", respData);
  } catch (error) {
    console.log("--- reviews_getAll_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** delete_review **/
async function deleteReview(request, response) {
  let params = request.params;

  try {
    if (!ObjectId.isValid(params.reviewId)) {
      return sendResponse(response, moduleName, 422, 0, "Invalid review ID format");
    }

    // verify_entity_existence
    let check = await ReviewModel.countDocuments({
      _id: new ObjectId(params.reviewId),
    });

    if (check > 0) {
      const deleteRecord = await ReviewModel.deleteOne({
        _id: new ObjectId(params.reviewId),
      });

      if (deleteRecord) {
        // generate_audit_entry
        let systemLogsData = {
          userId: request.user._id,
          userIp: request.ip,
          roleId: request.user.roleId,
          module: moduleName,
          action: "deleted",
          data: params.reviewId,
        };
        await systemLogsHelper.composeSystemLogs(systemLogsData);

        return sendResponse(
          response,
          moduleName,
          200,
          1,
          "Review has been deleted successfully"
        );
      }
    }

    return sendResponse(response, moduleName, 422, 0, "Review does not exist");
  } catch (error) {
    console.log("--- reviews_delete_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

