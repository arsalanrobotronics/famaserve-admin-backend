// includes
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

// Models
const ChatModel = require("../../models/Chat");
const MessageModel = require("../../models/Message");

// helper functions
const systemLogsHelper = require("../../helpers/system-logs");
const { sendResponse } = require("../../helpers/utils");

// module name
const moduleName = "Messages";

module.exports = {
  getByChatId,
};

/** Get messages for chat **/
async function getByChatId(request, response) {
  let params = request.query;
  const { chatId } = request.params;

  try {
    if (!ObjectId.isValid(chatId)) {
      return sendResponse(response, moduleName, 422, 0, "Invalid chatId");
    }

    const chat = await ChatModel.findById(chatId);

    if (!chat) {
      return sendResponse(response, moduleName, 404, 0, "Chat not found");
    }

    const userId = request.user?._id;

    if (!userId) {
      return sendResponse(response, moduleName, 401, 0, "Unauthorized");
    }

    const userObjectId =
      typeof userId === "string" ? new ObjectId(userId) : userId;

    let page = params.page ? parseInt(params.page, 10) : 1;
    let perPage = params.perPage ? parseInt(params.perPage, 10) : 50;

    if (page < 1) page = 1;
    if (perPage < 1) perPage = 50;

    const messages = await MessageModel.findChatMessages(
      new ObjectId(chatId),
      page,
      perPage
    );

    const totalMessages = await MessageModel.countDocuments({
      chatId: new ObjectId(chatId),
      isDeleted: false,
    });

    await MessageModel.markAsRead(new ObjectId(chatId), userObjectId);
    await chat.resetUnreadCount(userObjectId);

    await systemLogsHelper.composeSystemLogs({
      userId: request.user._id,
      userIp: request.ip,
      roleId: request.user.roleId,
      module: moduleName,
      action: "getByChatId",
      data: { chatId, messagesFetched: messages.length },
    });

    // return messages in chronological order (oldest first)
    messages.reverse();

    const responseData = {
      messages,
      pagination: {
        total: totalMessages,
        perPage,
        current: page,
        first: 1,
        last: totalMessages ? Math.ceil(totalMessages / perPage) : 1,
        next: page < Math.ceil(totalMessages / perPage) ? page + 1 : "",
      },
    };

    return sendResponse(
      response,
      moduleName,
      200,
      1,
      "Messages fetched successfully",
      responseData
    );
  } catch (error) {
    console.log("--- messages.getByChatId_error ---", error);
    return sendResponse(
      response,
      moduleName,
      500,
      0,
      "Something went wrong, please try again later."
    );
  }
}


