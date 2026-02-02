const Permission = require('../models/Permissions')
const PermissionData = require('./data/Permission.json')

async function run() {
    try {
        await Permission.collection.drop()
        await Permission.insertMany(PermissionData)
        console.log('process_permissions_seeder_completed')
    } catch (e) {
        console.log('operation_permissions_seeder_error:', e)
        if (e.code === 26) {
            console.log('entity_missing:', Permission.collection.name)
            console.log('process_permissions_seeder_completed')
            await Permission.insertMany(PermissionData)
        } else {
            console.log('operation_permissions_seeder_error:', e)
        }
    }
}

module.exports = {
    permissionSeeder: run,
}
