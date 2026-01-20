const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const ObjectId = mongoose.Types.ObjectId;

const defaultSchema = new Schema(
  {
    title: {
      type: String,
      default: null,
      maxlength: 500,
    },
    slug: {
      type: String,
      default: null,
      maxlength: 500,
    },
    // type: {
    //   type: String,
    //   required: true,
    //   enum: ["manual", "automated"],
    //   default: "manual",
    // },
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

module.exports = model("Permission", defaultSchema, "permissions");
