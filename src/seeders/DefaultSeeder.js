const defaultModel = require('../models/SystemUsers')
var defaultData = require('./data/User')
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

async function run() {
    try {
        await defaultModel.collection.drop()
        await defaultModel.insertMany(defaultData)
        console.log('process_31_completed')
    } catch (e) {
        console.log('operation_32_error:', e)
        if (e.code === 26) {
            console.log('entity_missing:', defaultModel.collection.name)
            console.log('process_33_completed')
            await defaultModel.insertMany(defaultData)
        } else {
            console.log('operation_34_error:', e)
        }
    }
}

module.exports = {
    run,
}
