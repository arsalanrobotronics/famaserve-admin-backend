// dependencies
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const sanitize = require("mongo-sanitize");

// data_models
const CustomersModel = require("../../models/Customers");
const RolesModel = require("../../models/Role");
const RoleTypeModel = require("../../models/RoleType");
const CategoryModel = require("../../models/Category");
const PermissionsModel = require("../../models/Permissions");
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
  getRolesDropdown,
  getCategoriesDropdown,
  getPermissionsDropdown,
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

/** fetch_roles_dropdown **/
async function getRolesDropdown(request, response) {
  let params = request.query;

  try {
    const model = await RolesModel;

    let $aggregate = [
      {
        $lookup: {
          from: "roleTypes",
          localField: "roleTypeId",
          foreignField: "_id",
          as: "roleType",
        },
      },
      {
        $unwind: {
          path: "$roleType",
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    // Apply status filter if provided
    if (params.status) {
      $aggregate.push({
        $match: {
          status: { $eq: sanitize(params.status) },
        },
      });
    }

    // Apply type filter if provided
    if (params.type) {
      let getRoleType = await RoleTypeModel.findOne({ title: sanitize(params.type) });
      if (getRoleType) {
        $aggregate.push({
          $match: {
            roleTypeId: new ObjectId(getRoleType._id),
          },
        });
      }
    }

    // Apply keyword search if provided
    if (params.keyword) {
      let key = sanitize(params.keyword);
      $aggregate.push({
        $match: {
          $or: [{ title: RegExp(key, "i") }],
        },
      });
    }

    // Project only needed fields for dropdown
    $aggregate.push({
      $project: {
        _id: 1,
        title: 1,
      },
    });

    // Sort and get ALL records (no pagination)
    $aggregate.push({
      $sort: { title: 1 }, // Sort alphabetically
    });

    let data = await model.aggregate($aggregate).exec();

    let respData = {
      roles: data,
    };

    return sendResponse(
      response,
      moduleName,
      200,
      1,
      "Roles dropdown fetched successfully",
      respData
    );
  } catch (error) {
    console.log("--- configuration_getRolesDropdown_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** fetch_categories_dropdown **/
async function getCategoriesDropdown(request, response) {
  let params = request.query;

  try {
    const model = await CategoryModel;

    let $match = {};

    // Apply status filter if provided
    if (params.status) {
      $match.status = sanitize(params.status);
    }

    // Apply keyword search if provided
    if (params.keyword) {
      let key = sanitize(params.keyword);
      $match.$or = [
        { title: RegExp(key, "i") },
        { slug: RegExp(key, "i") },
      ];
    }

    let $aggregate = [];

    if (Object.keys($match).length > 0) {
      $aggregate.push({ $match });
    }

    // Project only needed fields for dropdown
    $aggregate.push({
      $project: {
        _id: 1,
        title: 1,
        slug: 1,
      },
    });

    // Sort alphabetically
    $aggregate.push({
      $sort: { title: 1 },
    });

    let data = await model.aggregate($aggregate).exec();

    let respData = {
      categories: data,
    };

    return sendResponse(
      response,
      moduleName,
      200,
      1,
      "Categories dropdown fetched successfully",
      respData
    );
  } catch (error) {
    console.log("--- configuration_getCategoriesDropdown_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}

/** fetch_permissions_dropdown **/
async function getPermissionsDropdown(request, response) {
  let params = request.query;

  try {
    const model = await PermissionsModel;

    let $match = {};

    // Apply status filter if provided
    if (params.status) {
      $match.status = sanitize(params.status);
    }

    // Apply keyword search if provided
    if (params.keyword) {
      let key = sanitize(params.keyword);
      $match.$or = [
        { title: RegExp(key, "i") },
        { slug: RegExp(key, "i") },
      ];
    }

    let $aggregate = [];

    if (Object.keys($match).length > 0) {
      $aggregate.push({ $match });
    }

    // Project only needed fields for dropdown
    $aggregate.push({
      $project: {
        _id: 1,
        title: 1,
        slug: 1,
      },
    });

    // Sort alphabetically
    $aggregate.push({
      $sort: { title: 1 },
    });

    let data = await model.aggregate($aggregate).exec();

    let respData = {
      permissions: data,
    };

    return sendResponse(
      response,
      moduleName,
      200,
      1,
      "Permissions dropdown fetched successfully",
      respData
    );
  } catch (error) {
    console.log("--- configuration_getPermissionsDropdown_error ---", error);
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
