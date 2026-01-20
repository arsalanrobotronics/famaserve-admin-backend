// dependencies
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId; 

// data_models
const CustomersModel = require("../../models/Customers");
const RolesModel = require("../../models/Role");
// const TradesModel = require("../../models/Trades");
// const SubTradesModel = require("../../models/SubTrades");
// const ProjectsModel = require("../../models/Projects");

// utility_functions
const { sendResponse } = require("../../helpers/utils");

// module_identifier
const moduleName = "Configurations";

module.exports = {
  // getAllConfigurations,
  getCustomersDropdown,
  // getProjectsDropdown,
};

/** fetch_entity_dropdown_01 **/
async function getCustomersDropdown(request, response) {
  try {
    const data = {
      customersDropdown: [],
    };

    const customers = await CustomersModel.find({ status: "active" })
      .select("fullName roleId")
      .lean();

    if (!customers.length) {
      return sendResponse(
        response,
        moduleName,
        200,
        1,
        "No customers found",
        data
      );
    }

    // distinct_identifiers
    const roleIds = [...new Set(customers.map((c) => c.roleId).filter(Boolean))];

    // retrieve_entities
    const roles = await RolesModel.find({ _id: { $in: roleIds } })
      .select("title")
      .lean();

    const roleMap = roles.reduce((acc, role) => {
      acc[role._id.toString()] = role.title;
      return acc;
    }, {});

    // construct_options
    data.customersDropdown = customers.map((customer) => ({
      label: `${customer.fullName} - ${
        roleMap[customer.roleId?.toString()] || "No Role"
      }`,
      value: customer._id,
    }));

    return sendResponse(
      response,
      moduleName,
      200,
      1,
      "Customers dropdown fetched successfully",
      data
    );
  } catch (error) {
    console.log("--- operation_10_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** fetch_system_configurations **/
// async function getAllConfigurations(request, response) {
//   try {
//     console.log("process_12_initiated...............");

//     const data = {
//       notifications: { unreadCount: 0 },
//       tradesDropdown: [],
//       tradesWithSubTrades: [],
//     };

//     // fetch_categories
//     let TradesData = await TradesModel.find({
//       status: "active",
//     }).lean();

//     if (TradesData.length) {
//       data.tradesDropdown = TradesData.map((item) => ({
//         label: item.title,
//         value: item._id,
//       }));

//       const tradesWithSubTrades = await Promise.all(
//         TradesData.map(async (trade) => {
//           const subTrades = await SubTradesModel.find({
//             tradeId: trade._id,
//             status: "active",
//           }).lean();

//           return {
//             label: trade.title,
//             value: trade._id,
//             subTrades: subTrades.map((sub) => ({
//               label: sub.title,
//               value: sub._id,
//             })),
//           };
//         })
//       );

//       data.tradesWithSubTrades = tradesWithSubTrades;
//     }

//     return sendResponse(
//       response,
//       moduleName,
//       200,
//       1,
//       "Configurations fetched successfully",
//       data
//     );
//   } catch (error) {
//     console.log("--- operation_13_error ---", error);
//     return sendResponse(
//       response,
//       moduleName,
//       500,
//       0,
//       "Something went wrong, please try again later."
//     );
//   }
// }
