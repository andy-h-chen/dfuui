var utils    = require('../../lib/utils'),
    _        = require('underscore'),
    NotFound = utils.NotFound,
    checkErr = utils.checkErr,
    log      = console.log,
    RolesController;

RolesController = function(app, mongoose, config) {

    var Role = mongoose.model('Role');

    app.get(app.v1 + '/roles', app.canAccessAdmin, function index(req, res, next) {
        console.log(req.url, req.query);
    
        Role.find(function(err, roles) {
            // TODO: finish etag support here, check for If-None-Match
            //res.header('ETag', utils.etag(perms));
            console.log(roles);
            res.json(roles);
        });
    });

    app.get(app.v1 + '/roles/:id', app.canAccessAdmin, function show(req, res, next) {
        console.log(req.url, req.params.id);
        Role.findById(req.params.id, true, function(err, role) {
            checkErr(
                next,
                [{ cond: err }, { cond: !role, err: new NotFound('json') }],
                function() {
                    res.header('ETag', utils.etag(role));
                    res.json(role);
                }
            );
        });
    });
    app.delete(app.v1 + '/roles/:id', app.canAccessAdmin, function destroy(req, res, next) {
        Role.findById(req.params.id, false /* details */, function(err, role) {
            checkErr(
                next,
                [{ cond: err }, { cond: !role, err: new NotFound('json') }],
                function() {
                    role.remove();
                    res.json({});
                }
            );
        });
    });
    app.put(app.v1 + '/roles/:id', app.canAccessAdmin, function update(req, res, next) {
        Role.findById(req.params.id, false /* details */, function(err, role) {
            checkErr(
                next,
                [{ cond: err }, { cond: !role, err: new NotFound('json') }],
                function() {
                    var newAttributes;

                    // modify resource with allowed attributes
                    newAttributes = _.pick(req.body, 'name', 'permissions_id');
                    role = _.extend(role, newAttributes);

                    role.save(function(err) {
                        var errors, code = 200;

                        if (!err) {
                            // send 204 No Content
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
                }
            );
        });
    });


    app.post(app.v1 + '/roles', app.canAccessAdmin, function create(req, res, next) {
        log('app.post', req.url);
        var newRole;

        // disallow other fields besides those listed below
        newRole = new Role(_.pick(req.body, 'name', 'permissions_id'));
        newRole.save(function(err) {
            var errors, code = 200, loc;
            if (!err) {
                loc = config.site_url + app.v1 + '/roles/' + newRole._id;
                res.setHeader('Location', loc);
                res.json(newRole, 201);
            } else {
                errors = utils.parseDbErrors(err, config.error_messages, 'name' /* unique field */);
                if (errors.code) {
                    code = errors.code;
                    delete errors.code;
                    // TODO: better better logging system
                    log(err);
                }
                res.json(errors, code);
            }
        });
    });
};

module.exports = RolesController;
