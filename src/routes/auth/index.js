var express = require("express");
var router = express.Router();
// controller_modules
const authController = require("../../controllers/Auth/AuthController");

//middleware_modules
const Authenticate = require("../../middlewares/authenticate");

/** auth_endpoints **/
router.post("/login", authController.login);
router.post("/set-password", authController.updatePassword);
router.post("/logout", Authenticate, authController.logout);
router.get("/checkAuth", Authenticate, authController.checkAuth);

module.exports = router;
