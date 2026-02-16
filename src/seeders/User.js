const User = require('../models/SystemUsers')
const UserData = require('./data/User')
const bcrypt = require('bcryptjs')
const salt = parseInt(process.env.SALT)

async function run() {
    try {
        let added = 0
        let skipped = 0
        for (const item of UserData) {
            const existing = await User.findOne({
                $or: [{ email: item.email }, { username: item.username }],
            })
            if (!existing) {
                const userToCreate = {
                    ...item,
                    password: bcrypt.hashSync(item.password, salt),
                }
                await User.create(userToCreate)
                added++
            } else {
                skipped++
            }
        }
        console.log('process_35_completed', { added, skipped })
    } catch (e) {
        console.log('operation_36_error:', e)
    }
}

module.exports = {
    userSeeder: run,
}
