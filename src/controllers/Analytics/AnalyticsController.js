// includes
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

// Models
const CustomerModel = require("../../models/Customers");
const RoleModel = require("../../models/Role");
const BookingModel = require("../../models/Booking");
const CategoryModel = require("../../models/Category");
const ReviewModel = require("../../models/Review");

// helper functions
const systemLogsHelper = require("../../helpers/system-logs");
const { sendResponse } = require("../../helpers/utils");

// module name
const moduleName = "Analytics";

module.exports = {
  getAllAnalytics,
};

/** Get all analytics for Dashboard **/
async function getAllAnalytics(request, response) {
  let params = request.query;

  try {
    // Get Provider and Customer role IDs
    const providerRole = await RoleModel.findOne({ title: "Provider" }).select("_id title");
    const customerRole = await RoleModel.findOne({ title: "Customer" }).select("_id title");

    if (!providerRole) {
      return sendResponse(response, moduleName, 404, 0, "Provider role not found");
    }

    const providerRoleId = providerRole._id;
    const customerRoleId = customerRole ? customerRole._id : null;

    // ========== 1. Total Users (All Customers) ==========
    const totalUsers = await CustomerModel.countDocuments();

    // ========== 2. Total Providers ==========
    const totalProviders = await CustomerModel.countDocuments({
      roleId: providerRoleId,
      status: "active",
    });

    // ========== 3. Pending Verifications ==========
    const pendingVerifications = await CustomerModel.countDocuments({
      status: "pending",
    });

    // ========== 4. Total Bookings ==========
    const totalBookings = await BookingModel.countDocuments();

    // ========== 5. Total Categories ==========
    const totalCategories = await CategoryModel.countDocuments();

    // ========== 6. Flagged Content (Reviews with low ratings <= 2) ==========
    const flaggedContent = await ReviewModel.countDocuments({
      rating: { $lte: 2 },
    });

    // ========== 7. Monthly Bookings ==========
    const last6Months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last6Months.push({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        monthName: date.toLocaleDateString("en-US", { month: "short" }),
      });
    }

    const monthlyBookingsData = await BookingModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1),
          },
        },
      },
      {
        $project: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
      },
      {
        $group: {
          _id: {
            year: "$year",
            month: "$month",
          },
          count: { $sum: 1 },
        },
      },
    ]).exec();

    const monthlyBookingsMap = {};
    monthlyBookingsData.forEach((item) => {
      const key = `${item._id.year}-${item._id.month}`;
      monthlyBookingsMap[key] = item.count;
    });

    const monthlyBookings = last6Months.map((m) => {
      const key = `${m.year}-${m.month}`;
      return {
        month: m.monthName,
        bookings: monthlyBookingsMap[key] || 0,
      };
    });

    // ========== 8. Monthly Users ==========
    const monthlyUsersData = await CustomerModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1),
          },
        },
      },
      {
        $project: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
      },
      {
        $group: {
          _id: {
            year: "$year",
            month: "$month",
          },
          count: { $sum: 1 },
        },
      },
    ]).exec();

    const monthlyUsersMap = {};
    monthlyUsersData.forEach((item) => {
      const key = `${item._id.year}-${item._id.month}`;
      monthlyUsersMap[key] = item.count;
    });

    const monthlyUsers = last6Months.map((m) => {
      const key = `${m.year}-${m.month}`;
      return {
        month: m.monthName,
        users: monthlyUsersMap[key] || 0,
      };
    });

    // ========== 9. Top Providers (by booking count and rating) ==========
    const topProvidersData = await BookingModel.aggregate([
      {
        $match: {
          providerId: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$providerId",
          bookingCount: { $sum: 1 },
        },
      },
      {
        $sort: { bookingCount: -1 },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
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
          from: "reviews",
          localField: "_id",
          foreignField: "providerId",
          as: "reviews",
        },
      },
      {
        $project: {
          _id: 1,
          bookingCount: 1,
          providerName: {
            $ifNull: ["$provider.companyName", "$provider.fullName"],
          },
          averageRating: {
            $cond: {
              if: { $gt: [{ $size: "$reviews" }, 0] },
              then: { $avg: "$reviews.rating" },
              else: 0,
            },
          },
        },
      },
      {
        $sort: { bookingCount: -1, averageRating: -1 },
      },
    ]).exec();

    const topProviders = topProvidersData.map((item, index) => ({
      id: item._id.toString(),
      name: item.providerName || "Unknown Provider",
      rating: item.averageRating ? parseFloat(item.averageRating.toFixed(1)) : 0,
      bookings: item.bookingCount,
    }));

    // create system logs
    await systemLogsHelper.composeSystemLogs({
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "getAllAnalytics",
      data: { analytics: "fetched" },
    });

    const respData = {
      totalUsers,
      totalProviders,
      pendingVerifications,
      totalBookings,
      totalCategories,
      flaggedContent,
      monthlyBookings,
      monthlyUsers,
      topProviders,
    };

    return sendResponse(
      response,
      moduleName,
      200,
      1,
      "Analytics fetched successfully",
      respData
    );
  } catch (error) {
    console.log("--- analytics.getAllAnalytics_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}
