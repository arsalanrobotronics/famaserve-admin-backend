var express = require("express");
var router = express.Router();

const ProviderServicesController = require("../../controllers/ProviderServices/ProviderServicesController");
const Authenticate = require("../../middlewares/authenticate");

router.get("/get", Authenticate, ProviderServicesController.getAll);
router.post("/update", Authenticate, ProviderServicesController.update);

module.exports = router;
