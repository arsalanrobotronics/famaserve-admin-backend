// dependencies
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

// data_models
const BookingModel = require("../../models/Booking");

// utility_functions
const systemLogsHelper = require("../../helpers/system-logs");
const { sendResponse } = require("../../helpers/utils");

// module_identifier
const moduleName = "Bookings"; 

module.exports = {
  getById,
  getAll,
};

/** fetch_booking_by_identifier **/
async function getById(request, response) {
  let params = request.params;

  try {
    if (!ObjectId.isValid(params.bookingId)) {
      return sendResponse(response, moduleName, 422, 0, "Invalid booking ID format");
    }

    const $aggregate = [
      {
        $match: {
          _id: new ObjectId(params.bookingId),
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
          status: 1,
          scheduleDate: 1,
          timeSlotStart: 1,
          timeSlotEnd: 1,
          timeLabel: 1,
          requestedPrice: 1,
          notes: 1,
          serviceSnapshot: 1,
          cancelledBy: 1,
          cancellationReason: 1,
          cancellationNote: 1,
          cancelledAt: 1,
          providerRespondedAt: 1,
          confirmedAt: 1,
          completedAt: 1,
          createdAt: 1,
          updatedAt: 1,
          "customer._id": 1,
          "customer.fullName": 1,
          "customer.email": 1,
          "customer.phoneNumber": 1,
          "customer.avatar": 1,
          "provider._id": 1,
          "provider.fullName": 1,
          "provider.email": 1,
          "provider.phoneNumber": 1,
          "provider.companyName": 1,
          "provider.avatar": 1,
          "service._id": 1,
          "service.title": 1,
          "service.location": 1,
        },
      },
    ];

    let data = await BookingModel.aggregate($aggregate).exec();

    if (!data || data.length === 0) {
      return sendResponse(response, moduleName, 404, 0, "Booking not found");
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
      booking: data[0],
    };
    return sendResponse(response, moduleName, 200, 1, "Booking fetched", respData);
  } catch (error) {
    console.log("--- bookings_getById_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** fetch_all_bookings **/
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
          status: 1,
          scheduleDate: 1,
          timeSlotStart: 1,
          timeSlotEnd: 1,
          timeLabel: 1,
          requestedPrice: 1,
          notes: 1,
          serviceSnapshot: 1,
          cancelledBy: 1,
          cancellationReason: 1,
          cancelledAt: 1,
          confirmedAt: 1,
          completedAt: 1,
          createdAt: 1,
          updatedAt: 1,
          "customer._id": 1,
          "customer.fullName": 1,
          "customer.email": 1,
          "customer.phoneNumber": 1,
          "provider._id": 1,
          "provider.fullName": 1,
          "provider.email": 1,
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
            { "service.title": RegExp(key, "i") },
            { "serviceSnapshot.title": RegExp(key, "i") },
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

    /** apply_schedule_date_filter **/
    if (params.scheduleDate) {
      const filterDate = new Date(params.scheduleDate);
      if (!isNaN(filterDate)) {
        const startOfDay = new Date(filterDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(filterDate);
        endOfDay.setHours(23, 59, 59, 999);

        $aggregate.unshift({
          $match: {
            scheduleDate: {
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

    let data = await BookingModel.aggregate($aggregate).exec();
    const count = await BookingModel.aggregate(countAggregate).exec();
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
      bookings: data,
      pagination: {
        total: total,
        perPage: perPage,
        current: page,
        first: 1,
        last: total ? Math.ceil(total / perPage) : 1,
        next: page < Math.ceil(total / perPage) ? page + 1 : "",
      },
    };
    return sendResponse(response, moduleName, 200, 1, "Bookings fetched", respData);
  } catch (error) {
    console.log("--- bookings_getAll_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

