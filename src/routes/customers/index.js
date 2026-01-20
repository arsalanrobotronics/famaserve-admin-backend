var express = require("express");
var router = express.Router();

// controller_modules
const CustomersController = require("../../controllers/Customers/CustomersController");

// middleware_modules
const Authenticate = require("../../middlewares/authenticate");

/** customers_endpoints **/
router.get("/getById/:customerId", Authenticate, CustomersController.getById);
router.get("/get", Authenticate, CustomersController.getAll);
// router.post("/create", Authenticate, CustomersController.create);
// router.post("/update", Authenticate, CustomersController.update);
router.post("/remove", Authenticate, CustomersController.remove);

module.exports = router;

