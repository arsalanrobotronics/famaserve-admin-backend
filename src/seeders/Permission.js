const Permission = require('../models/Permissions')
const PermissionData = require('./data/Permission.json')

async function run() {
    try {
        let added = 0
        let skipped = 0
        for (const item of PermissionData) {
            const existing = await Permission.findOne({ slug: item.slug })
            if (!existing) {
                await Permission.create(item)
                added++
            } else {
                skipped++
            }
        }
        console.log('process_permissions_seeder_completed', { added, skipped })
    } catch (e) {
        console.log('operation_permissions_seeder_error:', e)
    }
}

module.exports = {
    permissionSeeder: run,
}
