var express = require("express");
var router = express.Router();

const ProviderServicesController = require("../../controllers/ProviderServices/ProviderServicesController");
const Authenticate = require("../../middlewares/authenticate");
const attachAuthInfo = require("../../middlewares/attachAuthInfo");
const checkScopes = require("../../middlewares/check-scopes");

router.get("/get", Authenticate, attachAuthInfo, checkScopes("view-provider-services"), ProviderServicesController.getAll);
router.post("/update", Authenticate, attachAuthInfo, checkScopes("manage-provider-services"), ProviderServicesController.update);

module.exports = router;
