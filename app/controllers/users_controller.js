var v1       = '/api/v1',
    utils    = require('../../lib/utils'),
    _        = require('underscore'),
    passwordhasher = require('password-hasher'),
    NotFound = utils.NotFound,
    checkErr = utils.checkErr,
    log      = console.log,
    UsersController;

UsersController = function(app, mongoose, config) {

    var User = mongoose.model('User');

    app.get(v1 + '/users', app.canAccessAdmin, function index(req, res, next) {
        console.log(req.url, req.query);
    
        User.search({query: req.query, fields:{username:1, email:1}}, function(err, users) {
            checkErr(
                next,
                [{ cond: err }],
                function() {
                    // TODO: finish etag support here, check for If-None-Match
                    res.header('ETag', utils.etag(users));
                    res.json(users);
                }
            );
        });
    });

    app.get(v1 + '/users/:id', app.canAccessAdmin, function show(req, res, next) {
        User.findById(req.params.id, true, function(err, user) {
            checkErr(
                next,
                [{ cond: err }, { cond: !user, err: new NotFound('json') }],
                function() {
                    // TODO: finish etag support here, check for If-None-Match
                    res.header('ETag', utils.etag(user));
                    res.json(user);
                }
            );
        });
    });
    app.put(app.v1 + '/users/:id', app.canAccessAdmin, function update(req, res, next) {
        User.findById(req.params.id, false /* details */, function(err, user) {
            checkErr(
                next,
                [{ cond: err }, { cond: !user, err: new NotFound('json') }],
                function() {
                    var newAttributes;

                    // modify resource with allowed attributes
                    newAttributes = _.pick(req.body, 'email', 'roles_id', 'perms', 'dfus_id');
                    user = _.extend(user, newAttributes);

                    user.calculateAllPerms(user, function(err, u) {
                        if (err) {
                             errors = utils.parseDbErrors(err, config.error_messages);
                             if (errors.code) {
                                 code = errors.code;
                                 delete errors.code;
                                 log(err);
                             }
                             res.json(errors, code);
                             return;
                        }
                        u.save(function(err) {
                            var errors, code = 200;

                            if (!err) {
                                res.send();
                            } else {
                                errors = utils.parseDbErrors(err, config.error_messages);
                                if (errors.code) {
                                    code = errors.code;
                                    delete errors.code;
                                    log(err);
                                }
                                res.json(errors, code);
                            }
                        });
                    });
                }
            );
        });
    });

  app.post(v1 + '/users', app.canAccessAdmin, function create(req, res, next) {
    log('app.post', req.url);
    var newUser;
   // disallow other fields besides those listed below
    newUser = new User(_.pick(req.body, 'username', 'email', 'password', 'pwr', 'roles_id', 'perms'));
    console.log(newUser);
    var hash = passwordhasher.createHash('ssha512', newUser.password, new Buffer(app.salt));
    var result = hash.hash.toString('hex');
    newUser.password = result;
     /*
    if (!newUser.pw || !newUser.pwr || newUser.pw !== newUser.pwr) {
        var err = {};
        err.password = 'Does not match.';
        err.passwordrepeat = 'Does not match';
        res.json({errors: err}, 200);
        return;
    }*/
    console.log('before save');
    newUser.calculateAllPerms(newUser, function(err, u) {
        console.log(u);
        if (err) {
             errors = utils.parseDbErrors(err, config.error_messages);
             if (errors.code) {
                 code = errors.code;
                 delete errors.code;
                 log(err);
             }
             res.json(errors, code);
             return;
        }
        u.save(function(err) {
            var errors, code = 200;

            if (!err) {
                loc = config.site_url + app.v1 + '/users/' + newUser._id;
                res.setHeader('Location', loc);
                res.json(newUser, 201);
            } else {
                errors = utils.parseDbErrors(err, config.error_messages);
                if (errors.code) {
                    code = errors.code;
                    delete errors.code;
                    log(err);
                }
                res.json(errors, code);
            }
        });
    });

  });

  app.delete(v1 + '/users/:id', app.canAccessAdmin, function destroy(req, res, next) {
    User.findById(req.params.id, false /* details */, function(err, user) {
      checkErr(
        next,
        [{ cond: err }, { cond: !user, err: new NotFound('json') }],
        function() {
          user.remove();
          res.json({});
        }
      );
    });
  });
};

module.exports = UsersController;
