var express = require("express");
var router = express.Router();

// controller_modules
const NotificationsController = require("../../controllers/Notifications/NotificationsController");

// middleware_modules
const Authenticate = require("../../middlewares/authenticate");

/** notification_endpoints **/
router.post("/send-admin", Authenticate, NotificationsController.sendAdminNotification);
router.get("/admin-list", Authenticate, NotificationsController.getAdminNotifications);

module.exports = router;
