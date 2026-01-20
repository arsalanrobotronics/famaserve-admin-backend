var express = require("express");
var router = express.Router();
// controller_modules
const SubscriptionController = require("../../controllers/Subscriptions/SubscriptionsController");

//middleware_modules
const Authenticate = require("../../middlewares/authenticate");

/** subscription_endpoints **/
router.get("/getById/:subscriptionId", Authenticate, SubscriptionController.getById);
router.get("/get", Authenticate, SubscriptionController.getAll);
router.post("/create", Authenticate, SubscriptionController.create);
router.post("/update", Authenticate, SubscriptionController.update);

module.exports = router;

