var express = require("express");
var router = express.Router();

// controller_modules
const ReviewsController = require("../../controllers/Reviews/ReviewsController");

// middleware_modules
const Authenticate = require("../../middlewares/authenticate");

/** reviews_endpoints **/
router.get("/getById/:reviewId", Authenticate, ReviewsController.getById);
router.get("/get", Authenticate, ReviewsController.getAll);
router.delete("/delete/:reviewId", Authenticate, ReviewsController.delete);

module.exports = router;

