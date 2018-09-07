var jsonwebtoken = require('jsonwebtoken');

module.exports = {
    loadPriority: 999,
    startPriority: 999,
    stopPriority: 999,

    initialize: function(api, next) {

        var jwtMiddleware = {
            name: 'jwt token validator',
            global: true,
            preProcessor: function(data, next) {

                // for actions that want to ignore JWT alltogether
                if (data.actionTemplate.ignoreJWT) {
                  return next();
                }

                // is it required to have a valid token to access an action?
                var tokenRequired = false;
                if (data.actionTemplate.authenticate && api.config.jwtauth.enabled[data.connection.type]) {
                    tokenRequired = true;
                }

                // get request data from the required sources
                var token = '';
                var req = {
                    headers: data.params.httpHeaders || (data.connection.rawConnection.req ? data.connection.rawConnection.req.headers : undefined) || data.connection.mockHeaders || {},
                    uri: data.connection.rawConnection.req ? data.connection.rawConnection.req.uri : {}
                };

                var authHeader = req.headers.authorization ||  req.headers.Authorization ||  false;

                // extract token from http headers
                if (authHeader) {
                    var parts = authHeader.split(' ');
                    if (parts.length != 2 || parts[0].toLowerCase() !== 'token') {
                    
                    	// return error if token was required and missing
                    	if ( tokenRequired ) {
							return next({
								code: 500,
								message: 'Invalid Authorization Header'
							});
						}
						else {
							return next();
						}

                    }
                    token = parts[1];
                }

                // if GET parameter for tokens is allowed, use it
                if (!token && api.config.jwtauth.enableGet && req.uri.query && req.uri.query.token) {
                    token = req.uri.query.token;
                }

				// return error if token was missing but marked as required
                if (tokenRequired && !token) {
                    return next({
                        code: 500,
                        message: 'Authorization Header Not Set'
                    });
                }
                
				// process token and save in connection
                else if (token) {
					api.jwtauth.processToken(token, function(tokenData) {
						data.connection._jwtTokenData = tokenData;
						next();
					}, next);
				}
				
				else {
					return next();
				}

            },

            stop: function(api, next) {
                next();
            }
        }

        api.actions.addMiddleware(jwtMiddleware);
        next();
    }
};
