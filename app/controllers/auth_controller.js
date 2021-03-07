var v1          = '/api/v1',
    express     = require('express'),
    utils       = require('../../lib/utils'),
    _           = require('underscore'),
    socketio_jwt = require('socketio-jwt'),
    jwt         = require('jsonwebtoken'),
    LocalStrategy  = require('passport-local').Strategy,
    //bcrypt      = require('bcrypt-nodejs'),
    passwordhasher = require('password-hasher'),
    serveIndex  = require('serve-index'),
    NotFound    = utils.NotFound,
    checkErr    = utils.checkErr,
    AuthController;

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

    app.use(protectPath([
        {path: /\/dfu\//, authorize: function(req) { return req.isAuthenticated(); }},
        {path: /\/admin\//, authorize: function(req) { return req.isAuthenticated() && req.user.hasAccess('access_admin'); }}
    ]));

    var directlyForward = function(req, res, next) {
        console.log('directlyForward', req.user);
        if (req.user && req.user.username !== app.demo.user) {
            var user = req.user;
            var token = jwt.sign(user._id, config.JWT_SECRET, {expiresInMinutes: 300});
            req.foo = 'bar';
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

   var doAuthentication = function(req, res, next) {
        app.logger.info('doAuthentication Login attempt: ', req.body.username, req.params.username, req.query.username);
        passport.authenticate('local', function(err, user, info) {
            if (err) {
                app.logger.error('doAuthentication error occurred: ', err);
                return next(err);
            }
            if (!user) {
                app.logger.info('doAuthentication user does not exist.');
                doResponse(req, res, {json: {error: 'Username does not exist.', errorId: 1}, redirect: '/?1'});
                return;
            }
            req.logIn(user, function(err) {
                if (err) {
                    app.logger.error('doAuthentication req.logIn error occurred: ', err);
                    doResponse(req, res, {json: {error: err, errorId: 2}, redirect: '/?2'});
                } else {
                    app.logger.info('doAuthentication user ' + user.username + ' logged in');
                    var token = jwt.sign(user._id, config.JWT_SECRET, {expiresInMinutes: 300});
                    var result = {};
                    result.json = {user: {'_id': user._id, 'username': user.username, 'email': user.email, 'all_perms': user.all_perms}, 'token': token};
                    if (isWIP) {
                        result.redirect = '/dfu/dfu_bruyere.html?' + token;
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
