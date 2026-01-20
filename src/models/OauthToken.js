const mongoose = require("mongoose");
const { Schema } = mongoose;

const oauthTokenSchema = new Schema({
  name: { type: String, required: true },
  scopes: { type: [String] }, // Assuming scopes are strings, adjust as needed
  userId: { type: Schema.Types.ObjectId, required: true },
  clientId: { type: Schema.Types.ObjectId, required: true },
  revoked: { type: Boolean, default: false },
  channel: { type: String },
  revokedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: Date.now },
});

oauthTokenSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("OauthToken", oauthTokenSchema, "oauthTokens");
