// dependencies
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const sanitize = require("mongo-sanitize");

// data_models
const NotificationModel = require("../../models/Notification");
const CustomerModel = require("../../models/Customers");
const RoleModel = require("../../models/Role");

// utility_functions
const systemLogsHelper = require("../../helpers/system-logs");
const { sendResponse, checkKeysExist } = require("../../helpers/utils");

// module_identifier
const moduleName = "Notifications";

module.exports = {
  sendAdminNotification,
  getAdminNotifications,
};

/** send_notification_from_admin **/
async function sendAdminNotification(request, response) {
  try {
    let params = request.body;

    if (!request.user || !request.user._id) {
      return sendResponse(response, moduleName, 401, 0, "Unauthorized");
    }

    // Validate required fields
    let checkKeys = await checkKeysExist(params, ["title", "message", "targetAudience"]);
    if (checkKeys) {
      return sendResponse(response, moduleName, 422, 0, checkKeys);
    }

    // Validate targetAudience
    const validAudiences = ["all_users", "all_providers", "all_customers"];
    if (!validAudiences.includes(params.targetAudience)) {
      return sendResponse(response, moduleName, 422, 0, "Invalid target audience. Must be: all_users, all_providers, or all_customers");
    }

    // Get role IDs for filtering
    let providerRoleId = null;
    let customerRoleId = null;

    if (params.targetAudience === "all_providers" || params.targetAudience === "all_users") {
      const providerRole = await RoleModel.findOne({ title: "Provider" }).select("_id");
      if (providerRole) {
        providerRoleId = providerRole._id;
      }
    }

    if (params.targetAudience === "all_customers" || params.targetAudience === "all_users") {
      const customerRole = await RoleModel.findOne({ title: "Customer" }).select("_id");
      if (customerRole) {
        customerRoleId = customerRole._id;
      }
    }

    // Build query to get recipients
    let recipientQuery = { status: "active" };
    
    if (params.targetAudience === "all_providers") {
      if (providerRoleId) {
        recipientQuery.roleId = providerRoleId;
      } else {
        return sendResponse(response, moduleName, 404, 0, "Provider role not found");
      }
    } else if (params.targetAudience === "all_customers") {
      if (customerRoleId) {
        recipientQuery.roleId = customerRoleId;
      } else {
        return sendResponse(response, moduleName, 404, 0, "Customer role not found");
      }
    } else if (params.targetAudience === "all_users") {
      // For all_users, we'll get both providers and customers
      if (providerRoleId && customerRoleId) {
        recipientQuery.roleId = { $in: [providerRoleId, customerRoleId] };
      } else if (providerRoleId) {
        recipientQuery.roleId = providerRoleId;
      } else if (customerRoleId) {
        recipientQuery.roleId = customerRoleId;
      } else {
        return sendResponse(response, moduleName, 404, 0, "Roles not found");
      }
    }

    // Get all recipients
    const recipients = await CustomerModel.find(recipientQuery).select("_id").lean();

    if (!recipients || recipients.length === 0) {
      return sendResponse(response, moduleName, 404, 0, "No recipients found for the selected audience");
    }

    // Create notifications for all recipients
    const notifications = recipients.map((recipient) => ({
      title: sanitize(params.title),
      message: sanitize(params.message),
      type: "system_notification",
      status: "active",
      recipientId: recipient._id,
      senderId: null,
      isRead: false,
      sentByAdmin: true,
      adminUserId: request.user._id,
      targetAudience: params.targetAudience,
      meta: params.meta || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Bulk insert notifications
    const insertedNotifications = await NotificationModel.insertMany(notifications);

    // generate_audit_entry
    let systemLogsData = {
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "sendAdminNotification",
      data: {
        targetAudience: params.targetAudience,
        recipientCount: insertedNotifications.length,
        title: params.title,
      },
    };
    await systemLogsHelper.composeSystemLogs(systemLogsData);

    return sendResponse(
      response,
      moduleName,
      200,
      1,
      `Notification sent successfully to ${insertedNotifications.length} recipients`,
      {
        notificationCount: insertedNotifications.length,
        targetAudience: params.targetAudience,
      }
    );
  } catch (error) {
    console.log("--- notifications.sendAdminNotification_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** get_admin_notifications_list **/
async function getAdminNotifications(request, response) {
  try {
    let params = request.query;

    if (!request.user || !request.user._id) {
      return sendResponse(response, moduleName, 401, 0, "Unauthorized");
    }

    let page = params.startAt ? parseInt(params.startAt) : 1;
    let perPage = params.perPage ? parseInt(params.perPage) : 10;
    let sortBy = { createdAt: -1 };

    // Build aggregation pipeline
    let $aggregate = [
      {
        $match: {
          sentByAdmin: true,
        },
      },
      {
        $lookup: {
          from: "systemusers",
          localField: "adminUserId",
          foreignField: "_id",
          as: "adminDetails",
        },
      },
      {
        $unwind: { path: "$adminDetails", preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: "customers",
          localField: "recipientId",
          foreignField: "_id",
          as: "recipientDetails",
        },
      },
      {
        $unwind: { path: "$recipientDetails", preserveNullAndEmptyArrays: true },
      },
    ];

    // Filter by targetAudience if provided
    if (params.targetAudience) {
      $aggregate.push({
        $match: { targetAudience: sanitize(params.targetAudience) },
      });
    }

    // Filter by date if provided
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

    // Group by title, message, targetAudience, and adminUserId to get unique notifications
    $aggregate.push({
      $group: {
        _id: {
          title: "$title",
          message: "$message",
          targetAudience: "$targetAudience",
          adminUserId: "$adminUserId",
        },
        adminName: { $first: "$adminDetails.fullName" },
        recipientCount: { $sum: 1 },
        firstNotificationId: { $first: "$_id" },
        createdAt: { $min: "$createdAt" }, // Use min to get the earliest notification time
      },
    });

    // Project final fields
    $aggregate.push({
      $project: {
        _id: "$firstNotificationId",
        title: "$_id.title",
        message: "$_id.message",
        targetAudience: "$_id.targetAudience",
        adminUserId: "$_id.adminUserId",
        adminName: 1,
        recipientCount: 1,
        createdAt: 1,
      },
    });

    // Sort
    $aggregate.push({ $sort: sortBy });

    // Pagination
    $aggregate.push({ $skip: perPage * (page - 1) });
    $aggregate.push({ $limit: perPage });

    let data = await NotificationModel.aggregate($aggregate).exec();

    // Get total count
    let countAgg = [
      {
        $match: {
          sentByAdmin: true,
        },
      },
    ];

    if (params.targetAudience) {
      countAgg.push({
        $match: { targetAudience: sanitize(params.targetAudience) },
      });
    }

    if (params.date) {
      const filterDate = new Date(params.date);
      if (!isNaN(filterDate)) {
        const startOfDay = new Date(filterDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(filterDate);
        endOfDay.setHours(23, 59, 59, 999);

        countAgg.push({
          $match: {
            createdAt: {
              $gte: startOfDay,
              $lte: endOfDay,
            },
          },
        });
      }
    }

    countAgg.push({
      $group: {
        _id: {
          title: "$title",
          message: "$message",
          targetAudience: "$targetAudience",
          adminUserId: "$adminUserId",
        },
      },
    });

    countAgg.push({ $count: "total" });

    const count = await NotificationModel.aggregate(countAgg).exec();
    const total = count.length ? count[0].total : 0;

    // generate_audit_entry
    await systemLogsHelper.composeSystemLogs({
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "getAdminNotifications",
      data: { page, perPage },
    });

    return sendResponse(response, moduleName, 200, 1, "Admin notifications fetched", {
      notifications: data,
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
    console.log("--- notifications.getAdminNotifications_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}
