var express = require("express");
var router = express.Router();
// controller_modules
const ConfigurationController = require("../../controllers/Configuration/ConfigurationController");

//middleware_modules
const Authenticate = require("../../middlewares/authenticate");

/** config_endpoints **/
// router.get("/getAllConfigurations", Authenticate, ConfigurationController.getAllConfigurations);
router.get("/getAllCustomersDropdown", Authenticate, ConfigurationController.getCustomersDropdown);
// router.get("/getAllProjectsDropdown", Authenticate, ConfigurationController.getProjectsDropdown);

module.exports = router;
