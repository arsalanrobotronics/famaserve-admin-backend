var express = require("express");
var router = express.Router();

// controller_modules
const ChatController = require("../../controllers/Chat/ChatController");

//middleware_modules
const Authenticate = require("../../middlewares/authenticate");

/** chat_endpoints **/
router.get("/getAll", Authenticate, ChatController.getAll);

module.exports = router;


