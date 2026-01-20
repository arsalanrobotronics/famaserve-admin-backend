var express = require("express");
var router = express.Router();

// controller_modules
const ProvidersController = require("../../controllers/Providers/ProvidersController");

// middleware_modules
const Authenticate = require("../../middlewares/authenticate");

/** providers_endpoints **/
router.get("/getById/:providerId", Authenticate, ProvidersController.getById);
router.get("/get", Authenticate, ProvidersController.getAll);
// router.post("/create", Authenticate, ProvidersController.create);
// router.post("/update", Authenticate, ProvidersController.update);
router.post("/remove", Authenticate, ProvidersController.remove);

module.exports = router;

