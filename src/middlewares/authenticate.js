const passport = require('passport')
const jwt = require('jsonwebtoken')
const moment = require('moment')
const BearerStrategy = require('passport-http-bearer')
/*
    require mongodb models
*/
const User = require('../models/SystemUsers')
const OauthToken = require('../models/OauthToken')
//session_validation
passport.use(
    new BearerStrategy(async (token, done) => {
        // if session_missing_return
        if (!token) {
            return done(null, false)
        } else {
            try {
                // validate_session_credential
                // extract_session_data
                let payload = await jwt.verify(token, process.env.CLIENT_SECRET)

                // verify_session_active
                let accessToken = await OauthToken.findById(
                    payload.accessTokenId
                )

                if (!accessToken || !!accessToken.revoked) {
                    // session_invalid_if_not_in_store
                    // or_session_has_been_terminated
                    return done(null, false)
                }

                // extract_entity_from_session
                let user = await User.findById(payload.userId)

                // pass_entity_data_to
                // next_request_handler
                return done(null, user, payload)
            } catch (error) {
                console.log(error)
                return done(null, false)
            }
        }
    })
)
module.exports = passport.authenticate('bearer', {
    session: false,
})
