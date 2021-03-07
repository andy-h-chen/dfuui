var v1          = '/api/v1',
    express     = require('express'),
    utils       = require('../../lib/utils'),
    _           = require('underscore'),
    socketio_jwt = require('socketio-jwt'),
    jwt         = require('jsonwebtoken'),
    LocalStrategy  = require('passport-local').Strategy,
    //bcrypt      = require('bcrypt-nodejs'),
     passportJWT = require("passport-jwt"),
     JWTStrategy   = passportJWT.Strategy,
     ExtractJWT = passportJWT.ExtractJwt,
    passwordhasher = require('password-hasher'),
    serveIndex  = require('serve-index'),
    crypto = require('crypto'),
    NotFound    = utils.NotFound,
    checkErr    = utils.checkErr,
    ENV = process.env.NODE_ENV || 'development',
    AuthController;


function getTURNCredentials(name, secret){    

    var unixTimeStamp = parseInt(Date.now()/1000) + 24*3600,   // this credential would be valid for the next 24 hours
        username = [unixTimeStamp, name].join(':'),
        password,
        hmac = crypto.createHmac('sha1', secret);
    hmac.setEncoding('base64');
    hmac.write(username);
    hmac.end();
    password = hmac.read();
    return {
        username: username,
        password: password
    };
}

AuthController = function(app, mongoose, passport, config) {
    //var isWIP = config.URL.includes('wip');
    var isWIP = false;
    var doResponse = function(req, res, result) {
        if (req.xhr) {
            res.json(result.json);
        } else {
            res.redirect(result.redirect);
        }
    };
    var protectPath = function(protectedPath) {
        return function(req, res, next) {
            var pass = true;
            for(var i=0; i<protectedPath.length; i++) {
                pass &= !protectedPath[i].path.test(req.url) || protectedPath[i].authorize(req);
            }
            if (pass) return next();
            var result = {};
            result.json = {error: 'Unauthorized'};
            result.redirect = '/?3';
            doResponse(req, res, result);
        };
    };
    // For wip only
    app.use('/ui', serveIndex(__dirname + '/../../public/ui', {'icons': true}));

    // Temporarily disable for new admin page
    
    app.use(protectPath([
        {path: /\/dfu\//, authorize: function(req) { console.log('protectPath', req.isAuthenticated(), req.user ? req.user.username : null); return req.isAuthenticated(); }}
        //{path: /\/admin\//, authorize: function(req) { return req.isAuthenticated() && req.user.hasAccess('access_admin'); }}
    ]));
    

    var directlyForward = function(req, res, next) {
        console.log('directlyForward', req.user ? req.user.username : null);
        if (req.user && req.user.username !== app.demo.user) {
            var user = req.user;
            var token = jwt.sign(user._id, config.JWT_SECRET, {expiresInMinutes: 300});
            if (isWIP) {
                res.redirect('/dfu/dfu_bruyere.html?' + token);
            } else {
                res.redirect('/dfu/dfu.html?' + token);
            }
        } else {
            next();
        }
    };
    app.get('/', directlyForward);
    app.get('/index.html', directlyForward);
    app.get('/demo', function(req, res, next) {
        req.body = {username: app.demo.user, password: app.demo.pass};
        doAuthentication(req, res, next);
    });

    app.use('/', express['static'](__dirname + '/../../public'));
    app.use(v1 + '/admin/dailylogs', express['static'](__dirname + '/../../logs'));
    app.use('/jqm', express['static'](__dirname + '/../../node_modules/jquery-mobile/dist'));
    var User = mongoose.model('User');
    
    passport.use(new JWTStrategy({
            jwtFromRequest: ExtractJWT.fromHeader('x-access-token'),
            secretOrKey   : config.JWT_SECRET
        },
        function (jwtPayload, done) {
          console.log('jwtPayload = ', jwtPayload);
          if (jwtPayload.agentId !== '') {
            return done(null, jwtPayload);
          } else {
            return done({err:'no permission'});
          }
            //find the user in db if needed. This functionality may be omitted if you store everything you'll need in JWT payload.
            /*
            User.findById(jwtPayload._id, false, function(err, user) {
              if (err) {
                return done(err);
              }
              if (user && user.agentId !== '') {
                return done(null, user);
              } else {
                return done(err);
              }
            });*/
        }
    ));
    passport.use(new LocalStrategy(
        function(username, password, done) {
            process.nextTick(function() {
                User.findByUsername(username, function(err, user) {
                    if (err) {
                        return done(err);
                    }
                    if (!user) {
                        return done(null, false, {message: 'Unknown user' + username});
                    }
                    var hash = passwordhasher.createHash('ssha512', password, new Buffer(app.salt));
                    var result = hash.hash.toString('hex');
                    if (result === user.password) {
                        return done(null, user);
                    } else {
                        return done(null, false, {message: 'Invalid password'});
                    }
                    /*
                    bcrypt.compare(password, user.password, function(err, res) {
                        if (err) {
                            app.logger.error('Error occurred during bcrypt.compare', err);
                        }
                        if(res) {
                            return done(null, user);
                        } else {
                            return done(null, false, {message: 'Invalid password'});
                        }
                    });*/
                })
            });
        }
    ));

    // Passport setup
    passport.serializeUser(function(user, done) {
        done(null, user.id);
    });

    passport.deserializeUser(function(id, done) {
        User.findById(id, false, function(err, user) {
            done(err, user);
        });
    });
    
    app.hasPermission = passport.authenticate('jwt', {session: false});
    
   var doAuthentication = function(req, res, next) {
        app.logger.info('doAuthentication Login attempt: ', req.body.username, req.params.username, req.query.username);
        var targetAdmin = req.body.target === 'admin';
        passport.authenticate('local', function(err, user, info) {
            if (err) {
                app.logger.error('doAuthentication error occurred: ', err);
                return next(err);
            }
            if (!user) {
                app.logger.info('doAuthentication user does not exist.');
                if (targetAdmin) {
                    res.status(401).send({auth: false, token: null});
                } else {
                    doResponse(req, res, {json: {error: 'Username does not exist.', errorId: 1}, redirect: '/?1'});
                }
                return;
            }
            console.log('doAuthentication user.agentId = ', user.agentId);
            //targetAdmin = targetAdmin || user.username == 'admin';
            if (targetAdmin && (user.agentId === '' || !user.agentId)) {
                res.status(401).send({auth: false, token: null});
                return;
            }
            req.logIn(user, function(err) {
                if (err) {
                    app.logger.error('doAuthentication req.logIn error occurred: ', err);
                    doResponse(req, res, {json: {error: err, errorId: 2}, redirect: '/?2'});
                } else {
                    app.logger.info('doAuthentication user ' + user.username + ' logged in');
                    console.log('user_id = ', user._id);
                    var token;
                    if (targetAdmin)
                        token = jwt.sign({_id: user._id, agentId: user.agentId, email: user.email}, config.JWT_SECRET, {expiresInMinutes: 300});
                    else
                        token = jwt.sign(user._id, config.JWT_SECRET, {expiresInMinutes: 300});
                    var result = {};
                    result.json = {user: {'_id': user._id, 'username': user.username, 'email': user.email, 'all_perms': user.all_perms}, 'token': token};
                    if (isWIP) {
                        result.redirect = '/dfu/dfu_bruyere.html?' + token;
                    } else if (targetAdmin){
                        // TODO: remove ACAO
                        if (ENV === 'development') {
                          res.header('Access-Control-Allow-Origin', 'http://' + config.DOMAIN_NAME + ':3000');
                        }
                        res.json({auth: true, token: token, user: {_id: user._id, username: user.username, agentId: user.agentId}});
                        return;
                    } else {
                        result.redirect = '/dfu/dfu.html?' + token;
                    }
                    doResponse(req, res, result);
                }
            });
        })(req, res, next);
    };

    app.post(v1 + '/auth/login', function(req, res, next) {
        doAuthentication(req, res, next);
    });

    app.get(v1 + '/auth/login', function(req, res, next) {
        doAuthentication(req, res, next);
    });
    app.get(v1 + '/auth/loginbyid/:token', passport.authenticate('token'), function(req, res, next) {
        res.redirect('/dfu.html?' + jwt.sign(req.user._id, config.JWT_SECRET, {expiresInMinutes: 300}));
    });
    var logout = function(req, res, next) {
        app.logger.info('logout ' + (req.user ? req.user.username : 'no user'));
        if (req.isAuthenticated()) {
            req.logout();
            req.session.destroy();
            console.log(req.isAuthenticated());
            var result = {};
            result.redirect = '/';
            result.json = {};
            doResponse(req, res, result);
            //req.session.messages = req.i18n.__("Log out successfully.");
        } else {
            var result = {};
            result.json = {error: 'Please log in.'};
            result.redirect = '/';
            doResponse(req, res, result);
        }
    };
    app.post(v1 + '/auth/logout', app.ensureAuthenticated, logout);
    app.get(v1 + '/auth/logout', logout);
    
    app.get('/getcredential', function(req, res, next) {
      var username = req.query.username;
      if (username != null) {
        var cred = getTURNCredentials(username, config.TURN_SECRET_KEY);
        res.json(cred);
      } else {
        res.status(401).send('no username');
      }
    });

    app.post(v1 + '/auth/changepassword', app.ensureAuthenticated, function(req, res, next) {
        console.log('changepassword', req.body.oldPassword, req.body.newPassword, req.body.repeat);
        var hash = passwordhasher.createHash('ssha512', req.body.oldPassword, new Buffer(app.salt));
        var result = hash.hash.toString('hex');
        if (result !== req.user.password) {
            res.json({error: 'Old password incorrect.'});
            return;
        }
        if (req.body.newPassword !== req.body.repeat) {
            res.json({error: 'New password and repeat don\'t match.'});
            return;
        }
        if (req.body.newPassword.length < 5) {
            res.json({error: 'New password must be at least 5 characters.'});
            return;
        }
        hash = passwordhasher.createHash('ssha512', req.body.newPassword, new Buffer(app.salt));
        result = hash.hash.toString('hex');
        User.update({_id: req.user._id}, {$set: { password: result}}, function(err, numAffected) {
            if (err) {
                logger.error(err);
                res.json({error: 'Error occurred during changing password.'});
            } else {
                res.json({numAffected: numAffected});
            }
        });
/*        bcrypt.compare(req.body.oldPassword, req.user.password, function(err, res) {
            if (err) {
                logger.error('Error occurred on bcrypt.compare', err);
                res.json({error: 'Error occurred during changing password.'});
                return;
            }
            if (!res) {
                res.json({error: 'Old password incorrect.'});
                return;
            }
            bcrypt.hash(req.body.newPassword, app.salt, function(err, hash) {
                if (err) {
                    logger.error('Error occurred on bcrypt.hash', err);
                    res.json({error: 'Error occurred during changing password.'});
                    return;
                }
                User.update({_id: req.user._id}, {$set: {password: hash}}, function(err, numAffected) {
                    if (err) {
                        logger.error(err);
                        res.json({error: err});
                    } else {
                        res.json({numAffected: numAffected});
                    }
                });

            });
        });*/
    });

    app.post(v1 + '/auth/loggedIn', function(req, res, next) {
        if (req.user) {
            var user = req.user;
            var token = jwt.sign(user, config.JWT_SECRET, {expiresInMinutes: 300});
            res.json({user: {'_id': user._id, 'username': user.username, 'email': user.email, 'all_perms': user.all_perms}, token: token});
        } else {
            res.json({error: 'Please login.'});
        }
    });
};

module.exports = AuthController;
