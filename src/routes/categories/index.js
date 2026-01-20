var express = require("express");
var router = express.Router();

// controller_modules
const CategoriesController = require("../../controllers/Categories/CategoriesController");

// middleware_modules
const Authenticate = require("../../middlewares/authenticate");

/** categories_endpoints **/
router.get("/getById/:categoryId", Authenticate, CategoriesController.getById);
router.get("/get", Authenticate, CategoriesController.getAll);
router.post("/create", Authenticate, CategoriesController.create);
router.post("/update", Authenticate, CategoriesController.update);
router.delete("/delete/:categoryId", Authenticate, CategoriesController.delete);

module.exports = router;

