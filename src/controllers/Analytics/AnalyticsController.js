// includes
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

// Models
// const CustomerModel = require("../../models/Customers");
// const RoleModel = require("../../models/Role");
// const SubscriptionModel = require("../../models/Subscriptions");
// const ProjectModel = require("../../models/Projects");
// const TradeModel = require("../../models/Trades");
// const SubTradeModel = require("../../models/SubTrades");

// helper functions
const systemLogsHelper = require("../../helpers/system-logs");
const { sendResponse } = require("../../helpers/utils");

// module name
const moduleName = "Analytics";

module.exports = {
  // getAllAnalytics,
};

/** Get all analytics - Active Tradies, Builders, Subscriptions, Projects, Trades/SubTrades **/
// async function getAllAnalytics(request, response) {
//   let params = request.query;

//   try {
//     // Get Tradie and Builder role IDs
//     const tradieRole = await RoleModel.findOne({ title: "Tradie" }).select("_id title");
//     const builderRole = await RoleModel.findOne({ title: "Builder" }).select("_id title");

//     if (!tradieRole || !builderRole) {
//       return sendResponse(response, moduleName, 404, 0, "Tradie or Builder role not found");
//     }

//     const tradieRoleId = tradieRole._id;
//     const builderRoleId = builderRole._id;

//     // Build match conditions for date filtering
//     const dateMatch = {};
//     if (params.startDate || params.endDate) {
//       dateMatch.createdAt = {};
//       if (params.startDate) {
//         dateMatch.createdAt.$gte = new Date(params.startDate);
//       }
//       if (params.endDate) {
//         dateMatch.createdAt.$lte = new Date(params.endDate);
//       }
//     }

//     // ========== 1. Active Tradies and Builders Analytics ==========
//     const customersMatch = {
//       status: "active",
//       roleId: { $in: [tradieRoleId, builderRoleId] },
//       ...dateMatch,
//     };

//     const customersAggregate = [
//       { $match: customersMatch },
//       {
//         $lookup: {
//           from: "roles",
//           localField: "roleId",
//           foreignField: "_id",
//           as: "role",
//         },
//       },
//       { $unwind: { path: "$role", preserveNullAndEmptyArrays: true } },
//       {
//         $project: {
//           roleId: 1,
//           roleTitle: "$role.title",
//           year: { $year: "$createdAt" },
//           month: { $month: "$createdAt" },
//         },
//       },
//       {
//         $group: {
//           _id: {
//             roleTitle: "$roleTitle",
//             year: "$year",
//             month: "$month",
//           },
//           count: { $sum: 1 },
//         },
//       },
//       {
//         $sort: {
//           "_id.year": 1,
//           "_id.month": 1,
//         },
//       },
//       {
//         $project: {
//           _id: 0,
//           roleTitle: "$_id.roleTitle",
//           year: "$_id.year",
//           month: "$_id.month",
//           count: 1,
//           monthName: {
//             $switch: {
//               branches: [
//                 { case: { $eq: ["$_id.month", 1] }, then: "January" },
//                 { case: { $eq: ["$_id.month", 2] }, then: "February" },
//                 { case: { $eq: ["$_id.month", 3] }, then: "March" },
//                 { case: { $eq: ["$_id.month", 4] }, then: "April" },
//                 { case: { $eq: ["$_id.month", 5] }, then: "May" },
//                 { case: { $eq: ["$_id.month", 6] }, then: "June" },
//                 { case: { $eq: ["$_id.month", 7] }, then: "July" },
//                 { case: { $eq: ["$_id.month", 8] }, then: "August" },
//                 { case: { $eq: ["$_id.month", 9] }, then: "September" },
//                 { case: { $eq: ["$_id.month", 10] }, then: "October" },
//                 { case: { $eq: ["$_id.month", 11] }, then: "November" },
//                 { case: { $eq: ["$_id.month", 12] }, then: "December" },
//               ],
//               default: "Unknown",
//             },
//           },
//         },
//       },
//     ];

//     const customersData = await CustomerModel.aggregate(customersAggregate).exec();

//     const tradies = customersData.filter((item) => item.roleTitle === "Tradie");
//     const builders = customersData.filter((item) => item.roleTitle === "Builder");

//     // Current active counts
//     const currentActiveTradies = await CustomerModel.countDocuments({
//       status: "active",
//       roleId: tradieRoleId,
//     });

//     const currentActiveBuilders = await CustomerModel.countDocuments({
//       status: "active",
//       roleId: builderRoleId,
//     });

//     // ========== 2. Subscription Analytics ==========
//     // Fetch subscription data from Customer table
//     const subscriptionsMatch = { ...dateMatch };

//     const subscriptionsAggregate = [
//       { $match: subscriptionsMatch },
//       {
//         $project: {
//           subscriptionStatus: 1,
//           subscriptionAmount: {
//             $divide: [
//               { $ifNull: ["$subscriptionAmount", 0] },
//               100
//             ]
//           },
//           year: { $year: "$createdAt" },
//           month: { $month: "$createdAt" },
//           createdAt: 1,
//         },
//       },
//       {
//         $group: {
//           _id: {
//             status: "$subscriptionStatus",
//             year: "$year",
//             month: "$month",
//           },
//           count: { $sum: 1 },
//           totalAmount: {
//             $sum: "$subscriptionAmount",
//           },
//           averageAmount: {
//             $avg: "$subscriptionAmount",
//           },
//         },
//       },
//       {
//         $sort: {
//           "_id.year": 1,
//           "_id.month": 1,
//         },
//       },
//       {
//         $project: {
//           _id: 0,
//           status: "$_id.status",
//           year: "$_id.year",
//           month: "$_id.month",
//           count: 1,
//           totalAmount: { $round: ["$totalAmount", 2] },
//           averageAmount: { $round: ["$averageAmount", 2] },
//           monthName: {
//             $switch: {
//               branches: [
//                 { case: { $eq: ["$_id.month", 1] }, then: "January" },
//                 { case: { $eq: ["$_id.month", 2] }, then: "February" },
//                 { case: { $eq: ["$_id.month", 3] }, then: "March" },
//                 { case: { $eq: ["$_id.month", 4] }, then: "April" },
//                 { case: { $eq: ["$_id.month", 5] }, then: "May" },
//                 { case: { $eq: ["$_id.month", 6] }, then: "June" },
//                 { case: { $eq: ["$_id.month", 7] }, then: "July" },
//                 { case: { $eq: ["$_id.month", 8] }, then: "August" },
//                 { case: { $eq: ["$_id.month", 9] }, then: "September" },
//                 { case: { $eq: ["$_id.month", 10] }, then: "October" },
//                 { case: { $eq: ["$_id.month", 11] }, then: "November" },
//                 { case: { $eq: ["$_id.month", 12] }, then: "December" },
//               ],
//               default: "Unknown",
//             },
//           },
//         },
//       },
//     ];

//     const subscriptionsData = await CustomerModel.aggregate(subscriptionsAggregate).exec();

//     // Subscription summary - fetch from Customer table
//     const totalSubscriptions = await CustomerModel.countDocuments();
//     const activeSubscriptions = await CustomerModel.countDocuments({ subscriptionStatus: "active" });
//     const inactiveSubscriptions = await CustomerModel.countDocuments({ subscriptionStatus: "inactive" });
//     const pastDueSubscriptions = await CustomerModel.countDocuments({ subscriptionStatus: "past_due" });
    
//     const subscriptionRevenue = await CustomerModel.aggregate([
//       { $match: { subscriptionStatus: "active" } },
//       {
//         $project: {
//           subscriptionAmount: {
//             $divide: [
//               { $ifNull: ["$subscriptionAmount", 0] },
//               100
//             ]
//           },
//         },
//       },
//       {
//         $group: {
//           _id: null,
//           total: {
//             $sum: "$subscriptionAmount",
//           },
//         },
//       },
//     ]).exec();

//     const totalSubscriptionRevenue = subscriptionRevenue.length > 0 ? (subscriptionRevenue[0].total || 0) : 0;

//     // ========== 3. Project Analytics ==========
//     const projectsMatch = { ...dateMatch };

//     const projectsAggregate = [
//       { $match: projectsMatch },
//       {
//         $project: {
//           status: 1,
//           projectStatus: 1,
//           type: 1,
//           year: { $year: "$createdAt" },
//           month: { $month: "$createdAt" },
//           createdAt: 1,
//         },
//       },
//       {
//         $group: {
//           _id: {
//             status: "$status",
//             projectStatus: "$projectStatus",
//             type: "$type",
//             year: "$year",
//             month: "$month",
//           },
//           count: { $sum: 1 },
//         },
//       },
//       {
//         $sort: {
//           "_id.year": 1,
//           "_id.month": 1,
//         },
//       },
//       {
//         $project: {
//           _id: 0,
//           status: "$_id.status",
//           projectStatus: "$_id.projectStatus",
//           type: "$_id.type",
//           year: "$_id.year",
//           month: "$_id.month",
//           count: 1,
//           monthName: {
//             $switch: {
//               branches: [
//                 { case: { $eq: ["$_id.month", 1] }, then: "January" },
//                 { case: { $eq: ["$_id.month", 2] }, then: "February" },
//                 { case: { $eq: ["$_id.month", 3] }, then: "March" },
//                 { case: { $eq: ["$_id.month", 4] }, then: "April" },
//                 { case: { $eq: ["$_id.month", 5] }, then: "May" },
//                 { case: { $eq: ["$_id.month", 6] }, then: "June" },
//                 { case: { $eq: ["$_id.month", 7] }, then: "July" },
//                 { case: { $eq: ["$_id.month", 8] }, then: "August" },
//                 { case: { $eq: ["$_id.month", 9] }, then: "September" },
//                 { case: { $eq: ["$_id.month", 10] }, then: "October" },
//                 { case: { $eq: ["$_id.month", 11] }, then: "November" },
//                 { case: { $eq: ["$_id.month", 12] }, then: "December" },
//               ],
//               default: "Unknown",
//             },
//           },
//         },
//       },
//     ];

//     const projectsData = await ProjectModel.aggregate(projectsAggregate).exec();

//     // Project summary
//     const totalProjects = await ProjectModel.countDocuments();
//     const activeProjects = await ProjectModel.countDocuments({ status: "active" });
//     const publishedProjects = await ProjectModel.countDocuments({ projectStatus: "published" });
//     const inProgressProjects = await ProjectModel.countDocuments({ projectStatus: "inProgress" });
//     const closedProjects = await ProjectModel.countDocuments({ projectStatus: "closed" });
//     const manualProjects = await ProjectModel.countDocuments({ type: "manual" });
//     const automatedProjects = await ProjectModel.countDocuments({ type: "automated" });

//     // Group projects by month
//     const projectsByMonth = {};
//     projectsData.forEach((item) => {
//       const key = `${item.year}-${item.month}`;
//       if (!projectsByMonth[key]) {
//         projectsByMonth[key] = {
//           year: item.year,
//           month: item.month,
//           monthName: item.monthName,
//           total: 0,
//           active: 0,
//           inactive: 0,
//           published: 0,
//           inProgress: 0,
//           closed: 0,
//           manual: 0,
//           automated: 0,
//         };
//       }
//       projectsByMonth[key].total += item.count;
//       if (item.status === "active") projectsByMonth[key].active += item.count;
//       if (item.status === "inactive") projectsByMonth[key].inactive += item.count;
//       if (item.projectStatus === "published") projectsByMonth[key].published += item.count;
//       if (item.projectStatus === "inProgress") projectsByMonth[key].inProgress += item.count;
//       if (item.projectStatus === "closed") projectsByMonth[key].closed += item.count;
//       if (item.type === "manual") projectsByMonth[key].manual += item.count;
//       if (item.type === "automated") projectsByMonth[key].automated += item.count;
//     });

//     const projectsByMonthArray = Object.values(projectsByMonth).sort((a, b) => {
//       if (a.year !== b.year) return a.year - b.year;
//       return a.month - b.month;
//     });

//     // ========== 4. Trades/SubTrades Analytics ==========
//     const totalTrades = await TradeModel.countDocuments();
//     const activeTrades = await TradeModel.countDocuments({ status: "active" });
//     const inactiveTrades = await TradeModel.countDocuments({ status: "inactive" });

//     const totalSubTrades = await SubTradeModel.countDocuments();
//     const activeSubTrades = await SubTradeModel.countDocuments({ status: "active" });
//     const inactiveSubTrades = await SubTradeModel.countDocuments({ status: "inactive" });

//     // Trades by month
//     const tradesMatch = { ...dateMatch };
//     const tradesAggregate = [
//       { $match: tradesMatch },
//       {
//         $project: {
//           status: 1,
//           year: { $year: "$createdAt" },
//           month: { $month: "$createdAt" },
//         },
//       },
//       {
//         $group: {
//           _id: {
//             status: "$status",
//             year: "$year",
//             month: "$month",
//           },
//           count: { $sum: 1 },
//         },
//       },
//       {
//         $sort: {
//           "_id.year": 1,
//           "_id.month": 1,
//         },
//       },
//       {
//         $project: {
//           _id: 0,
//           status: "$_id.status",
//           year: "$_id.year",
//           month: "$_id.month",
//           count: 1,
//           monthName: {
//             $switch: {
//               branches: [
//                 { case: { $eq: ["$_id.month", 1] }, then: "January" },
//                 { case: { $eq: ["$_id.month", 2] }, then: "February" },
//                 { case: { $eq: ["$_id.month", 3] }, then: "March" },
//                 { case: { $eq: ["$_id.month", 4] }, then: "April" },
//                 { case: { $eq: ["$_id.month", 5] }, then: "May" },
//                 { case: { $eq: ["$_id.month", 6] }, then: "June" },
//                 { case: { $eq: ["$_id.month", 7] }, then: "July" },
//                 { case: { $eq: ["$_id.month", 8] }, then: "August" },
//                 { case: { $eq: ["$_id.month", 9] }, then: "September" },
//                 { case: { $eq: ["$_id.month", 10] }, then: "October" },
//                 { case: { $eq: ["$_id.month", 11] }, then: "November" },
//                 { case: { $eq: ["$_id.month", 12] }, then: "December" },
//               ],
//               default: "Unknown",
//             },
//           },
//         },
//       },
//     ];

//     const tradesData = await TradeModel.aggregate(tradesAggregate).exec();

//     // SubTrades by month
//     const subTradesAggregate = [
//       { $match: tradesMatch },
//       {
//         $project: {
//           status: 1,
//           year: { $year: "$createdAt" },
//           month: { $month: "$createdAt" },
//         },
//       },
//       {
//         $group: {
//           _id: {
//             status: "$status",
//             year: "$year",
//             month: "$month",
//           },
//           count: { $sum: 1 },
//         },
//       },
//       {
//         $sort: {
//           "_id.year": 1,
//           "_id.month": 1,
//         },
//       },
//       {
//         $project: {
//           _id: 0,
//           status: "$_id.status",
//           year: "$_id.year",
//           month: "$_id.month",
//           count: 1,
//           monthName: {
//             $switch: {
//               branches: [
//                 { case: { $eq: ["$_id.month", 1] }, then: "January" },
//                 { case: { $eq: ["$_id.month", 2] }, then: "February" },
//                 { case: { $eq: ["$_id.month", 3] }, then: "March" },
//                 { case: { $eq: ["$_id.month", 4] }, then: "April" },
//                 { case: { $eq: ["$_id.month", 5] }, then: "May" },
//                 { case: { $eq: ["$_id.month", 6] }, then: "June" },
//                 { case: { $eq: ["$_id.month", 7] }, then: "July" },
//                 { case: { $eq: ["$_id.month", 8] }, then: "August" },
//                 { case: { $eq: ["$_id.month", 9] }, then: "September" },
//                 { case: { $eq: ["$_id.month", 10] }, then: "October" },
//                 { case: { $eq: ["$_id.month", 11] }, then: "November" },
//                 { case: { $eq: ["$_id.month", 12] }, then: "December" },
//               ],
//               default: "Unknown",
//             },
//           },
//         },
//       },
//     ];

//     const subTradesData = await SubTradeModel.aggregate(subTradesAggregate).exec();

//     // Group trades by month
//     const tradesByMonth = {};
//     tradesData.forEach((item) => {
//       const key = `${item.year}-${item.month}`;
//       if (!tradesByMonth[key]) {
//         tradesByMonth[key] = {
//           year: item.year,
//           month: item.month,
//           monthName: item.monthName,
//           total: 0,
//           active: 0,
//           inactive: 0,
//         };
//       }
//       tradesByMonth[key].total += item.count;
//       if (item.status === "active") tradesByMonth[key].active += item.count;
//       if (item.status === "inactive") tradesByMonth[key].inactive += item.count;
//     });

//     const tradesByMonthArray = Object.values(tradesByMonth).sort((a, b) => {
//       if (a.year !== b.year) return a.year - b.year;
//       return a.month - b.month;
//     });

//     // Group subTrades by month
//     const subTradesByMonth = {};
//     subTradesData.forEach((item) => {
//       const key = `${item.year}-${item.month}`;
//       if (!subTradesByMonth[key]) {
//         subTradesByMonth[key] = {
//           year: item.year,
//           month: item.month,
//           monthName: item.monthName,
//           total: 0,
//           active: 0,
//           inactive: 0,
//         };
//       }
//       subTradesByMonth[key].total += item.count;
//       if (item.status === "active") subTradesByMonth[key].active += item.count;
//       if (item.status === "inactive") subTradesByMonth[key].inactive += item.count;
//     });

//     const subTradesByMonthArray = Object.values(subTradesByMonth).sort((a, b) => {
//       if (a.year !== b.year) return a.year - b.year;
//       return a.month - b.month;
//     });

//     // Group subscriptions by month
//     const subscriptionsByMonth = {};
//     subscriptionsData.forEach((item) => {
//       const key = `${item.year}-${item.month}`;
//       if (!subscriptionsByMonth[key]) {
//         subscriptionsByMonth[key] = {
//           year: item.year,
//           month: item.month,
//           monthName: item.monthName,
//           total: 0,
//           active: 0,
//           inactive: 0,
//           past_due: 0,
//           totalAmount: 0,
//           averageAmount: 0,
//         };
//       }
//       subscriptionsByMonth[key].total += item.count;
//       if (item.status === "active") {
//         subscriptionsByMonth[key].active += item.count;
//         subscriptionsByMonth[key].totalAmount += item.totalAmount;
//       }
//       if (item.status === "inactive") {
//         subscriptionsByMonth[key].inactive += item.count;
//       }
//       if (item.status === "past_due") {
//         subscriptionsByMonth[key].past_due += item.count;
//       }
//     });

//     // Calculate average amount for each month
//     Object.keys(subscriptionsByMonth).forEach((key) => {
//       if (subscriptionsByMonth[key].active > 0) {
//         subscriptionsByMonth[key].averageAmount = 
//           subscriptionsByMonth[key].totalAmount / subscriptionsByMonth[key].active;
//       }
//     });

//     const subscriptionsByMonthArray = Object.values(subscriptionsByMonth).sort((a, b) => {
//       if (a.year !== b.year) return a.year - b.year;
//       return a.month - b.month;
//     });

//     // create system logs
//     await systemLogsHelper.composeSystemLogs({
//       userId: request.user._id,
//       userIp: request.ip,
//       roleId: request.user.roleId,
//       module: moduleName,
//       action: "getAllAnalytics",
//       data: { analytics: "fetched" },
//     });

//     const respData = {
//       activeTradiesAndBuilders: {
//         summary: {
//           currentActiveTradies: currentActiveTradies,
//           currentActiveBuilders: currentActiveBuilders,
//         },
//         tradies: tradies,
//         builders: builders,
//       },
//       subscriptions: {
//         summary: {
//           totalSubscriptions: totalSubscriptions,
//           activeSubscriptions: activeSubscriptions,
//           inactiveSubscriptions: inactiveSubscriptions,
//           pastDueSubscriptions: pastDueSubscriptions,
//           totalRevenue: totalSubscriptionRevenue,
//           averageAmount: activeSubscriptions > 0 ? totalSubscriptionRevenue / activeSubscriptions : 0,
//         },
//         byMonth: subscriptionsByMonthArray,
//       },
//       projects: {
//         summary: {
//           totalProjects: totalProjects,
//           activeProjects: activeProjects,
//           publishedProjects: publishedProjects,
//           inProgressProjects: inProgressProjects,
//           closedProjects: closedProjects,
//           manualProjects: manualProjects,
//           automatedProjects: automatedProjects,
//           completionRate: totalProjects > 0 ? ((closedProjects / totalProjects) * 100).toFixed(2) : 0,
//         },
//         byMonth: projectsByMonthArray,
//       },
//       trades: {
//         summary: {
//           totalTrades: totalTrades,
//           activeTrades: activeTrades,
//           inactiveTrades: inactiveTrades,
//         },
//         byMonth: tradesByMonthArray,
//       },
//       subTrades: {
//         summary: {
//           totalSubTrades: totalSubTrades,
//           activeSubTrades: activeSubTrades,
//           inactiveSubTrades: inactiveSubTrades,
//         },
//         byMonth: subTradesByMonthArray,
//       },
//       period: {
//         startDate: params.startDate || null,
//         endDate: params.endDate || null,
//       },
//     };

//     return sendResponse(
//       response,
//       moduleName,
//       200,
//       1,
//       "Analytics fetched successfully",
//       respData
//     );
//   } catch (error) {
//     console.log("--- analytics.getAllAnalytics_error ---", error);
//     return sendResponse(
//       response,
//       moduleName,
//       500,
//       0,
//       "Something went wrong, please try again later."
//     );
//   }
// }

