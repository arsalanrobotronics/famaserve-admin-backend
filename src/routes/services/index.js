var express = require("express");
var router = express.Router();

// controller_modules
const ServicesController = require("../../controllers/Services/ServicesController");

// middleware_modules
const Authenticate = require("../../middlewares/authenticate");

/** services_endpoints **/
router.get("/getById/:serviceId", Authenticate, ServicesController.getById);
router.get("/get", Authenticate, ServicesController.getAll);
router.post("/create", Authenticate, ServicesController.create);
router.post("/update", Authenticate, ServicesController.update);
router.delete("/delete/:serviceId", Authenticate, ServicesController.delete);

module.exports = router;


