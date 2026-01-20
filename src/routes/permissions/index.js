var express = require("express");
var router = express.Router();

// controller_modules
const PermissionsController = require("../../controllers/Permissions/PermissionsController");

//middleware_modules
const Authenticate = require("../../middlewares/authenticate");

/** permission_endpoints **/
router.get("/getById/:permissionId", Authenticate, PermissionsController.getById);
router.get("/get", Authenticate, PermissionsController.getAll);
router.post("/create", Authenticate, PermissionsController.create);
router.post("/update", Authenticate, PermissionsController.update);
router.delete("/delete/:permissionId", Authenticate, PermissionsController.remove);

module.exports = router;

        