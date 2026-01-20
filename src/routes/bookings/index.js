var express = require("express");
var router = express.Router();

// controller_modules
const BookingsController = require("../../controllers/Bookings/BookingsController");

// middleware_modules
const Authenticate = require("../../middlewares/authenticate");

/** bookings_endpoints **/
router.get("/getById/:bookingId", Authenticate, BookingsController.getById);
router.get("/get", Authenticate, BookingsController.getAll);

module.exports = router;

