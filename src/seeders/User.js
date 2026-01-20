const User = require('../models/SystemUsers')
const UserData = require('./data/User')
const _ = require('lodash')
const bcrypt = require('bcryptjs')
const salt = parseInt(process.env.SALT)
async function run() {
    try {
        _.each(UserData, function(item, index) {
            item.password = bcrypt.hashSync(item.password, salt)
        })
        await User.collection.drop()
        await User.insertMany(UserData)
        console.log('process_35_completed')

    } catch (e) {
        if (e.code === 26) {
            console.log('entity_missing')
            await User.insertMany(UserData)

        } else {
            console.log('operation_36_error:', e)

        }
    }
}

module.exports = {
    userSeeder: run,
}
