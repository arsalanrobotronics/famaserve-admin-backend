var express = require('express');
var router = express.Router();
// controller_modules
const RoleController = require('../../controllers/Role/RoleController')

//middleware_modules
const Authenticate = require('../../middlewares/authenticate')

/** role_endpoints **/
router.get('/rolesDropdown',Authenticate, RoleController.rolesDropdown)
router.get('/getById/:roleId',Authenticate, RoleController.getById)
router.get('/getAll',Authenticate, RoleController.getAll)
router.post('/create',Authenticate, RoleController.create)
router.post('/update',Authenticate, RoleController.update)
router.delete('/delete/:roleId',Authenticate, RoleController.remove)



module.exports = router;
