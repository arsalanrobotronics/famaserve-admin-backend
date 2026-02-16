const RoleType = require('../models/RoleType');
const RoleTypeData = require('./data/RoleType');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

async function run() {
    try {
        console.log('process_26_initiated');
        let added = 0
        let skipped = 0
        for (const data of RoleTypeData) {
            const existing = await RoleType.findOne({
                $or: [{ _id: new ObjectId(data._id) }, { title: data.title }],
            });
            if (!existing) {
                await RoleType.create({
                    ...data,
                    _id: new ObjectId(data._id),
                });
                added++;
            } else {
                skipped++;
            }
        }
        console.log('process_27_completed', { added, skipped });
    } catch (e) {
        console.log('operation_28_error:', e);
    }
}

module.exports = {
    roleTypeSeeder: run,
};
