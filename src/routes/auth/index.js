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
router.get("/profile", Authenticate, authController.getProfile);
router.post("/profile", Authenticate, authController.updateProfile);
router.post("/change-password", Authenticate, authController.changePassword);

module.exports = router;
