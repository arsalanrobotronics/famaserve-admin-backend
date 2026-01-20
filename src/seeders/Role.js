const Role = require('../models/Role')
const RoleData = require('./data/Role')

async function run() {
    try {
        await Role.collection.drop()
        await Role.insertMany(RoleData)
        console.log('process_22_completed')
    } catch (e) {
        console.log('operation_23_error:', e)
        if (e.code === 26) {
            console.log('entity_missing:', Role.collection.name)
            console.log('process_24_completed')
            await Role.insertMany(RoleData)
        } else {
            console.log('operation_25_error:', e)
        }
    }
}

module.exports = {
    roleSeeder: run,
}
