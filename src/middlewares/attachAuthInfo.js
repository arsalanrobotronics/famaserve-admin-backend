const jwt = require("jsonwebtoken");

/**
 * Extracts JWT payload and sets req.authInfo.scopes for use by check-scopes middleware.
 * Must run after Authenticate (so token is already verified).
 */
module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.authInfo = { scopes: [] };
    return next();
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.decode(token);
    req.authInfo = {
      scopes: Array.isArray(decoded?.scopes) ? decoded.scopes : [],
    };
  } catch {
    req.authInfo = { scopes: [] };
  }
  next();
};
