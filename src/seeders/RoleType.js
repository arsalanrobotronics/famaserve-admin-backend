const RoleType = require('../models/RoleType');
let RoleTypeData = require('./data/RoleType'); // Use let instead of var
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

async function run() {
    try {
        console.log('process_26_initiated');
        await RoleType.collection.drop();
        RoleTypeData =await RoleTypeData.map(data => ({
            ...data,
            _id: new ObjectId(data._id), // Convert _id to ObjectId
        }));
        await RoleType.insertMany(RoleTypeData);
        console.log('process_27_completed');
    } catch (e) {
        console.log('operation_28_error:', e);
        if (e.code === 26) {
            console.log('entity_missing:', RoleType.collection.name);
            console.log('process_29_completed');
            RoleTypeData = await RoleTypeData.map(data => ({
                ...data,
                _id: new ObjectId(data._id), // Convert _id to ObjectId
            }));
            await RoleType.insertMany(RoleTypeData);
        } else {
            console.log('operation_30_error:', e);
        }
    }
}

module.exports = {
    roleTypeSeeder: run,
};
