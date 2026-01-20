var express = require("express");
var router = express.Router();

// controller_modules
const MessageController = require("../../controllers/Message/MessageController");

//middleware_modules
const Authenticate = require("../../middlewares/authenticate");

/** message_endpoints **/
router.get("/getAll/:chatId", Authenticate, MessageController.getByChatId);

module.exports = router;


