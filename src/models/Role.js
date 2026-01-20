// dependencies
const mongoose = require('mongoose')
const Schema = mongoose.Schema
const ObjectId = mongoose.Types.ObjectId

// entity_structure_definition
const roleSchema = new Schema({
    title: {
        type: String,
        required: true,
        maxlength: 50,
        unique: true,
    },
    associatedUsers: {
        type: Number,
        default: 0,
    },
    roleTypeId: {
        type: ObjectId,
        required: true,
        ref: 'RoleType',
    },
    permissions: {
        type: [String],
        required: true,
    },
    status: {
        type: String,
        enum: ['locked', 'active', 'archived'],
        default: 'active',
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
})

roleSchema.set('toJSON', { virtuals: true })
module.exports =
    mongoose.models.Role || mongoose.model('Role', roleSchema, 'roles')
