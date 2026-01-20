// dependencies
const mongoose = require('mongoose')
const { Schema, model } = mongoose;

// entity_structure_definition
const roleTypeSchema = new Schema({

    title: {
        type: String,
        required: true,
        maxlength: 50,
        unique: true,
    },
    status: {
        type: String,
        enum: ['locked', 'active', 'archived'],
        default: 'active',
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
})

roleTypeSchema.set('toJSON', { virtuals: true })
module.exports = model('RoleType', roleTypeSchema, 'roleTypes');

