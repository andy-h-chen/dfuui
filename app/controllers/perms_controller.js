var utils    = require('../../lib/utils'),
    _        = require('underscore'),
    NotFound = utils.NotFound,
    checkErr = utils.checkErr,
    log      = console.log,
    PermissionsController;

PermissionsController = function(app, mongoose, config) {

    var Permission = mongoose.model('Permission');

    app.get(app.v1 + '/perms', app.canAccessAdmin, function index(req, res, next) {
        console.log(req.url, req.query);
    
        Permission.find(function(err, perms) {
            // TODO: finish etag support here, check for If-None-Match
            //res.header('ETag', utils.etag(perms));
            res.json(perms);
        });
    });

    app.get(app.v1 + '/perms/:id', app.canAccessAdmin, function show(req, res, next) {
        console.log(req.url, req.params.id);
        Permission.findById(req.params.id, function(err, perm) {
            console.log(err, perm);
            checkErr(
                next,
                [{ cond: err }, { cond: !perm, err: new NotFound('json') }],
                function() {
                    // TODO: finish etag support here, check for If-None-Match
                    res.header('ETag', utils.etag(perm));
                    res.json(perm);
                }
            );
        });
    });
    app.delete(app.v1 + '/perms/:id', app.canAccessAdmin, function destroy(req, res, next) {
        Permission.findById(req.params.id, function(err, perm) {
            checkErr(
                next,
                [{ cond: err }, { cond: !perm, err: new NotFound('json') }],
                function() {
                    perm.remove();
                    res.json({});
                }
            );
        });
    });
    app.put(app.v1 + '/perms/:id', app.canAccessAdmin, function update(req, res, next) {
        Permission.findById(req.params.id, function(err, perm) {
            checkErr(
                next,
                [{ cond: err }, { cond: !perm, err: new NotFound('json') }],
                function() {
                    var newAttributes;

                    // modify resource with allowed attributes
                    newAttributes = _.pick(req.body, 'name', 'key');
                    perm = _.extend(perm, newAttributes);

                    perm.save(function(err) {
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


    app.post(app.v1 + '/perms', app.canAccessAdmin, function create(req, res, next) {
        log('app.post', req.url);
        var newPerm;

        // disallow other fields besides those listed below
        newPerm = new Permission(_.pick(req.body, 'name', 'key'));
        newPerm.save(function(err) {
            var errors, code = 200, loc;

            if (!err) {
                loc = config.site_url + app.v1 + '/perms/' + newPerm._id;
                res.setHeader('Location', loc);
                res.json(newPerm, 201);
            } else {
                errors = utils.parseDbErrors(err, config.error_messages, 'key' /* unique field */);
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

module.exports = PermissionsController;
