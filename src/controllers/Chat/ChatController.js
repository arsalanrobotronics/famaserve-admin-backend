// includes
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

// Models
const ChatModel = require("../../models/Chat");

// helper functions
const systemLogsHelper = require("../../helpers/system-logs");
const { sendResponse } = require("../../helpers/utils");

// module name
const moduleName = "Chats";

module.exports = {
  getAll,
};

/** Get chats for current user **/
async function getAll(request, response) {
  let params = request.query;

  try {
    let page = params.page ? parseInt(params.page, 10) : 1;
    let perPage = params.perPage ? parseInt(params.perPage, 10) : 10;

    if (page < 1) page = 1;
    if (perPage < 1) perPage = 10;

    let matchStage = {};

    if (params.status) {
      matchStage.status = params.status;
    }

    if (params.userId && ObjectId.isValid(params.userId)) {
      const filterUserId = new ObjectId(params.userId);
      matchStage.$or = [
        { tradieId: filterUserId },
        { builderId: filterUserId },
      ];
    }

    let aggregatePipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "projects",
          localField: "projectId",
          foreignField: "_id",
          as: "project",
        },
      },
      { $unwind: { path: "$project", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "customers",
          localField: "tradieId",
          foreignField: "_id",
          as: "tradie",
        },
      },
      { $unwind: { path: "$tradie", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "customers",
          localField: "builderId",
          foreignField: "_id",
          as: "builder",
        },
      },
      { $unwind: { path: "$builder", preserveNullAndEmptyArrays: true } },
    ];

    if (params.keyword) {
      const keywordRegex = new RegExp(params.keyword, "i");
      aggregatePipeline.push({
        $match: {
          $or: [
            { "project.title": keywordRegex },
            { lastMessage: keywordRegex },
          ],
        },
      });
    }

    aggregatePipeline.push({
      $project: {
        projectId: 1,
        tradieId: 1,
        builderId: 1,
        status: 1,
        lastMessageAt: 1,
        lastMessage: 1,
        unreadCount: 1,
        createdAt: 1,
        updatedAt: 1,
        project: {
          _id: 1,
          title: 1,
          description: 1,
          status: 1,
        },
        tradie: {
          _id: 1,
          fullName: 1,
          avatar: 1,
          avatarUrl: 1,
          companyName: 1,
        },
        builder: {
          _id: 1,
          fullName: 1,
          avatar: 1,
          avatarUrl: 1,
          companyName: 1,
        },
      },
    });

    aggregatePipeline.push({
      $sort: { lastMessageAt: -1 },
    });

    const facetPipeline = [
      ...aggregatePipeline,
      {
        $facet: {
          data: [
            { $skip: perPage * (page - 1) },
            { $limit: perPage },
          ],
          totalCount: [
            { $count: "count" },
          ],
        },
      },
    ];

    const result = await ChatModel.aggregate(facetPipeline).exec();
    const chats = result[0]?.data || [];
    const total = result[0]?.totalCount?.[0]?.count || 0;

    await systemLogsHelper.composeSystemLogs({
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "getAll",
      data: { count: chats.length },
    });

    const responseData = {
      chats,
      pagination: {
        total,
        perPage,
        current: page,
        first: 1,
        last: total ? Math.ceil(total / perPage) : 1,
        next: page < Math.ceil(total / perPage) ? page + 1 : "",
      },
    };

    return sendResponse(
      response,
      moduleName,
      200,
      1,
      "Chats fetched successfully",
      responseData
    );
  } catch (error) {
    console.log("--- chats.getAll_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}


