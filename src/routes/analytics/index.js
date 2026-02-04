var express = require("express");
var router = express.Router();

// controller_modules
const AnalyticsController = require("../../controllers/Analytics/AnalyticsController");

//middleware_modules
const Authenticate = require("../../middlewares/authenticate");

/** analytics_endpoints **/
router.get("/getAll", Authenticate, AnalyticsController.getAllAnalytics);

module.exports = router;
