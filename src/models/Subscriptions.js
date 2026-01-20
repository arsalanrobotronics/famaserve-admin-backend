const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const ObjectId = mongoose.Types.ObjectId;

const defaultSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      default: null,
      maxlength: 1000,
    },
    amount: {
      type: Number,
      required: true,
      default: null,
    },
    description: {
      type: String,
      default: null,
      maxlength: 10000,
    },
    status: {
      type: String,
      required: true,
      enum: ["active", "inactive"],
      default: "active",
    },
    createdBy: {
      type: ObjectId,
      default: null,
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
  },
  { toJSON: { virtuals: true } }
);

/** modify_collection_identifier_per_environment **/

module.exports = model("Subscription", defaultSchema, "subscriptions");
