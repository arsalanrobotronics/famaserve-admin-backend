const Role = require('../models/Role')
const RoleData = require('./data/Role')

async function run() {
    try {
        let added = 0
        let merged = 0
        let skipped = 0
        for (const item of RoleData) {
            const existing = await Role.findOne({ title: item.title })
            if (!existing) {
                await Role.create(item)
                added++
            } else {
                const newPerms = (item.permissions || []).filter(
                    (p) => !existing.permissions.includes(p)
                )
                if (newPerms.length > 0) {
                    existing.permissions = [...existing.permissions, ...newPerms]
                    await existing.save()
                    merged++
                } else {
                    skipped++
                }
            }
        }
        console.log('process_22_completed', { added, merged, skipped })
    } catch (e) {
        console.log('operation_23_error:', e)
    }
}

module.exports = {
    roleSeeder: run,
}
