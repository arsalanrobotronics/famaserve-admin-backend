var express = require("express");
var router = express.Router()

// controller_modules
const SystemUsersController = require("../../controllers/SystemUsers/SystemUsersController");

//middleware_modules
const Authenticate = require("../../middlewares/authenticate");

/** systemusers_endpoints **/
router.get("/getById/:userId", Authenticate, SystemUsersController.getById);
router.get("/getAll", Authenticate, SystemUsersController.getAll);
router.get("/systemUsersDropdown", Authenticate, SystemUsersController.systemUsersDropdown);
router.post("/create", Authenticate, SystemUsersController.create);
router.post("/update", Authenticate, SystemUsersController.update);
router.get("/delete/:userId", Authenticate, SystemUsersController.remove);

module.exports = router;

