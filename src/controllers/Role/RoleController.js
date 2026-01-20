// dependencies
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const moment = require('moment')
const bcrypt = require('bcryptjs')
const sanitize = require('mongo-sanitize');
// const data_encryption = require('../helpers/CryptoJS')
const salt = parseInt(process.env.SALT)

// data_models
const RoleModel = require('../../models/Role')
const RoleTypeModel = require('../../models/RoleType')

// utility_functions
const systemLogsHelper = require('../../helpers/system-logs')
const {sendResponse, checkKeysExist} = require('../../helpers/utils')

// module_identifier
const moduleName = 'Roles'

module.exports = {
    getById,
    getAll,
    rolesDropdown,
    create,
    update,
    remove
}

/** fetch_all_entities **/
async function rolesDropdown(request, response) {

    let params = request.query
    console.log('data_received',params)

    try {

        /** initialize_query_model **/
        const model = await RoleModel

        /** pagination_offset **/
        let page = params.startAt ? parseInt(params.startAt) : 1

        /** records_limit **/
        let perPage = params.perPage ? parseInt(params.perPage) : 10

        /** sort_configuration **/
        let sortBy = { createdAt: -1 }


        let $aggregate = [
            {
                $lookup: {
                    from: "roleTypes",
                    localField: "roleTypeId",
                    foreignField: "_id",
                    as: "roleType"
                }
            },
            {
                $unwind: {
                    path: '$roleType',
                    preserveNullAndEmptyArrays: true,
                },
            },
        ]

        /** apply_status_filter **/
        if (params.status) {
            $aggregate.push({
                $match: {
                    status: {
                        $eq: params.status,
                    },
                },
            })
        }
        /** apply_type_filter **/
        if (params.type) {
            let getRole = await RoleTypeModel.findOne({title:params.type})

            if(getRole)
            {
                $aggregate.push({
                    $match: {
                        roleTypeId: new ObjectId(getRole._id),
                    },
                })
            }
        }
        /** apply_search_filter **/

        if (params.keyword) {
            let key = params.keyword

            $aggregate.push({
                $match: {
                    $or: [
                        {
                            'title': RegExp(key, 'i'),
                        },
                    ],
                },
            })
        }

        let data = await model
            .aggregate([$aggregate])
            .sort(sortBy)
            .skip(perPage * (page - 1))
            .limit(perPage)
            .exec()

        $aggregate.push({
            $count: 'total',
        })
        const count = await model.aggregate($aggregate).exec()

        const total = count.length ? count[0].total : 0


        //generate_audit_entry
        let systemLogsData = {
            userId: request.user._id,
            userIp: request.ip,
            roleId: request.user.roleId,
            module: moduleName,
            action: 'getAll',
            data: data,
        }
        let systemLogs = await systemLogsHelper.composeSystemLogs(
            systemLogsData
        )


        let respData = {
            roles: data,
            pagination: {
                total: total,
                perPage: perPage,
                current: page,
                first: 1,
                last: total ? Math.ceil(total / perPage) : 1,
                next: page < Math.ceil(total / perPage) ? page + 1 : '',
            }
        }
        return sendResponse(response,moduleName,200,1,"Roles fetched",respData)


        } catch (error) {
        console.log('--- operation_09_error ---',error)
        return sendResponse(response,moduleName,500,0,"Something went wrong, please try again later.")
    }
}

/** create Roles **/
async function create(request, response) {
    let params = request.body;
  
    // check if the required keys are missing or not
    let checkKeys = await checkKeysExist(params, ["title","permissions"]);
    if (checkKeys) {
      return sendResponse(response, moduleName, 422, 0, checkKeys);
    }
    try {
      // check if record is already exists
      let check = await RoleModel.countDocuments({
        $or: [
          { "title": params.title },
        //   { "slug": params.slug },
        ],
      });
      if (check && check > 0) {
        return sendResponse(
          response,
          moduleName,
          422,
          0,
          "Role already exists with the given title or slug"
        );
      }
      let getRoleType = await RoleTypeModel.findOne(
        { title: "System Users" },
        { _id: 1 } // projection: only return the _id field
      );
      
      if (!getRoleType) {
        return sendResponse(response, moduleName, 422, 0, "Role type not found");
      }
      
      let roleTypeId = getRoleType._id; // this gives you just the ObjectId
      
      var record = new RoleModel();
      record.title = params.title;
      record.permissions = params.permissions;
      record.associatedUsers = 1;
      record.roleTypeId = roleTypeId;
      record.status = params.status || "active";
      record.createdBy = request.user._id;
      // create a new record
      let data = await record.save();
      // if created successfully
  
      if (data) {
        //create system logs
        let systemLogsData = {
          userId: request.user._id,
          userIp: request.ip,
          roleId: request.user.roleId,
          module: moduleName,
          action: "created",
          data: data,
        };
        let systemLogs = await systemLogsHelper.composeSystemLogs(systemLogsData);
  
        return sendResponse(
          response,
          moduleName,
          201,
          1,
          "Role has been created successfully",
          record
        );
      }
    } catch (error) {
      console.log("--- operation_46_error ---", error);
  
      return sendResponse(
        response,
        moduleName,
        500,
        0,
        "Something went wrong, please try again later."
      );
    }
  }

  /** update Role **/
async function update(request, response) {
    let params = request.body;
  
    // require _id for update
    let checkKeys = await checkKeysExist(params, ["_id"]);
    if (checkKeys) {
      return sendResponse(response, moduleName, 422, 0, checkKeys);
    }
  
    try {  
      // validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(params._id)) {
        return sendResponse(response, moduleName, 422, 0, "Invalid role _id provided");
      }
  
      // find existing role 
      let role = await RoleModel.findById(params._id);
      if (!role) {
        return sendResponse(response, moduleName, 404, 0, "Role not found");
      }
  
      // if the client is trying to change title, ensure no duplicate title (exclude current role)
      if (params.title && params.title !== role.title) {
        let dupCount = await RoleModel.countDocuments({
          title: params.title,
          _id: { $ne: role._id },
        });
        if (dupCount && dupCount > 0) {
          return sendResponse(response, moduleName, 422, 0, "Another role already exists with the given title");
        }
      }
  
      // get roleTypeId (same as create)
      let getRoleType = await RoleTypeModel.findOne(
        { title: "System Users" },
        { _id: 1 }
      );
      if (!getRoleType) {
        return sendResponse(response, moduleName, 422, 0, "Role type not found");
      }
      let roleTypeId = getRoleType._id;
  
      // update allowed fields (only update when provided)
      if (typeof params.title !== "undefined") role.title = params.title;
      if (typeof params.permissions !== "undefined") role.permissions = params.permissions;
      if (typeof params.status !== "undefined") role.status = params.status;
      if (typeof params.associatedUsers !== "undefined") role.associatedUsers = params.associatedUsers;
      // keep roleTypeId from system "System Users" (if you want to allow changing this, remove the next line)
      role.roleTypeId = roleTypeId;
      role.updatedAt = new Date();
      role.updatedBy = request.user._id;
  
      // save updated role
      let data = await role.save();
  
      if (data) {
        // create system logs
        let systemLogsData = {
          userId: request.user._id,
          userIp: request.ip,
          roleId: request.user.roleId,
          module: moduleName,
          action: "updated",
          data: data,
        };
        let systemLogs = await systemLogsHelper.composeSystemLogs(systemLogsData);
  
        return sendResponse(
          response,
          moduleName,
          200,
          1,
          "Role has been updated successfully",
          data
        );
      } else {
        return sendResponse(response, moduleName, 500, 0, "Failed to update role");
      }
    } catch (error) {
      console.log("--- operation_update_error ---", error);
      return sendResponse(
        response,
        moduleName,
        500,
        0,
        "Something went wrong, please try again later."
      );
    }
  }

  /** Get record by Id **/
async function getById(request, response) {
    let params = request.params;
  
    try {
      /** set model to fetch **/
        const model = await RoleModel;
  
      $aggregate = [
        {
          $lookup: {
            from: "systemUsers",
            localField: "createdBy",
            foreignField: "_id",
            as: "createdByDetails",
          },
        },
        {
          $unwind: {
            path: "$createdByDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
      ];
  
      $aggregate.push({
        $match: {
          _id: new ObjectId(params.roleId),
        },
      });
  
      let data = await model.aggregate([$aggregate]).exec();
  
      //create system logs
      let systemLogsData = {
        userId: request.user._id,
        userIp: request.ip,
        roleId: request.user.roleId,
        module: moduleName,
        action: "getById",
        data: data,
      };
      let systemLogs = await systemLogsHelper.composeSystemLogs(systemLogsData);
  
      let respData = {
        role: data[0],
      };
      return sendResponse(response, moduleName, 200, 1, "Role fetched", respData);
    } catch (error) {
      console.log("--- operation_44_error ---", error);
      return sendResponse(
        response,
        moduleName,
        500,
        0,
        "Something went wrong, please try again later."
      );
    }
  }
 /** Get All record **/
  async function getAll(request, response) {
    let params = request.query;
  
    try {
      /** set model to fetch all **/
      const model = await RoleModel;
  
      /** page number for pagination **/
      let page = params.startAt ? parseInt(params.startAt) : 1;
  
      /**  per page **/
      let perPage = params.perPage ? parseInt(params.perPage) : 10;
  
      /**  how to sort the list  **/
      let sortBy = { createdAt: -1 };
  
      $aggregate = [
        {
          $lookup: {
            from: "systemUsers",
            localField: "createdBy",
            foreignField: "_id",
            as: "createdByDetails",
          },
        },
        {
          $unwind: {
            path: "$createdByDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
      ];
  
      /** filter via status  **/
      if (params.status) {
        $aggregate.push({
          $match: {
            status: {
              $eq: params.status,
            },
          },
        });
      }
  
      /** filter via title or slug  **/
      if (params.keyword) {
        let key = params.keyword;

        $aggregate.push({
          $match: {
            $or: [
              {
                "title": RegExp(key, "i"),
              },
              {
                "slug": RegExp(key, "i"),
              },
            ],
          },
        });
      }

      /** apply_date_filter **/
      if (params.date) {
        const filterDate = new Date(params.date);
        if (!isNaN(filterDate)) {
          const startOfDay = new Date(filterDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(filterDate);
          endOfDay.setHours(23, 59, 59, 999);

          $aggregate.push({
            $match: {
              createdAt: {
                $gte: startOfDay,
                $lte: endOfDay,
              },
            },
          });
        }
      }
  
      let data = await model
        .aggregate([$aggregate])
        .sort(sortBy)
        .skip(perPage * (page - 1))
        .limit(perPage)
        .exec();
  
      $aggregate.push({
        $count: "total",
      });
      const count = await model.aggregate($aggregate).exec();
  
      const total = count.length ? count[0].total : 0;
  
      //create system logs
      let systemLogsData = {
        userId: request.user._id,
        userIp: request.ip,
        roleId: request.user.roleId,
        module: moduleName,
        action: "getAll",
        data: data,
      };
      let systemLogs = await systemLogsHelper.composeSystemLogs(systemLogsData);
  
      let respData = {
        roles: data,
        pagination: {
          total: total,
          perPage: perPage,
          current: page,
          first: 1,
          last: total ? Math.ceil(total / perPage) : 1,
          next: page < Math.ceil(total / perPage) ? page + 1 : "",
        },
      };
      return sendResponse(response, moduleName, 200, 1, "Roles fetched", respData);
    } catch (error) {
      console.log("--- operation_45_error ---", error);
      return sendResponse(
        response,
        moduleName,
        500,
        0,
        "Something went wrong, please try again later."
      );
    }
  }

  /** Delete roles **/
async function remove(request, response) {
    let params = request.params;
  
    try {
      const role = await RoleModel.findById(new ObjectId(params.roleId));
      if (!role) {
        return sendResponse(response, moduleName, 422, 0, "Role not found");
      }
  
      // Prevent deleting Admin or Super Admin
      const protectedRoles = ["admin", "super admin"];
        if (protectedRoles.includes(role.title.toLowerCase())) {
          return sendResponse(
            response,
            moduleName,
            403,
            0,
            `You cannot delete the ${role.title} role`
          );
        }
      // Delete permission
      const deleted = await RoleModel.findByIdAndDelete(
        new ObjectId(params.roleId)
      );
      if (!deleted) {
        return sendResponse(response, moduleName, 422, 0, "Role not found");
      }
  
      // Log system action
      let systemLogsData = {
        userId: request.user._id,
        userIp: request.ip,
        roleId: request.user.roleId,
        module: moduleName,
        action: "deleted",
        data: deleted,
      };
      await systemLogsHelper.composeSystemLogs(systemLogsData);
  
      return sendResponse(response, moduleName, 200, 1, "Role deleted successfully");
    } catch (error) {
      console.log("--- operation_47_error ---", error);
      return sendResponse(response, moduleName, 500, 0, "Something went wrong, please try again later.");
    }
  }
  
  




